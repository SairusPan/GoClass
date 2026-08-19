package com.tutortime.schedule;

import com.tutortime.common.AppException;
import com.tutortime.email.EmailService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClassService {

    private final ClassSessionRepository repository;
    private final TeacherRepository teacherRepository;
    private final RoomRepository roomRepository;
    private final NotificationRepository notificationRepository;
    private final EmailService emailService;

    public ClassService(
            ClassSessionRepository repository,
            TeacherRepository teacherRepository,
            RoomRepository roomRepository,
            NotificationRepository notificationRepository,
            EmailService emailService) {
        this.repository = repository;
        this.teacherRepository = teacherRepository;
        this.roomRepository = roomRepository;
        this.notificationRepository = notificationRepository;
        this.emailService = emailService;
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

        ClassSession saved = repository.save(session);
        if ("published".equals(saved.getStatus())) {
            notifyTeacherOfSchedule(institutionId, saved);
        }
        return ClassResponse.from(saved);
    }

    @Transactional
    public ClassResponse publish(Long institutionId, Long classId) {
        ClassSession session = find(institutionId, classId);
        session.setStatus("published");
        ClassSession saved = repository.save(session);
        notifyTeacherOfSchedule(institutionId, saved);
        return ClassResponse.from(saved);
    }

    @Transactional
    public List<ClassResponse> publishAllDrafts(Long institutionId) {
        List<ClassSession> drafts = repository.findByInstitutionIdAndStatus(institutionId, "draft");
        drafts.forEach(d -> d.setStatus("published"));
        repository.saveAll(drafts);
        drafts.forEach(d -> notifyTeacherOfSchedule(institutionId, d));
        return list(institutionId);
    }

    /** Fires once a class is actually confirmed (published), not on every draft tweak — an
     * admin may reassign the teacher several times while drafting, and a teacher shouldn't get
     * an email per tweak, only when the schedule is final. */
    private void notifyTeacherOfSchedule(Long institutionId, ClassSession session) {
        if (session.getTeacherId() == null) return;

        Teacher teacher = teacherRepository.findByIdAndInstitutionId(session.getTeacherId(), institutionId).orElse(null);
        if (teacher == null) return;

        String roomName = session.getRoomId() == null
                ? "TBA"
                : roomRepository.findByIdAndInstitutionId(session.getRoomId(), institutionId).map(Room::getName).orElse("TBA");

        String message = "You're scheduled to teach \"" + session.getName() + "\" on "
                + session.getDay() + " " + session.getStart() + " in " + roomName + ".";

        NotificationItem notification = new NotificationItem();
        notification.setInstitutionId(institutionId);
        notification.setAudience("teacher");
        notification.setMessage(message);
        notificationRepository.save(notification);

        emailService.send(teacher.getEmail(), "You're scheduled for a class — GoClass", message);
    }

    private ClassSession find(Long institutionId, Long classId) {
        return repository.findByIdAndInstitutionId(classId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Class not found."));
    }
}
