package com.usc.boardgames.gousc.model.entity;

public enum StoneColor {
    BLACK,
    WHITE;

    public StoneColor opposite() {
        return this == BLACK ? WHITE : BLACK;
    }
}
