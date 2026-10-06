package com.usc.boardgames.gousc.exception;

public class GameFullException extends Exception {
    private final Long gameId;

    public GameFullException(Long gameId) {
        super("Game already has two players: " + gameId);
        this.gameId = gameId;
    }

    public Long getGameId() {
        return gameId;
    }
}
