package com.usc.boardgames.gousc.exception;

public class GameStateException extends Exception {
    private final Long gameId;

    public GameStateException(Long gameId, String message) {
        super(message);
        this.gameId = gameId;
    }

    public Long getGameId() {
        return gameId;
    }
}
