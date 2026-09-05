package com.vote.balance.balancevote.repository;

/**
 * 세션별 개수 집계 결과.
 *
 * 관리자 화면이 세션 목록을 한 번에 받을 때
 * 세션 수만큼 COUNT 쿼리가 반복되는 것을 막기 위해 사용한다.
 */
public interface SessionCountProjection {

    Long getSessionId();

    long getTotal();
}
