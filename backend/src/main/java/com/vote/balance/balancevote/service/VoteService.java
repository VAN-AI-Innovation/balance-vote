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
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteService {

    private final VoteSessionRepository voteSessionRepository;
    private final VoteOptionRepository voteOptionRepository;
    private final VoteRecordRepository voteRecordRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public VoteResultResponse vote(
            Integer year,
            VoteRequest request
    ) {
        validateRequest(request);

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

        voteRecordRepository.save(voteRecord);

        VoteResultResponse result = getResult(session);

        messagingTemplate.convertAndSend(
                "/topic/vote/" + year,
                result
        );

        return result;
    }

    public VoteResultResponse getResult(Integer year) {
        VoteSession session = findSession(year);

        return getResult(session);
    }

    private VoteResultResponse getResult(VoteSession session) {
        List<VoteOption> options =
                voteOptionRepository.findBySessionId(session.getId());

        long totalVotes = options.stream()
                .mapToLong(option ->
                        voteRecordRepository.countBySessionIdAndOptionId(
                                session.getId(),
                                option.getId()
                        )
                )
                .sum();

        List<VoteResultResponse.OptionResult> results =
                options.stream()
                        .map(option -> {
                            long voteCount =
                                    voteRecordRepository.countBySessionIdAndOptionId(
                                            session.getId(),
                                            option.getId()
                                    );

                            BigDecimal voteRate = calculateVoteRate(
                                    voteCount,
                                    totalVotes
                            );

                            return new VoteResultResponse.OptionResult(
                                    option.getId(),
                                    option.getLabel(),
                                    voteCount,
                                    voteRate
                            );
                        })
                        .toList();

        return new VoteResultResponse(
                session.getYear(),
                totalVotes,
                results
        );
    }

    private BigDecimal calculateVoteRate(
            long voteCount,
            long totalVotes
    ) {
        if (totalVotes == 0) {
            return BigDecimal.ZERO.setScale(1);
        }

        return BigDecimal.valueOf(voteCount)
                .multiply(BigDecimal.valueOf(100))
                .divide(
                        BigDecimal.valueOf(totalVotes),
                        1,
                        RoundingMode.HALF_UP
                );
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

    private void validateRequest(VoteRequest request) {
        if (request == null
                || request.optionId() == null
                || request.voterToken() == null
                || request.voterToken().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "선택지와 투표자 토큰은 필수입니다."
            );
        }
    }
}