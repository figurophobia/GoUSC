package com.usc.boardgames.gousc.service;

import com.usc.boardgames.gousc.exception.InvalidMoveException;
import com.usc.boardgames.gousc.model.entity.StoneColor;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Reglas del Go. Opera sobre un tablero serializado como Map&lt;String, String&gt;
 * con claves "x,y" y valores "B"/"W" (la misma forma del JSON guardado en games.board_state).
 */
@Component
public class GoRules {

    public static final String BLACK_CODE = "B";
    public static final String WHITE_CODE = "W";

    public record MoveOutcome(Map<String, String> board, int captures) {}

    public record Group(Set<String> stones, Set<String> liberties) {}

    public String key(int x, int y) {
        return x + "," + y;
    }

    public String code(StoneColor color) {
        return color == StoneColor.BLACK ? BLACK_CODE : WHITE_CODE;
    }

    public Set<String> adjacent(int size, int x, int y) {
        Set<String> adj = new LinkedHashSet<>();
        if (x > 0) adj.add(key(x - 1, y));
        if (x < size - 1) adj.add(key(x + 1, y));
        if (y > 0) adj.add(key(x, y - 1));
        if (y < size - 1) adj.add(key(x, y + 1));
        return adj;
    }

    public Group groupAndLiberties(Map<String, String> board, int size, String start) {
        String color = board.get(start);
        Set<String> stones = new LinkedHashSet<>();
        Set<String> liberties = new LinkedHashSet<>();
        Set<String> visited = new LinkedHashSet<>();
        visited.add(start);
        Deque<String> stack = new ArrayDeque<>();
        stack.push(start);

        while (!stack.isEmpty()) {
            String current = stack.pop();
            stones.add(current);
            String[] parts = current.split(",");
            int x = Integer.parseInt(parts[0]);
            int y = Integer.parseInt(parts[1]);
            for (String adj : adjacent(size, x, y)) {
                if (!board.containsKey(adj)) {
                    liberties.add(adj);
                } else if (board.get(adj).equals(color) && !visited.contains(adj)) {
                    visited.add(adj);
                    stack.push(adj);
                }
            }
        }
        return new Group(stones, liberties);
    }

    /**
     * Coloca una piedra valida la jugada (rango, celda vacia, suicidio, ko) y
     * devuelve el tablero resultante con el numero de piedras capturadas.
     */
    public MoveOutcome placeStone(Map<String, String> board, int size, int x, int y,
                                  StoneColor color, Map<String, String> previousBoard)
            throws InvalidMoveException {
        if (x < 0 || y < 0 || x >= size || y >= size) {
            throw new InvalidMoveException(InvalidMoveException.Reason.OUT_OF_RANGE);
        }

        String pos = key(x, y);
        if (board.containsKey(pos)) {
            throw new InvalidMoveException(InvalidMoveException.Reason.OCCUPIED_CELL);
        }

        Map<String, String> newBoard = new HashMap<>(board);
        newBoard.put(pos, code(color));
        String enemy = code(color.opposite());

        Set<String> captured = new LinkedHashSet<>();
        for (String adj : adjacent(size, x, y)) {
            if (enemy.equals(newBoard.get(adj))) {
                Group group = groupAndLiberties(newBoard, size, adj);
                if (group.liberties().isEmpty()) {
                    captured.addAll(group.stones());
                }
            }
        }

        Group own = groupAndLiberties(newBoard, size, pos);
        if (own.liberties().isEmpty() && captured.isEmpty()) {
            throw new InvalidMoveException(InvalidMoveException.Reason.SUICIDE);
        }

        captured.forEach(newBoard::remove);

        if (newBoard.equals(previousBoard)) {
            throw new InvalidMoveException(InvalidMoveException.Reason.KO);
        }

        return new MoveOutcome(newBoard, captured.size());
    }

    /**
     * Calcula el territorio de cada color con un recorrido flood-fill por regiones
     * vacias: solo cuenta la region tocada exclusivamente por un color.
     * Devuelve [territorio_negras, territorio_blancas].
     */
    public int[] calculateTerritory(Map<String, String> board, int size) {
        Set<String> visited = new LinkedHashSet<>();
        int black = 0;
        int white = 0;

        for (int x = 0; x < size; x++) {
            for (int y = 0; y < size; y++) {
                String start = key(x, y);
                if (board.containsKey(start) || visited.contains(start)) {
                    continue;
                }

                boolean touchesBlack = false;
                boolean touchesWhite = false;
                int regionSize = 0;
                Deque<String> stack = new ArrayDeque<>();
                stack.push(start);
                visited.add(start);

                while (!stack.isEmpty()) {
                    String current = stack.pop();
                    regionSize++;
                    String[] parts = current.split(",");
                    int cx = Integer.parseInt(parts[0]);
                    int cy = Integer.parseInt(parts[1]);
                    for (String adj : adjacent(size, cx, cy)) {
                        if (board.containsKey(adj)) {
                            if (board.get(adj).equals(BLACK_CODE)) {
                                touchesBlack = true;
                            } else {
                                touchesWhite = true;
                            }
                        } else if (!visited.contains(adj)) {
                            visited.add(adj);
                            stack.push(adj);
                        }
                    }
                }

                if (touchesBlack && !touchesWhite) {
                    black += regionSize;
                } else if (touchesWhite && !touchesBlack) {
                    white += regionSize;
                }
            }
        }
        return new int[]{black, white};
    }

    /** Coordenada estilo Go: columna A-T (sin la I) + fila 1-19, p. ej. "D4". */
    public String formatCoordinate(int x, int y) {
        char column = (char) ('A' + x);
        if (column >= 'I') {
            column++;
        }
        return column + String.valueOf(y + 1);
    }

    /** Inverso de formatCoordinate: "D4" -> {3, 3}. */
    public int[] parseCoordinate(String coordinate) {
        char column = Character.toUpperCase(coordinate.charAt(0));
        if (column > 'I') {
            column--;
        }
        int x = column - 'A';
        int y = Integer.parseInt(coordinate.substring(1)) - 1;
        return new int[]{x, y};
    }
}
