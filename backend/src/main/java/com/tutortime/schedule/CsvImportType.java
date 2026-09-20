package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.springframework.http.HttpStatus;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

enum CsvImportType {
    SUBJECTS(
            List.of("name"),
            "name\nMaths Methods\n"),
    ROOMS(
            List.of("name", "capacity"),
            "name,capacity\nRoom A,12\n"),
    TEACHERS(
            List.of("name", "phone", "email", "subjects", "availability"),
            "name,phone,email,subjects,availability\n"
                    + "Sarah Chen,0400123456,sarah@example.com,Maths Methods|Chemistry,Mon 16:00-18:00;Wed 16:00-18:00\n"),
    CLASSES(
            List.of("name", "subject", "studentCount", "durationMinutes"),
            "name,subject,studentCount,durationMinutes\n"
                    + "Maths Methods U3/4,Maths Methods,8,60\n");

    private final List<String> headers;
    private final String template;

    CsvImportType(List<String> headers, String template) {
        this.headers = headers;
        this.template = template;
    }

    List<String> headers() {
        return headers;
    }

    String template() {
        return template;
    }

    String fileName() {
        return name().toLowerCase(Locale.ROOT) + ".csv";
    }

    static CsvImportType fromPath(String raw) {
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new AppException(HttpStatus.NOT_FOUND, "Unknown import type. Use subjects, rooms, teachers or classes.");
        }
    }

    boolean headersMatch(String[] present) {
        if (present == null || present.length != headers.size()) return false;
        List<String> normalised = Arrays.stream(present).map(CsvImportType::normaliseHeader).sorted().toList();
        List<String> expected = headers.stream().map(CsvImportType::normaliseHeader).sorted().toList();
        return normalised.equals(expected);
    }

    static String normaliseHeader(String header) {
        return header == null ? "" : header.replace("\uFEFF", "").trim().toLowerCase(Locale.ROOT);
    }
}
