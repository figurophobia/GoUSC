package com.usc.boardgames.gousc.controller;

import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.Message;
import com.usc.boardgames.gousc.model.dto.NewMessage;
import com.usc.boardgames.gousc.service.MessageService;
import com.usc.boardgames.gousc.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("messages")
public class MessageController {

    private final MessageService messages;
    private final UserService users;

    @Autowired
    public MessageController(MessageService messages, UserService users) {
        this.messages = messages;
        this.users = users;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Message> send(@RequestHeader("X-User-Id") Long userId,
                                        @RequestParam("to") Long to,
                                        @jakarta.validation.Valid @RequestBody NewMessage body)
            throws UserNotFoundException {
        return ResponseEntity.ok(messages.sendPrivate(users.get(userId), to, body.content()));
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Message>> get(@RequestHeader("X-User-Id") Long userId,
                                             @RequestParam("with") Long with)
            throws UserNotFoundException {
        return ResponseEntity.ok(messages.listPrivate(userId, with));
    }
}
