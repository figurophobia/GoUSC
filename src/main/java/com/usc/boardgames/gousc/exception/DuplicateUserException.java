package com.usc.boardgames.gousc.exception;

import com.usc.boardgames.gousc.model.entity.User;

public class DuplicateUserException extends Exception {
    private final User user;

    public DuplicateUserException(User user) {
        this.user = user;

        super("User already exists!");
    }

    public User getUser() {
        return user;
    }
}
