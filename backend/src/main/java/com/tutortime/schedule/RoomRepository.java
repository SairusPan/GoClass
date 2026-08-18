package com.tutortime.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByInstitutionId(Long institutionId);

    Optional<Room> findByIdAndInstitutionId(Long id, Long institutionId);
}
