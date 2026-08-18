package com.tutortime.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "is required") String token,
        @NotBlank(message = "is required") @Size(min = 6, message = "must be at least 6 characters") String newPassword
) {
}
