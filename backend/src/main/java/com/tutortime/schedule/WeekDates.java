package com.tutortime.schedule;

import java.time.LocalDate;
import java.util.Map;

/** Fixed calendar dates for the demo week, kept in lockstep with the frontend's WEEK_DATES map. */
final class WeekDates {

    private WeekDates() {
    }

    private static final Map<String, LocalDate> DATES = Map.of(
            "Mon", LocalDate.of(2026, 8, 17),
            "Tue", LocalDate.of(2026, 8, 18),
            "Wed", LocalDate.of(2026, 8, 19),
            "Thu", LocalDate.of(2026, 8, 20),
            "Fri", LocalDate.of(2026, 8, 21),
            "Sat", LocalDate.of(2026, 8, 22),
            "Sun", LocalDate.of(2026, 8, 23));

    static LocalDate forDay(String day) {
        return DATES.get(day);
    }
}
