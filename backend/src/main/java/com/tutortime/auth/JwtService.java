package com.tutortime.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
public class JwtService {

    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final SecretKey key;
    private final JwtProperties props;

    public JwtService(JwtProperties props) {
        this.props = props;
        this.key = Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(Institution institution) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(institution.getId()))
                .claim("username", institution.getUsername())
                .claim("type", TYPE_ACCESS)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.getAccessTokenExpiryMinutes(), ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(Institution institution, String jti) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(institution.getId()))
                .id(jti)
                .claim("type", TYPE_REFRESH)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.getRefreshTokenExpiryDays(), ChronoUnit.DAYS)))
                .signWith(key)
                .compact();
    }

    /** Throws io.jsonwebtoken.JwtException (or a subclass) if the token is malformed, expired, or has a bad signature. */
    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long refreshTokenExpiryDays() {
        return props.getRefreshTokenExpiryDays();
    }
}
