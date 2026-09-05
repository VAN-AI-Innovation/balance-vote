package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteOption;
import com.vote.balance.balancevote.domain.VoteRecord;
import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.dto.VoteRequest;
import com.vote.balance.balancevote.dto.VoteResultResponse;
import com.vote.balance.balancevote.repository.VoteOptionRepository;
import com.vote.balance.balancevote.repository.VoteRecordRepository;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteService {

    private final VoteSessionRepository voteSessionRepository;
    private final VoteOptionRepository voteOptionRepository;
    private final VoteRecordRepository voteRecordRepository;
    private final VoteTallyService voteTallyService;
    private final VoteBroadcaster voteBroadcaster;

    @Transactional
    public VoteResultResponse vote(
            Integer year,
            VoteRequest request
    ) {
        VoteSession session = findSession(year);

        if (session.getStatus() != VoteStatus.OPEN) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "OPEN 상태의 세션에서만 투표할 수 있습니다."
            );
        }

        if (voteRecordRepository.existsBySessionIdAndVoterToken(
                session.getId(),
                request.voterToken()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 투표한 사용자입니다."
            );
        }

        VoteOption option = findOption(request.optionId());

        if (!option.getSession().getId().equals(session.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "해당 세션의 선택지를 찾을 수 없습니다."
            );
        }

        VoteRecord voteRecord = VoteRecord.builder()
                .session(session)
                .option(option)
                .voterToken(request.voterToken())
                .build();

        try {
            voteRecordRepository.saveAndFlush(voteRecord);
        } catch (DataIntegrityViolationException e) {
            /*
             * 위 existsBy 검사와 저장 사이에 동일 토큰이 끼어든 경우다.
             * (session_id, voter_token) UNIQUE 제약이 최종 방어선이다.
             */
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 투표한 사용자입니다."
            );
        }

        VoteResultResponse result = voteTallyService.tally(session);

        /*
         * 커밋 이후에 발행된다. VoteBroadcaster 주석 참고.
         */
        voteBroadcaster.broadcastResult(result);

        return result;
    }

    public String issueVoterToken(Integer year) {
        VoteSession session = findSession(year);

        if (session.getStatus() != VoteStatus.OPEN) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "OPEN 상태의 세션에서만 투표자 토큰을 발급할 수 있습니다."
            );
        }

        return UUID.randomUUID().toString();
    }

    public boolean hasVoted(Integer year, String voterToken) {
        VoteSession session = findSession(year);

        return voteRecordRepository.existsBySessionIdAndVoterToken(
                session.getId(),
                voterToken
        );
    }

    public VoteResultResponse getResult(Integer year) {
        return voteTallyService.tally(findSession(year));
    }

    private VoteSession findSession(Integer year) {
        return voteSessionRepository.findByYear(year)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        year + "년 세션을 찾을 수 없습니다."
                ));
    }

    private VoteOption findOption(Long optionId) {
        return voteOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "선택지를 찾을 수 없습니다."
                ));
    }
}
