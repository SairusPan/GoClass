package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SubjectService {

    private final SubjectRepository repository;
    private final ClassSessionRepository classRepository;
    private final TeacherRepository teacherRepository;

    public SubjectService(
            SubjectRepository repository,
            ClassSessionRepository classRepository,
            TeacherRepository teacherRepository) {
        this.repository = repository;
        this.classRepository = classRepository;
        this.teacherRepository = teacherRepository;
    }

    public List<SubjectResponse> list(Long institutionId) {
        return repository.findByInstitutionId(institutionId).stream().map(SubjectResponse::from).toList();
    }

    public SubjectResponse create(Long institutionId, CreateSubjectRequest request) {
        Subject subject = new Subject();
        subject.setInstitutionId(institutionId);
        subject.setName(request.name());
        return SubjectResponse.from(repository.save(subject));
    }

    @Transactional
    public SubjectResponse update(Long institutionId, Long subjectId, UpdateSubjectRequest request) {
        Subject subject = find(institutionId, subjectId);

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "A subject needs a name.");
            }
            subject.setName(request.name().trim());
        }

        return SubjectResponse.from(repository.save(subject));
    }

    /**
     * Refused while anything still points at this subject. ClassSession.subjectId is non-null,
     * so there's no "unassign and keep the class" fallback the way there is for a teacher or
     * room — the only safe options are to block or to delete the classes too, and silently
     * deleting someone's timetable is worse than making them do it deliberately.
     */
    @Transactional
    public void delete(Long institutionId, Long subjectId) {
        Subject subject = find(institutionId, subjectId);

        long classCount = classRepository.countByInstitutionIdAndSubjectId(institutionId, subjectId);
        if (classCount > 0) {
            throw new AppException(HttpStatus.CONFLICT, "This subject is still used by " + classCount
                    + (classCount == 1 ? " class" : " classes") + " — move those to another subject or delete them first.");
        }

        long teacherCount = teacherRepository.countByInstitutionIdAndSubjectId(institutionId, subjectId);
        if (teacherCount > 0) {
            throw new AppException(HttpStatus.CONFLICT, "This subject is still listed for " + teacherCount
                    + (teacherCount == 1 ? " teacher" : " teachers") + " — remove it from them first.");
        }

        repository.delete(subject);
    }

    private Subject find(Long institutionId, Long subjectId) {
        return repository.findByIdAndInstitutionId(subjectId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Subject not found."));
    }
}
