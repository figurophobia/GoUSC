package com.usc.boardgames.gousc.service;

import com.usc.boardgames.gousc.exception.DuplicateUserException;
import com.usc.boardgames.gousc.exception.InvalidCredentialsException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.Credentials;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;

    @Autowired
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User create(User user) throws DuplicateUserException {
        var existing = userRepository.findByUsername(user.username());
        if (existing.isPresent()) {
            throw new DuplicateUserException(existing.get());
        }
        return User.from(userRepository.save(com.usc.boardgames.gousc.model.entity.User.from(user)));
    }

    public User get(Long id) throws UserNotFoundException {
        var user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(String.valueOf(id)));
        return User.from(user);
    }

    /**
     * Autenticación sin seguridad de Spring (proyecto de clase): valida
     * usuario + contraseña en texto plano.
     */
    public User login(Credentials credentials) throws UserNotFoundException, InvalidCredentialsException {
        var user = userRepository.findByUsername(credentials.username())
                .orElseThrow(() -> new UserNotFoundException(credentials.username()));
        if (credentials.password() == null || !credentials.password().equals(user.getPassword())) {
            throw new InvalidCredentialsException();
        }
        return User.from(user);
    }

    public Page<User> get(PageRequest page) {
        return userRepository.findAll(page).map(User::from);
    }

    public User update(Long id, User changes) throws UserNotFoundException, DuplicateUserException {
        var user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(String.valueOf(id)));
        if (changes.username() != null && !changes.username().isBlank()) {
            String username = changes.username().trim();
            if (username.length() < 3 || username.length() > 50) {
                throw new IllegalArgumentException("El nombre de usuario debe tener entre 3 y 50 caracteres");
            }
            if (!username.equals(user.getUsername())) {
                var existing = userRepository.findByUsername(username);
                if (existing.isPresent() && !existing.get().getId().equals(id)) {
                    throw new DuplicateUserException(existing.get());
                }
                user.setUsername(username);
            }
        }
        if (changes.email() != null) {
            user.setEmail(changes.email());
        }
        if (changes.password() != null && !changes.password().isBlank()) {
            user.setPassword(changes.password());
        }
        return User.from(userRepository.save(user));
    }

    /** Ranking de jugadores ordenado por ELO descendente. */
    public List<User> ranking() {
        return userRepository.findAllByOrderByEloDesc().stream().map(User::from).toList();
    }

    /**
     * Registra el resultado de una partida rankeada: victoria/derrota y
     * ajuste de ELO para ambos jugadores.
     */
    public void recordResult(com.usc.boardgames.gousc.model.entity.User winner,
                             com.usc.boardgames.gousc.model.entity.User loser,
                             int winnerDelta, int loserDelta) {
        winner.setWins(winner.getWins() + 1).setElo(winner.getElo() + winnerDelta);
        loser.setLosses(loser.getLosses() + 1).setElo(loser.getElo() + loserDelta);
        userRepository.save(winner);
        userRepository.save(loser);
    }

    public com.usc.boardgames.gousc.model.entity.User entity(Long id) throws UserNotFoundException {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(String.valueOf(id)));
    }
}
