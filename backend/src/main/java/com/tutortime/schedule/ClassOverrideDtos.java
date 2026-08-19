package com.tutortime.schedule;

record ClassOverrideResponse(
        Long id,
        Long classId,
        String weekStartDate,
        String day,
        String start,
        int durationMinutes,
        Long teacherId,
        Long roomId,
        String status) {
    static ClassOverrideResponse from(ClassOverride o) {
        return new ClassOverrideResponse(
                o.getId(),
                o.getClassSessionId(),
                o.getWeekStartDate().toString(),
                o.getDay(),
                o.getStart(),
                o.getDurationMinutes() != null ? o.getDurationMinutes() : 60,
                o.getTeacherId(),
                o.getRoomId(),
                o.getStatus());
    }
}
