package com.vote.balance.balancevote.dto;

import com.vote.balance.balancevote.domain.VoteSession;

import java.time.LocalDateTime;

public record VoteSessionResponse(
        Integer year,
        String question,
        String status,
        boolean current,

        /*
         * 관리자 화면이 세션 목록 하나로 진행 상황을 파악할 수 있도록
         * 선택지 수와 누적 득표수를 함께 담는다.
         */
        int optionCount,
        long totalVotes,
        LocalDateTime openedAt,
        LocalDateTime closedAt
) {

    public static VoteSessionResponse from(VoteSession session) {
        return from(session, 0, 0L);
    }

    public static VoteSessionResponse from(
            VoteSession session,
            int optionCount,
            long totalVotes
    ) {
        return new VoteSessionResponse(
                session.getYear(),
                session.getQuestion(),
                session.getStatus().name(),
                session.isCurrent(),
                optionCount,
                totalVotes,
                session.getOpenedAt(),
                session.getClosedAt()
        );
    }
}
