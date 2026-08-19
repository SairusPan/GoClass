package com.tutortime.schedule;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Populates a freshly-registered institution with the same demo dataset the frontend used to
 * ship as static mock data — six teachers, six subjects, four rooms, ten classes, including one
 * deliberate double-booking (Thu 17:00, same teacher + room) — so every new tenant starts from a
 * working, demonstrable timetable instead of an empty one.
 */
@Service
public class DemoSeedService {

    private final SubjectRepository subjectRepository;
    private final RoomRepository roomRepository;
    private final TeacherRepository teacherRepository;
    private final ClassSessionRepository classRepository;

    public DemoSeedService(
            SubjectRepository subjectRepository,
            RoomRepository roomRepository,
            TeacherRepository teacherRepository,
            ClassSessionRepository classRepository) {
        this.subjectRepository = subjectRepository;
        this.roomRepository = roomRepository;
        this.teacherRepository = teacherRepository;
        this.classRepository = classRepository;
    }

    @Transactional
    public void seed(Long institutionId) {
        Map<String, Long> subjectIds = seedSubjects(institutionId);
        Map<String, Long> roomIds = seedRooms(institutionId);
        Map<String, Long> teacherIds = seedTeachers(institutionId, subjectIds);
        seedClasses(institutionId, subjectIds, roomIds, teacherIds);
    }

    private Map<String, Long> seedSubjects(Long institutionId) {
        Map<String, String> names = new HashMap<>();
        names.put("mm", "Maths Methods");
        names.put("sm", "Specialist Maths");
        names.put("en", "English");
        names.put("ch", "Chemistry");
        names.put("ph", "Physics");
        names.put("bi", "Biology");

        Map<String, Long> ids = new HashMap<>();
        names.forEach((key, name) -> {
            Subject subject = new Subject();
            subject.setInstitutionId(institutionId);
            subject.setName(name);
            ids.put(key, subjectRepository.save(subject).getId());
        });
        return ids;
    }

    private Map<String, Long> seedRooms(Long institutionId) {
        Map<String, Long> ids = new HashMap<>();
        ids.put("a", saveRoom(institutionId, "Room A", 8));
        ids.put("b", saveRoom(institutionId, "Room B", 6));
        ids.put("c", saveRoom(institutionId, "Room C", 10));
        ids.put("online", saveRoom(institutionId, "Online", 20));
        return ids;
    }

    private Long saveRoom(Long institutionId, String name, int capacity) {
        Room room = new Room();
        room.setInstitutionId(institutionId);
        room.setName(name);
        room.setCapacity(capacity);
        return roomRepository.save(room).getId();
    }

    private Map<String, Long> seedTeachers(Long institutionId, Map<String, Long> subjectIds) {
        Map<String, Long> ids = new HashMap<>();
        ids.put("sarah", saveTeacher(institutionId, "Sarah Chen", "0412 000 001",
                List.of(subjectIds.get("mm"), subjectIds.get("sm")),
                List.of(new Availability("Mon", "16:00", "19:00"), new Availability("Wed", "16:00", "19:00"), new Availability("Sat", "09:00", "14:00"))));
        ids.put("james", saveTeacher(institutionId, "James Wilson", "0412 000 002",
                List.of(subjectIds.get("en")),
                List.of(new Availability("Tue", "16:00", "19:00"), new Availability("Thu", "16:00", "19:00"), new Availability("Sat", "09:00", "13:00"))));
        ids.put("priya", saveTeacher(institutionId, "Priya Nair", "0412 000 003",
                List.of(subjectIds.get("ch"), subjectIds.get("bi")),
                List.of(new Availability("Mon", "17:00", "19:00"), new Availability("Wed", "17:00", "19:00"), new Availability("Fri", "16:00", "18:00"), new Availability("Sat", "10:00", "14:00"))));
        ids.put("david", saveTeacher(institutionId, "David Kim", "0412 000 004",
                List.of(subjectIds.get("ph"), subjectIds.get("sm")),
                List.of(new Availability("Tue", "17:00", "19:00"), new Availability("Thu", "17:00", "19:00"), new Availability("Sat", "11:00", "15:00"))));
        ids.put("emily", saveTeacher(institutionId, "Emily Zhao", "0412 000 005",
                List.of(subjectIds.get("mm"), subjectIds.get("en")),
                List.of(new Availability("Mon", "15:00", "18:00"), new Availability("Wed", "15:00", "18:00"), new Availability("Sat", "09:00", "12:00"))));
        ids.put("michael", saveTeacher(institutionId, "Michael Brown", "0412 000 006",
                List.of(subjectIds.get("ch"), subjectIds.get("ph")),
                List.of(new Availability("Tue", "16:00", "18:00"), new Availability("Thu", "16:00", "18:00"), new Availability("Fri", "17:00", "19:00"))));
        return ids;
    }

    private Long saveTeacher(Long institutionId, String name, String phone, List<Long> subjectIds, List<Availability> availability) {
        Teacher teacher = new Teacher();
        teacher.setInstitutionId(institutionId);
        teacher.setName(name);
        teacher.setPhone(phone);
        teacher.setSubjectIds(subjectIds);
        teacher.setAvailability(availability);
        return teacherRepository.save(teacher).getId();
    }

    private void seedClasses(Long institutionId, Map<String, Long> subjectIds, Map<String, Long> roomIds, Map<String, Long> teacherIds) {
        saveClass(institutionId, "Maths Methods U3/4", subjectIds.get("mm"), 6, "published", "Mon", "16:00", 60, teacherIds.get("sarah"), roomIds.get("a"));
        saveClass(institutionId, "English U3/4", subjectIds.get("en"), 5, "published", "Tue", "17:00", 60, teacherIds.get("james"), roomIds.get("b"));
        saveClass(institutionId, "Chemistry U3/4", subjectIds.get("ch"), 7, "published", "Wed", "17:00", 60, teacherIds.get("priya"), roomIds.get("c"));
        // Deliberate double-booking: same teacher AND same room, both Thu 17:00 — gives the
        // conflict detector something to flag the moment a new tenant looks at their timetable.
        saveClass(institutionId, "Specialist Maths U3/4", subjectIds.get("sm"), 4, "published", "Thu", "17:00", 60, teacherIds.get("david"), roomIds.get("a"));
        saveClass(institutionId, "Physics U3/4", subjectIds.get("ph"), 5, "published", "Thu", "17:00", 60, teacherIds.get("david"), roomIds.get("a"));

        saveClass(institutionId, "Biology U3/4", subjectIds.get("bi"), 6, "unscheduled", null, null, 60, null, null);
        saveClass(institutionId, "Maths Methods U1/2", subjectIds.get("mm"), 8, "unscheduled", null, null, 60, null, null);
        saveClass(institutionId, "English U1/2", subjectIds.get("en"), 6, "unscheduled", null, null, 60, null, null);
        saveClass(institutionId, "Chemistry U1/2", subjectIds.get("ch"), 5, "unscheduled", null, null, 60, null, null);
        saveClass(institutionId, "Specialist Maths U1/2", subjectIds.get("sm"), 3, "unscheduled", null, null, 60, null, null);
    }

    private void saveClass(Long institutionId, String name, Long subjectId, int studentCount, String status,
                            String day, String start, Integer durationMinutes, Long teacherId, Long roomId) {
        ClassSession session = new ClassSession();
        session.setInstitutionId(institutionId);
        session.setName(name);
        session.setSubjectId(subjectId);
        session.setStudentCount(studentCount);
        session.setStatus(status);
        session.setDay(day);
        session.setStart(start);
        session.setDurationMinutes(durationMinutes);
        session.setTeacherId(teacherId);
        session.setRoomId(roomId);
        session.setDate(day == null ? null : WeekDates.forDay(day));
        classRepository.save(session);
    }
}
