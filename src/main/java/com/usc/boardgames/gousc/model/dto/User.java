package com.usc.boardgames.gousc.model.dto;

import com.fasterxml.jackson.annotation.JsonView;

import java.time.LocalDateTime;

public record User(
        @JsonView(Views.Public.class) Long id,
        @JsonView(Views.Public.class) String username,
        @JsonView(Views.Private.class) String password,
        @JsonView(Views.Public.class) String email,
        @JsonView(Views.Public.class) Integer elo,
        @JsonView(Views.Public.class) Integer wins,
        @JsonView(Views.Public.class) Integer losses,
        @JsonView(Views.Public.class) LocalDateTime createdAt
) {
    public static User from(com.usc.boardgames.gousc.model.entity.User user) {
        return new User(
                user.getId(),
                user.getUsername(),
                user.getPassword(),
                user.getEmail(),
                user.getElo(),
                user.getWins(),
                user.getLosses(),
                user.getCreatedAt()
        );
    }
}
