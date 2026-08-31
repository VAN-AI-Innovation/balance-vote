package com.vote.balance.balancevote.controller;

import com.vote.balance.balancevote.service.VoteSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class VoteSessionAdminController {

    private final VoteSessionService voteSessionService;

    @PostMapping("/{year}/open")
    public ResponseEntity<Void> open(@PathVariable Integer year) {
        voteSessionService.open(year);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{year}/close")
    public ResponseEntity<Void> close(@PathVariable Integer year) {
        voteSessionService.close(year);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{year}/reset")
    public ResponseEntity<Void> reset(@PathVariable Integer year) {
        voteSessionService.reset(year);
        return ResponseEntity.ok().build();
    }
}