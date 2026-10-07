package com.usc.boardgames.gousc.model.dto;

import com.usc.boardgames.gousc.model.entity.BoardSize;
import com.usc.boardgames.gousc.model.entity.GameMode;
import jakarta.validation.constraints.NotNull;

public record NewGame(@NotNull BoardSize boardSize, @NotNull GameMode mode) {
}
