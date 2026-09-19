package com.tutortime.config;

import com.tutortime.auth.JwtProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Runs while the context is coming up, not after Tomcat is already listening — a bad JWT
 * secret should refuse the process, not serve traffic for a few seconds first.
 */
@Component
public class DeploymentSafetyChecks {

    public DeploymentSafetyChecks(
            JwtProperties jwt,
            Environment env,
            @Value("${app.frontend-url}") String frontendUrl) {
        boolean hosted = hasText(env.getProperty("PORT")) || hasText(env.getProperty("MYSQLHOST"));
        DeploymentSafety.verify(List.of(env.getActiveProfiles()), jwt.getSecret(), frontendUrl, hosted);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
