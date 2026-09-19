package com.tutortime.schedule;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

record RoomResponse(Long id, String name, int capacity) {
    static RoomResponse from(Room r) {
        return new RoomResponse(r.getId(), r.getName(), r.getCapacity());
    }
}

record CreateRoomRequest(@NotBlank String name, @Min(1) int capacity) {
}

/** Partial update — a null field means "leave this one alone", matching AssignClassRequest. */
record UpdateRoomRequest(String name, @Min(1) Integer capacity) {
}
