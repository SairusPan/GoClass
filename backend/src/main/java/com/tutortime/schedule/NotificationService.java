package com.tutortime.schedule;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    public List<NotificationResponse> list(Long institutionId) {
        return repository.findByInstitutionIdOrderByIdDesc(institutionId).stream().map(NotificationResponse::from).toList();
    }
}
