package com.vote.balance.balancevote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VoteOptionRequest(
        @NotBlank(message = "선택지 내용은 비어 있을 수 없습니다.")
        @Size(max = 255, message = "선택지는 255자를 넘을 수 없습니다.")
        String label
) {
}
