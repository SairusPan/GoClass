package com.tutortime.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InstitutionRepository extends JpaRepository<Institution, Long> {
    Optional<Institution> findByUsername(String username);

    boolean existsByUsername(String username);

    Optional<Institution> findByResetToken(String resetToken);
}
