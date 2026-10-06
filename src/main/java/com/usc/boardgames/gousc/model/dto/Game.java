package com.usc.boardgames.gousc.model.dto;

import com.usc.boardgames.gousc.model.entity.BoardSize;
import com.usc.boardgames.gousc.model.entity.GameMode;
import com.usc.boardgames.gousc.model.entity.GameStatus;
import com.usc.boardgames.gousc.model.entity.StoneColor;

import java.time.LocalDateTime;

public record Game(
        Long id,
        BoardSize boardSize,
        GameMode mode,
        GameStatus status,
        User blackPlayer,
        User whitePlayer,
        User winner,
        String boardState,
        String moveHistory,
        StoneColor currentTurn,
        Integer consecutivePasses,
        Integer capturesBlack,
        Integer capturesWhite,
        Double komi,
        Double finalScoreBlack,
        Double finalScoreWhite,
        Integer eloChangeBlack,
        Integer eloChangeWhite,
        LocalDateTime createdAt,
        LocalDateTime finishedAt
) {
    public static Game from(com.usc.boardgames.gousc.model.entity.Game game) {
        return new Game(
                game.getId(),
                game.getBoardSize(),
                game.getMode(),
                game.getStatus(),
                User.from(game.getBlackPlayer()),
                game.getWhitePlayer() != null ? User.from(game.getWhitePlayer()) : null,
                game.getWinner() != null ? User.from(game.getWinner()) : null,
                game.getBoardState(),
                game.getMoveHistory(),
                game.getCurrentTurn(),
                game.getConsecutivePasses(),
                game.getCapturesBlack(),
                game.getCapturesWhite(),
                game.getKomi(),
                game.getFinalScoreBlack(),
                game.getFinalScoreWhite(),
                game.getEloChangeBlack(),
                game.getEloChangeWhite(),
                game.getCreatedAt(),
                game.getFinishedAt()
        );
    }
}
