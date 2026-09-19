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
    private final ClassOverrideRepository overrideRepository;
    private final TeacherRepository teacherRepository;
    private final RoomRepository roomRepository;
    private final SubjectRepository subjectRepository;
    private final NotificationRepository notificationRepository;
    private final EmailService emailService;

    public ClassService(
            ClassSessionRepository repository,
            ClassOverrideRepository overrideRepository,
            TeacherRepository teacherRepository,
            RoomRepository roomRepository,
            SubjectRepository subjectRepository,
            NotificationRepository notificationRepository,
            EmailService emailService) {
        this.repository = repository;
        this.overrideRepository = overrideRepository;
        this.teacherRepository = teacherRepository;
        this.roomRepository = roomRepository;
        this.subjectRepository = subjectRepository;
        this.notificationRepository = notificationRepository;
        this.emailService = emailService;
    }

    public List<ClassResponse> list(Long institutionId) {
        return repository.findByInstitutionId(institutionId).stream().map(ClassResponse::from).toList();
    }

    @Transactional
    public ClassResponse create(Long institutionId, CreateClassRequest request) {
        ClassSession session = new ClassSession();
        session.setInstitutionId(institutionId);
        session.setName(request.name().trim());
        session.setSubjectId(requireOwnSubject(institutionId, request.subjectId()));
        session.setStudentCount(request.studentCount());
        session.setDurationMinutes(request.durationMinutes() != null ? request.durationMinutes() : 60);
        session.setStatus("unscheduled");
        return ClassResponse.from(repository.save(session));
    }

    /** Name, subject, size — the parts of a class that have nothing to do with where it sits
     * on the timetable. Scheduling goes through {@link #assign} instead. */
    @Transactional
    public ClassResponse update(Long institutionId, Long classId, UpdateClassRequest request) {
        ClassSession session = find(institutionId, classId);

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "A class needs a name.");
            }
            session.setName(request.name().trim());
        }
        if (request.subjectId() != null) {
            session.setSubjectId(requireOwnSubject(institutionId, request.subjectId()));
        }
        if (request.studentCount() != null) session.setStudentCount(request.studentCount());
        if (request.durationMinutes() != null) session.setDurationMinutes(request.durationMinutes());

        return ClassResponse.from(repository.save(session));
    }

    /** Subject ids arrive straight from the client, so a request could otherwise point a class
     * at another institution's subject and quietly break tenant isolation. */
    private Long requireOwnSubject(Long institutionId, Long subjectId) {
        return subjectRepository.findByIdAndInstitutionId(subjectId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Subject not found."))
                .getId();
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
        if (request.durationMinutes() != null) session.setDurationMinutes(request.durationMinutes());

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

        String timeRange = session.getDurationMinutes() == null
                ? session.getStart()
                : session.getStart() + "–" + addMinutes(session.getStart(), session.getDurationMinutes());
        String message = "You're scheduled to teach \"" + session.getName() + "\" on "
                + session.getDay() + " " + timeRange + " in " + roomName + ".";

        NotificationItem notification = new NotificationItem();
        notification.setInstitutionId(institutionId);
        notification.setAudience("teacher");
        notification.setMessage(message);
        notificationRepository.save(notification);

        emailService.send(teacher.getEmail(), "You're scheduled for a class — GoClass", message);
    }

    @Transactional
    public void delete(Long institutionId, Long classId) {
        ClassSession session = find(institutionId, classId);
        overrideRepository.deleteByClassSessionId(session.getId());
        repository.delete(session);
    }

    private static String addMinutes(String hhmm, int minutes) {
        return java.time.LocalTime.parse(hhmm).plusMinutes(minutes).toString();
    }

    private ClassSession find(Long institutionId, Long classId) {
        return repository.findByIdAndInstitutionId(classId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Class not found."));
    }
}
