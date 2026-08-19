package com.tutortime.schedule;

import com.tutortime.common.CurrentInstitution;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
public class ClassOverrideController {

    private final ClassOverrideService service;

    public ClassOverrideController(ClassOverrideService service) {
        this.service = service;
    }

    @GetMapping("/api/class-overrides")
    public List<ClassOverrideResponse> list(
            HttpServletRequest request, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return service.list(CurrentInstitution.id(request), week);
    }

    @PutMapping("/api/classes/{id}/override")
    public ClassOverrideResponse upsert(
            HttpServletRequest request,
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week,
            @RequestBody AssignClassRequest body) {
        return service.upsert(CurrentInstitution.id(request), id, week, body);
    }

    @DeleteMapping("/api/classes/{id}/override")
    public ResponseEntity<Void> delete(
            HttpServletRequest request,
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        service.delete(CurrentInstitution.id(request), id, week);
        return ResponseEntity.noContent().build();
    }
}
