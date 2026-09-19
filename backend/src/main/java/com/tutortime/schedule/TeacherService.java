package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TeacherService {

    private final TeacherRepository repository;
    private final ClassSessionRepository classRepository;
    private final ClassOverrideRepository overrideRepository;

    public TeacherService(
            TeacherRepository repository,
            ClassSessionRepository classRepository,
            ClassOverrideRepository overrideRepository) {
        this.repository = repository;
        this.classRepository = classRepository;
        this.overrideRepository = overrideRepository;
    }

    public List<TeacherResponse> list(Long institutionId) {
        return repository.findByInstitutionId(institutionId).stream().map(TeacherResponse::from).toList();
    }

    public TeacherResponse create(Long institutionId, CreateTeacherRequest request) {
        Teacher teacher = new Teacher();
        teacher.setInstitutionId(institutionId);
        teacher.setName(request.name());
        teacher.setPhone(request.phone());
        teacher.setEmail(request.email());
        teacher.setSubjectIds(request.subjectIds());
        teacher.setAvailability(request.availability().stream().map(AvailabilityDto::toEntity).toList());
        return TeacherResponse.from(repository.save(teacher));
    }

    /**
     * Dropping a subject or an availability window here can leave the teacher assigned to a
     * class they no longer qualify for. That's allowed on purpose — the same "flag it, don't
     * block it" stance the schedule builder takes on manual edits.
     */
    @Transactional
    public TeacherResponse update(Long institutionId, Long teacherId, UpdateTeacherRequest request) {
        Teacher teacher = find(institutionId, teacherId);

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "A teacher needs a name.");
            }
            teacher.setName(request.name().trim());
        }
        if (request.phone() != null) {
            teacher.setPhone(request.phone());
        }
        if (request.email() != null) {
            teacher.setEmail(request.email());
        }
        // Both of these are @ElementCollection lists on a managed entity — mutate in place
        // rather than swapping the reference, so Hibernate diffs the rows instead of losing
        // track of the collection it was already managing.
        if (request.subjectIds() != null) {
            teacher.getSubjectIds().clear();
            teacher.getSubjectIds().addAll(request.subjectIds());
        }
        if (request.availability() != null) {
            teacher.getAvailability().clear();
            request.availability().stream().map(AvailabilityDto::toEntity).forEach(teacher.getAvailability()::add);
        }

        return TeacherResponse.from(repository.save(teacher));
    }

    /**
     * Only live assignments block the delete. Leave records also carry teacher ids, but those
     * are historical — counting them would make any teacher who ever took a day off permanently
     * undeletable, so a resolved record is left to show a dash for the name instead.
     */
    @Transactional
    public void delete(Long institutionId, Long teacherId) {
        Teacher teacher = find(institutionId, teacherId);

        long classCount = classRepository.countByInstitutionIdAndTeacherId(institutionId, teacherId);
        if (classCount > 0) {
            throw new AppException(HttpStatus.CONFLICT, "This teacher is still assigned to " + classCount
                    + (classCount == 1 ? " class" : " classes") + " — reassign those first.");
        }

        long overrideCount = overrideRepository.countByInstitutionIdAndTeacherId(institutionId, teacherId);
        if (overrideCount > 0) {
            throw new AppException(HttpStatus.CONFLICT, "This teacher is still assigned in " + overrideCount
                    + (overrideCount == 1 ? " one-week schedule change" : " one-week schedule changes")
                    + " — revert those weeks first.");
        }

        repository.delete(teacher);
    }

    private Teacher find(Long institutionId, Long teacherId) {
        return repository.findByIdAndInstitutionId(teacherId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Teacher not found."));
    }
}
