package com.usc.boardgames.gousc.exception;

import lombok.Getter;

@Getter
public class FriendshipNotFoundException extends Exception {
    private final Long friendshipId;

    public FriendshipNotFoundException(Long friendshipId) {
        super("Friendship not found: " + friendshipId);
        this.friendshipId = friendshipId;
    }
}
