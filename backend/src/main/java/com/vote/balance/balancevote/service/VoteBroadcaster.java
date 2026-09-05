package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.dto.VoteResultResponse;
import com.vote.balance.balancevote.dto.VoteSessionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 실시간 브로드캐스트를 한곳에서 관리한다.
 *
 * 두 가지 문제를 해결하기 위해 서비스에서 분리했다.
 *
 * 1. 커밋 이후 발행
 *    기존에는 @Transactional 메서드 안에서 즉시 convertAndSend 를 호출했다.
 *    이 경우 이후 롤백이 발생하면 실제로 저장되지 않은 집계가 화면에 남고,
 *    커밋 전 집계가 나가므로 동시 투표 시 다른 트랜잭션의 결과를 놓친다.
 *
 * 2. 순번 부여
 *    동시에 여러 투표가 커밋되면 메시지 도착 순서가 뒤바뀔 수 있다.
 *    발행 직전에 순번을 붙여 클라이언트가 오래된 프레임을 버릴 수 있게 한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class VoteBroadcaster {

    public static final String RESULT_TOPIC_PREFIX = "/topic/vote/";
    public static final String SESSION_TOPIC_PREFIX = "/topic/session/";
    public static final String SESSION_TOPIC = "/topic/session";

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 서버 재시작 후에도 순번이 뒤로 가지 않도록 현재 시각(ms)에서 시작한다.
     *
     * 0에서 시작하면 재시작 직후 발행한 프레임의 순번이
     * 클라이언트가 이미 적용한 순번보다 작아져 갱신이 무시된다.
     */
    private final AtomicLong sequence = new AtomicLong(System.currentTimeMillis());

    /**
     * REST 응답에 실을 현재 순번.
     *
     * 재연결 직후의 REST 스냅샷이 최신으로 취급되도록
     * 마지막으로 발행한 순번을 그대로 사용한다.
     */
    public long currentSequence() {
        return sequence.get();
    }

    public void broadcastResult(VoteResultResponse result) {
        afterCommit(() -> {
            VoteResultResponse payload =
                    result.withSequence(sequence.incrementAndGet());

            messagingTemplate.convertAndSend(
                    RESULT_TOPIC_PREFIX + payload.year(),
                    payload
            );
        });
    }

    /**
     * 세션 상태 변경을 알린다.
     *
     * 연도별 토픽과 전체 토픽에 모두 발행한다.
     * 참가자/결과 화면은 진행자가 어느 연도를 여는지 미리 알 수 없으므로
     * 전체 토픽(/topic/session)을 구독해 현재 세션 전환까지 따라간다.
     */
    public void broadcastSession(VoteSessionResponse session) {
        afterCommit(() -> {
            messagingTemplate.convertAndSend(
                    SESSION_TOPIC_PREFIX + session.year(),
                    session
            );
            messagingTemplate.convertAndSend(SESSION_TOPIC, session);
        });
    }

    /**
     * 트랜잭션이 있으면 커밋 후에, 없으면 즉시 실행한다.
     */
    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            runQuietly(action);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        runQuietly(action);
                    }
                }
        );
    }

    /**
     * 브로드캐스트 실패가 투표 처리 자체를 실패시키지 않도록 한다.
     *
     * afterCommit 단계에서 예외가 나면 이미 커밋된 투표는 유지되지만
     * 호출자에게 500이 반환되어 참가자가 재투표를 시도하게 된다.
     */
    private void runQuietly(Runnable action) {
        try {
            action.run();
        } catch (Exception e) {
            log.warn("실시간 브로드캐스트에 실패했습니다.", e);
        }
    }
}
