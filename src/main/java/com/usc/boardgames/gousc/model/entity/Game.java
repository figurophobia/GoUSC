package com.usc.boardgames.gousc.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

@Entity
@Table(name = "games")
@Getter
@Setter
@Accessors(chain = true)
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private BoardSize boardSize;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private GameMode mode;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private GameStatus status = GameStatus.WAITING;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "black_player_id", nullable = false)
    private User blackPlayer;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "white_player_id")
    private User whitePlayer;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "winner_id")
    private User winner;

    @Column(nullable = false, columnDefinition = "text")
    private String boardState = "{}";

    @Column(nullable = false, columnDefinition = "text")
    private String previousBoardState = "{}";

    @Column(nullable = false, columnDefinition = "text")
    private String moveHistory = "";

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private StoneColor currentTurn = StoneColor.BLACK;

    @Column(nullable = false)
    private Integer consecutivePasses = 0;

    @Column(nullable = false)
    private Integer capturesBlack = 0;

    @Column(nullable = false)
    private Integer capturesWhite = 0;

    @Column(nullable = false)
    private Double komi = 6.5;

    @Column
    private Double finalScoreBlack;

    @Column
    private Double finalScoreWhite;

    @Column
    private Integer eloChangeBlack;

    @Column
    private Integer eloChangeWhite;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column
    private LocalDateTime finishedAt;

    public Game() {}

    public Game(BoardSize boardSize, GameMode mode, User blackPlayer) {
        this.boardSize = boardSize;
        this.mode = mode;
        this.blackPlayer = blackPlayer;
    }
}
