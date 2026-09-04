package com.vote.balance.balancevote.controller;

import com.vote.balance.balancevote.dto.VoteRequest;
import com.vote.balance.balancevote.dto.VoteResultResponse;
import com.vote.balance.balancevote.service.VoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{year}/votes")
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    @PostMapping
    public ResponseEntity<VoteResultResponse> vote(
            @PathVariable Integer year,
            @RequestBody VoteRequest request
    ) {
        return ResponseEntity.ok(
                voteService.vote(year, request)
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
}