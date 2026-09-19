package com.tutortime.schedule;

import com.tutortime.common.CurrentInstitution;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationResponse> list(HttpServletRequest request) {
        return service.list(CurrentInstitution.id(request));
    }

    @PatchMapping("/{id}/read")
    public NotificationResponse markRead(HttpServletRequest request, @PathVariable Long id) {
        return service.markRead(CurrentInstitution.id(request), id);
    }

    @PostMapping("/read-all")
    public List<NotificationResponse> markAllRead(HttpServletRequest request) {
        return service.markAllRead(CurrentInstitution.id(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest request, @PathVariable Long id) {
        service.delete(CurrentInstitution.id(request), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAll(HttpServletRequest request) {
        service.deleteAll(CurrentInstitution.id(request));
        return ResponseEntity.noContent().build();
    }
}
