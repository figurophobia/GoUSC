package com.usc.boardgames.gousc.service;

import com.usc.boardgames.gousc.model.dto.Game;
import com.usc.boardgames.gousc.model.dto.Move;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.model.entity.BoardSize;
import com.usc.boardgames.gousc.model.entity.GameMode;
import com.usc.boardgames.gousc.model.entity.GameStatus;
import com.usc.boardgames.gousc.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fase 5: el leaderboard contra la base de datos real. Cada test corre en una
 * transacción que se deshace al acabar, así que no deja usuarios ni partidas.
 */
@SpringBootTest
@Transactional
class LeaderboardTest {

    @Autowired
    private UserService users;

    @Autowired
    private GameService games;

    @Autowired
    private UserRepository userRepository;

    // ------------------------------------------------------------ ayudas

    private User newUser() throws Exception {
        String name = "lb_" + UUID.randomUUID().toString().substring(0, 8);
        return users.create(new User(null, name, "secret", null, null, null, null, null));
    }

    private User reload(User u) throws Exception {
        return users.get(u.id());
    }

    private void setElo(User u, int elo) {
        userRepository.findById(u.id()).orElseThrow().setElo(elo);
    }

    /**
     * Juega una partida 9x9 completa y devuelve el resultado. Si gana negras,
     * pone una piedra y ambos pasan (territorio 80 > komi); si gana blancas,
     * ambos pasan sin jugar (0 < 6.5 de komi).
     */
    private Game play(User black, User white, GameMode mode, boolean blackWins) throws Exception {
        Game game = games.create(black, BoardSize.NINE, mode);
        games.join(game.id(), white);
        if (blackWins) {
            games.playMove(game.id(), black, new Move(4, 4, false));
            games.playMove(game.id(), white, new Move(null, null, true));
            return games.playMove(game.id(), black, new Move(null, null, true));
        }
        games.playMove(game.id(), black, new Move(null, null, true));
        return games.playMove(game.id(), white, new Move(null, null, true));
    }

    // ------------------------------------------------------------- tests

    @Test
    void rankedWinMovesEloAndCounters() throws Exception {
        User black = newUser(), white = newUser();

        Game result = play(black, white, GameMode.RANKED, true);

        assertEquals(GameStatus.FINISHED, result.status());
        assertEquals(black.id(), result.winner().id());
        assertEquals(16, result.eloChangeBlack());
        assertEquals(-16, result.eloChangeWhite());

        User b = reload(black), w = reload(white);
        assertEquals(1516, b.elo());
        assertEquals(1484, w.elo());
        assertEquals(1, b.wins());
        assertEquals(0, b.losses());
        assertEquals(0, w.wins());
        assertEquals(1, w.losses());
    }

    @Test
    void whiteWinsByKomiWhenBoardIsEmpty() throws Exception {
        User black = newUser(), white = newUser();

        Game result = play(black, white, GameMode.RANKED, false);

        assertEquals(0.0, result.finalScoreBlack());
        assertEquals(6.5, result.finalScoreWhite());
        assertEquals(white.id(), result.winner().id());
        assertEquals(1516, reload(white).elo());
        assertEquals(1484, reload(black).elo());
    }

    @Test
    void casualGamesDoNotTouchTheLeaderboard() throws Exception {
        User black = newUser(), white = newUser();

        Game result = play(black, white, GameMode.CASUAL, true);

        assertEquals(black.id(), result.winner().id());
        assertNull(result.eloChangeBlack());
        assertNull(result.eloChangeWhite());
        User b = reload(black), w = reload(white);
        assertEquals(1500, b.elo());
        assertEquals(1500, w.elo());
        assertEquals(0, b.wins());
        assertEquals(0, w.losses());
    }

    @Test
    void underdogVictoryIsWorthMore() throws Exception {
        User black = newUser(), white = newUser();
        setElo(black, 1400);
        setElo(white, 1800);

        Game result = play(black, white, GameMode.RANKED, true);

        assertEquals(29, result.eloChangeBlack());
        assertEquals(1429, reload(black).elo());
        assertEquals(1771, reload(white).elo());
    }

    @Test
    void abandoningARankedGameGivesTheWinToTheOpponent() throws Exception {
        User black = newUser(), white = newUser();
        Game game = games.create(black, BoardSize.NINE, GameMode.RANKED);
        games.join(game.id(), white);

        Game result = games.leave(game.id(), black);

        assertEquals(GameStatus.ABANDONED, result.status());
        assertEquals(white.id(), result.winner().id());
        assertEquals(1516, reload(white).elo());
        assertEquals(1, reload(white).wins());
        assertEquals(1484, reload(black).elo());
        assertEquals(1, reload(black).losses());
    }

    @Test
    void cancellingAnEmptyRoomDoesNotCount() throws Exception {
        User black = newUser();
        Game game = games.create(black, BoardSize.NINE, GameMode.RANKED);

        Game result = games.leave(game.id(), black);

        assertEquals(GameStatus.ABANDONED, result.status());
        assertNull(result.winner());
        User b = reload(black);
        assertEquals(1500, b.elo());
        assertEquals(0, b.losses());
    }

    @Test
    void resultsAccumulateOverSeveralGames() throws Exception {
        User a = newUser(), b = newUser();

        play(a, b, GameMode.RANKED, true);    // a gana con negras
        play(b, a, GameMode.RANKED, false);   // a gana con blancas
        play(a, b, GameMode.RANKED, false);   // b gana con blancas

        User ra = reload(a), rb = reload(b);
        assertEquals(2, ra.wins());
        assertEquals(1, ra.losses());
        assertEquals(1, rb.wins());
        assertEquals(2, rb.losses());
        // suma cero: los puntos ni se crean ni se destruyen
        assertEquals(3000, ra.elo() + rb.elo());
    }

    @Test
    void rankingIsSortedByEloAfterSeveralGames() throws Exception {
        User a = newUser(), b = newUser(), c = newUser();

        play(a, b, GameMode.RANKED, true);   // a 1516, b 1484
        play(a, c, GameMode.RANKED, true);   // a gana a c: +15 -> a 1531, c 1485

        assertEquals(1531, reload(a).elo());
        assertEquals(1485, reload(c).elo());
        assertEquals(1484, reload(b).elo());

        List<User> ranking = users.ranking();
        for (int i = 1; i < ranking.size(); i++) {
            assertTrue(ranking.get(i - 1).elo() >= ranking.get(i).elo(),
                    "El ranking debe ir de mayor a menor ELO (posición " + i + ")");
        }
        List<Long> ours = ranking.stream()
                .map(User::id)
                .filter(id -> id.equals(a.id()) || id.equals(b.id()) || id.equals(c.id()))
                .toList();
        assertEquals(List.of(a.id(), c.id(), b.id()), ours);
    }
}
