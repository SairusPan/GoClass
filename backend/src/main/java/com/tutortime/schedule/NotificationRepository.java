package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<NotificationItem, Long> {
    List<NotificationItem> findByInstitutionIdOrderByIdDesc(Long institutionId);
}
