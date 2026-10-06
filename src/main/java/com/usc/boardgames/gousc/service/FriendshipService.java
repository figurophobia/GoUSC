package com.usc.boardgames.gousc.service;

import com.usc.boardgames.gousc.exception.DuplicateFriendshipException;
import com.usc.boardgames.gousc.exception.FriendshipNotFoundException;
import com.usc.boardgames.gousc.exception.FriendshipStateException;
import com.usc.boardgames.gousc.exception.UserNotFoundException;
import com.usc.boardgames.gousc.model.dto.Friendship;
import com.usc.boardgames.gousc.model.dto.User;
import com.usc.boardgames.gousc.model.entity.FriendshipStatus;
import com.usc.boardgames.gousc.repository.FriendshipRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserService userService;

    @Autowired
    public FriendshipService(FriendshipRepository friendshipRepository, UserService userService) {
        this.friendshipRepository = friendshipRepository;
        this.userService = userService;
    }

    public Friendship request(User requester, Long addresseeId)
            throws UserNotFoundException, DuplicateFriendshipException {
        var requesterEntity = userService.entity(requester.id());
        var addresseeEntity = userService.entity(addresseeId);

        if (requesterEntity.getId().equals(addresseeEntity.getId())) {
            throw new IllegalArgumentException("No puedes enviarte una solicitud a ti mismo");
        }

        var direct = friendshipRepository.findByRequesterAndAddressee(requesterEntity, addresseeEntity);
        var reverse = friendshipRepository.findByRequesterAndAddressee(addresseeEntity, requesterEntity);
        if (direct.isPresent()) {
            throw new DuplicateFriendshipException(direct.get());
        }
        if (reverse.isPresent()) {
            throw new DuplicateFriendshipException(reverse.get());
        }

        var friendship = new com.usc.boardgames.gousc.model.entity.Friendship(requesterEntity, addresseeEntity);
        return Friendship.from(friendshipRepository.save(friendship));
    }

    public Friendship accept(Long friendshipId, User current)
            throws FriendshipNotFoundException, FriendshipStateException, UserNotFoundException {
        var friendship = find(friendshipId);
        requireAddressee(friendship, current);
        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new FriendshipStateException(friendshipId, "La solicitud ya fue resuelta");
        }
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        return Friendship.from(friendshipRepository.save(friendship));
    }

    public Friendship reject(Long friendshipId, User current)
            throws FriendshipNotFoundException, FriendshipStateException, UserNotFoundException {
        var friendship = find(friendshipId);
        requireAddressee(friendship, current);
        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new FriendshipStateException(friendshipId, "La solicitud ya fue resuelta");
        }
        friendship.setStatus(FriendshipStatus.REJECTED);
        return Friendship.from(friendshipRepository.save(friendship));
    }

    /** Lista de amigos aceptados (el otro lado de cada relación). */
    public List<User> listFriends(User user) throws UserNotFoundException {
        var entity = userService.entity(user.id());
        return friendshipRepository
                .findByRequesterAndStatusOrAddresseeAndStatus(entity, FriendshipStatus.ACCEPTED,
                        entity, FriendshipStatus.ACCEPTED)
                .stream()
                .map(f -> f.getRequester().getId().equals(entity.getId()) ? f.getAddressee() : f.getRequester())
                .map(User::from)
                .toList();
    }

    /** Solicitudes de amistad recibidas pendientes de respuesta. */
    public List<Friendship> listPending(User user) throws UserNotFoundException {
        var entity = userService.entity(user.id());
        return friendshipRepository.findByAddresseeAndStatus(entity, FriendshipStatus.PENDING).stream()
                .map(Friendship::from)
                .toList();
    }

    private com.usc.boardgames.gousc.model.entity.Friendship find(Long friendshipId)
            throws FriendshipNotFoundException {
        return friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new FriendshipNotFoundException(friendshipId));
    }

    private void requireAddressee(com.usc.boardgames.gousc.model.entity.Friendship friendship, User current)
            throws FriendshipStateException, UserNotFoundException {
        if (!friendship.getAddressee().getId().equals(userService.entity(current.id()).getId())) {
            throw new FriendshipStateException(friendship.getId(),
                    "Solo el destinatario puede responder a la solicitud");
        }
    }
}
