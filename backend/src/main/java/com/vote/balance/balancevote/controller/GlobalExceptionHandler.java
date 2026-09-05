package com.vote.balance.balancevote.controller;

import com.vote.balance.balancevote.dto.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

/**
 * 전역 예외 처리.
 *
 * 기존에는 핸들러가 없어 DataIntegrityViolationException 등이
 * 그대로 500 으로 노출됐고, 응답 형태도 일정하지 않았다.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * 서비스 계층이 의도적으로 던진 예외.
     *
     * 상태 코드와 한국어 메시지를 그대로 사용한다.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(
            ResponseStatusException e
    ) {
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());

        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        String message = e.getReason() == null
                ? status.getReasonPhrase()
                : e.getReason();

        return build(status, status.name(), message);
    }

    /**
     * @Valid 본문 검증 실패.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleBodyValidation(
            MethodArgumentNotValidException e
    ) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .filter(it -> it != null && !it.isBlank())
                .distinct()
                .collect(Collectors.joining(" "));

        return build(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                message.isBlank() ? "요청 값이 올바르지 않습니다." : message
        );
    }

    /**
     * @RequestParam / @PathVariable 검증 실패.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleParameterValidation(
            ConstraintViolationException e
    ) {
        String message = e.getConstraintViolations().stream()
                .map(jakarta.validation.ConstraintViolation::getMessage)
                .filter(it -> it != null && !it.isBlank())
                .distinct()
                .collect(Collectors.joining(" "));

        return build(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                message.isBlank() ? "요청 값이 올바르지 않습니다." : message
        );
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(
            MissingServletRequestParameterException e
    ) {
        return build(
                HttpStatus.BAD_REQUEST,
                "MISSING_PARAMETER",
                e.getParameterName() + " 파라미터가 필요합니다."
        );
    }

    /**
     * 경로 변수 타입 불일치. 예: /api/sessions/abc
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException e
    ) {
        return build(
                HttpStatus.BAD_REQUEST,
                "INVALID_PARAMETER",
                e.getName() + " 값의 형식이 올바르지 않습니다."
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(
            HttpMessageNotReadableException e
    ) {
        return build(
                HttpStatus.BAD_REQUEST,
                "MALFORMED_BODY",
                "요청 본문을 읽을 수 없습니다."
        );
    }

    /**
     * UNIQUE/FK 제약 위반.
     *
     * 중복 투표 경합이 대표적인 사례이므로 409 로 변환한다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(
            DataIntegrityViolationException e
    ) {
        log.warn("데이터 정합성 제약을 위반했습니다.", e);

        return build(
                HttpStatus.CONFLICT,
                "DATA_CONFLICT",
                "이미 처리된 요청이거나 다른 데이터와 충돌합니다."
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("처리하지 못한 예외가 발생했습니다.", e);

        return build(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
    }

    private ResponseEntity<ErrorResponse> build(
            HttpStatus status,
            String code,
            String message
    ) {
        return ResponseEntity.status(status)
                .body(ErrorResponse.of(status.value(), code, message));
    }
}
