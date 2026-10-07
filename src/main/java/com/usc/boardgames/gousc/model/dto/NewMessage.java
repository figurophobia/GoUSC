package com.usc.boardgames.gousc.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NewMessage(@NotBlank @Size(min = 1, max = 1000) String content) {
}
