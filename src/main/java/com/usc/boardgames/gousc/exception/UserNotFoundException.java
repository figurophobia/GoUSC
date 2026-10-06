package com.usc.boardgames.gousc.exception;

public class UserNotFoundException extends Exception {
    private final String identifier;

    public UserNotFoundException(String identifier) {
        super("User not found: " + identifier);
        this.identifier = identifier;
    }

    public String getIdentifier() {
        return identifier;
    }
}
