package com.tutortime.schedule;

import com.tutortime.common.CurrentInstitution;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leave")
public class LeaveController {

    private final LeaveService service;

    public LeaveController(LeaveService service) {
        this.service = service;
    }

    @GetMapping
    public List<LeaveResponse> list(HttpServletRequest request) {
        return service.list(CurrentInstitution.id(request));
    }

    @PostMapping
    public ResponseEntity<LeaveResponse> file(HttpServletRequest request, @Valid @RequestBody FileLeaveRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.file(CurrentInstitution.id(request), body));
    }

    @PostMapping("/{id}/substitute")
    public LeaveResponse resolveWithSubstitute(HttpServletRequest request, @PathVariable Long id, @Valid @RequestBody ResolveSubstituteRequest body) {
        return service.resolveWithSubstitute(CurrentInstitution.id(request), id, body);
    }

    @PostMapping("/{id}/reschedule")
    public LeaveResponse resolveWithReschedule(HttpServletRequest request, @PathVariable Long id, @Valid @RequestBody ResolveRescheduleRequest body) {
        return service.resolveWithReschedule(CurrentInstitution.id(request), id, body);
    }
}
