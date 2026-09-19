package com.tutortime.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Railway's MySQL plugin exposes {@code mysql://user:pass@host:port/db}. Spring's driver
 * only accepts {@code jdbc:mysql://...}. If someone pastes MYSQL_URL into
 * SPRING_DATASOURCE_URL (the dashboard screenshot does exactly this pattern), Hikari
 * dies on boot with a driver/url mismatch that looks like a crash, not a config error.
 */
public class JdbcUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    static final String DATASOURCE_URL = "spring.datasource.url";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String url = environment.getProperty(DATASOURCE_URL);
        String jdbc = toJdbcUrl(url);
        if (jdbc == null || jdbc.equals(url)) {
            return;
        }
        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put(DATASOURCE_URL, jdbc);
        environment.getPropertySources().addFirst(new MapPropertySource("jdbc-url-normalized", patch));
    }

    static String toJdbcUrl(String url) {
        if (url == null || url.isBlank()) {
            return url;
        }
        if (url.startsWith("jdbc:")) {
            return url;
        }
        if (url.startsWith("mysql://")) {
            return "jdbc:" + url;
        }
        return url;
    }
}
