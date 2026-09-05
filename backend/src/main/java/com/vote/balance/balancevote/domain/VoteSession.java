package com.vote.balance.balancevote.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "vote_session")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoteSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Integer year;

    /**
     * 밸런스 게임 문제 문구.
     *
     * 결과 화면 상단과 CSV 출력 헤더에 사용한다.
     * 진행 직전까지 수정될 수 있으므로 nullable 로 둔다.
     */
    @Column(length = 500)
    private String question;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VoteStatus status;

    @Column(nullable = false)
    @Builder.Default
    private boolean current = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * 실제로 투표를 오픈/마감한 시각.
     *
     * 세션별 결과를 출력할 때 진행 기록으로 사용한다.
     * 재오픈 시 openedAt 은 최초 오픈 시각을 유지하고
     * closedAt 만 마감할 때마다 갱신한다.
     */
    private LocalDateTime openedAt;

    private LocalDateTime closedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<VoteOption> options = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = VoteStatus.WAITING;
        }
    }

    public void open() {
        this.status = VoteStatus.OPEN;

        /*
         * 최초 오픈 시각만 기록한다.
         * 재오픈으로 openedAt 이 덮어써지면 진행 기록이 사라진다.
         */
        if (this.openedAt == null) {
            this.openedAt = LocalDateTime.now();
        }

        /*
         * 재오픈하면 이전 마감 시각은 더 이상 유효하지 않다.
         */
        this.closedAt = null;
    }

    public void close() {
        this.status = VoteStatus.CLOSED;
        this.closedAt = LocalDateTime.now();
    }

    public void reopen() {
        open();
    }

    public void reset() {
        this.status = VoteStatus.WAITING;
        this.openedAt = null;
        this.closedAt = null;
    }

    public void updateQuestion(String question) {
        this.question = question;
    }

    public void selectAsCurrent() {
        this.current = true;
    }

    public void clearCurrent() {
        this.current = false;
    }
}
