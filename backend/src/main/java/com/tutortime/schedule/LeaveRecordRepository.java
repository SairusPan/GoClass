package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LeaveRecordRepository extends JpaRepository<LeaveRecord, Long> {
    List<LeaveRecord> findByInstitutionIdOrderByIdDesc(Long institutionId);

    Optional<LeaveRecord> findByIdAndInstitutionId(Long id, Long institutionId);
}
