package com.vote.balance.balancevote.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "vote_option")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoteOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private VoteSession session;

    @Column(nullable = false)
    private String label;

    private String colorTag;
}