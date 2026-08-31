package com.vote.balance.balancevote.repository;

import com.vote.balance.balancevote.domain.VoteOption;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VoteOptionRepository extends JpaRepository<VoteOption, Long> {
    List<VoteOption> findBySessionId(Long sessionId);
}