package com.usc.boardgames.gousc.model.dto;

import jakarta.validation.constraints.NotBlank;

public record Credentials(@NotBlank String username, @NotBlank String password) {
}
