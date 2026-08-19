package com.tutortime.schedule;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

record ClassResponse(
        Long id,
        String name,
        Long subjectId,
        int studentCount,
        String status,
        String day,
        String start,
        int durationMinutes,
        Long teacherId,
        Long roomId,
        String date) {
    static ClassResponse from(ClassSession c) {
        return new ClassResponse(
                c.getId(),
                c.getName(),
                c.getSubjectId(),
                c.getStudentCount(),
                c.getStatus(),
                c.getDay(),
                c.getStart(),
                // Rows created before duration_minutes existed are still NULL in the DB —
                // never let that leak out as null; the frontend always expects a real number.
                c.getDurationMinutes() != null ? c.getDurationMinutes() : 60,
                c.getTeacherId(),
                c.getRoomId(),
                c.getDate() == null ? null : c.getDate().toString());
    }
}

/** Partial update — every field optional, only non-null ones are applied (PATCH semantics). */
record AssignClassRequest(Long teacherId, Long roomId, String day, String start, Integer durationMinutes, String status) {
}

record CreateClassRequest(@NotBlank String name, @NotNull Long subjectId, @Min(1) int studentCount, Integer durationMinutes) {
}
