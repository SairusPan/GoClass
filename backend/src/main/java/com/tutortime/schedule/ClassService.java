package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClassService {

    private final ClassSessionRepository repository;

    public ClassService(ClassSessionRepository repository) {
        this.repository = repository;
    }

    public List<ClassResponse> list(Long institutionId) {
        return repository.findByInstitutionId(institutionId).stream().map(ClassResponse::from).toList();
    }

    @Transactional
    public ClassResponse assign(Long institutionId, Long classId, AssignClassRequest request) {
        ClassSession session = find(institutionId, classId);

        if (request.teacherId() != null) session.setTeacherId(request.teacherId());
        if (request.roomId() != null) session.setRoomId(request.roomId());
        if (request.day() != null) {
            session.setDay(request.day());
            session.setDate(WeekDates.forDay(request.day()));
        }
        if (request.start() != null) session.setStart(request.start());

        if (request.status() != null) {
            session.setStatus(request.status());
        } else if ("unscheduled".equals(session.getStatus())) {
            session.setStatus("draft");
        }

        return ClassResponse.from(repository.save(session));
    }

    @Transactional
    public ClassResponse publish(Long institutionId, Long classId) {
        ClassSession session = find(institutionId, classId);
        session.setStatus("published");
        return ClassResponse.from(repository.save(session));
    }

    @Transactional
    public List<ClassResponse> publishAllDrafts(Long institutionId) {
        List<ClassSession> drafts = repository.findByInstitutionIdAndStatus(institutionId, "draft");
        drafts.forEach(d -> d.setStatus("published"));
        repository.saveAll(drafts);
        return list(institutionId);
    }

    private ClassSession find(Long institutionId, Long classId) {
        return repository.findByIdAndInstitutionId(classId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Class not found."));
    }
}
