package com.vote.balance.balancevote.repository;

import com.vote.balance.balancevote.domain.VoteRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VoteRecordRepository extends JpaRepository<VoteRecord, Long> {
    boolean existsBySessionIdAndVoterToken(Long sessionId, String voterToken);
    long countBySessionIdAndOptionId(Long sessionId, Long optionId);
}