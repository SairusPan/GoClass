package com.tutortime.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * The frontend is a single-page app with no server-side routes of its own except one
 * (/reset-password, read client-side from the URL) — but Spring Boot's static resource handler
 * only serves index.html at "/", not at arbitrary paths. Without this, a user clicking a
 * password-reset link straight from their email would hit a raw 404 instead of the app.
 *
 * Matches any single-segment path with no dot in it (so real static files like
 * /assets/index-abc123.js still fall through to normal static serving) that doesn't start with
 * "api" (so backend routes are untouched).
 */
@Controller
public class SpaFallbackController {

    @RequestMapping("/{path:^(?!api)[^.]*$}")
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
