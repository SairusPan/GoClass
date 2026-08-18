package com.tutortime.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Stands in for Spring Security's filter chain, which we deliberately didn't pull in
 * (see pom.xml) — this is the whole auth story for protected /api/** routes: require a
 * valid, non-expired access token and stash the caller's institution id on the request.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/forgot-password",
            "/api/auth/reset-password"
    );

    public static final String INSTITUTION_ID_ATTR = "institutionId";

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();

        // CORS preflight requests never carry an Authorization header — let them through
        // so Spring's CORS support (registered in WebConfig) can answer them. Blocking
        // OPTIONS here would make every cross-origin call to a protected route fail with
        // a CORS error before it even gets a chance to send the real request.
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        if (!path.startsWith("/api/") || PUBLIC_PATHS.contains(path)) {
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing access token.");
            return;
        }

        try {
            Claims claims = jwtService.parseClaims(header.substring(7));
            if (!JwtService.TYPE_ACCESS.equals(claims.get("type"))) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Not an access token.");
                return;
            }
            request.setAttribute(INSTITUTION_ID_ATTR, Long.valueOf(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException e) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Access token invalid or expired.");
            return;
        }

        chain.doFilter(request, response);
    }
}
