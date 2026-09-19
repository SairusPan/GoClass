package com.tutortime.auth.dto;

import jakarta.validation.constraints.Email;

/**
 * Partial update — a null field means "leave this one alone", matching the schedule DTOs.
 * Username is deliberately absent: it's the login credential, so changing it would need a
 * uniqueness check and would invalidate whatever the user has saved in their password manager.
 */
public record UpdateInstitutionRequest(
        String name,
        String adminName,
        @Email(message = "must be a valid email") String email
) {
}
