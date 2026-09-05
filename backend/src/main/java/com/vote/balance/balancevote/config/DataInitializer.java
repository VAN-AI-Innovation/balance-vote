package com.vote.balance.balancevote.config;

import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final VoteSessionRepository voteSessionRepository;

    @Value("${vote.session.years:}")
    private String sessionYears;

    @Override
    public void run(String @NonNull ... args) {
        if (voteSessionRepository.count() > 0 || sessionYears.isBlank()) {
            return;
        }

        for (String value : sessionYears.split(",")) {
            Integer year = Integer.valueOf(value.trim());

            voteSessionRepository.save(
                    VoteSession.builder()
                            .year(year)
                            .status(VoteStatus.WAITING)
                            .build()
            );
        }
    }
}