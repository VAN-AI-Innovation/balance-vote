package com.vote.balance.balancevote.repository;

import com.vote.balance.balancevote.domain.VoteOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VoteOptionRepository extends JpaRepository<VoteOption, Long> {

    /**
     * 선택지 생성 순서(id 오름차순)를 항상 보장한다.
     *
     * Admin 화면과 결과 화면에서 동일한 순서로
     * 선택지가 표시되도록 DB 조회 단계에서 정렬한다.
     */
    List<VoteOption> findBySessionIdOrderByIdAsc(Long sessionId);
}