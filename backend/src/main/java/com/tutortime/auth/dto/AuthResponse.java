package com.tutortime.auth.dto;

public record AuthResponse(String accessToken, String refreshToken, InstitutionResponse institution) {
}
