package com.usc.boardgames.gousc.exception;

import lombok.Getter;

@Getter
public class FriendshipStateException extends Exception {
    private final Long friendshipId;

    public FriendshipStateException(Long friendshipId, String message) {
        super(message);
        this.friendshipId = friendshipId;
    }
}
