package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<NotificationItem, Long> {
    List<NotificationItem> findByInstitutionIdOrderByIdDesc(Long institutionId);

    Optional<NotificationItem> findByIdAndInstitutionId(Long id, Long institutionId);

    List<NotificationItem> findByInstitutionIdAndReadFalse(Long institutionId);

    void deleteByInstitutionId(Long institutionId);
}
