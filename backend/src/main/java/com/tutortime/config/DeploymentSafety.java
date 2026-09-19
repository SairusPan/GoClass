package com.tutortime.config;

import java.util.Collection;

/**
 * Fail-fast checks that comments in application.yml can't enforce. The JWT placeholder is
 * committed in a public repo, so a forgotten JWT_SECRET would otherwise mint tokens anyone
 * can forge. The frontend-url default points at Vite, so a hosted deploy that leaves it
 * alone would email password-reset links nobody can open.
 */
public final class DeploymentSafety {

    /**
     * Must match the default in application.yml. Compared by exact string, not a substring —
     * a real secret that happens to contain "change-me" shouldn't take the app down.
     */
    public static final String PLACEHOLDER_JWT_SECRET =
            "dev-only-secret-change-me-before-shipping-anywhere-real-0123456789";

    private DeploymentSafety() {
    }

    public static void verify(
            Collection<String> activeProfiles,
            String jwtSecret,
            String frontendUrl,
            boolean hosted) {
        boolean test = activeProfiles != null && activeProfiles.contains("test");
        if (!test) {
            if (jwtSecret == null || jwtSecret.isBlank()) {
                throw new IllegalStateException(
                        "JWT_SECRET is missing. Set it to a random string of at least 32 characters.");
            }
            if (PLACEHOLDER_JWT_SECRET.equals(jwtSecret)) {
                throw new IllegalStateException(
                        "JWT_SECRET is still the public placeholder from application.yml. "
                                + "Generate a unique value (32+ characters) before this process starts.");
            }
            if (jwtSecret.length() < 32) {
                throw new IllegalStateException(
                        "JWT_SECRET is too short for HMAC-SHA256 — use at least 32 characters.");
            }
        }

        // Railway sets PORT; its MySQL plugin sets MYSQLHOST. Either one means this isn't
        // `mvn spring-boot:run` on a laptop, so a localhost reset link is a live bug.
        if (hosted) {
            if (frontendUrl == null || frontendUrl.isBlank()
                    || frontendUrl.contains("localhost") || frontendUrl.contains("127.0.0.1")) {
                throw new IllegalStateException(
                        "FRONTEND_URL must be the public origin of this app (the Railway or custom "
                                + "domain). Password-reset emails are built from it, and the default "
                                + "is http://localhost:5173.");
            }
        }
    }
}
