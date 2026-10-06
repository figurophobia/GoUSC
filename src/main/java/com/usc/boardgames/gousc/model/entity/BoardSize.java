package com.usc.boardgames.gousc.model.entity;

public enum BoardSize {
    NINE(9),
    THIRTEEN(13),
    NINETEEN(19);

    private final int size;

    BoardSize(int size) {
        this.size = size;
    }

    public int getSize() {
        return size;
    }
}
