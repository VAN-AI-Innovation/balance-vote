package com.vote.balance.balancevote.repository;

import com.vote.balance.balancevote.domain.VoteRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VoteRecordRepository extends JpaRepository<VoteRecord, Long> {

    boolean existsBySessionIdAndVoterToken(Long sessionId, String voterToken);

    long countBySessionIdAndOptionId(Long sessionId, Long optionId);

    long countBySessionId(Long sessionId);

    long deleteBySessionId(Long sessionId);

    /**
     * 전체 세션의 누적 득표수를 한 번에 집계한다.
     */
    @Query("""
            SELECT r.session.id AS sessionId, COUNT(r.id) AS total
            FROM VoteRecord r
            GROUP BY r.session.id
            """)
    List<SessionCountProjection> countGroupBySessionId();

    /**
     * 세션 전체 득표를 단 한 번의 GROUP BY 로 집계한다.
     *
     * 기존에는 선택지 개수만큼 COUNT 를 반복 실행했고(총합 계산 + 항목별 계산으로 2N회),
     * 이 집계가 투표 1건마다 호출되어 동시 투표 부하에서 병목이 됐다.
     *
     * 득표가 0인 선택지는 결과 행이 없으므로
     * 호출하는 쪽에서 0으로 채워야 한다.
     */
    @Query("""
            SELECT r.option.id AS optionId, COUNT(r.id) AS voteCount
            FROM VoteRecord r
            WHERE r.session.id = :sessionId
            GROUP BY r.option.id
            """)
    List<OptionTally> tallyBySessionId(@Param("sessionId") Long sessionId);

    /**
     * CSV 출력용. 투표 시각 순서대로 원본 기록을 조회한다.
     */
    @Query("""
            SELECT r
            FROM VoteRecord r
            JOIN FETCH r.option
            WHERE r.session.id = :sessionId
            ORDER BY r.votedAt ASC, r.id ASC
            """)
    List<VoteRecord> findAllForExport(@Param("sessionId") Long sessionId);

    interface OptionTally {
        Long getOptionId();

        long getVoteCount();
    }
}
