package com.vote.balance.balancevote.controller;

import com.vote.balance.balancevote.dto.VoteOptionRequest;
import com.vote.balance.balancevote.dto.VoteOptionResponse;
import com.vote.balance.balancevote.service.VoteOptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions/{year}/options")
@RequiredArgsConstructor
public class VoteOptionAdminController {

    private final VoteOptionService voteOptionService;

    @GetMapping
    public ResponseEntity<List<VoteOptionResponse>> findAll(
            @PathVariable Integer year
    ) {
        return ResponseEntity.ok(
                voteOptionService.findAll(year)
        );
    }

    @PostMapping
    public ResponseEntity<VoteOptionResponse> create(
            @PathVariable Integer year,
            @Valid @RequestBody VoteOptionRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(voteOptionService.create(year, request));
    }

    @PutMapping("/{optionId}")
    public ResponseEntity<VoteOptionResponse> update(
            @PathVariable Integer year,
            @PathVariable Long optionId,
            @Valid @RequestBody VoteOptionRequest request
    ) {
        return ResponseEntity.ok(
                voteOptionService.update(
                        year,
                        optionId,
                        request
                )
        );
    }

    @DeleteMapping("/{optionId}")
    public ResponseEntity<Void> delete(
            @PathVariable Integer year,
            @PathVariable Long optionId
    ) {
        voteOptionService.delete(year, optionId);

        return ResponseEntity.noContent().build();
    }
}