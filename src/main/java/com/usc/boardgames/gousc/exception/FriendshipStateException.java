package com.usc.boardgames.gousc.exception;

public class FriendshipStateException extends Exception {
    private final Long friendshipId;

    public FriendshipStateException(Long friendshipId, String message) {
        super(message);
        this.friendshipId = friendshipId;
    }

    public Long getFriendshipId() {
        return friendshipId;
    }
}
