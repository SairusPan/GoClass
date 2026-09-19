package com.tutortime.schedule;

import com.tutortime.common.CurrentInstitution;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
public class SubjectController {

    private final SubjectService service;

    public SubjectController(SubjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<SubjectResponse> list(HttpServletRequest request) {
        return service.list(CurrentInstitution.id(request));
    }

    @PostMapping
    public ResponseEntity<SubjectResponse> create(HttpServletRequest request, @Valid @RequestBody CreateSubjectRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(CurrentInstitution.id(request), body));
    }

    @PatchMapping("/{id}")
    public SubjectResponse update(HttpServletRequest request, @PathVariable Long id, @Valid @RequestBody UpdateSubjectRequest body) {
        return service.update(CurrentInstitution.id(request), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest request, @PathVariable Long id) {
        service.delete(CurrentInstitution.id(request), id);
        return ResponseEntity.noContent().build();
    }
}
