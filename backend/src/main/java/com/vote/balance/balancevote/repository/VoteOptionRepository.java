package com.vote.balance.balancevote.repository;

import com.vote.balance.balancevote.domain.VoteOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VoteOptionRepository extends JpaRepository<VoteOption, Long> {

    /**
     * 선택지 생성 순서(id 오름차순)를 항상 보장한다.
     *
     * Admin 화면과 결과 화면에서 동일한 순서로
     * 선택지가 표시되도록 DB 조회 단계에서 정렬한다.
     */
    List<VoteOption> findBySessionIdOrderByIdAsc(Long sessionId);

    long countBySessionId(Long sessionId);

    boolean existsBySessionIdAndLabel(Long sessionId, String label);

    /**
     * 전체 세션의 선택지 수를 한 번에 집계한다.
     */
    @Query("""
            SELECT o.session.id AS sessionId, COUNT(o.id) AS total
            FROM VoteOption o
            GROUP BY o.session.id
            """)
    List<SessionCountProjection> countGroupBySessionId();

    /**
     * 라벨 중복 검사 시 수정 대상 자신은 제외한다.
     */
    @Query("""
            SELECT COUNT(o.id) > 0
            FROM VoteOption o
            WHERE o.session.id = :sessionId
              AND o.label = :label
              AND o.id <> :excludedOptionId
            """)
    boolean existsDuplicateLabel(
            @Param("sessionId") Long sessionId,
            @Param("label") String label,
            @Param("excludedOptionId") Long excludedOptionId
    );
}
