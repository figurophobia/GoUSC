package com.usc.boardgames.gousc.exception;

import com.usc.boardgames.gousc.model.entity.Friendship;
import lombok.Getter;

@Getter
public class DuplicateFriendshipException extends Exception {
    private final Friendship friendship;

    public DuplicateFriendshipException(Friendship friendship) {
        super("A friendship or request between these users already exists!");
        this.friendship = friendship;
    }
}
