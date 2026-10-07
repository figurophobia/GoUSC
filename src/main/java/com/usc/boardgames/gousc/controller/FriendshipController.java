package com.usc.boardgames.gousc.controller;

import com.usc.boardgames.gousc.exception.DuplicateFriendshipException;
import com.usc.boardgames.gousc.exception.FriendshipNotFoundException;
import com.usc.boardgames.gousc.exception.FriendshipStateException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.Friendship;
import com.usc.boardgames.gousc.model.dto.FriendshipRequest;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.service.FriendshipService;
import com.usc.boardgames.gousc.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("friendships")
public class FriendshipController {

    private final FriendshipService friendships;
    private final UserService users;

    @Autowired
    public FriendshipController(FriendshipService friendships, UserService users) {
        this.friendships = friendships;
        this.users = users;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Friendship> request(@RequestHeader("X-User-Id") Long userId,
                                               @jakarta.validation.Valid @RequestBody FriendshipRequest body)
            throws UserNotFoundException, DuplicateFriendshipException {
        Friendship created = friendships.request(users.get(userId), body.addresseeId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PostMapping(path = "{id}/accept", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Friendship> accept(@PathVariable Long id,
                                             @RequestHeader("X-User-Id") Long userId)
            throws FriendshipNotFoundException, FriendshipStateException, UserNotFoundException {
        return ResponseEntity.ok(friendships.accept(id, users.get(userId)));
    }

    @PostMapping(path = "{id}/reject", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Friendship> reject(@PathVariable Long id,
                                             @RequestHeader("X-User-Id") Long userId)
            throws FriendshipNotFoundException, FriendshipStateException, UserNotFoundException {
        return ResponseEntity.ok(friendships.reject(id, users.get(userId)));
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<User>> friends(@RequestHeader("X-User-Id") Long userId)
            throws UserNotFoundException {
        return ResponseEntity.ok(friendships.listFriends(users.get(userId)));
    }

    @GetMapping(path = "pending", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Friendship>> pending(@RequestHeader("X-User-Id") Long userId)
            throws UserNotFoundException {
        return ResponseEntity.ok(friendships.listPending(users.get(userId)));
    }
}
