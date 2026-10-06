package com.usc.boardgames.gousc.model.dto;

import com.usc.boardgames.gousc.model.entity.BoardSize;
import com.usc.boardgames.gousc.model.entity.GameMode;

public record NewGame(BoardSize boardSize, GameMode mode) {
}
