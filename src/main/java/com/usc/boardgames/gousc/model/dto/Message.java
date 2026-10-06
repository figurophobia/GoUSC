package com.usc.boardgames.gousc.model.dto;

import java.time.LocalDateTime;

public record Message(
        Long id,
        User sender,
        User recipient,
        Long gameId,
        String content,
        LocalDateTime createdAt
) {
    public static Message from(com.usc.boardgames.gousc.model.entity.Message message) {
        return new Message(
                message.getId(),
                User.from(message.getSender()),
                message.getRecipient() != null ? User.from(message.getRecipient()) : null,
                message.getGame() != null ? message.getGame().getId() : null,
                message.getContent(),
                message.getCreatedAt()
        );
    }
}
