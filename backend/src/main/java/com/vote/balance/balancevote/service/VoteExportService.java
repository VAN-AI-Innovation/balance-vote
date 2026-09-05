package com.vote.balance.balancevote.service;

import com.vote.balance.balancevote.domain.VoteRecord;
import com.vote.balance.balancevote.domain.VoteSession;
import com.vote.balance.balancevote.dto.VoteResultResponse;
import com.vote.balance.balancevote.repository.VoteRecordRepository;
import com.vote.balance.balancevote.repository.VoteSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 연도별 투표 결과를 CSV로 출력한다.
 *
 * 요구사항의 '5번의 투표 세션을 개별 관리/출력할 수 있는 구조'를 위해
 * 세션 단위 출력과 전체 세션 출력을 모두 제공한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoteExportService {

    /**
     * Excel 이 UTF-8 CSV 를 올바른 인코딩으로 열도록 BOM 을 붙인다.
     *
     * BOM 이 없으면 한글 라벨이 깨져서 보인다.
     */
    private static final String UTF8_BOM = "\uFEFF";

    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final String SUMMARY_HEADER =
            "연도,문제,상태,오픈시각,마감시각,선택지,득표수,득표율(%),총투표수";

    private static final String RECORD_HEADER =
            "연도,투표시각,선택지,투표자토큰";

    private final VoteSessionRepository voteSessionRepository;
    private final VoteRecordRepository voteRecordRepository;
    private final VoteTallyService voteTallyService;

    /**
     * 단일 연도의 집계 결과를 CSV로 출력한다.
     */
    public String exportSessionSummary(Integer year) {
        return buildSummaryCsv(List.of(findSession(year)));
    }

    /**
     * 전체 연도(2030~2050)의 집계 결과를 하나의 CSV로 출력한다.
     */
    public String exportAllSummaries() {
        return buildSummaryCsv(voteSessionRepository.findAllByOrderByYearAsc());
    }

    /**
     * 단일 연도의 개별 투표 기록을 CSV로 출력한다.
     *
     * 집계 검증이나 사후 분석이 필요할 때 사용한다.
     */
    public String exportSessionRecords(Integer year) {
        VoteSession session = findSession(year);

        List<VoteRecord> records =
                voteRecordRepository.findAllForExport(session.getId());

        StringBuilder csv = new StringBuilder(UTF8_BOM)
                .append(RECORD_HEADER)
                .append('\n');

        for (VoteRecord record : records) {
            appendRow(
                    csv,
                    String.valueOf(session.getYear()),
                    formatTimestamp(record.getVotedAt()),
                    record.getOption().getLabel(),
                    record.getVoterToken()
            );
        }

        return csv.toString();
    }

    public String summaryFileName(Integer year) {
        return "balance-vote-" + year + "-summary.csv";
    }

    public String allSummaryFileName() {
        return "balance-vote-all-summary.csv";
    }

    public String recordsFileName(Integer year) {
        return "balance-vote-" + year + "-records.csv";
    }

    private String buildSummaryCsv(List<VoteSession> sessions) {
        StringBuilder csv = new StringBuilder(UTF8_BOM)
                .append(SUMMARY_HEADER)
                .append('\n');

        for (VoteSession session : sessions) {
            VoteResultResponse result = voteTallyService.tally(session);

            /*
             * 선택지가 없는 세션도 진행 여부를 확인할 수 있도록
             * 빈 선택지 행을 한 줄 남긴다.
             */
            if (result.options().isEmpty()) {
                appendSummaryRow(csv, session, result, null);
                continue;
            }

            for (VoteResultResponse.OptionResult option : result.options()) {
                appendSummaryRow(csv, session, result, option);
            }
        }

        return csv.toString();
    }

    private void appendSummaryRow(
            StringBuilder csv,
            VoteSession session,
            VoteResultResponse result,
            VoteResultResponse.OptionResult option
    ) {
        appendRow(
                csv,
                String.valueOf(session.getYear()),
                nullToEmpty(session.getQuestion()),
                session.getStatus().name(),
                formatTimestamp(session.getOpenedAt()),
                formatTimestamp(session.getClosedAt()),
                option == null ? "" : option.label(),
                option == null ? "0" : String.valueOf(option.voteCount()),
                option == null ? "0.0" : option.voteRate().toPlainString(),
                String.valueOf(result.totalVotes())
        );
    }

    private void appendRow(StringBuilder csv, String... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                csv.append(',');
            }
            csv.append(escape(values[i]));
        }
        csv.append('\n');
    }

    /**
     * CSV 필드 이스케이프.
     *
     * 쉼표/줄바꿈/따옴표가 포함된 값은 따옴표로 감싸고
     * 내부 따옴표는 두 번 반복해 표현한다.
     */
    private String escape(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }

        boolean needsQuoting = value.contains(",")
                || value.contains("\"")
                || value.contains("\n")
                || value.contains("\r");

        if (!needsQuoting) {
            return value;
        }

        return '"' + value.replace("\"", "\"\"") + '"';
    }

    private String formatTimestamp(LocalDateTime value) {
        return value == null ? "" : value.format(TIMESTAMP_FORMAT);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private VoteSession findSession(Integer year) {
        return voteSessionRepository.findByYear(year)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        year + "년 세션을 찾을 수 없습니다."
                ));
    }
}
