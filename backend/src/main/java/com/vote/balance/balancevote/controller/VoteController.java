package com.vote.balance.balancevote.controller;

import com.vote.balance.balancevote.dto.VoteRequest;
import com.vote.balance.balancevote.dto.VoteResultResponse;
import com.vote.balance.balancevote.dto.VoteStatusResponse;
import com.vote.balance.balancevote.dto.VoterTokenResponse;
import com.vote.balance.balancevote.service.VoteService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{year}/votes")
@RequiredArgsConstructor
@Validated
public class VoteController {

    private final VoteService voteService;

    @PostMapping
    public ResponseEntity<VoteResultResponse> vote(
            @PathVariable Integer year,
            @Valid @RequestBody VoteRequest request
    ) {
        return ResponseEntity.ok(
                voteService.vote(year, request)
        );
    }

    @PostMapping("/token")
    public ResponseEntity<VoterTokenResponse> issueVoterToken(
            @PathVariable Integer year
    ) {
        return ResponseEntity.ok(
                new VoterTokenResponse(voteService.issueVoterToken(year))
        );
    }

    @GetMapping("/result")
    public ResponseEntity<VoteResultResponse> getResult(
            @PathVariable Integer year
    ) {
        return ResponseEntity.ok(
                voteService.getResult(year)
        );
    }

    @GetMapping("/status")
    public ResponseEntity<VoteStatusResponse> getVoteStatus(
            @PathVariable Integer year,

            /*
             * 빈 토큰은 이전에 hasVoted=false 로 조용히 넘어갔다.
             * 클라이언트 버그를 감추므로 400 으로 명시한다.
             */
            @RequestParam @NotBlank(message = "투표자 토큰은 필수입니다.") String voterToken
    ) {
        return ResponseEntity.ok(
                new VoteStatusResponse(voteService.hasVoted(year, voterToken))
        );
    }
}
