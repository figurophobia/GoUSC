package com.usc.boardgames.gousc.repository;

import com.usc.boardgames.gousc.model.entity.Message;
import com.usc.boardgames.gousc.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByGameIdOrderByCreatedAtAsc(Long gameId);

    @Query("""
            SELECT m FROM Message m
            WHERE (m.sender = :a AND m.recipient = :b)
               OR (m.sender = :b AND m.recipient = :a)
            ORDER BY m.createdAt ASC""")
    List<Message> findPrivateConversation(@Param("a") User a, @Param("b") User b);
}
