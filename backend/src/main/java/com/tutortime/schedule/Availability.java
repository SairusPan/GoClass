package com.tutortime.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class Availability {

    // "day" is a reserved word in H2's MySQL-compat mode.
    @Column(name = "day_of_week", length = 8)
    private String day;

    @Column(name = "start_time", length = 8)
    private String start;

    @Column(name = "end_time", length = 8)
    private String end;

    public Availability() {
    }

    public Availability(String day, String start, String end) {
        this.day = day;
        this.start = start;
        this.end = end;
    }

    public String getDay() {
        return day;
    }

    public void setDay(String day) {
        this.day = day;
    }

    public String getStart() {
        return start;
    }

    public void setStart(String start) {
        this.start = start;
    }

    public String getEnd() {
        return end;
    }

    public void setEnd(String end) {
        this.end = end;
    }
}
