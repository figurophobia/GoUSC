package com.usc.boardgames.gousc.controller;

import com.usc.boardgames.gousc.exception.GameFullException;
import com.usc.boardgames.gousc.exception.GameNotFoundException;
import com.usc.boardgames.gousc.exception.GameStateException;
import com.usc.boardgames.gousc.exception.InvalidMoveException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.Game;
import com.usc.boardgames.gousc.model.dto.Message;
import com.usc.boardgames.gousc.model.dto.Move;
import com.usc.boardgames.gousc.model.dto.NewGame;
import com.usc.boardgames.gousc.model.dto.NewMessage;
import com.usc.boardgames.gousc.model.entity.GameStatus;
import com.usc.boardgames.gousc.service.GameService;
import com.usc.boardgames.gousc.service.MessageService;
import com.usc.boardgames.gousc.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("games")
public class GameController {

    private final GameService games;
    private final UserService users;
    private final MessageService messages;

    @Autowired
    public GameController(GameService games, UserService users, MessageService messages) {
        this.games = games;
        this.users = users;
        this.messages = messages;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Game> create(@RequestHeader("X-User-Id") Long userId,
                                       @RequestBody NewGame request)
            throws UserNotFoundException {
        Game created = games.create(users.get(userId), request.boardSize(), request.mode());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Game>> get(
            @RequestParam(value = "status", required = false) GameStatus status,
            @RequestParam(value = "player", required = false) Long playerId
    ) throws UserNotFoundException {
        if (playerId != null) {
            List<Game> mine = games.listByUser(users.get(playerId));
            if (status != null) {
                mine = mine.stream().filter(g -> g.status() == status).toList();
            }
            return ResponseEntity.ok(mine);
        }
        if (status != null) {
            return ResponseEntity.ok(games.list(status));
        }
        return ResponseEntity.ok(games.listAll());
    }

    @GetMapping(path = "{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Game> get(@PathVariable Long id) throws GameNotFoundException {
        return ResponseEntity.ok(games.get(id));
    }

    @PostMapping(path = "{id}/join", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Game> join(@PathVariable Long id,
                                     @RequestHeader("X-User-Id") Long userId)
            throws GameNotFoundException, GameFullException, GameStateException, UserNotFoundException {
        return ResponseEntity.ok(games.join(id, users.get(userId)));
    }

    @PostMapping(path = "{id}/leave", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Game> leave(@PathVariable Long id,
                                      @RequestHeader("X-User-Id") Long userId)
            throws GameNotFoundException, GameStateException, UserNotFoundException {
        return ResponseEntity.ok(games.leave(id, users.get(userId)));
    }

    @PostMapping(path = "{id}/moves", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Game> move(@PathVariable Long id,
                                     @RequestHeader("X-User-Id") Long userId,
                                     @RequestBody Move move)
            throws GameNotFoundException, GameStateException, InvalidMoveException, UserNotFoundException {
        return ResponseEntity.ok(games.playMove(id, users.get(userId), move));
    }

    @GetMapping(path = "{id}/messages", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Message>> getMessages(@PathVariable Long id)
            throws GameNotFoundException {
        return ResponseEntity.ok(messages.listGame(id));
    }

    @PostMapping(path = "{id}/messages", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Message> sendMessage(@PathVariable Long id,
                                               @RequestHeader("X-User-Id") Long userId,
                                               @RequestBody NewMessage body)
            throws GameNotFoundException, GameStateException, UserNotFoundException {
        return ResponseEntity.ok(messages.sendGame(id, users.get(userId), body.content()));
    }
}
