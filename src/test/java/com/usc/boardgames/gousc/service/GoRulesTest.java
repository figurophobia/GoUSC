package com.usc.boardgames.gousc.service;

import com.usc.boardgames.gousc.exception.InvalidMoveException;
import com.usc.boardgames.gousc.model.entity.StoneColor;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GoRulesTest {

    private static final int SIZE = 9;

    private final GoRules rules = new GoRules();

    private Map<String, String> board(String... entries) {
        Map<String, String> board = new HashMap<>();
        for (int i = 0; i < entries.length; i += 2) {
            board.put(entries[i], entries[i + 1]);
        }
        return board;
    }

    @Test
    void placeStoneOnEmptyBoard() throws InvalidMoveException {
        var outcome = rules.placeStone(board(), SIZE, 0, 0, StoneColor.BLACK, board());

        assertEquals(0, outcome.captures());
        assertEquals("B", outcome.board().get("0,0"));
        assertEquals(1, outcome.board().size());
    }

    @Test
    void occupiedCellIsRejected() {
        var current = board("4,4", "B");

        var ex = assertThrows(InvalidMoveException.class,
                () -> rules.placeStone(current, SIZE, 4, 4, StoneColor.WHITE, board()));
        assertEquals(InvalidMoveException.Reason.OCCUPIED_CELL, ex.getReason());
    }

    @Test
    void outOfRangeIsRejected() {
        var ex = assertThrows(InvalidMoveException.class,
                () -> rules.placeStone(board(), SIZE, -1, 0, StoneColor.BLACK, board()));
        assertEquals(InvalidMoveException.Reason.OUT_OF_RANGE, ex.getReason());
    }

    @Test
    void captureRemovesEnemyGroup() throws InvalidMoveException {
        // Blanca en (1,1) con libertad unica en (1,2): negras la rodean
        var current = board("1,1", "W", "1,0", "B", "0,1", "B", "2,1", "B");

        var outcome = rules.placeStone(current, SIZE, 1, 2, StoneColor.BLACK, current);

        assertEquals(1, outcome.captures());
        assertFalse(outcome.board().containsKey("1,1"));
        assertEquals("B", outcome.board().get("1,2"));
    }

    @Test
    void suicideIsRejected() {
        // Blanca rodea por completo (2,2): sin capturas previas, es suicidio
        var current = board("2,1", "W", "1,2", "W", "3,2", "W", "2,3", "W");

        var ex = assertThrows(InvalidMoveException.class,
                () -> rules.placeStone(current, SIZE, 2, 2, StoneColor.BLACK, current));
        assertEquals(InvalidMoveException.Reason.SUICIDE, ex.getReason());
    }

    @Test
    void koIsRejected() {
        // Negra jugaria en (1,2), capturaria la blanca de (1,1) y el resultado
        // coincidiria con el estado anterior -> ko
        var current = board("1,0", "B", "0,1", "B", "2,1", "B", "1,1", "W");
        var previous = board("1,0", "B", "0,1", "B", "2,1", "B", "1,2", "B");

        var ex = assertThrows(InvalidMoveException.class,
                () -> rules.placeStone(current, SIZE, 1, 2, StoneColor.BLACK, previous));
        assertEquals(InvalidMoveException.Reason.KO, ex.getReason());
    }

    @Test
    void territoryCountsOnlyRegionsTouchingOneColor() {
        // (0,0) solo toca negras -> territorio negro; el resto del tablero toca ambos -> neutro
        var current = board("1,0", "B", "0,1", "B", "8,8", "W");

        int[] territory = rules.calculateTerritory(current, SIZE);

        assertArrayEquals(new int[]{1, 0}, territory);
    }

    @Test
    void groupAndLibertiesFindsConnectedStones() {
        var current = board("0,0", "B", "1,0", "B", "0,1", "B");

        var group = rules.groupAndLiberties(current, SIZE, "0,0");

        assertEquals(3, group.stones().size());
        // Libertades: (2,0), (1,1) y las del borde exterior del grupo
        assertTrue(group.liberties().contains("2,0"));
        assertTrue(group.liberties().contains("1,1"));
        assertFalse(group.liberties().contains("0,0"));
    }

    @Test
    void coordinatesRoundTrip() {
        assertEquals("D4", rules.formatCoordinate(3, 3));
        assertEquals("T19", rules.formatCoordinate(18, 18));
        assertEquals("J9", rules.formatCoordinate(8, 8));

        assertArrayEquals(new int[]{3, 3}, rules.parseCoordinate("D4"));
        assertArrayEquals(new int[]{18, 18}, rules.parseCoordinate("T19"));
        assertArrayEquals(new int[]{8, 8}, rules.parseCoordinate("J9"));
        assertArrayEquals(new int[]{0, 0}, rules.parseCoordinate("A1"));
    }
}
