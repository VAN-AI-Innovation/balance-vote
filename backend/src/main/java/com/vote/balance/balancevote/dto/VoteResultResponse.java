package com.vote.balance.balancevote.dto;

import java.math.BigDecimal;
import java.util.List;

public record VoteResultResponse(
        Integer year,
        String question,

        /*
         * 결과 화면이 '투표 진행 중 / 마감' 상태를 프레임 하나로 판단할 수 있도록
         * 세션 상태를 함께 실어 보낸다.
         */
        String status,
        long totalVotes,

        /*
         * 브로드캐스트 순번.
         *
         * 동시 투표 시 커밋 순서와 메시지 도착 순서가 어긋날 수 있으므로
         * 클라이언트가 이미 적용한 순번보다 작은 프레임을 버리는 데 사용한다.
         */
        long sequence,
        List<OptionResult> options
) {

    public record OptionResult(
            Long optionId,
            String label,
            long voteCount,
            BigDecimal voteRate
    ) {
    }

    /**
     * 순번만 교체한 사본을 만든다.
     *
     * 집계는 트랜잭션 안에서 수행하고 브로드캐스트는 커밋 후에 하므로
     * 순번 부여 시점이 집계 시점과 분리된다.
     */
    public VoteResultResponse withSequence(long sequence) {
        return new VoteResultResponse(
                year,
                question,
                status,
                totalVotes,
                sequence,
                options
        );
    }
}
