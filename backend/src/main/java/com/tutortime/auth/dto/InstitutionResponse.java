package com.tutortime.auth.dto;

import com.tutortime.auth.Institution;

public record InstitutionResponse(Long id, String name, String adminName, String username, String email) {
    public static InstitutionResponse from(Institution institution) {
        return new InstitutionResponse(
                institution.getId(), institution.getName(), institution.getAdminName(), institution.getUsername(), institution.getEmail());
    }
}
