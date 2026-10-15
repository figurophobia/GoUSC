package com.usc.boardgames.gousc.exception;

import lombok.Getter;

@Getter
public class UserNotFoundException extends Exception {
    private final String identifier;

    public UserNotFoundException(String identifier) {
        super("User not found: " + identifier);
        this.identifier = identifier;
    }
}
