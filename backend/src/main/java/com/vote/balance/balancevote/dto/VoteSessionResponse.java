package com.vote.balance.balancevote.dto;

import com.vote.balance.balancevote.domain.VoteSession;

public record VoteSessionResponse(
        Integer year,
        String status,
        boolean current
) {
    public static VoteSessionResponse from(VoteSession session) {
        return new VoteSessionResponse(
                session.getYear(),
                session.getStatus().name(),
                session.isCurrent()
        );
    }
}
