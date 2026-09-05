package com.vote.balance.balancevote.dto;

import jakarta.validation.constraints.Size;

/**
 * 세션의 밸런스 게임 문제 문구를 설정한다.
 *
 * 문구를 비우는 것도 허용하므로 @NotBlank 를 걸지 않는다.
 */
public record VoteQuestionRequest(
        @Size(max = 500, message = "문제 문구는 500자를 넘을 수 없습니다.")
        String question
) {
}
