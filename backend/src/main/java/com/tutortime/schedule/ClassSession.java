package com.tutortime.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** A single scheduled (or not-yet-scheduled) lesson. Mirrors the frontend's ClassGroup type. */
@Entity
@Table(name = "class_sessions")
public class ClassSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long institutionId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Long subjectId;

    @Column(nullable = false)
    private int studentCount;

    /** unscheduled | draft | published */
    @Column(nullable = false, length = 16)
    private String status;

    /** Mon..Sat, null while unscheduled — "day" and "start" are both reserved words in H2's
     * MySQL-compat mode, so the columns need explicit non-reserved names. */
    @Column(name = "day_of_week", length = 8)
    private String day;

    /** "HH:mm", null while unscheduled */
    @Column(name = "start_time", length = 8)
    private String start;

    private Long teacherId;

    private Long roomId;

    // "date" is a reserved word in several SQL dialects (H2 included) — name the column
    // explicitly so unquoted DDL/DML doesn't break against it.
    @Column(name = "class_date")
    private LocalDate date;

    public Long getId() {
        return id;
    }

    public Long getInstitutionId() {
        return institutionId;
    }

    public void setInstitutionId(Long institutionId) {
        this.institutionId = institutionId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getSubjectId() {
        return subjectId;
    }

    public void setSubjectId(Long subjectId) {
        this.subjectId = subjectId;
    }

    public int getStudentCount() {
        return studentCount;
    }

    public void setStudentCount(int studentCount) {
        this.studentCount = studentCount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }
}
