package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeacherRepository extends JpaRepository<Teacher, Long> {
    List<Teacher> findByInstitutionId(Long institutionId);

    Optional<Teacher> findByIdAndInstitutionId(Long id, Long institutionId);
}
