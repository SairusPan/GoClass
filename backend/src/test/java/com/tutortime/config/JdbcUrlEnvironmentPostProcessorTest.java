package com.tutortime.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JdbcUrlEnvironmentPostProcessorTest {

    @Test
    void railwayMysqlSchemeBecomesAJdbcUrl() {
        assertThat(JdbcUrlEnvironmentPostProcessor.toJdbcUrl("mysql://user:pass@host:3306/tutortime"))
                .isEqualTo("jdbc:mysql://user:pass@host:3306/tutortime");
    }

    @Test
    void anAlreadyJdbcUrlIsLeftAlone() {
        assertThat(JdbcUrlEnvironmentPostProcessor.toJdbcUrl("jdbc:mysql://localhost:3306/tutortime"))
                .isEqualTo("jdbc:mysql://localhost:3306/tutortime");
    }

    @Test
    void blankStaysBlank() {
        assertThat(JdbcUrlEnvironmentPostProcessor.toJdbcUrl(null)).isNull();
        assertThat(JdbcUrlEnvironmentPostProcessor.toJdbcUrl("")).isEmpty();
    }
}
