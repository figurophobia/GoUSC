package com.usc.boardgames.gousc.controller;

import com.fasterxml.jackson.annotation.JsonView;
import com.usc.boardgames.gousc.exception.DuplicateUserException;
import com.usc.boardgames.gousc.exception.InvalidCredentialsException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.Credentials;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.model.dto.Views;
import com.usc.boardgames.gousc.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("users")
public class UserController {

    private final UserService users;

    @Autowired
    public UserController(UserService users) {
        this.users = users;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @JsonView(Views.Public.class)
    public ResponseEntity<User> create(@jakarta.validation.Valid @RequestBody User user) throws DuplicateUserException {
        User created = users.create(user);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PostMapping(path = "login", produces = MediaType.APPLICATION_JSON_VALUE)
    @JsonView(Views.Public.class)
    public ResponseEntity<User> login(@jakarta.validation.Valid @RequestBody Credentials credentials)
            throws UserNotFoundException, InvalidCredentialsException {
        return ResponseEntity.ok(users.login(credentials));
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @JsonView(Views.Public.class)
    public ResponseEntity<Page<User>> get(
            @RequestParam(value = "page", required = false, defaultValue = "0") int page,
            @RequestParam(value = "size", required = false, defaultValue = "10") int pagesize,
            @RequestParam(value = "sort", required = false, defaultValue = "") List<String> sort
    ) {
        return ResponseEntity.ok(users.get(
                PageRequest.of(page, pagesize,
                        Sort.by(sort.stream()
                                .map(key -> key.startsWith("-")
                                        ? Sort.Order.desc(key.substring(1))
                                        : Sort.Order.asc(key))
                                .toList()))
        ));
    }

    @GetMapping(path = "ranking", produces = MediaType.APPLICATION_JSON_VALUE)
    @JsonView(Views.Public.class)
    public ResponseEntity<List<User>> ranking() {
        return ResponseEntity.ok(users.ranking());
    }

    @GetMapping(path = "{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    @JsonView(Views.Public.class)
    public ResponseEntity<User> get(@PathVariable Long id) throws UserNotFoundException {
        return ResponseEntity.ok(users.get(id));
    }

    @PutMapping(path = "{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    @JsonView(Views.Public.class)
    public ResponseEntity<User> update(@PathVariable Long id, @RequestBody User user)
            throws UserNotFoundException {
        return ResponseEntity.ok(users.update(id, user));
    }
}
