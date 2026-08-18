package com.tutortime.schedule;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

record AvailabilityDto(@NotBlank String day, @NotBlank String start, @NotBlank String end) {
    static AvailabilityDto from(Availability a) {
        return new AvailabilityDto(a.getDay(), a.getStart(), a.getEnd());
    }

    Availability toEntity() {
        return new Availability(day, start, end);
    }
}

record TeacherResponse(Long id, String name, String phone, String email, List<Long> subjectIds, List<AvailabilityDto> availability) {
    static TeacherResponse from(Teacher t) {
        return new TeacherResponse(
                t.getId(),
                t.getName(),
                t.getPhone(),
                t.getEmail(),
                t.getSubjectIds(),
                t.getAvailability().stream().map(AvailabilityDto::from).toList());
    }
}

record CreateTeacherRequest(
        @NotBlank String name,
        String phone,
        @Email String email,
        @NotEmpty List<Long> subjectIds,
        @NotEmpty List<@NotNull AvailabilityDto> availability) {
}
