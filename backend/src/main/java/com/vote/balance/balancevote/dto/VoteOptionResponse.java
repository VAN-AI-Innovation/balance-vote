package com.vote.balance.balancevote.dto;

import com.vote.balance.balancevote.domain.VoteOption;

public record VoteOptionResponse(
        Long id,
        Long sessionId,
        String label
) {
    public static VoteOptionResponse from(VoteOption option) {
        return new VoteOptionResponse(
                option.getId(),
                option.getSession().getId(),
                option.getLabel()
        );
    }
}