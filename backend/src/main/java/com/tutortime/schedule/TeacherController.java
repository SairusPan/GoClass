package com.tutortime.schedule;

import com.tutortime.common.CurrentInstitution;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teachers")
public class TeacherController {

    private final TeacherService service;

    public TeacherController(TeacherService service) {
        this.service = service;
    }

    @GetMapping
    public List<TeacherResponse> list(HttpServletRequest request) {
        return service.list(CurrentInstitution.id(request));
    }

    @PostMapping
    public ResponseEntity<TeacherResponse> create(HttpServletRequest request, @Valid @RequestBody CreateTeacherRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(CurrentInstitution.id(request), body));
    }
}
