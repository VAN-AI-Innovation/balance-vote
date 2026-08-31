package com.vote.balance.balancevote.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "vote_record",
        uniqueConstraints = @UniqueConstraint(columnNames = {"session_id", "voter_token"})
)
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoteRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private VoteSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_id", nullable = false)
    private VoteOption option;

    @Column(name = "voter_token", nullable = false)
    private String voterToken;

    @Column(nullable = false, updatable = false)
    private LocalDateTime votedAt;

    @PrePersist
    protected void onCreate() {
        this.votedAt = LocalDateTime.now();
    }
}