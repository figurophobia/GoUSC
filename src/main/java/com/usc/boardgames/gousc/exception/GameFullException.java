package com.usc.boardgames.gousc.exception;

import lombok.Getter;

@Getter
public class GameFullException extends Exception {
    private final Long gameId;

    public GameFullException(Long gameId) {
        super("Game already has two players: " + gameId);
        this.gameId = gameId;
    }
}
