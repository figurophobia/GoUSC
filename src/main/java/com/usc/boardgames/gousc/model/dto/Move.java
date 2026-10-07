package com.usc.boardgames.gousc.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;

public record Move(Integer x, Integer y, Boolean pass) {

    public boolean isPass() {
        return Boolean.TRUE.equals(pass);
    }

    @AssertTrue(message = "Debe especificar pass=true o las coordenadas x,y")
    public boolean isValidMove() {
        if (Boolean.TRUE.equals(pass)) {
            return true;
        }
        return x != null && y != null;
    }
}
