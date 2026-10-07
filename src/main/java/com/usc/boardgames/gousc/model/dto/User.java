package com.usc.boardgames.gousc.model.dto;

import com.fasterxml.jackson.annotation.JsonView;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record User(
        @JsonView(Views.Public.class) Long id,
        @JsonView(Views.Public.class) @NotBlank @Size(min = 3, max = 50) String username,
        @JsonView(Views.Private.class) @NotBlank @Size(min = 3) String password,
        @JsonView(Views.Public.class) @Email String email,
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
