package com.usc.boardgames.gousc.model.dto;

import jakarta.validation.constraints.NotNull;

public record FriendshipRequest(@NotNull Long addresseeId) {
}
