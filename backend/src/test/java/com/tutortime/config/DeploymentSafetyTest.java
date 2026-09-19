package com.tutortime.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeploymentSafetyTest {

    private static final String REAL_SECRET = "a-unique-secret-used-only-in-this-unit-test-xx";

    @Test
    void thePublishedPlaceholderIsRefusedOutsideTheTestProfile() {
        assertThatThrownBy(() -> DeploymentSafety.verify(
                        List.of("local"),
                        DeploymentSafety.PLACEHOLDER_JWT_SECRET,
                        "http://localhost:5173",
                        false))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("placeholder");
    }

    @Test
    void theTestProfileMayUseItsOwnShortLivedSecret() {
        assertThatCode(() -> DeploymentSafety.verify(
                        List.of("test"),
                        "test-only-secret-not-for-anything-real-0123456789abcdef",
                        "http://localhost:5173",
                        false))
                .doesNotThrowAnyException();
    }

    @Test
    void aSecretShorterThan32CharactersIsRefused() {
        assertThatThrownBy(() -> DeploymentSafety.verify(List.of(), "tooshort", "http://localhost:5173", false))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32");
    }

    @Test
    void aHostedProcessCannotKeepTheViteDefaultAsFrontendUrl() {
        assertThatThrownBy(() -> DeploymentSafety.verify(
                        List.of(),
                        REAL_SECRET,
                        "http://localhost:5173",
                        true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("FRONTEND_URL");
    }

    @Test
    void aHostedProcessWithAPublicOriginAndARealSecretStarts() {
        assertThatCode(() -> DeploymentSafety.verify(
                        List.of(),
                        REAL_SECRET,
                        "https://goclass.up.railway.app",
                        true))
                .doesNotThrowAnyException();
    }

    @Test
    void localDevWithItsOwnSecretAndTheViteUrlIsFine() {
        assertThatCode(() -> DeploymentSafety.verify(
                        List.of("local"),
                        REAL_SECRET,
                        "http://localhost:5173",
                        false))
                .doesNotThrowAnyException();
    }
}
