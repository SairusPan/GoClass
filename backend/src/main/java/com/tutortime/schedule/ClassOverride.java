package com.tutortime.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

/** A one-week exception to a class's normal recurring schedule (see ClassSession) — when a row
 * exists here for a (classSessionId, weekStartDate) pair, its fields are that week's real
 * schedule instead of the template's, without touching the template itself. */
@Entity
@Table(name = "class_overrides", uniqueConstraints = @UniqueConstraint(columnNames = {"classSessionId", "weekStartDate"}))
public class ClassOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long institutionId;

    @Column(nullable = false)
    private Long classSessionId;

    /** The Monday of the week this override applies to. */
    @Column(nullable = false)
    private LocalDate weekStartDate;

    @Column(name = "day_of_week", length = 8)
    private String day;

    @Column(name = "start_time", length = 8)
    private String start;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    private Long teacherId;

    private Long roomId;

    @Column(nullable = false, length = 16)
    private String status;

    public Long getId() {
        return id;
    }

    public Long getInstitutionId() {
        return institutionId;
    }

    public void setInstitutionId(Long institutionId) {
        this.institutionId = institutionId;
    }

    public Long getClassSessionId() {
        return classSessionId;
    }

    public void setClassSessionId(Long classSessionId) {
        this.classSessionId = classSessionId;
    }

    public LocalDate getWeekStartDate() {
        return weekStartDate;
    }

    public void setWeekStartDate(LocalDate weekStartDate) {
        this.weekStartDate = weekStartDate;
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

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public Long getTeacherId() {
        return teacherId;
    }

    public void setTeacherId(Long teacherId) {
        this.teacherId = teacherId;
    }

    public Long getRoomId() {
        return roomId;
    }

    public void setRoomId(Long roomId) {
        this.roomId = roomId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
