package com.vote.balance.balancevote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record VoteRequest(
        @NotNull(message = "선택지를 선택해 주세요.")
        Long optionId,

        @NotBlank(message = "투표자 토큰은 필수입니다.")
        @Size(max = 255, message = "투표자 토큰이 너무 깁니다.")
        String voterToken
) {
}
