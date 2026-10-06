package com.usc.boardgames.gousc.exception;

public class GameNotFoundException extends Exception {
    private final Long gameId;

    public GameNotFoundException(Long gameId) {
        super("Game not found: " + gameId);
        this.gameId = gameId;
    }

    public Long getGameId() {
        return gameId;
    }
}
