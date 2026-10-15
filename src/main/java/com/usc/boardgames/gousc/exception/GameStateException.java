package com.usc.boardgames.gousc.exception;

import lombok.Getter;

@Getter
public class GameStateException extends Exception {
    private final Long gameId;

    public GameStateException(Long gameId, String message) {
        super(message);
        this.gameId = gameId;
    }
}
