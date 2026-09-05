package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.dto.VoteQuestionRequest;
import com.vote.balance.balancevote.dto.VoteSessionResponse;
import com.vote.balance.balancevote.repository.SessionCountProjection;
import com.vote.balance.balancevote.repository.VoteOptionRepository;
import com.vote.balance.balancevote.repository.VoteRecordRepository;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteSessionService {

    /**
     * 밸런스 게임은 최소 2개의 선택지가 있어야 성립한다.
     *
     * 선택지를 만들지 않은 세션을 실수로 오픈하면
     * 관객 화면에 선택지가 없는 투표가 노출되므로 오픈 시점에 막는다.
     */
    private static final int MIN_OPTION_COUNT = 2;

    private final VoteSessionRepository voteSessionRepository;
    private final VoteOptionRepository voteOptionRepository;
    private final VoteRecordRepository voteRecordRepository;
    private final VoteTallyService voteTallyService;
    private final VoteBroadcaster voteBroadcaster;

    public List<VoteSessionResponse> getAll() {
        List<VoteSession> sessions = voteSessionRepository.findAllByOrderByYearAsc();

        /*
         * 세션마다 COUNT 를 반복하지 않도록
         * 선택지 수와 득표수를 각각 한 번의 GROUP BY 로 가져온다.
         */
        Map<Long, Long> optionCounts = toCountMap(
                voteOptionRepository.countGroupBySessionId()
        );
        Map<Long, Long> voteCounts = toCountMap(
                voteRecordRepository.countGroupBySessionId()
        );

        return sessions.stream()
                .map(session -> VoteSessionResponse.from(
                        session,
                        optionCounts.getOrDefault(session.getId(), 0L).intValue(),
                        voteCounts.getOrDefault(session.getId(), 0L)
                ))
                .toList();
    }

    public VoteSessionResponse get(Integer year) {
        return toResponse(findSession(year));
    }

    public VoteSessionResponse getCurrent() {
        VoteSession currentSession =
                voteSessionRepository.findByCurrentTrue()
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "현재 선택된 투표 세션이 없습니다."
                        ));

        return toResponse(currentSession);
    }

    /**
     * 현재 세션 변경
     * 1. DB에서 현재 세션을 먼저 모두 false로 변경
     * 2. persistence context를 자동 clear
     * 3. 대상 세션을 다시 조회
     * 4. 대상 세션을 true로 변경
     *
     * 순서로 처리한다.
     */
    @Transactional
    public VoteSessionResponse selectCurrent(Integer year) {
        VoteSession target = makeCurrent(year);

        VoteSessionResponse response = toResponse(target);

        /*
         * 진행자가 다음 연도로 넘어갔음을 관객/결과 화면에 즉시 알린다.
         */
        voteBroadcaster.broadcastSession(response);

        return response;
    }

    /**
     * 연도별 투표를 오픈한다.
     *
     * WAITING(최초 오픈)과 CLOSED(재오픈)를 모두 허용한다.
     * 진행 중 네트워크 문제로 응답을 놓친 진행자가 다시 눌러도
     * 실패하지 않도록 이미 OPEN 인 경우는 그대로 통과시킨다.
     *
     * 오픈한 세션은 자동으로 '현재 세션'이 된다.
     * 진행자가 오픈만 하고 현재 세션 지정을 잊으면
     * 관객 화면이 다른 연도를 계속 보여주기 때문이다.
     */
    @Transactional
    public VoteSessionResponse open(Integer year) {
        VoteSession session = findSession(year);

        if (session.getStatus() != VoteStatus.OPEN) {
            validateOpenable(session);
            session.open();
        }

        /*
         * 다른 연도가 열려 있으면 먼저 마감한다.
         *
         * 동시에 두 연도가 열려 있으면 참가자가 어느 투표에 참여하는지
         * 알 수 없으므로 항상 한 번에 하나만 열리도록 보장한다.
         */
        closeOtherOpenSessions(session.getId());

        /*
         * makeCurrent 는 bulk update 로 영속성 컨텍스트를 초기화하므로
         * 상태 변경을 먼저 flush 한 뒤 세션을 다시 조회해서 사용한다.
         */
        VoteSession target = makeCurrent(year);

        VoteSessionResponse response = toResponse(target);

        voteBroadcaster.broadcastSession(response);

        /*
         * 재오픈이면 기존 득표가 남아 있으므로
         * 결과 화면이 즉시 최신 집계를 반영하도록 함께 발행한다.
         */
        voteBroadcaster.broadcastResult(voteTallyService.tally(target));

        return response;
    }

    /**
     * 진행 중인 세션을 마감한다.
     *
     * 이미 마감된 세션에 대한 재요청은 성공으로 처리한다.
     */
    @Transactional
    public VoteSessionResponse close(Integer year) {
        VoteSession session = findSession(year);

        if (session.getStatus() == VoteStatus.WAITING) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "시작되지 않은 세션은 마감할 수 없습니다."
            );
        }

        if (session.getStatus() == VoteStatus.OPEN) {
            session.close();
        }

        VoteSessionResponse response = toResponse(session);

        voteBroadcaster.broadcastSession(response);

        /*
         * 마감 순간의 최종 집계를 확정 발행한다.
         * 결과 화면이 status=CLOSED 와 최종 수치를 함께 받도록 한다.
         */
        voteBroadcaster.broadcastResult(voteTallyService.tally(session));

        return response;
    }

    /**
     * 마감된 세션을 투표 기록 삭제 없이 다시 오픈한다.
     *
     * open() 이 CLOSED -> OPEN 을 함께 처리하므로 위임한다.
     * 기존 클라이언트 호환을 위해 엔드포인트는 유지한다.
     */
    @Transactional
    public VoteSessionResponse reopen(Integer year) {
        return open(year);
    }

    /**
     * 세션을 초기화한다.
     *
     * reset 은 재오픈과 달리 기존 투표 기록을 모두 삭제하고
     * 세션을 WAITING 상태로 되돌린다.
     *
     * 리허설 직후 실제 진행을 시작할 때가 주 용도이므로
     * OPEN 상태에서도 허용한다. (기존에는 CLOSED 에서만 가능했다)
     */
    @Transactional
    public VoteSessionResponse reset(Integer year) {
        VoteSession session = findSession(year);

        voteRecordRepository.deleteBySessionId(session.getId());
        session.reset();

        VoteSessionResponse response = toResponse(session);

        voteBroadcaster.broadcastSession(response);

        /*
         * 초기화 후 빈 집계를 발행해야 결과 화면의 막대가 0으로 돌아간다.
         * 발행하지 않으면 이전 득표가 화면에 계속 남는다.
         */
        voteBroadcaster.broadcastResult(voteTallyService.tally(session));

        return response;
    }

    /**
     * 밸런스 게임 문제 문구를 저장한다.
     */
    @Transactional
    public VoteSessionResponse updateQuestion(
            Integer year,
            VoteQuestionRequest request
    ) {
        VoteSession session = findSession(year);

        String question = request.question() == null
                ? null
                : request.question().trim();

        session.updateQuestion(
                question == null || question.isBlank() ? null : question
        );

        VoteSessionResponse response = toResponse(session);

        voteBroadcaster.broadcastSession(response);
        voteBroadcaster.broadcastResult(voteTallyService.tally(session));

        return response;
    }

    /**
     * 대상 세션을 현재 세션으로 만든다.
     *
     * vote_session.current 에 부분 UNIQUE INDEX 가 있어
     * 기존 true 값을 DB 에 먼저 반영한 뒤에 대상을 true 로 바꿔야 한다.
     * clearCurrentSessions 는 clearAutomatically = true 이므로
     * 이후 반드시 세션을 다시 조회해야 한다.
     */
    private VoteSession makeCurrent(Integer year) {
        findSession(year);

        voteSessionRepository.clearCurrentSessions();

        VoteSession target = findSession(year);
        target.selectAsCurrent();

        return target;
    }

    /**
     * 대상 세션을 제외한 모든 OPEN 세션을 마감한다.
     */
    private void closeOtherOpenSessions(Long targetSessionId) {
        voteSessionRepository.findAllByStatus(VoteStatus.OPEN).stream()
                .filter(other -> !other.getId().equals(targetSessionId))
                .forEach(VoteSession::close);
    }

    private void validateOpenable(VoteSession session) {
        long optionCount = voteOptionRepository.countBySessionId(session.getId());

        if (optionCount < MIN_OPTION_COUNT) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "선택지를 " + MIN_OPTION_COUNT + "개 이상 등록한 뒤 오픈할 수 있습니다."
            );
        }
    }

    private VoteSessionResponse toResponse(VoteSession session) {
        return VoteSessionResponse.from(
                session,
                (int) voteOptionRepository.countBySessionId(session.getId()),
                voteRecordRepository.countBySessionId(session.getId())
        );
    }

    private Map<Long, Long> toCountMap(List<SessionCountProjection> projections) {
        return projections.stream()
                .collect(Collectors.toMap(
                        SessionCountProjection::getSessionId,
                        SessionCountProjection::getTotal,
                        (a, b) -> a
                ));
    }

    private VoteSession findSession(Integer year) {
        return voteSessionRepository.findByYear(year)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        year + "년 세션을 찾을 수 없습니다."
                ));
    }
}
