package com.usc.boardgames.gousc.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EloServiceTest {

    private final EloService elo = new EloService();

    @Test
    void equalRatingsExchangeHalfOfK() {
        // esperado = 0.5 -> 32 * 0.5 = 16
        assertArrayEquals(new int[]{16, -16}, elo.deltas(1500, 1500));
    }

    @Test
    void favouriteWinningGainsLittle() {
        // 1800 vs 1400: esperado = 1 / (1 + 10^-1) = 0.909 -> 32 * 0.091 = 2.9 -> 3
        assertArrayEquals(new int[]{3, -3}, elo.deltas(1800, 1400));
    }

    @Test
    void underdogWinningGainsALot() {
        // 1400 vs 1800: esperado = 1 / (1 + 10) = 0.091 -> 32 * 0.909 = 29.1 -> 29
        assertArrayEquals(new int[]{29, -29}, elo.deltas(1400, 1800));
    }

    @Test
    void changeIsNeverBelowOnePoint() {
        // Diferencia enorme: el cálculo daría 0, pero ganar siempre suma al menos 1
        assertArrayEquals(new int[]{1, -1}, elo.deltas(3000, 1000));
    }

    @Test
    void exchangeIsAlwaysZeroSum() {
        int[][] pairs = {{1500, 1500}, {1516, 1484}, {1200, 2100}, {2100, 1200}, {1650, 1649}};
        for (int[] p : pairs) {
            int[] d = elo.deltas(p[0], p[1]);
            assertEquals(0, d[0] + d[1], "La suma debe ser 0 para " + p[0] + " vs " + p[1]);
            assertTrue(d[0] >= 1 && d[0] <= 32, "El ganador gana entre 1 y K puntos");
        }
    }
}
