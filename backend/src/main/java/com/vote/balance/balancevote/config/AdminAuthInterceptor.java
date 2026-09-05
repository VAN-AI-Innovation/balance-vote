package com.vote.balance.balancevote.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Set;

/**
 * 관리자 전용 API 를 토큰으로 보호한다.
 *
 * 기존에는 인증이 전혀 없어 행사장에서 URL 을 아는 관객이
 * /close, /reset 을 임의로 호출할 수 있었다.
 *
 * 인증 방식은 진행자 1명만 쓰는 화면에 맞춰 단일 공유 토큰으로 한다.
 * admin.token 이 비어 있으면 인터셉터는 비활성화되므로
 * 로컬 개발 환경은 기존과 동일하게 동작한다.
 */
@Component
@Slf4j
public class AdminAuthInterceptor implements HandlerInterceptor {

    public static final String ADMIN_TOKEN_HEADER = "X-Admin-Token";

    private static final Set<String> MUTATING_METHODS =
            Set.of("POST", "PUT", "PATCH", "DELETE");

    @Value("${admin.token:}")
    private String adminToken;

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) throws Exception {

        if (adminToken == null || adminToken.isBlank()) {
            return true;
        }

        /*
         * CORS preflight 에는 커스텀 헤더가 실리지 않는다.
         */
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }

        if (!requiresAdmin(request)) {
            return true;
        }

        String provided = request.getHeader(ADMIN_TOKEN_HEADER);

        if (matches(provided)) {
            return true;
        }

        log.warn(
                "관리자 인증 실패: {} {}",
                request.getMethod(),
                request.getRequestURI()
        );

        writeUnauthorized(response);

        return false;
    }

    /**
     * 보호 대상 판별.
     *
     * - 참가자 투표 경로(/api/sessions/{year}/votes/**)는 POST 지만 공개다.
     * - 결과/세션 조회(GET)는 결과 화면과 참가자 화면이 사용하므로 공개다.
     * - CSV 출력은 GET 이지만 투표자 토큰까지 포함되므로 보호한다.
     */
    private boolean requiresAdmin(HttpServletRequest request) {
        String path = request.getRequestURI();

        if (path.contains("/export")) {
            return true;
        }

        if (!MUTATING_METHODS.contains(request.getMethod())) {
            return false;
        }

        return !isParticipantVotePath(path);
    }

    private boolean isParticipantVotePath(String path) {
        return path.matches("/api/sessions/\\d+/votes(/.*)?");
    }

    /**
     * 타이밍 공격을 피하기 위해 길이에 무관한 상수 시간 비교를 사용한다.
     */
    private boolean matches(String provided) {
        if (provided == null) {
            return false;
        }

        return MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                adminToken.getBytes(StandardCharsets.UTF_8)
        );
    }

    /**
     * 인터셉터는 @RestControllerAdvice 보다 앞서 동작하므로
     * 실패 응답을 직접 작성한다.
     *
     * 본문 형태는 ErrorResponse 와 동일하게 맞춰
     * 프론트엔드가 message 만 읽어도 처리할 수 있게 한다.
     */
    private void writeUnauthorized(HttpServletResponse response) throws Exception {
        String body = """
                {"status":%d,"code":"%s","message":"%s","timestamp":"%s"}"""
                .formatted(
                        HttpStatus.UNAUTHORIZED.value(),
                        "ADMIN_TOKEN_REQUIRED",
                        "관리자 인증이 필요합니다. 관리자 키를 확인해 주세요.",
                        LocalDateTime.now()
                );

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setHeader(
                HttpHeaders.CONTENT_TYPE,
                MediaType.APPLICATION_JSON_VALUE
        );
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(body);
    }
}
