package com.tutortime.schedule;

import jakarta.validation.constraints.NotBlank;

record SubjectResponse(Long id, String name) {
    static SubjectResponse from(Subject s) {
        return new SubjectResponse(s.getId(), s.getName());
    }
}

record CreateSubjectRequest(@NotBlank String name) {
}
