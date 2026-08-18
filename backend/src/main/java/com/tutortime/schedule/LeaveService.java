package com.tutortime.schedule;

import com.tutortime.common.AppException;
import com.tutortime.email.EmailService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class LeaveService {

    private final LeaveRecordRepository leaveRepository;
    private final ClassSessionRepository classRepository;
    private final TeacherRepository teacherRepository;
    private final NotificationRepository notificationRepository;
    private final EmailService emailService;

    public LeaveService(
            LeaveRecordRepository leaveRepository,
            ClassSessionRepository classRepository,
            TeacherRepository teacherRepository,
            NotificationRepository notificationRepository,
            EmailService emailService) {
        this.leaveRepository = leaveRepository;
        this.classRepository = classRepository;
        this.teacherRepository = teacherRepository;
        this.notificationRepository = notificationRepository;
        this.emailService = emailService;
    }

    public List<LeaveResponse> list(Long institutionId) {
        return leaveRepository.findByInstitutionIdOrderByIdDesc(institutionId).stream().map(LeaveResponse::from).toList();
    }

    @Transactional
    public LeaveResponse file(Long institutionId, FileLeaveRequest request) {
        ClassSession session = classRepository.findByIdAndInstitutionId(request.classId(), institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Class not found."));
        if (session.getTeacherId() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "This class has no teacher assigned yet.");
        }

        LeaveRecord record = new LeaveRecord();
        record.setInstitutionId(institutionId);
        record.setClassId(session.getId());
        record.setOriginalTeacherId(session.getTeacherId());
        record.setReason(request.reason() == null || request.reason().isBlank() ? "No reason given" : request.reason());
        leaveRepository.save(record);

        Teacher awayTeacher = teacher(institutionId, session.getTeacherId());
        notifyTeacher(institutionId, awayTeacher, "You're marked as away — GoClass",
                awayTeacher.getName() + " marked as away for \"" + session.getName()
                        + "\" on " + session.getDay() + " " + session.getStart() + ". Finding cover…");

        return LeaveResponse.from(record);
    }

    @Transactional
    public LeaveResponse resolveWithSubstitute(Long institutionId, Long leaveId, ResolveSubstituteRequest request) {
        LeaveRecord record = findLeave(institutionId, leaveId);
        ClassSession session = classRepository.findByIdAndInstitutionId(record.getClassId(), institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Class not found."));

        session.setTeacherId(request.teacherId());
        classRepository.save(session);

        record.setResolution("substitute");
        record.setResolvedTeacherId(request.teacherId());
        leaveRepository.save(record);

        Teacher substitute = teacher(institutionId, request.teacherId());
        notifyTeacher(institutionId, substitute, "You're covering a class — GoClass",
                substitute.getName() + " confirmed to cover \"" + session.getName() + "\" on " + session.getDay() + " " + session.getStart() + ".");
        // No student/parent contact records exist yet — this stays queue-only until that data model exists.
        pushNotification(institutionId, "student_parent",
                "Your class \"" + session.getName() + "\" on " + session.getDate() + " will now be taught by " + substitute.getName()
                        + ". Time and room are unchanged.");

        return LeaveResponse.from(record);
    }

    @Transactional
    public LeaveResponse resolveWithReschedule(Long institutionId, Long leaveId, ResolveRescheduleRequest request) {
        LeaveRecord record = findLeave(institutionId, leaveId);
        ClassSession session = classRepository.findByIdAndInstitutionId(record.getClassId(), institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Class not found."));

        LocalDate date = WeekDates.forDay(request.day());
        session.setDay(request.day());
        session.setStart(request.start());
        session.setRoomId(request.roomId());
        session.setDate(date);
        classRepository.save(session);

        record.setResolution("rescheduled");
        record.setResolvedDay(request.day());
        record.setResolvedStart(request.start());
        record.setResolvedDate(date);
        leaveRepository.save(record);

        Teacher teacher = teacher(institutionId, session.getTeacherId());
        notifyTeacher(institutionId, teacher, "Your class has a new time — GoClass",
                "\"" + session.getName() + "\" moved to a make-up slot: " + request.day() + " " + request.start() + " (" + date + ").");
        pushNotification(institutionId, "student_parent",
                "Your class \"" + session.getName() + "\" has been rescheduled to " + request.day() + " " + request.start()
                        + " on " + date + " due to a teacher change.");

        return LeaveResponse.from(record);
    }

    private LeaveRecord findLeave(Long institutionId, Long leaveId) {
        return leaveRepository.findByIdAndInstitutionId(leaveId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Leave record not found."));
    }

    private Teacher teacher(Long institutionId, Long teacherId) {
        return teacherRepository.findByIdAndInstitutionId(teacherId, institutionId).orElse(null);
    }

    /** Queues the in-app notification (always) and, if the teacher has an email on file, actually sends one. */
    private void notifyTeacher(Long institutionId, Teacher teacher, String subject, String message) {
        pushNotification(institutionId, "teacher", message);
        if (teacher != null) {
            emailService.send(teacher.getEmail(), subject, message);
        }
    }

    private void pushNotification(Long institutionId, String audience, String message) {
        NotificationItem notification = new NotificationItem();
        notification.setInstitutionId(institutionId);
        notification.setAudience(audience);
        notification.setMessage(message);
        notificationRepository.save(notification);
    }
}
