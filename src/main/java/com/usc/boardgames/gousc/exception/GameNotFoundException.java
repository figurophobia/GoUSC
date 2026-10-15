package com.usc.boardgames.gousc.exception;

import lombok.Getter;

@Getter
public class GameNotFoundException extends Exception {
    private final Long gameId;

    public GameNotFoundException(Long gameId) {
        super("Game not found: " + gameId);
        this.gameId = gameId;
    }
}
