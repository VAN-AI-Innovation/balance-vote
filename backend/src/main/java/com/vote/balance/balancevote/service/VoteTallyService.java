package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteOption;
import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.dto.VoteResultResponse;
import com.vote.balance.balancevote.repository.VoteOptionRepository;
import com.vote.balance.balancevote.repository.VoteRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 득표 집계와 득표율 계산을 담당한다.
 *
 * 투표 처리(VoteService), 세션 상태 변경(VoteSessionService),
 * CSV 출력(VoteExportService)이 모두 동일한 집계 결과를 사용하도록
 * 별도 서비스로 분리했다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteTallyService {

    private static final int RATE_SCALE = 1;

    private final VoteOptionRepository voteOptionRepository;
    private final VoteRecordRepository voteRecordRepository;
    private final VoteBroadcaster voteBroadcaster;

    /**
     * 세션의 현재 집계를 만든다.
     *
     * 선택지 조회 1회 + 득표 집계 1회, 총 2개의 쿼리만 사용한다.
     */
    public VoteResultResponse tally(VoteSession session) {

        /*
         * 반드시 id 오름차순으로 조회한다.
         *
         * 선택지를 수정해도 id는 변경되지 않으므로
         * 수정 후에도 기존 순서가 유지된다.
         */
        List<VoteOption> options =
                voteOptionRepository.findBySessionIdOrderByIdAsc(session.getId());

        /*
         * 득표가 0인 선택지는 GROUP BY 결과에 행이 없으므로
         * Map 에서 조회할 때 0으로 기본값을 채운다.
         */
        Map<Long, Long> voteCounts = voteRecordRepository
                .tallyBySessionId(session.getId())
                .stream()
                .collect(Collectors.toMap(
                        VoteRecordRepository.OptionTally::getOptionId,
                        VoteRecordRepository.OptionTally::getVoteCount,
                        (a, b) -> a,
                        HashMap::new
                ));

        long totalVotes = options.stream()
                .mapToLong(option -> voteCounts.getOrDefault(option.getId(), 0L))
                .sum();

        List<VoteResultResponse.OptionResult> results = options.stream()
                .map(toOptionResult(voteCounts, totalVotes))
                .toList();

        return new VoteResultResponse(
                session.getYear(),
                session.getQuestion(),
                session.getStatus().name(),
                totalVotes,
                voteBroadcaster.currentSequence(),
                results
        );
    }

    private Function<VoteOption, VoteResultResponse.OptionResult> toOptionResult(
            Map<Long, Long> voteCounts,
            long totalVotes
    ) {
        return option -> {
            long voteCount = voteCounts.getOrDefault(option.getId(), 0L);

            return new VoteResultResponse.OptionResult(
                    option.getId(),
                    option.getLabel(),
                    voteCount,
                    calculateVoteRate(voteCount, totalVotes)
            );
        };
    }

    private BigDecimal calculateVoteRate(long voteCount, long totalVotes) {
        if (totalVotes == 0) {
            return BigDecimal.ZERO.setScale(RATE_SCALE);
        }

        return BigDecimal.valueOf(voteCount)
                .multiply(BigDecimal.valueOf(100))
                .divide(
                        BigDecimal.valueOf(totalVotes),
                        RATE_SCALE,
                        RoundingMode.HALF_UP
                );
    }
}
