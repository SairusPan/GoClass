package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public NotificationResponse markRead(Long institutionId, Long notificationId) {
        NotificationItem item = repository.findByIdAndInstitutionId(notificationId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Notification not found."));
        item.setRead(true);
        return NotificationResponse.from(repository.save(item));
    }

    @Transactional
    public List<NotificationResponse> markAllRead(Long institutionId) {
        List<NotificationItem> unread = repository.findByInstitutionIdAndReadFalse(institutionId);
        unread.forEach(n -> n.setRead(true));
        repository.saveAll(unread);
        return list(institutionId);
    }

    /** Notifications are a log, not a resource anything else points at, so deleting is unguarded. */
    @Transactional
    public void delete(Long institutionId, Long notificationId) {
        NotificationItem item = repository.findByIdAndInstitutionId(notificationId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Notification not found."));
        repository.delete(item);
    }

    @Transactional
    public void deleteAll(Long institutionId) {
        repository.deleteByInstitutionId(institutionId);
    }
}
