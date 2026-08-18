package com.tutortime.schedule;

record ClassResponse(
        Long id,
        String name,
        Long subjectId,
        int studentCount,
        String status,
        String day,
        String start,
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
                c.getTeacherId(),
                c.getRoomId(),
                c.getDate() == null ? null : c.getDate().toString());
    }
}

/** Partial update — every field optional, only non-null ones are applied (PATCH semantics). */
record AssignClassRequest(Long teacherId, Long roomId, String day, String start, String status) {
}
