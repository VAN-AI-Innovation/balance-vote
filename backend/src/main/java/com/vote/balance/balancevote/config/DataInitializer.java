package com.vote.balance.balancevote.config;

import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final VoteSessionRepository voteSessionRepository;

    @Value("${vote.session.years:}")
    private String sessionYears;

    /**
     * 설정에 있는 연도 중 아직 없는 세션만 생성한다.
     *
     * 기존에는 세션이 하나라도 있으면 전체를 건너뛰었기 때문에
     * 나중에 연도를 추가해도 반영되지 않았다.
     * 이미 존재하는 세션은 상태와 득표를 유지하므로
     * 행사 중 재시작해도 안전하다.
     */
    @Override
    @Transactional
    public void run(String @NonNull ... args) {
        if (sessionYears == null || sessionYears.isBlank()) {
            return;
        }

        Set<Integer> existingYears = voteSessionRepository.findAll().stream()
                .map(VoteSession::getYear)
                .collect(Collectors.toSet());

        List<VoteSession> missing = parseYears().stream()
                .filter(year -> !existingYears.contains(year))
                .map(year -> VoteSession.builder()
                        .year(year)
                        .status(VoteStatus.WAITING)
                        .build())
                .toList();

        if (missing.isEmpty()) {
            return;
        }

        voteSessionRepository.saveAll(missing);

        log.info(
                "투표 세션을 생성했습니다: {}",
                missing.stream()
                        .map(session -> String.valueOf(session.getYear()))
                        .collect(Collectors.joining(", "))
        );
    }

    private List<Integer> parseYears() {
        return Arrays.stream(sessionYears.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Integer::valueOf)
                .distinct()
                .toList();
    }
}
