package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.dto.VoteSessionResponse;
import com.vote.balance.balancevote.repository.VoteRecordRepository;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteSessionService {

    private final VoteSessionRepository voteSessionRepository;
    private final VoteRecordRepository voteRecordRepository;

    public List<VoteSessionResponse> getAll() {
        return voteSessionRepository.findAllByOrderByYearAsc()
                .stream()
                .map(VoteSessionResponse::from)
                .toList();
    }

    public VoteSessionResponse get(Integer year) {
        return VoteSessionResponse.from(findSession(year));
    }

    public VoteSessionResponse getCurrent() {
        VoteSession currentSession =
                voteSessionRepository.findByCurrentTrue()
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "현재 선택된 투표 세션이 없습니다."
                        ));

        return VoteSessionResponse.from(currentSession);
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

        /*
         * 대상 세션이 실제로 존재하는지 먼저 확인한다.
         */
        findSession(year);

        /*
         * 기존 current=true 세션을 DB에서 먼저 해제한다.
         *
         * clearAutomatically = true이므로
         * bulk update 이후 영속성 컨텍스트도 초기화된다.
         */
        voteSessionRepository.clearCurrentSessions();

        /*
         * 영속성 컨텍스트가 초기화되었으므로
         * 대상 세션을 다시 조회한다.
         */
        VoteSession target = findSession(year);

        target.selectAsCurrent();

        /*
         * target은 현재 트랜잭션에서 관리되는 엔티티이므로
         * 트랜잭션 종료 시 current=true가 DB에 반영된다.
         */
        return VoteSessionResponse.from(target);
    }

    @Transactional
    public void open(Integer year) {
        VoteSession session = findSession(year);

        if (session.getStatus() != VoteStatus.WAITING) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "WAITING 상태의 세션만 오픈할 수 있습니다."
            );
        }

        session.open();
    }

    @Transactional
    public void close(Integer year) {
        VoteSession session = findSession(year);

        if (session.getStatus() != VoteStatus.OPEN) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "OPEN 상태의 세션만 마감할 수 있습니다."
            );
        }

        session.close();
    }

    @Transactional
    public void reset(Integer year) {
        VoteSession session = findSession(year);

        voteRecordRepository.deleteBySessionId(session.getId());

        session.reset();
    }

    private VoteSession findSession(Integer year) {
        return voteSessionRepository.findByYear(year)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        year + "년 세션을 찾을 수 없습니다."
                ));
    }
}