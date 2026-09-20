package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Parses a typed CSV, then inserts through the existing create methods — never the
 * repositories — so tenant checks and validation stay in one place. A class row becomes
 * unscheduled; this service does not assign a slot.
 */
@Service
public class CsvService {

    private static final int MAX_ROWS = 500;
    private static final long MAX_BYTES = 1_000_000;
    private static final Set<String> DAYS = Set.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
    private static final Pattern TIME = Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");
    private static final Pattern WINDOW = Pattern.compile(
            "(Mon|Tue|Wed|Thu|Fri|Sat|Sun) ([0-2]\\d:[0-5]\\d)-([0-2]\\d:[0-5]\\d)");

    private final SubjectService subjectService;
    private final RoomService roomService;
    private final TeacherService teacherService;
    private final ClassService classService;
    private final SubjectRepository subjectRepository;
    private final RoomRepository roomRepository;
    private final TeacherRepository teacherRepository;
    private final ClassSessionRepository classRepository;

    public CsvService(
            SubjectService subjectService,
            RoomService roomService,
            TeacherService teacherService,
            ClassService classService,
            SubjectRepository subjectRepository,
            RoomRepository roomRepository,
            TeacherRepository teacherRepository,
            ClassSessionRepository classRepository) {
        this.subjectService = subjectService;
        this.roomService = roomService;
        this.teacherService = teacherService;
        this.classService = classService;
        this.subjectRepository = subjectRepository;
        this.roomRepository = roomRepository;
        this.teacherRepository = teacherRepository;
        this.classRepository = classRepository;
    }

    @Transactional
    public ImportResponse importCsv(Long institutionId, CsvImportType type, MultipartFile file) {
        requireCsvFile(file);
        List<CSVRecord> rows = parse(file, type);

        List<String> errors = new ArrayList<>();
        switch (type) {
            case SUBJECTS -> importSubjects(institutionId, rows, errors);
            case ROOMS -> importRooms(institutionId, rows, errors);
            case TEACHERS -> importTeachers(institutionId, rows, errors);
            case CLASSES -> importClasses(institutionId, rows, errors);
        }
        if (!errors.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, String.join(" ", errors));
        }
        return new ImportResponse(type.name().toLowerCase(Locale.ROOT), rows.size());
    }

    private void importSubjects(Long institutionId, List<CSVRecord> rows, List<String> errors) {
        Set<String> existing = subjectRepository.findByInstitutionId(institutionId).stream()
                .map(s -> key(s.getName())).collect(Collectors.toSet());
        Set<String> seen = new LinkedHashSet<>();
        List<CreateSubjectRequest> ready = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            int line = i + 2;
            String name = cell(rows.get(i), "name");
            if (name.isBlank()) {
                errors.add("Row " + line + ": a subject needs a name.");
                continue;
            }
            String key = key(name);
            if (existing.contains(key) || !seen.add(key)) {
                errors.add("Row " + line + ": subject \"" + name + "\" already exists.");
                continue;
            }
            ready.add(new CreateSubjectRequest(name));
        }
        if (!errors.isEmpty()) return;
        ready.forEach(req -> subjectService.create(institutionId, req));
    }

    private void importRooms(Long institutionId, List<CSVRecord> rows, List<String> errors) {
        Set<String> existing = roomRepository.findByInstitutionId(institutionId).stream()
                .map(r -> key(r.getName())).collect(Collectors.toSet());
        Set<String> seen = new LinkedHashSet<>();
        List<CreateRoomRequest> ready = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            int line = i + 2;
            CSVRecord row = rows.get(i);
            String name = cell(row, "name");
            Integer capacity = parsePositiveInt(cell(row, "capacity"), "capacity", line, errors);
            if (name.isBlank()) {
                errors.add("Row " + line + ": a room needs a name.");
                continue;
            }
            if (capacity == null) continue;
            String key = key(name);
            if (existing.contains(key) || !seen.add(key)) {
                errors.add("Row " + line + ": room \"" + name + "\" already exists.");
                continue;
            }
            ready.add(new CreateRoomRequest(name, capacity));
        }
        if (!errors.isEmpty()) return;
        ready.forEach(req -> roomService.create(institutionId, req));
    }

    private void importTeachers(Long institutionId, List<CSVRecord> rows, List<String> errors) {
        Map<String, Long> subjectsByName = subjectRepository.findByInstitutionId(institutionId).stream()
                .collect(Collectors.toMap(s -> key(s.getName()), Subject::getId, (a, b) -> a));
        Set<String> existing = teacherRepository.findByInstitutionId(institutionId).stream()
                .map(t -> key(t.getName())).collect(Collectors.toSet());
        Set<String> seen = new LinkedHashSet<>();
        List<CreateTeacherRequest> ready = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            int line = i + 2;
            CSVRecord row = rows.get(i);
            String name = cell(row, "name");
            String phone = cell(row, "phone");
            String email = cell(row, "email");
            if (name.isBlank()) {
                errors.add("Row " + line + ": a teacher needs a name.");
                continue;
            }
            if (!email.isBlank() && !email.contains("@")) {
                errors.add("Row " + line + ": email must be a valid email.");
            }
            List<Long> subjectIds = new ArrayList<>();
            for (String subjectName : split(cell(row, "subjects"), "\\|")) {
                Long id = subjectsByName.get(key(subjectName));
                if (id == null) {
                    errors.add("Row " + line + ": subject \"" + subjectName + "\" was not found — import subjects first.");
                } else {
                    subjectIds.add(id);
                }
            }
            if (subjectIds.isEmpty()) {
                errors.add("Row " + line + ": a teacher needs at least one subject.");
            }
            List<AvailabilityDto> availability = parseAvailability(cell(row, "availability"), line, errors);
            String key = key(name);
            if (existing.contains(key) || !seen.add(key)) {
                errors.add("Row " + line + ": teacher \"" + name + "\" already exists.");
            }
            ready.add(new CreateTeacherRequest(
                    name,
                    phone.isBlank() ? null : phone,
                    email.isBlank() ? null : email,
                    subjectIds,
                    availability));
        }
        if (!errors.isEmpty()) return;
        ready.forEach(req -> teacherService.create(institutionId, req));
    }

    private void importClasses(Long institutionId, List<CSVRecord> rows, List<String> errors) {
        Map<String, Long> subjectsByName = subjectRepository.findByInstitutionId(institutionId).stream()
                .collect(Collectors.toMap(s -> key(s.getName()), Subject::getId, (a, b) -> a));
        Set<String> existing = classRepository.findByInstitutionId(institutionId).stream()
                .map(c -> key(c.getName())).collect(Collectors.toSet());
        Set<String> seen = new LinkedHashSet<>();
        List<CreateClassRequest> ready = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            int line = i + 2;
            CSVRecord row = rows.get(i);
            String name = cell(row, "name");
            String subjectName = cell(row, "subject");
            Integer studentCount = parsePositiveInt(cell(row, "studentCount"), "studentCount", line, errors);
            String durationRaw = cell(row, "durationMinutes");
            Integer duration = durationRaw.isBlank()
                    ? 60
                    : parsePositiveInt(durationRaw, "durationMinutes", line, errors);
            if (name.isBlank()) {
                errors.add("Row " + line + ": a class needs a name.");
                continue;
            }
            Long subjectId = subjectsByName.get(key(subjectName));
            if (subjectId == null) {
                errors.add("Row " + line + ": subject \"" + subjectName + "\" was not found — import subjects first.");
                continue;
            }
            if (studentCount == null || duration == null) continue;
            String key = key(name);
            if (existing.contains(key) || !seen.add(key)) {
                errors.add("Row " + line + ": class \"" + name + "\" already exists.");
                continue;
            }
            ready.add(new CreateClassRequest(name, subjectId, studentCount, duration));
        }
        if (!errors.isEmpty()) return;
        ready.forEach(req -> classService.create(institutionId, req));
    }

    private List<CSVRecord> parse(MultipartFile file, CsvImportType type) {
        String text;
        try {
            text = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Could not read that file.");
        }
        if (text.startsWith("\uFEFF")) {
            text = text.substring(1);
        }
        if (text.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "That CSV is empty.");
        }

        try (CSVParser parser = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .setTrim(true)
                .setIgnoreHeaderCase(true)
                .build()
                .parse(new StringReader(text))) {
            if (!type.headersMatch(parser.getHeaderNames().toArray(String[]::new))) {
                throw new AppException(HttpStatus.BAD_REQUEST,
                        "Unexpected columns. Expected: " + String.join(", ", type.headers()) + ".");
            }
            List<CSVRecord> rows = parser.getRecords();
            if (rows.isEmpty()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "That CSV has a header but no data rows.");
            }
            if (rows.size() > MAX_ROWS) {
                throw new AppException(HttpStatus.BAD_REQUEST, "A CSV can have at most " + MAX_ROWS + " data rows.");
            }
            return rows;
        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Could not parse that CSV.");
        }
    }

    private static void requireCsvFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Attach a CSV file as \"file\".");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new AppException(HttpStatus.BAD_REQUEST, "That file is larger than 1 MB.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!name.endsWith(".csv")) {
            throw new AppException(HttpStatus.BAD_REQUEST,
                    "Save the spreadsheet as CSV UTF-8 first (.csv), then upload that file.");
        }
    }

    private static List<AvailabilityDto> parseAvailability(String raw, int line, List<String> errors) {
        List<AvailabilityDto> windows = new ArrayList<>();
        for (String part : split(raw, ";")) {
            Matcher matcher = WINDOW.matcher(part);
            if (!matcher.matches()) {
                errors.add("Row " + line + ": availability \"" + part
                        + "\" should look like Mon 16:00-18:00.");
                continue;
            }
            String day = matcher.group(1);
            String start = matcher.group(2);
            String end = matcher.group(3);
            if (!DAYS.contains(day) || !TIME.matcher(start).matches() || !TIME.matcher(end).matches()) {
                errors.add("Row " + line + ": availability \"" + part + "\" is not a valid day or time.");
                continue;
            }
            if (start.compareTo(end) >= 0) {
                errors.add("Row " + line + ": availability \"" + part + "\" needs an end time after the start.");
                continue;
            }
            windows.add(new AvailabilityDto(day, start, end));
        }
        if (windows.isEmpty()) {
            errors.add("Row " + line + ": a teacher needs at least one availability window.");
        }
        return windows;
    }

    private static Integer parsePositiveInt(String raw, String field, int line, List<String> errors) {
        if (raw.isBlank()) {
            errors.add("Row " + line + ": " + field + " is required.");
            return null;
        }
        try {
            int value = Integer.parseInt(raw);
            if (value < 1) {
                errors.add("Row " + line + ": " + field + " must be at least 1.");
                return null;
            }
            return value;
        } catch (NumberFormatException e) {
            errors.add("Row " + line + ": " + field + " must be a whole number.");
            return null;
        }
    }

    private static List<String> split(String raw, String delimiter) {
        if (raw == null || raw.isBlank()) return List.of();
        List<String> parts = new ArrayList<>();
        for (String part : raw.split(delimiter)) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) parts.add(trimmed);
        }
        return parts;
    }

    private static String cell(CSVRecord row, String header) {
        if (!row.isMapped(header)) return "";
        String value = row.get(header);
        return value == null ? "" : value.trim();
    }

    private static String key(String name) {
        return name.trim().toLowerCase(Locale.ROOT);
    }
}
