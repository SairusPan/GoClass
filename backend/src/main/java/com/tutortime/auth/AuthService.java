package com.tutortime.auth;

import com.tutortime.auth.dto.AuthResponse;
import com.tutortime.auth.dto.InstitutionResponse;
import com.tutortime.auth.dto.LoginRequest;
import com.tutortime.auth.dto.RegisterRequest;
import com.tutortime.common.AppException;
import com.tutortime.email.EmailService;
import com.tutortime.schedule.DemoSeedService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private final InstitutionRepository repository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final DemoSeedService demoSeedService;
    private final EmailService emailService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public AuthService(
            InstitutionRepository repository,
            BCryptPasswordEncoder passwordEncoder,
            JwtService jwtService,
            DemoSeedService demoSeedService,
            EmailService emailService) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.demoSeedService = demoSeedService;
        this.emailService = emailService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String username = normalise(request.username());
        if (repository.existsByUsername(username)) {
            throw new AppException(HttpStatus.CONFLICT, "That username is already registered.");
        }

        Institution institution = new Institution();
        institution.setUsername(username);
        institution.setPasswordHash(passwordEncoder.encode(request.password()));
        institution.setName(request.name().trim());
        institution.setAdminName(request.adminName().trim());
        institution.setEmail(request.email().trim().toLowerCase());
        institution = repository.save(institution);

        if (Boolean.TRUE.equals(request.seedDemoData())) {
            demoSeedService.seed(institution.getId());
        }

        return issueTokens(institution);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Institution institution = repository.findByUsername(normalise(request.username()))
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Incorrect username or password."));

        if (!passwordEncoder.matches(request.password(), institution.getPasswordHash())) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Incorrect username or password.");
        }

        return issueTokens(institution);
    }

    /**
     * Refresh-token rotation: every refresh call invalidates the token that was just used
     * and issues a brand new access/refresh pair. If a refresh token is replayed after it's
     * already been rotated out (jti no longer matches what's on file), the session is killed
     * and the caller has to log in again — that mismatch is the signal a token may have leaked.
     */
    @Transactional
    public AuthResponse refresh(String refreshToken) {
        Claims claims;
        try {
            claims = jwtService.parseClaims(refreshToken);
        } catch (JwtException | IllegalArgumentException e) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Refresh token is invalid or expired.");
        }

        if (!JwtService.TYPE_REFRESH.equals(claims.get("type"))) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Not a refresh token.");
        }

        Long institutionId = Long.valueOf(claims.getSubject());
        Institution institution = repository.findById(institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Account no longer exists."));

        boolean jtiMatches = institution.getRefreshTokenId() != null && institution.getRefreshTokenId().equals(claims.getId());
        boolean notExpired = institution.getRefreshTokenExpiresAt() != null && institution.getRefreshTokenExpiresAt().isAfter(Instant.now());
        if (!jtiMatches || !notExpired) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Session expired — please log in again.");
        }

        return issueTokens(institution);
    }

    @Transactional
    public void logout(Long institutionId) {
        repository.findById(institutionId).ifPresent(institution -> {
            institution.setRefreshTokenId(null);
            institution.setRefreshTokenExpiresAt(null);
            repository.save(institution);
        });
    }

    /**
     * Deliberately silent on a missing account or missing email — responding differently for
     * "no such username" vs "username exists" would let an attacker enumerate registered
     * usernames. The caller always sees the same generic "check your email" response.
     */
    @Transactional
    public void forgotPassword(String username) {
        Institution institution = repository.findByUsername(normalise(username)).orElse(null);
        if (institution == null || institution.getEmail() == null || institution.getEmail().isBlank()) {
            return;
        }

        String token = UUID.randomUUID().toString();
        institution.setResetToken(token);
        institution.setResetTokenExpiresAt(Instant.now().plus(30, ChronoUnit.MINUTES));
        repository.save(institution);

        String link = frontendUrl + "/reset-password?token=" + token;
        emailService.send(
                institution.getEmail(),
                "Reset your GoClass password",
                "We received a request to reset your GoClass password.\n\n"
                        + "Click this link to choose a new one (it expires in 30 minutes):\n" + link + "\n\n"
                        + "If you didn't request this, you can safely ignore this email.");
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        Institution institution = repository.findByResetToken(token)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "This reset link is invalid or has already been used."));

        if (institution.getResetTokenExpiresAt() == null || institution.getResetTokenExpiresAt().isBefore(Instant.now())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "This reset link has expired — request a new one.");
        }

        institution.setPasswordHash(passwordEncoder.encode(newPassword));
        institution.setResetToken(null);
        institution.setResetTokenExpiresAt(null);
        // A password reset should kill any existing session, not just change the password.
        institution.setRefreshTokenId(null);
        institution.setRefreshTokenExpiresAt(null);
        repository.save(institution);
    }

    public InstitutionResponse me(Long institutionId) {
        Institution institution = repository.findById(institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Account no longer exists."));
        return InstitutionResponse.from(institution);
    }

    private AuthResponse issueTokens(Institution institution) {
        String jti = UUID.randomUUID().toString();
        institution.setRefreshTokenId(jti);
        institution.setRefreshTokenExpiresAt(Instant.now().plus(jwtService.refreshTokenExpiryDays(), ChronoUnit.DAYS));
        institution = repository.save(institution);

        String accessToken = jwtService.generateAccessToken(institution);
        String refreshToken = jwtService.generateRefreshToken(institution, jti);
        return new AuthResponse(accessToken, refreshToken, InstitutionResponse.from(institution));
    }

    private String normalise(String username) {
        return username.trim().toLowerCase();
    }
}
