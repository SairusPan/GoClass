package com.tutortime.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "leave_records")
public class LeaveRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long institutionId;

    @Column(nullable = false)
    private Long classId;

    @Column(nullable = false)
    private Long originalTeacherId;

    private String reason;

    /** pending | substitute | rescheduled */
    @Column(nullable = false, length = 16)
    private String resolution = "pending";

    private Long resolvedTeacherId;

    private String resolvedDay;

    private String resolvedStart;

    private LocalDate resolvedDate;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public Long getInstitutionId() {
        return institutionId;
    }

    public void setInstitutionId(Long institutionId) {
        this.institutionId = institutionId;
    }

    public Long getClassId() {
        return classId;
    }

    public void setClassId(Long classId) {
        this.classId = classId;
    }

    public Long getOriginalTeacherId() {
        return originalTeacherId;
    }

    public void setOriginalTeacherId(Long originalTeacherId) {
        this.originalTeacherId = originalTeacherId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getResolution() {
        return resolution;
    }

    public void setResolution(String resolution) {
        this.resolution = resolution;
    }

    public Long getResolvedTeacherId() {
        return resolvedTeacherId;
    }

    public void setResolvedTeacherId(Long resolvedTeacherId) {
        this.resolvedTeacherId = resolvedTeacherId;
    }

    public String getResolvedDay() {
        return resolvedDay;
    }

    public void setResolvedDay(String resolvedDay) {
        this.resolvedDay = resolvedDay;
    }

    public String getResolvedStart() {
        return resolvedStart;
    }

    public void setResolvedStart(String resolvedStart) {
        this.resolvedStart = resolvedStart;
    }

    public LocalDate getResolvedDate() {
        return resolvedDate;
    }

    public void setResolvedDate(LocalDate resolvedDate) {
        this.resolvedDate = resolvedDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
