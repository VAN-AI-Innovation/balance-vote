package com.vote.balance.balancevote.config;

import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.domain.VoteStatus;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private static final List<Integer> YEARS = List.of(2030, 2035, 2040, 2045, 2050);

    private final VoteSessionRepository voteSessionRepository;

    @Override
    public void run(String... args) {
        if (voteSessionRepository.count() > 0) return;

        YEARS.forEach(year ->
                voteSessionRepository.save(
                        VoteSession.builder()
                                .year(year)
                                .status(VoteStatus.WAITING)
                                .build()
                )
        );
    }
}