package com.usc.boardgames.gousc.service;

import org.springframework.stereotype.Component;

/**
 * Sistema de puntuacion ELO con K = 32 (el estandar de partidas clasificatorias).
 */
@Component
public class EloService {

    private static final int K = 32;

    /**
     * Devuelve {cambio_ganador, cambio_perdedor}. La suma es siempre 0:
     * lo que gana uno lo pierde el otro.
     */
    public int[] deltas(int winnerElo, int loserElo) {
        double expected = 1.0 / (1.0 + Math.pow(10, (loserElo - winnerElo) / 400.0));
        int delta = (int) Math.round(K * (1 - expected));
        if (delta < 1) {
            delta = 1;
        }
        return new int[]{delta, -delta};
    }
}
