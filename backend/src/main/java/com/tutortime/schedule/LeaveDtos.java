package com.tutortime.schedule;

import jakarta.validation.constraints.NotNull;

record LeaveResponse(
        Long id,
        Long classId,
        Long originalTeacherId,
        String reason,
        String resolution,
        Long resolvedTeacherId,
        String resolvedDay,
        String resolvedStart,
        String resolvedDate,
        String createdAt) {
    static LeaveResponse from(LeaveRecord r) {
        return new LeaveResponse(
                r.getId(),
                r.getClassId(),
                r.getOriginalTeacherId(),
                r.getReason(),
                r.getResolution(),
                r.getResolvedTeacherId(),
                r.getResolvedDay(),
                r.getResolvedStart(),
                r.getResolvedDate() == null ? null : r.getResolvedDate().toString(),
                r.getCreatedAt().toString());
    }
}

record FileLeaveRequest(@NotNull Long classId, String reason) {
}

record ResolveSubstituteRequest(@NotNull Long teacherId) {
}

record ResolveRescheduleRequest(@NotNull String day, @NotNull String start, @NotNull Long roomId) {
}
