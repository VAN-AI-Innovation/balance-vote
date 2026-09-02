package com.vote.balance.balancevote.dto;

public record VoteRequest(
        Long optionId,
        String voterToken
) {
}