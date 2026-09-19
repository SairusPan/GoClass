package com.tutortime.schedule;

import com.tutortime.common.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoomService {

    private final RoomRepository repository;
    private final ClassSessionRepository classRepository;
    private final ClassOverrideRepository overrideRepository;

    public RoomService(
            RoomRepository repository,
            ClassSessionRepository classRepository,
            ClassOverrideRepository overrideRepository) {
        this.repository = repository;
        this.classRepository = classRepository;
        this.overrideRepository = overrideRepository;
    }

    public List<RoomResponse> list(Long institutionId) {
        return repository.findByInstitutionId(institutionId).stream().map(RoomResponse::from).toList();
    }

    public RoomResponse create(Long institutionId, CreateRoomRequest request) {
        Room room = new Room();
        room.setInstitutionId(institutionId);
        room.setName(request.name());
        room.setCapacity(request.capacity());
        return RoomResponse.from(repository.save(room));
    }

    /**
     * Capacity can be shrunk below what a class already scheduled in here needs. That's
     * deliberate and matches how the rest of the app treats manual edits — the timetable
     * surfaces the problem rather than blocking the edit outright.
     */
    @Transactional
    public RoomResponse update(Long institutionId, Long roomId, UpdateRoomRequest request) {
        Room room = find(institutionId, roomId);

        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "A room needs a name.");
            }
            room.setName(request.name().trim());
        }
        if (request.capacity() != null) {
            room.setCapacity(request.capacity());
        }

        return RoomResponse.from(repository.save(room));
    }

    @Transactional
    public void delete(Long institutionId, Long roomId) {
        Room room = find(institutionId, roomId);

        long classCount = classRepository.countByInstitutionIdAndRoomId(institutionId, roomId);
        if (classCount > 0) {
            throw new AppException(HttpStatus.CONFLICT, "This room is still used by " + classCount
                    + (classCount == 1 ? " class" : " classes") + " — move those to another room first.");
        }

        long overrideCount = overrideRepository.countByInstitutionIdAndRoomId(institutionId, roomId);
        if (overrideCount > 0) {
            throw new AppException(HttpStatus.CONFLICT, "This room is still used by " + overrideCount
                    + (overrideCount == 1 ? " one-week schedule change" : " one-week schedule changes")
                    + " — revert those weeks first.");
        }

        repository.delete(room);
    }

    private Room find(Long institutionId, Long roomId) {
        return repository.findByIdAndInstitutionId(roomId, institutionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Room not found."));
    }
}
