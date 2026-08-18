package com.tutortime.auth;

import com.tutortime.auth.dto.AuthResponse;
import com.tutortime.auth.dto.ForgotPasswordRequest;
import com.tutortime.auth.dto.InstitutionResponse;
import com.tutortime.auth.dto.LoginRequest;
import com.tutortime.auth.dto.RefreshRequest;
import com.tutortime.auth.dto.RegisterRequest;
import com.tutortime.auth.dto.ResetPasswordRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.refreshToken());
    }

    @PostMapping("/forgot-password")
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request.username());
    }

    @PostMapping("/reset-password")
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request.token(), request.newPassword());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(currentInstitutionId(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public InstitutionResponse me(HttpServletRequest request) {
        return authService.me(currentInstitutionId(request));
    }

    private Long currentInstitutionId(HttpServletRequest request) {
        return (Long) request.getAttribute(JwtAuthFilter.INSTITUTION_ID_ATTR);
    }
}
