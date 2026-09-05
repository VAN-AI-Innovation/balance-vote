package com.vote.balance.balancevote.repository;

import com.vote.balance.balancevote.domain.VoteSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VoteSessionRepository extends JpaRepository<VoteSession, Long> {

    Optional<VoteSession> findByYear(Integer year);

    Optional<VoteSession> findByCurrentTrue();

    List<VoteSession> findAllByOrderByYearAsc();
}
