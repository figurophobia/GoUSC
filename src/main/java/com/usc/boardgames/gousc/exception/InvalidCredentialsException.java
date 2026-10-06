package com.usc.boardgames.gousc.exception;

public class InvalidCredentialsException extends Exception {
    public InvalidCredentialsException() {
        super("Usuario o contraseña incorrectos");
    }
}
