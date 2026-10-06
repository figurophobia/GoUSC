package com.usc.boardgames.gousc.model.dto;

import com.usc.boardgames.gousc.model.entity.FriendshipStatus;

import java.time.LocalDateTime;

public record Friendship(
        Long id,
        User requester,
        User addressee,
        FriendshipStatus status,
        LocalDateTime createdAt
) {
    public static Friendship from(com.usc.boardgames.gousc.model.entity.Friendship friendship) {
        return new Friendship(
                friendship.getId(),
                User.from(friendship.getRequester()),
                User.from(friendship.getAddressee()),
                friendship.getStatus(),
                friendship.getCreatedAt()
        );
    }
}
