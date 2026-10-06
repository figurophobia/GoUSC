package com.usc.boardgames.gousc.service;

import com.usc.boardgames.gousc.exception.GameNotFoundException;
import com.usc.boardgames.gousc.exception.GameStateException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.Message;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.model.entity.GameStatus;
import com.usc.boardgames.gousc.repository.GameRepository;
import com.usc.boardgames.gousc.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class MessageService {

    private final MessageRepository messageRepository;
    private final GameRepository gameRepository;
    private final UserService userService;

    @Autowired
    public MessageService(MessageRepository messageRepository, GameRepository gameRepository,
                          UserService userService) {
        this.messageRepository = messageRepository;
        this.gameRepository = gameRepository;
        this.userService = userService;
    }

    /** Mensaje privado entre dos usuarios (chat de amigos). */
    public Message sendPrivate(User sender, Long recipientId, String content)
            throws UserNotFoundException {
        var senderEntity = userService.entity(sender.id());
        var recipientEntity = userService.entity(recipientId);
        var message = new com.usc.boardgames.gousc.model.entity.Message(
                senderEntity, recipientEntity, null, content);
        return Message.from(messageRepository.save(message));
    }

    /** Mensaje en el chat de una partida (solo jugadores). */
    public Message sendGame(Long gameId, User sender, String content)
            throws GameNotFoundException, GameStateException, UserNotFoundException {
        var game = gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException(gameId));
        if (game.getStatus() != GameStatus.ACTIVE) {
            throw new GameStateException(gameId, "La partida no está en curso");
        }
        var senderEntity = userService.entity(sender.id());
        boolean isPlayer = game.getBlackPlayer().getId().equals(senderEntity.getId())
                || (game.getWhitePlayer() != null
                    && game.getWhitePlayer().getId().equals(senderEntity.getId()));
        if (!isPlayer) {
            throw new GameStateException(gameId, "No participas en esta partida");
        }

        var message = new com.usc.boardgames.gousc.model.entity.Message(
                senderEntity, null, game, content);
        return Message.from(messageRepository.save(message));
    }

    /** Conversación privada entre dos usuarios, en orden cronológico. */
    public List<Message> listPrivate(Long userId, Long otherId) throws UserNotFoundException {
        var a = userService.entity(userId);
        var b = userService.entity(otherId);
        return messageRepository.findPrivateConversation(a, b).stream()
                .map(Message::from)
                .toList();
    }

    /** Mensajes de una partida, en orden cronológico. */
    public List<Message> listGame(Long gameId) throws GameNotFoundException {
        if (!gameRepository.existsById(gameId)) {
            throw new GameNotFoundException(gameId);
        }
        return messageRepository.findByGameIdOrderByCreatedAtAsc(gameId).stream()
                .map(Message::from)
                .toList();
    }
}
