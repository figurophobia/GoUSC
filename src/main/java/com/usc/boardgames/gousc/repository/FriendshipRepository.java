package com.usc.boardgames.gousc.repository;

import com.usc.boardgames.gousc.model.entity.Friendship;
import com.usc.boardgames.gousc.model.entity.FriendshipStatus;
import com.usc.boardgames.gousc.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    Optional<Friendship> findByRequesterAndAddressee(User requester, User addressee);

    List<Friendship> findByRequesterAndStatus(User requester, FriendshipStatus status);

    List<Friendship> findByAddresseeAndStatus(User addressee, FriendshipStatus status);

    List<Friendship> findByRequesterAndStatusOrAddresseeAndStatus(
            User requester, FriendshipStatus status1,
            User addressee, FriendshipStatus status2);
}
