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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VoteStatus status;

    @Column(nullable = false)
    @Builder.Default
    private boolean current = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

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
    }

    public void close() {
        this.status = VoteStatus.CLOSED;
    }

    public void reopen() {
        this.status = VoteStatus.OPEN;
    }

    public void reset() {
        this.status = VoteStatus.WAITING;
    }

    public void selectAsCurrent() {
        this.current = true;
    }

    public void clearCurrent() {
        this.current = false;
    }
}
