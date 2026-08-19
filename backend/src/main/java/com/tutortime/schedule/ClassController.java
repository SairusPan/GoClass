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
@RequestMapping("/api/classes")
public class ClassController {

    private final ClassService service;

    public ClassController(ClassService service) {
        this.service = service;
    }

    @GetMapping
    public List<ClassResponse> list(HttpServletRequest request) {
        return service.list(CurrentInstitution.id(request));
    }

    @PostMapping
    public ResponseEntity<ClassResponse> create(HttpServletRequest request, @Valid @RequestBody CreateClassRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(CurrentInstitution.id(request), body));
    }

    @PatchMapping("/{id}")
    public ClassResponse assign(HttpServletRequest request, @PathVariable Long id, @RequestBody AssignClassRequest body) {
        return service.assign(CurrentInstitution.id(request), id, body);
    }

    @PostMapping("/{id}/publish")
    public ClassResponse publish(HttpServletRequest request, @PathVariable Long id) {
        return service.publish(CurrentInstitution.id(request), id);
    }

    @PostMapping("/publish-drafts")
    public List<ClassResponse> publishAllDrafts(HttpServletRequest request) {
        return service.publishAllDrafts(CurrentInstitution.id(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest request, @PathVariable Long id) {
        service.delete(CurrentInstitution.id(request), id);
        return ResponseEntity.noContent().build();
    }
}
