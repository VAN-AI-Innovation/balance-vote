package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.repository.VoteRecordRepository;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteSessionService {

    private final VoteSessionRepository voteSessionRepository;
    private final VoteRecordRepository voteRecordRepository;

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