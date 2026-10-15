package com.usc.boardgames.gousc.exception;

import lombok.Getter;

@Getter
public class InvalidMoveException extends Exception {

    public enum Reason {
        NOT_YOUR_TURN,
        OCCUPIED_CELL,
        SUICIDE,
        KO,
        OUT_OF_RANGE
    }

    private final Reason reason;

    public InvalidMoveException(Reason reason) {
        super("Invalid move: " + reason);
        this.reason = reason;
    }
}
