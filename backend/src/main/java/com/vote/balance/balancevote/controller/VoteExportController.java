package com.vote.balance.balancevote.controller;

import com.vote.balance.balancevote.service.VoteExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * 투표 결과 CSV 출력.
 *
 * 진행 후 세션별 결과를 개별/전체로 내려받을 수 있게 한다.
 */
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class VoteExportController {

    private static final MediaType CSV_UTF8 =
            new MediaType("text", "csv", StandardCharsets.UTF_8);

    private final VoteExportService voteExportService;

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll() {
        return csv(
                voteExportService.exportAllSummaries(),
                voteExportService.allSummaryFileName()
        );
    }

    @GetMapping("/{year}/export")
    public ResponseEntity<byte[]> exportSession(@PathVariable Integer year) {
        return csv(
                voteExportService.exportSessionSummary(year),
                voteExportService.summaryFileName(year)
        );
    }

    @GetMapping("/{year}/export/records")
    public ResponseEntity<byte[]> exportSessionRecords(@PathVariable Integer year) {
        return csv(
                voteExportService.exportSessionRecords(year),
                voteExportService.recordsFileName(year)
        );
    }

    private ResponseEntity<byte[]> csv(String body, String fileName) {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .contentType(CSV_UTF8)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(fileName, StandardCharsets.UTF_8)
                                .build()
                                .toString()
                )
                /*
                 * 브라우저가 이전 다운로드를 캐시해 오래된 결과를 주지 않도록 한다.
                 */
                .cacheControl(org.springframework.http.CacheControl.noStore())
                .body(bytes);
    }
}
