package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TeacherRepository extends JpaRepository<Teacher, Long> {
    List<Teacher> findByInstitutionId(Long institutionId);

    Optional<Teacher> findByIdAndInstitutionId(Long id, Long institutionId);

    /** subjectIds is an @ElementCollection, so this needs an explicit "member of" rather than a
     * derived query name. */
    @Query("select count(t) from Teacher t where t.institutionId = :institutionId and :subjectId member of t.subjectIds")
    long countByInstitutionIdAndSubjectId(@Param("institutionId") Long institutionId, @Param("subjectId") Long subjectId);
}
