package com.usc.boardgames.gousc.model.dto;

public record Move(Integer x, Integer y, Boolean pass) {

    public boolean isPass() {
        return Boolean.TRUE.equals(pass);
    }
}
