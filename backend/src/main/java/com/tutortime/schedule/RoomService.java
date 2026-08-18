package com.tutortime.schedule;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RoomService {

    private final RoomRepository repository;

    public RoomService(RoomRepository repository) {
        this.repository = repository;
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
}
