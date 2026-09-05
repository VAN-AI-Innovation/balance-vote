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
        VoteSession currentSession = voteSessionRepository.findByCurrentTrue()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "현재 선택된 투표 세션이 없습니다."
                ));

        return VoteSessionResponse.from(currentSession);
    }

    @Transactional
    public VoteSessionResponse selectCurrent(Integer year) {
        VoteSession target = findSession(year);

        voteSessionRepository.findByCurrentTrue()
                .ifPresent(session -> {
                    if (!session.getId().equals(target.getId())) {
                        session.clearCurrent();
                    }
                });

        target.selectAsCurrent();

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
