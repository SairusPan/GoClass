package com.tutortime.schedule;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TeacherService {

    private final TeacherRepository repository;

    public TeacherService(TeacherRepository repository) {
        this.repository = repository;
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
}
