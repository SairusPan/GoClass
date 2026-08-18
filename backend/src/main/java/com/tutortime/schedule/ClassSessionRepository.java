package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {
    List<ClassSession> findByInstitutionId(Long institutionId);

    Optional<ClassSession> findByIdAndInstitutionId(Long id, Long institutionId);

    List<ClassSession> findByInstitutionIdAndStatus(Long institutionId, String status);
}
