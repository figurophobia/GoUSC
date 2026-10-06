package com.usc.boardgames.gousc.exception;

import com.usc.boardgames.gousc.model.entity.Friendship;

public class DuplicateFriendshipException extends Exception {
    private final Friendship friendship;

    public DuplicateFriendshipException(Friendship friendship) {
        super("A friendship or request between these users already exists!");
        this.friendship = friendship;
    }

    public Friendship getFriendship() {
        return friendship;
    }
}
