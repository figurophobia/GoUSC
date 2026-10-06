package com.usc.boardgames.gousc.controller;

import com.usc.boardgames.gousc.exception.DuplicateFriendshipException;
import com.usc.boardgames.gousc.exception.DuplicateUserException;
import com.usc.boardgames.gousc.exception.FriendshipNotFoundException;
import com.usc.boardgames.gousc.exception.FriendshipStateException;
import com.usc.boardgames.gousc.exception.GameFullException;
import com.usc.boardgames.gousc.exception.GameNotFoundException;
import com.usc.boardgames.gousc.exception.GameStateException;
import com.usc.boardgames.gousc.exception.InvalidCredentialsException;
import com.usc.boardgames.gousc.exception.InvalidMoveException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.MvcUriComponentsBuilder;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;

@RestControllerAdvice
public class ErrorController extends ResponseEntityExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handle(UserNotFoundException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setDetail("No existe ningún usuario con identificador " + ex.getIdentifier());
        error.setType(uri("user-not-found"));
        error.setTitle("Usuario no encontrado");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(DuplicateUserException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handle(DuplicateUserException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setDetail("El usuario " + ex.getUser().getUsername() + " ya existe en la base de datos");
        error.setType(uri("duplicated-user"));
        error.setTitle("Usuario ya existente");
        return ErrorResponse.builder(ex, error)
                .header(HttpHeaders.LOCATION, MvcUriComponentsBuilder
                        .fromMethodName(UserController.class, "get", ex.getUser().getId())
                        .build().toUriString())
                .build();
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ErrorResponse handle(InvalidCredentialsException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        error.setDetail(ex.getMessage());
        error.setType(uri("invalid-credentials"));
        error.setTitle("Credenciales inválidas");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(GameNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handle(GameNotFoundException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setDetail("No existe ninguna partida con id " + ex.getGameId());
        error.setType(uri("game-not-found"));
        error.setTitle("Partida no encontrada");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(GameFullException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handle(GameFullException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setDetail("La partida " + ex.getGameId() + " ya tiene ambos jugadores");
        error.setType(uri("game-full"));
        error.setTitle("Partida completa");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(GameStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handle(GameStateException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setDetail(ex.getMessage());
        error.setType(uri("game-state"));
        error.setTitle("Estado de partida no válido");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(InvalidMoveException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handle(InvalidMoveException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        error.setDetail("Jugada inválida: " + ex.getReason());
        error.setType(uri("invalid-move"));
        error.setTitle("Jugada inválida");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(FriendshipNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handle(FriendshipNotFoundException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        error.setDetail("No existe ninguna solicitud de amistad con id " + ex.getFriendshipId());
        error.setType(uri("friendship-not-found"));
        error.setTitle("Solicitud de amistad no encontrada");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(DuplicateFriendshipException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handle(DuplicateFriendshipException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setDetail("Ya existe una solicitud de amistad entre "
                + ex.getFriendship().getRequester().getUsername() + " y "
                + ex.getFriendship().getAddressee().getUsername());
        error.setType(uri("duplicated-friendship"));
        error.setTitle("Solicitud de amistad duplicada");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(FriendshipStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handle(FriendshipStateException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        error.setDetail(ex.getMessage());
        error.setType(uri("friendship-state"));
        error.setTitle("Estado de solicitud no válido");
        return ErrorResponse.builder(ex, error).build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handle(IllegalArgumentException ex) {
        ProblemDetail error = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        error.setDetail(ex.getMessage());
        error.setType(uri("bad-request"));
        error.setTitle("Petición inválida");
        return ErrorResponse.builder(ex, error).build();
    }

    private static URI uri(String slug) {
        return MvcUriComponentsBuilder.fromController(ErrorController.class)
                .pathSegment("error", slug).build().toUri();
    }
}
