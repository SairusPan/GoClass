package com.tutortime.schedule;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;

/** Classes recur weekly by day-of-week, not by a fixed calendar date — this maps a day name to
 * its concrete date in the *current* week (Mon-Sun containing today), so the timetable rolls
 * forward automatically instead of staying pinned to whatever week the app was first built in. */
final class WeekDates {

    private WeekDates() {
    }

    private static final Map<String, DayOfWeek> DAYS = Map.of(
            "Mon", DayOfWeek.MONDAY,
            "Tue", DayOfWeek.TUESDAY,
            "Wed", DayOfWeek.WEDNESDAY,
            "Thu", DayOfWeek.THURSDAY,
            "Fri", DayOfWeek.FRIDAY,
            "Sat", DayOfWeek.SATURDAY,
            "Sun", DayOfWeek.SUNDAY);

    static LocalDate forDay(String day) {
        DayOfWeek target = DAYS.get(day);
        if (target == null) return null;
        LocalDate today = LocalDate.now();
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        return monday.plusDays(target.getValue() - 1L);
    }
}
