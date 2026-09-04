package com.vote.balance.balancevote.dto;

import java.math.BigDecimal;
import java.util.List;

public record VoteResultResponse(
        Integer year,
        long totalVotes,
        List<OptionResult> options
) {

    public record OptionResult(
            Long optionId,
            String label,
            long voteCount,
            BigDecimal voteRate
    ) {
    }
}