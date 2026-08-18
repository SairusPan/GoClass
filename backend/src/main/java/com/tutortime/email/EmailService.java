package com.tutortime.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Sends transactional email via Resend's HTTP API. Free tier is 3,000 emails/month / 100 a day —
 * comfortably covers a single tutoring centre's leave/substitute notifications. Deliberately not
 * a hard dependency: with no API key configured this just logs instead of sending, so the app
 * (and its test suite) works fine before anyone sets one up.
 *
 * Note: a brand-new Resend account with no verified sending domain can only deliver to the email
 * address the account itself was signed up with — that's a Resend sandbox restriction, not a bug
 * here. Verify a domain in the Resend dashboard to send to arbitrary teacher addresses.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final EmailProperties properties;
    private final RestClient restClient = RestClient.create();

    public EmailService(EmailProperties properties) {
        this.properties = properties;
    }

    public void send(String to, String subject, String textBody) {
        if (to == null || to.isBlank()) {
            log.info("Skipping email '{}' — no recipient address on file.", subject);
            return;
        }
        if (properties.getResendApiKey() == null || properties.getResendApiKey().isBlank()) {
            log.info("RESEND_API_KEY not configured — would have emailed {} <- \"{}\": {}", to, subject, textBody);
            return;
        }

        try {
            restClient.post()
                    .uri(RESEND_API_URL)
                    .header("Authorization", "Bearer " + properties.getResendApiKey())
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", properties.getFromAddress(),
                            "to", List.of(to),
                            "subject", subject,
                            "text", textBody))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            // Never let an email provider outage break the scheduling action that triggered it.
            log.warn("Failed to send email to {} (subject: {}): {}", to, subject, e.getMessage());
        }
    }
}
