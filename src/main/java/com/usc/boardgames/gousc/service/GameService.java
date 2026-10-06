package com.usc.boardgames.gousc.service;

import com.usc.boardgames.gousc.exception.GameFullException;
import com.usc.boardgames.gousc.exception.GameNotFoundException;
import com.usc.boardgames.gousc.exception.GameStateException;
import com.usc.boardgames.gousc.exception.InvalidMoveException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.model.entity.BoardSize;
import com.usc.boardgames.gousc.model.entity.Game;
import com.usc.boardgames.gousc.model.entity.GameMode;
import com.usc.boardgames.gousc.model.entity.GameStatus;
import com.usc.boardgames.gousc.model.entity.StoneColor;
import com.usc.boardgames.gousc.repository.GameRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class GameService {

    private final GameRepository gameRepository;
    private final UserService userService;
    private final GoRules goRules;
    private final EloService eloService;
    private final ObjectMapper objectMapper;

    @Autowired
    public GameService(GameRepository gameRepository, UserService userService,
                       GoRules goRules, EloService eloService, ObjectMapper objectMapper) {
        this.gameRepository = gameRepository;
        this.userService = userService;
        this.goRules = goRules;
        this.eloService = eloService;
        this.objectMapper = objectMapper;
    }

    public com.usc.boardgames.gousc.model.dto.Game create(User creator, BoardSize size, GameMode mode)
            throws UserNotFoundException {
        var creatorEntity = userService.entity(creator.id());
        var game = new Game(size, mode, creatorEntity);
        return com.usc.boardgames.gousc.model.dto.Game.from(gameRepository.save(game));
    }

    public com.usc.boardgames.gousc.model.dto.Game join(Long gameId, User joiner)
            throws GameNotFoundException, GameFullException, GameStateException, UserNotFoundException {
        var game = find(gameId);
        if (game.getStatus() != GameStatus.WAITING) {
            throw new GameStateException(gameId, "La partida ya tiene ambos jugadores");
        }
        if (game.getBlackPlayer().getId().equals(joiner.id())) {
            throw new GameStateException(gameId, "Ya eres el jugador de las negras");
        }
        if (game.getWhitePlayer() != null) {
            throw new GameFullException(gameId);
        }
        game.setWhitePlayer(userService.entity(joiner.id()));
        game.setStatus(GameStatus.ACTIVE);
        return com.usc.boardgames.gousc.model.dto.Game.from(gameRepository.save(game));
    }

    public com.usc.boardgames.gousc.model.dto.Game leave(Long gameId, User user)
            throws GameNotFoundException, GameStateException, UserNotFoundException {
        var game = find(gameId);
        if (game.getStatus() == GameStatus.FINISHED || game.getStatus() == GameStatus.ABANDONED) {
            throw new GameStateException(gameId, "La partida ya ha terminado");
        }

        StoneColor color;
        if (game.getBlackPlayer().getId().equals(user.id())) {
            color = StoneColor.BLACK;
        } else if (game.getWhitePlayer() != null && game.getWhitePlayer().getId().equals(user.id())) {
            color = StoneColor.WHITE;
        } else {
            throw new GameStateException(gameId, "No participas en esta partida");
        }

        game.setStatus(GameStatus.ABANDONED).setFinishedAt(LocalDateTime.now());
        // Si había rival (partida en juego), gana el otro jugador
        if (color == StoneColor.BLACK && game.getWhitePlayer() != null) {
            game.setWinner(game.getWhitePlayer());
        } else if (color == StoneColor.WHITE) {
            game.setWinner(game.getBlackPlayer());
        }
        if (game.getWinner() != null) {
            applyElo(game, game.getWinner(),
                    color == StoneColor.BLACK ? game.getBlackPlayer() : game.getWhitePlayer());
        }
        return com.usc.boardgames.gousc.model.dto.Game.from(gameRepository.save(game));
    }

    public List<com.usc.boardgames.gousc.model.dto.Game> list(GameStatus status) {
        return gameRepository.findByStatusOrderByCreatedAtDesc(status).stream()
                .map(com.usc.boardgames.gousc.model.dto.Game::from)
                .toList();
    }

    public List<com.usc.boardgames.gousc.model.dto.Game> listAll() {
        return gameRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(com.usc.boardgames.gousc.model.dto.Game::from)
                .toList();
    }

    public List<com.usc.boardgames.gousc.model.dto.Game> listByUser(User user) throws UserNotFoundException {
        var entity = userService.entity(user.id());
        return gameRepository.findByBlackPlayerOrWhitePlayerOrderByCreatedAtDesc(entity, entity).stream()
                .map(com.usc.boardgames.gousc.model.dto.Game::from)
                .toList();
    }

    public com.usc.boardgames.gousc.model.dto.Game get(Long gameId) throws GameNotFoundException {
        return com.usc.boardgames.gousc.model.dto.Game.from(find(gameId));
    }

    /**
     * Ejecuta una jugada (colocar piedra o pasar). Valida turno y estado de la
     * partida, aplica las reglas del Go y persiste el nuevo estado.
     */
    public com.usc.boardgames.gousc.model.dto.Game playMove(Long gameId, User user,
                                                             com.usc.boardgames.gousc.model.dto.Move move)
            throws GameNotFoundException, GameStateException, InvalidMoveException {
        var game = find(gameId);
        if (game.getStatus() != GameStatus.ACTIVE) {
            throw new GameStateException(gameId, "La partida no está en curso");
        }
        StoneColor color = colorOf(game, user);
        if (color != game.getCurrentTurn()) {
            throw new InvalidMoveException(InvalidMoveException.Reason.NOT_YOUR_TURN);
        }

        if (move.isPass()) {
            return doPass(game);
        }
        if (move.x() == null || move.y() == null) {
            throw new InvalidMoveException(InvalidMoveException.Reason.OUT_OF_RANGE);
        }

        Map<String, String> board = toBoard(game.getBoardState());
        Map<String, String> previous = toBoard(game.getPreviousBoardState());
        var outcome = goRules.placeStone(board, game.getBoardSize().getSize(),
                move.x(), move.y(), color, previous);

        game.setPreviousBoardState(toJson(board));
        game.setBoardState(toJson(outcome.board()));
        if (color == StoneColor.BLACK) {
            game.setCapturesBlack(game.getCapturesBlack() + outcome.captures());
        } else {
            game.setCapturesWhite(game.getCapturesWhite() + outcome.captures());
        }
        game.setCurrentTurn(color.opposite());
        game.setConsecutivePasses(0);
        appendMove(game, goRules.formatCoordinate(move.x(), move.y()));

        return com.usc.boardgames.gousc.model.dto.Game.from(gameRepository.save(game));
    }

    private com.usc.boardgames.gousc.model.dto.Game doPass(Game game) {
        game.setConsecutivePasses(game.getConsecutivePasses() + 1);
        game.setCurrentTurn(game.getCurrentTurn().opposite());
        appendMove(game, "-");

        if (game.getConsecutivePasses() >= 2) {
            finishGame(game);
        }
        return com.usc.boardgames.gousc.model.dto.Game.from(gameRepository.save(game));
    }

    private void finishGame(Game game) {
        Map<String, String> board = toBoard(game.getBoardState());
        int[] territory = goRules.calculateTerritory(board, game.getBoardSize().getSize());

        double blackScore = game.getCapturesBlack() + territory[0];
        double whiteScore = game.getCapturesWhite() + territory[1] + game.getKomi();

        game.setStatus(GameStatus.FINISHED)
                .setFinishedAt(LocalDateTime.now())
                .setFinalScoreBlack(blackScore)
                .setFinalScoreWhite(whiteScore);

        if (blackScore > whiteScore) {
            game.setWinner(game.getBlackPlayer());
            applyElo(game, game.getBlackPlayer(), game.getWhitePlayer());
        } else {
            game.setWinner(game.getWhitePlayer());
            applyElo(game, game.getWhitePlayer(), game.getBlackPlayer());
        }
    }

    private void applyElo(Game game,
                          com.usc.boardgames.gousc.model.entity.User winner,
                          com.usc.boardgames.gousc.model.entity.User loser) {
        if (game.getMode() != GameMode.RANKED) {
            return;
        }
        int[] deltas = eloService.deltas(winner.getElo(), loser.getElo());
        userService.recordResult(winner, loser, deltas[0], deltas[1]);
        if (winner.getId().equals(game.getBlackPlayer().getId())) {
            game.setEloChangeBlack(deltas[0]).setEloChangeWhite(deltas[1]);
        } else {
            game.setEloChangeBlack(deltas[1]).setEloChangeWhite(deltas[0]);
        }
    }

    private Game find(Long gameId) throws GameNotFoundException {
        return gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException(gameId));
    }

    private StoneColor colorOf(Game game, User user) throws GameStateException {
        if (game.getBlackPlayer().getId().equals(user.id())) {
            return StoneColor.BLACK;
        }
        if (game.getWhitePlayer() != null && game.getWhitePlayer().getId().equals(user.id())) {
            return StoneColor.WHITE;
        }
        throw new GameStateException(game.getId(), "No participas en esta partida");
    }

    private void appendMove(Game game, String entry) {
        game.setMoveHistory(game.getMoveHistory().isEmpty()
                ? entry
                : game.getMoveHistory() + "," + entry);
    }

    private Map<String, String> toBoard(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JacksonException e) {
            throw new IllegalStateException("Estado de tablero corrupto", e);
        }
    }

    private String toJson(Map<String, String> board) {
        try {
            return objectMapper.writeValueAsString(board);
        } catch (JacksonException e) {
            throw new IllegalStateException("No se pudo serializar el tablero", e);
        }
    }
}
