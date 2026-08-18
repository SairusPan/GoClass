package com.tutortime.schedule;

record NotificationResponse(Long id, String audience, String message, String createdAt) {
    static NotificationResponse from(NotificationItem n) {
        return new NotificationResponse(n.getId(), n.getAudience(), n.getMessage(), n.getCreatedAt().toString());
    }
}
