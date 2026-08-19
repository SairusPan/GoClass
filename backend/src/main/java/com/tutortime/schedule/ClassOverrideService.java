package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class ClassOverrideService {

    private final ClassOverrideRepository overrideRepository;
    private final ClassSessionRepository classRepository;

    public ClassOverrideService(ClassOverrideRepository overrideRepository, ClassSessionRepository classRepository) {
        this.overrideRepository = overrideRepository;
        this.classRepository = classRepository;
    }

    public List<ClassOverrideResponse> list(Long institutionId, LocalDate weekStartDate) {
        return overrideRepository.findByInstitutionIdAndWeekStartDate(institutionId, weekStartDate).stream()
                .map(ClassOverrideResponse::from)
                .toList();
    }

    @Transactional
    public ClassOverrideResponse upsert(Long institutionId, Long classId, LocalDate weekStartDate, AssignClassRequest request) {
        classRepository.findByIdAndInstitutionId(classId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Class not found."));

        if (request.teacherId() == null || request.roomId() == null || request.day() == null
                || request.start() == null || request.durationMinutes() == null || request.status() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "A one-week override needs every field set.");
        }

        ClassOverride override = overrideRepository
                .findByInstitutionIdAndClassSessionIdAndWeekStartDate(institutionId, classId, weekStartDate)
                .orElseGet(ClassOverride::new);
        override.setInstitutionId(institutionId);
        override.setClassSessionId(classId);
        override.setWeekStartDate(weekStartDate);
        override.setTeacherId(request.teacherId());
        override.setRoomId(request.roomId());
        override.setDay(request.day());
        override.setStart(request.start());
        override.setDurationMinutes(request.durationMinutes());
        override.setStatus(request.status());

        return ClassOverrideResponse.from(overrideRepository.save(override));
    }

    @Transactional
    public void delete(Long institutionId, Long classId, LocalDate weekStartDate) {
        overrideRepository
                .findByInstitutionIdAndClassSessionIdAndWeekStartDate(institutionId, classId, weekStartDate)
                .ifPresent(overrideRepository::delete);
    }
}
