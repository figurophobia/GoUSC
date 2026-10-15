package com.usc.boardgames.gousc.controller;

import com.usc.boardgames.gousc.model.dto.Game;
import com.usc.boardgames.gousc.model.dto.Move;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.model.entity.BoardSize;
import com.usc.boardgames.gousc.model.entity.GameMode;
import com.usc.boardgames.gousc.service.GameService;
import com.usc.boardgames.gousc.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests de los endpoints: códigos HTTP, errores problem+json y que la
 * contraseña nunca salga en las respuestas.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApiTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private UserService users;

    @Autowired
    private GameService games;

    private User newUser() throws Exception {
        String name = "api_" + UUID.randomUUID().toString().substring(0, 8);
        return users.create(new User(null, name, "secret", null, null, null, null, null));
    }

    private String body(String raw) {
        return raw.replace('\'', '"');
    }

    // ------------------------------------------------------------ usuarios

    @Test
    void registerReturns201WithLocationAndNoPassword() throws Exception {
        String name = "api_" + UUID.randomUUID().toString().substring(0, 8);
        mvc.perform(post("/users").contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'username':'" + name + "','password':'secret'}")))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.username").value(name))
                .andExpect(jsonPath("$.elo").value(1500))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void duplicatedUsernameReturns409() throws Exception {
        User existing = newUser();
        mvc.perform(post("/users").contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'username':'" + existing.username() + "','password':'otra'}")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Usuario ya existente"));
    }

    @Test
    void tooShortUsernameReturns400() throws Exception {
        mvc.perform(post("/users").contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'username':'ab','password':'secret'}")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginWithRightCredentialsReturnsUserWithoutPassword() throws Exception {
        User u = newUser();
        mvc.perform(post("/users/login").contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'username':'" + u.username() + "','password':'secret'}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(u.id()))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void loginWithWrongPasswordOrUnknownUserReturnsTheSame401() throws Exception {
        User u = newUser();
        mvc.perform(post("/users/login").contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'username':'" + u.username() + "','password':'mala'}")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Credenciales inválidas"));
        mvc.perform(post("/users/login").contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'username':'no_existe_nunca','password':'x'}")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Credenciales inválidas"));
    }

    @Test
    void rankingEndpointIsSortedByEloAndHidesPasswords() throws Exception {
        String raw = mvc.perform(get("/users/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].password").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        JsonNode list = json.readTree(raw);
        assertTrue(list.size() > 0);
        for (int i = 1; i < list.size(); i++) {
            assertTrue(list.get(i - 1).get("elo").asInt() >= list.get(i).get("elo").asInt(),
                    "Ranking desordenado en la posición " + i);
        }
    }

    // ------------------------------------------------------------ partidas

    @Test
    void createGameReturns201AndWaitingGame() throws Exception {
        User u = newUser();
        mvc.perform(post("/games").header("X-User-Id", u.id()).contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'boardSize':'NINE','mode':'RANKED'}")))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.status").value("WAITING"))
                .andExpect(jsonPath("$.blackPlayer.id").value(u.id()))
                .andExpect(jsonPath("$.blackPlayer.password").doesNotExist());
    }

    @Test
    void missingUserHeaderReturns400() throws Exception {
        mvc.perform(post("/games").contentType(MediaType.APPLICATION_JSON)
                        .content(body("{'boardSize':'NINE','mode':'CASUAL'}")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void joiningAFullGameReturns409() throws Exception {
        User black = newUser(), white = newUser(), third = newUser();
        Game g = games.create(black, BoardSize.NINE, GameMode.CASUAL);
        games.join(g.id(), white);

        mvc.perform(post("/games/{id}/join", g.id()).header("X-User-Id", third.id()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Partida completa"));
    }

    @Test
    void unknownGameReturns404() throws Exception {
        mvc.perform(get("/games/{id}", 999_999_999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Partida no encontrada"));
    }

    @Test
    void playingOutOfTurnReturns400() throws Exception {
        User black = newUser(), white = newUser();
        Game g = games.create(black, BoardSize.NINE, GameMode.CASUAL);
        games.join(g.id(), white);

        mvc.perform(post("/games/{id}/moves", g.id()).header("X-User-Id", white.id())
                        .contentType(MediaType.APPLICATION_JSON).content(body("{'x':3,'y':3,'pass':false}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("NOT_YOUR_TURN")));
    }

    @Test
    void playingOnAnOccupiedPointReturns400() throws Exception {
        User black = newUser(), white = newUser();
        Game g = games.create(black, BoardSize.NINE, GameMode.CASUAL);
        games.join(g.id(), white);
        games.playMove(g.id(), black, new Move(3, 3, false));

        mvc.perform(post("/games/{id}/moves", g.id()).header("X-User-Id", white.id())
                        .contentType(MediaType.APPLICATION_JSON).content(body("{'x':3,'y':3,'pass':false}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("OCCUPIED_CELL")));
    }

    @Test
    void moveWithoutCoordinatesOrPassReturns400() throws Exception {
        User black = newUser(), white = newUser();
        Game g = games.create(black, BoardSize.NINE, GameMode.CASUAL);
        games.join(g.id(), white);

        mvc.perform(post("/games/{id}/moves", g.id()).header("X-User-Id", black.id())
                        .contentType(MediaType.APPLICATION_JSON).content(body("{'pass':false}")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validMoveUpdatesBoardAndTurn() throws Exception {
        User black = newUser(), white = newUser();
        Game g = games.create(black, BoardSize.NINE, GameMode.CASUAL);
        games.join(g.id(), white);

        mvc.perform(post("/games/{id}/moves", g.id()).header("X-User-Id", black.id())
                        .contentType(MediaType.APPLICATION_JSON).content(body("{'x':3,'y':3,'pass':false}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentTurn").value("WHITE"))
                .andExpect(jsonPath("$.moveHistory").value("D4"))
                .andExpect(jsonPath("$.boardState", containsString("3,3")));
    }

    // ------------------------------------------------------- mensajes

    @Test
    void messageToYourselfReturns400() throws Exception {
        User u = newUser();
        mvc.perform(post("/messages").param("to", String.valueOf(u.id())).header("X-User-Id", u.id())
                        .contentType(MediaType.APPLICATION_JSON).content(body("{'content':'hola'}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("No puedes enviarte un mensaje a ti mismo"));
    }
}
