package com.vote.balance.balancevote.dto;

import java.time.LocalDateTime;

/**
 * 모든 실패 응답의 공통 형태.
 *
 * 프론트엔드가 message 하나만 읽어도 사용자에게 노출할 수 있도록
 * 한국어 메시지를 그대로 담고, 분기 처리가 필요한 경우를 위해
 * 기계가 읽을 수 있는 code 를 함께 제공한다.
 */
public record ErrorResponse(
        int status,
        String code,
        String message,
        LocalDateTime timestamp
) {
    public static ErrorResponse of(int status, String code, String message) {
        return new ErrorResponse(status, code, message, LocalDateTime.now());
    }
}
