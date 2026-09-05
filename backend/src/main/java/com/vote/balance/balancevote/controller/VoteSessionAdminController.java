package com.vote.balance.balancevote.controller;

import com.vote.balance.balancevote.dto.VoteQuestionRequest;
import com.vote.balance.balancevote.dto.VoteSessionResponse;
import com.vote.balance.balancevote.service.VoteSessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class VoteSessionAdminController {

    private final VoteSessionService voteSessionService;

    @GetMapping
    public ResponseEntity<List<VoteSessionResponse>> getAll() {
        return ResponseEntity.ok(voteSessionService.getAll());
    }

    @GetMapping("/current")
    public ResponseEntity<VoteSessionResponse> getCurrent() {
        return ResponseEntity.ok(voteSessionService.getCurrent());
    }

    @PutMapping("/{year}/current")
    public ResponseEntity<VoteSessionResponse> selectCurrent(
            @PathVariable Integer year
    ) {
        return ResponseEntity.ok(voteSessionService.selectCurrent(year));
    }

    @GetMapping("/{year}")
    public ResponseEntity<VoteSessionResponse> get(@PathVariable Integer year) {
        return ResponseEntity.ok(voteSessionService.get(year));
    }

    /*
     * open/close/reopen/reset 은 변경된 세션 상태를 그대로 반환한다.
     *
     * 기존에는 204 로 빈 본문을 반환해 관리자 화면이 상태를 직접
     * 추측해서 갱신해야 했다.
     */
    @PostMapping("/{year}/open")
    public ResponseEntity<VoteSessionResponse> open(@PathVariable Integer year) {
        return ResponseEntity.ok(voteSessionService.open(year));
    }

    @PostMapping("/{year}/close")
    public ResponseEntity<VoteSessionResponse> close(@PathVariable Integer year) {
        return ResponseEntity.ok(voteSessionService.close(year));
    }

    @PostMapping("/{year}/reopen")
    public ResponseEntity<VoteSessionResponse> reopen(@PathVariable Integer year) {
        return ResponseEntity.ok(voteSessionService.reopen(year));
    }

    @PostMapping("/{year}/reset")
    public ResponseEntity<VoteSessionResponse> reset(@PathVariable Integer year) {
        return ResponseEntity.ok(voteSessionService.reset(year));
    }

    @PutMapping("/{year}/question")
    public ResponseEntity<VoteSessionResponse> updateQuestion(
            @PathVariable Integer year,
            @Valid @RequestBody VoteQuestionRequest request
    ) {
        return ResponseEntity.ok(
                voteSessionService.updateQuestion(year, request)
        );
    }
}
