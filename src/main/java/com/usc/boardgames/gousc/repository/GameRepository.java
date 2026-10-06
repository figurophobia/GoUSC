package com.usc.boardgames.gousc.repository;

import com.usc.boardgames.gousc.model.entity.Game;
import com.usc.boardgames.gousc.model.entity.GameStatus;
import com.usc.boardgames.gousc.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameRepository extends JpaRepository<Game, Long> {

    List<Game> findByStatusOrderByCreatedAtDesc(GameStatus status);

    List<Game> findByBlackPlayerOrWhitePlayerOrderByCreatedAtDesc(User blackPlayer, User whitePlayer);
}
