package com.vote.balance.balancevote.repository;

import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface VoteSessionRepository extends JpaRepository<VoteSession, Long> {

    Optional<VoteSession> findByYear(Integer year);

    Optional<VoteSession> findByCurrentTrue();

    List<VoteSession> findAllByOrderByYearAsc();

    /**
     * 한 번에 하나의 연도만 열려 있도록 보장하기 위해
     * 현재 OPEN 상태인 세션을 조회한다.
     */
    List<VoteSession> findAllByStatus(VoteStatus status);

    /**
     * 현재 세션을 먼저 모두 해제한다.
     *
     * vote_session.current에 부분 UNIQUE INDEX가 있기 때문에
     * 새 세션을 true로 변경하기 전에 반드시 기존 true 값을
     * false로 DB에 먼저 반영해야 한다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE VoteSession s
            SET s.current = false
            WHERE s.current = true
            """)
    int clearCurrentSessions();
}