package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ClassOverrideRepository extends JpaRepository<ClassOverride, Long> {
    List<ClassOverride> findByInstitutionIdAndWeekStartDate(Long institutionId, LocalDate weekStartDate);

    Optional<ClassOverride> findByInstitutionIdAndClassSessionIdAndWeekStartDate(
            Long institutionId, Long classSessionId, LocalDate weekStartDate);

    List<ClassOverride> findByClassSessionId(Long classSessionId);

    void deleteByClassSessionId(Long classSessionId);
}
