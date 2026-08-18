package com.tutortime.schedule;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubjectService {

    private final SubjectRepository repository;

    public SubjectService(SubjectRepository repository) {
        this.repository = repository;
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
}
