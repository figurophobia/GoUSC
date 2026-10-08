const API_BASE = '';

const state = {
    user: null,
    currentGame: null,
    currentGameId: null,
    boardSize: 9,
    games: [],
    friends: [],
    pending: [],
    chatUsers: [],
    privateChat: [],
    gameChat: [],
    ranking: [],
    history: []
};

const $ = (id) => document.getElementById(id);

const views = {
    loginSection: $('loginSection'),
    mainSection: $('mainSection'),
    gameSection: $('gameSection')
};

/* ============================================================ utilidades === */

function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function initials(name) {
    const s = String(name || '?').trim();
    if (!s) return '?';
    const parts = s.split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : s.slice(0, 2)).toUpperCase();
}

function fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function emptyState(title, sub) {
    return `<div class="emptyState">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4.5"></rect>
            <path d="M9 3.8v16.4M15 3.8v16.4M3.8 9h16.4M3.8 15h16.4"></path>
        </svg>
        <strong>${esc(title)}</strong>
        ${sub ? `<span>${esc(sub)}</span>` : ''}
    </div>`;
}

/* ============================================================== toasts ==== */

const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4.5M12 17h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
};

const TOAST_TITLES = {
    success: 'Correcto',
    error: 'Error',
    warning: 'Aviso',
    info: 'Información'
};

function toast(type, message, title) {
    const container = $('toastContainer');
    if (!container) return;
    const kind = TOAST_ICONS[type] ? type : 'info';
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.innerHTML = `
        <span class="toastIcon">${TOAST_ICONS[kind]}</span>
        <div class="toastBody">
            <div class="toastTitle">${esc(title || TOAST_TITLES[kind])}</div>
            <div class="toastMsg">${esc(message || '')}</div>
        </div>
        <button class="toastClose" type="button" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>`;
    const remove = () => {
        if (!el.parentNode) return;
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 230);
    };
    el.querySelector('.toastClose').addEventListener('click', remove);
    container.appendChild(el);
    setTimeout(remove, 4600);
    while (container.children.length > 4) container.firstElementChild.remove();
}

/* ================================================================ API ===== */

function showError(id, msg) {
    const el = $(id);
    if (el) el.textContent = msg || '';
}

function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (state.user && state.user.id) h['X-User-Id'] = state.user.id;
    return h;
}

async function apiFetch(path, options = {}) {
    const res = await fetch(API_BASE + path, {
        ...options,
        headers: { ...getHeaders(), ...(options.headers || {}) }
    });
    if (res.status === 204) return null;
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
        const err = new Error((data && (data.detail || data.title)) || 'Error de conexión');
        err.title = data && data.title;
        err.status = res.status;
        throw err;
    }
    return data;
}

/* ============================================================== sesión ==== */

function saveUser() {
    if (state.user) localStorage.setItem('gousc_user', JSON.stringify(state.user));
}

function syncUserUI() {
    if (!state.user) return;
    $('currentUser').textContent = state.user.username || '-';
    $('currentElo').textContent = state.user.elo != null ? state.user.elo : 1500;
    $('headerAvatar').textContent = initials(state.user.username);
}

function setAuth(user) {
    state.user = user;
    if (user) {
        saveUser();
        syncUserUI();
        views.loginSection.style.display = 'none';
        views.mainSection.style.display = 'flex';
        views.gameSection.style.display = 'none';
        loadGames();
        loadFriends();
        loadRanking();
        loadChatUsers();
        refreshMe();
    } else {
        localStorage.removeItem('gousc_user');
        views.loginSection.style.display = 'flex';
        views.mainSection.style.display = 'none';
        views.gameSection.style.display = 'none';
    }
}

async function refreshMe() {
    if (!state.user || !state.user.id) return;
    try {
        const me = await apiFetch(`/users/${state.user.id}`);
        if (me && me.id) {
            state.user = { ...state.user, ...me };
            saveUser();
            syncUserUI();
            renderProfile();
        }
    } catch (e) { /* sin conexión: se mantiene la copia local */ }
}

/* ========================================================= pestañas/nav === */

const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tabContent');
tabs.forEach(t => {
    t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        tabContents.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        $(t.dataset.tab).classList.add('active');
    });
});

const navBtns = document.querySelectorAll('.navBtn');
const viewsEl = document.querySelectorAll('.view');

function switchView(viewId) {
    navBtns.forEach(x => x.classList.toggle('active', x.dataset.view === viewId));
    viewsEl.forEach(x => x.classList.toggle('active', x.id === viewId));
    if (viewId === 'rankingView') loadRanking();
    if (viewId === 'friendsView') loadFriends();
    if (viewId === 'chatView') { loadChatUsers().then(() => loadPrivateChat(false)); }
    if (viewId === 'lobbyView') loadGames(true);
    if (viewId === 'profileView') loadProfile();
}

navBtns.forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
$('userChip').addEventListener('click', () => switchView('profileView'));

/* =============================================================== auth ===== */

$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('loginError', '');
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value.trim();
    if (!username || !password) { showError('loginError', 'Rellena todos los campos'); return; }
    try {
        const user = await apiFetch('/users/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        setAuth(user);
        toast('success', `Bienvenido de nuevo, ${user.username}.`, 'Sesión iniciada');
    } catch (err) {
        showError('loginError', err.message);
        toast('error', err.message, err.title || 'No se pudo iniciar sesión');
    }
});

$('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('regError', '');
    const username = $('regUsername').value.trim();
    const password = $('regPassword').value.trim();
    const email = $('regEmail').value.trim();
    if (!username || !password) { showError('regError', 'Usuario y contraseña obligatorios'); return; }
    try {
        await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, email: email || null })
        });
        toast('success', 'Cuenta creada. Ya puedes iniciar sesión.', 'Registro completado');
        $('loginUsername').value = username;
        $('loginPassword').value = '';
        document.querySelector('.tab[data-tab="loginTab"]').click();
    } catch (err) {
        showError('regError', err.message);
        toast('error', err.message, err.title || 'No se pudo registrar');
    }
});

$('logoutBtn').addEventListener('click', () => {
    setAuth(null);
    toast('info', 'Has cerrado la sesión.', 'Hasta pronto');
});

/* =============================================================== lobby ==== */

const inflight = {};
let lastGamesJson = '';

$('createGameBtn').addEventListener('click', async () => {
    if (!state.user) return;
    const boardSize = $('boardSizeSelect').value;
    const mode = $('gameModeSelect').value;
    try {
        const game = await apiFetch('/games', {
            method: 'POST',
            body: JSON.stringify({ boardSize, mode })
        });
        toast('success', `Partida #${game.id} creada.`, 'Partida lista');
        await loadGames(true);
        if (game && game.id) await openGame(game.id);
    } catch (err) {
        toast('error', err.message, err.title || 'No se pudo crear la partida');
    }
});

$('refreshLobbyBtn').addEventListener('click', () => loadGames(true));

$('backToLobbyBtn').addEventListener('click', () => {
    state.currentGameId = null;
    state.currentGame = null;
    views.gameSection.style.display = 'none';
    views.mainSection.style.display = 'flex';
    loadGames(true);
});

async function loadGames(force) {
    if (inflight.games) return;
    inflight.games = true;
    try {
        const games = await apiFetch('/games');
        state.games = games || [];
        const json = JSON.stringify(state.games);
        if (force || json !== lastGamesJson) {
            lastGamesJson = json;
            renderGames();
        }
    } catch (err) { console.error(err); }
    finally { inflight.games = false; }
}

const STATUS_MAP = {
    WAITING: { cls: 'chip--wait', text: 'Esperando' },
    ACTIVE: { cls: 'chip--live', text: 'En juego' },
    FINISHED: { cls: 'chip--done', text: 'Finalizada' },
    ABANDONED: { cls: 'chip--off', text: 'Abandonada' }
};

function statusChip(status) {
    const s = STATUS_MAP[status] || { cls: '', text: status || '-' };
    return `<span class="chip ${s.cls}">${esc(s.text)}</span>`;
}

function playerNames(g) {
    const black = g.blackPlayer ? g.blackPlayer.username : '—';
    const white = g.whitePlayer ? g.whitePlayer.username : 'Por jugar';
    return `<strong>${esc(black)}</strong><span class="vsTag">VS</span><strong>${esc(white)}</strong>`;
}

function renderGames() {
    const list = $('gamesList');
    if (!state.games.length) {
        list.innerHTML = emptyState('No hay partidas abiertas', 'Crea una nueva desde el panel superior.');
        return;
    }
    list.innerHTML = state.games.map(g => {
        const canJoin = g.status === 'WAITING' && state.user && g.blackPlayer
            && g.blackPlayer.id !== state.user.id && !g.whitePlayer;
        return `<div class="gameCard">
            <div class="gameCardInfo">
                <div class="gameCardTop">
                    <span class="gameCardId">Partida #${esc(g.id)}</span>
                    ${statusChip(g.status)}
                    <span class="chip ${g.mode === 'RANKED' ? 'chip--ranked' : ''}">${esc(g.mode)}</span>
                    <span class="chip">${esc(g.boardSize)}</span>
                </div>
                <div class="gamePlayers">${playerNames(g)}</div>
            </div>
            <div class="gameCardActions">
                <button class="btn btnGhost btnSm" data-action="view" data-id="${esc(g.id)}" type="button">Ver</button>
                ${canJoin ? `<button class="btn btnPrimary btnSm" data-action="join" data-id="${esc(g.id)}" type="button">Unirse</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

$('gamesList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'view') return openGame(id);
    if (btn.dataset.action === 'join') {
        try {
            await apiFetch(`/games/${id}/join`, { method: 'POST' });
            toast('success', `Te has unido a la partida #${id}.`, 'Partida encontrada');
            await openGame(id);
        } catch (err) { toast('error', err.message, err.title || 'No te pudiste unir'); }
    }
});

/* ============================================================= ranking ==== */

let lastRankingJson = '';

async function loadRanking(force) {
    if (inflight.ranking) return;
    inflight.ranking = true;
    try {
        const ranking = await apiFetch('/users/ranking');
        state.ranking = ranking || [];
        const json = JSON.stringify(state.ranking);
        if (force || json !== lastRankingJson) {
            lastRankingJson = json;
            renderRanking();
        }
    } catch (err) { console.error(err); }
    finally { inflight.ranking = false; }
}

function renderRanking() {
    const body = $('rankingBody');
    if (!state.ranking.length) {
        body.innerHTML = `<tr><td colspan="5">${emptyState('Aún no hay jugadores en el ranking')}</td></tr>`;
        return;
    }
    const meId = state.user && state.user.id;
    body.innerHTML = state.ranking.map((u, i) => {
        const isMe = meId != null && u.id === meId;
        return `<tr class="${isMe ? 'isMe' : ''}">
            <td class="colRank"><span class="rankBadge${i < 3 ? ` rankBadge--${i + 1}` : ''}">${i + 1}</span></td>
            <td>
                <div class="playerCell">
                    <span class="avatar avatarXs">${esc(initials(u.username))}</span>
                    <span class="playerCellName">${esc(u.username)}${isMe ? '<small>Tú</small>' : ''}</span>
                </div>
            </td>
            <td class="colElo"><span class="eloPill">${u.elo != null ? u.elo : 1500}</span></td>
            <td class="colNum"><span class="wPill">${u.wins || 0}</span></td>
            <td class="colNum"><span class="lPill">${u.losses || 0}</span></td>
        </tr>`;
    }).join('');
}

/* ============================================================== amigos ==== */

let lastFriendsJson = '';

async function loadFriends() {
    if (inflight.friends) return;
    inflight.friends = true;
    try {
        const friends = await apiFetch('/friendships');
        const pending = await apiFetch('/friendships/pending');
        state.friends = friends || [];
        state.pending = pending || [];
        const json = JSON.stringify([state.friends, state.pending]);
        if (json !== lastFriendsJson) {
            lastFriendsJson = json;
            renderFriends();
        }
    } catch (err) { console.error(err); }
    finally { inflight.friends = false; }
}

function renderFriends() {
    $('pendingCount').textContent = state.pending.length;
    $('friendsCount').textContent = state.friends.length;

    const pList = $('pendingList');
    pList.innerHTML = state.pending.length ? state.pending.map(p => `
        <div class="itemRow">
            <span class="avatar avatarSm">${esc(initials(p.requester && p.requester.username))}</span>
            <div class="itemInfo">
                <span class="itemName">${esc(p.requester ? p.requester.username : 'Desconocido')}</span>
                <span class="itemMeta">Solicitud #${esc(p.id)} · ${esc(fmtDate(p.createdAt))}</span>
            </div>
            <div class="itemActions">
                <button class="btn btnPrimary btnSm" data-action="accept" data-id="${esc(p.id)}" type="button">Aceptar</button>
                <button class="btn btnGhost btnSm" data-action="reject" data-id="${esc(p.id)}" type="button">Rechazar</button>
            </div>
        </div>`).join('') : emptyState('No tienes solicitudes pendientes', 'Comparte tu ID para que te agreguen.');

    const fList = $('friendsList');
    fList.innerHTML = state.friends.length ? state.friends.map(f => `
        <div class="itemRow">
            <span class="avatar avatarSm">${esc(initials(f.username))}</span>
            <div class="itemInfo">
                <span class="itemName">${esc(f.username)}</span>
                <span class="itemMeta">ELO ${f.elo != null ? f.elo : 1500} · ID ${esc(f.id)}</span>
            </div>
            <div class="itemActions">
                <button class="btn btnGhost btnSm" data-action="chat" data-id="${esc(f.id)}" type="button">Chat</button>
            </div>
        </div>`).join('') : emptyState('Todavía no tienes amigos', 'Añade jugadores por su ID.');
}

$('pendingList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    try {
        if (btn.dataset.action === 'accept') {
            await apiFetch(`/friendships/${id}/accept`, { method: 'POST' });
            toast('success', 'Solicitud aceptada.', 'Amigos');
            loadFriends();
            loadChatUsers();
        } else {
            await apiFetch(`/friendships/${id}/reject`, { method: 'POST' });
            toast('info', 'Solicitud rechazada.', 'Amigos');
            loadFriends();
        }
    } catch (err) { toast('error', err.message, err.title || 'No se pudo procesar'); }
});

$('friendsList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="chat"]');
    if (!btn) return;
    switchView('chatView');
    setTimeout(() => {
        $('chatUserSelect').value = btn.dataset.id;
        loadPrivateChat(false);
    }, 60);
});

$('addFriendBtn').addEventListener('click', async () => {
    const id = $('friendIdInput').value.trim();
    if (!id) { toast('warning', 'Introduce el ID del jugador que quieres agregar.', 'Falta el ID'); return; }
    if (state.user && String(state.user.id) === id) {
        toast('warning', 'No puedes enviarte una solicitud a ti mismo.', 'ID inválido');
        return;
    }
    try {
        await apiFetch('/friendships', {
            method: 'POST',
            body: JSON.stringify({ addresseeId: parseInt(id, 10) })
        });
        $('friendIdInput').value = '';
        toast('success', `Solicitud enviada al jugador #${id}.`, 'Solicitud enviada');
        loadFriends();
    } catch (err) { toast('error', err.message, err.title || 'No se pudo enviar la solicitud'); }
});

/* ================================================================ chat ==== */

async function loadChatUsers() {
    try {
        const friends = await apiFetch('/friendships');
        state.friends = friends || [];
        const sel = $('chatUserSelect');
        const previous = sel.value;
        sel.innerHTML = state.friends.length
            ? state.friends.map(f => `<option value="${esc(f.id)}">${esc(f.username)}</option>`).join('')
            : '<option value="">No tienes amigos aún</option>';
        if (previous && [...sel.options].some(o => o.value === previous)) sel.value = previous;
        return state.friends;
    } catch (err) { console.error(err); return []; }
}

$('chatUserSelect').addEventListener('change', () => loadPrivateChat(false));
$('loadChatBtn').addEventListener('click', () => loadPrivateChat(true));
$('sendPrivateBtn').addEventListener('click', sendPrivateMsg);
$('privateMsgInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPrivateMsg(); });

let lastPrivateJson = '';
let lastPrivateWith = null;

async function loadPrivateChat(force) {
    const withId = $('chatUserSelect').value;
    const box = $('privateChat');
    if (!withId) {
        lastPrivateJson = '';
        lastPrivateWith = null;
        box.innerHTML = emptyState('Elige una conversación', 'Selecciona un amigo para empezar a chatear.');
        return;
    }
    if (inflight.privateChat) return;
    inflight.privateChat = true;
    try {
        const msgs = await apiFetch(`/messages?with=${withId}`);
        if ($('chatUserSelect').value !== withId) return;
        state.privateChat = msgs || [];
        const json = JSON.stringify(state.privateChat);
        const switched = withId !== lastPrivateWith;
        if (!force && !switched && json === lastPrivateJson) return;
        lastPrivateJson = json;
        lastPrivateWith = withId;
        renderChatBox(box, state.privateChat, true, !force && !switched);
    } catch (err) {
        if (force) toast('error', err.message, err.title || 'No se pudo cargar el chat');
    } finally { inflight.privateChat = false; }
}

async function sendPrivateMsg() {
    const withId = $('chatUserSelect').value;
    const input = $('privateMsgInput');
    const content = input.value.trim();
    if (!withId) { toast('warning', 'Selecciona primero una conversación.', 'Chat'); return; }
    if (!content) return;
    try {
        await apiFetch(`/messages?to=${withId}`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        input.value = '';
        await loadPrivateChat(true);
    } catch (err) { toast('error', err.message, err.title || 'No se pudo enviar el mensaje'); }
}

function renderChatBox(box, msgs, mineFlag, keepScroll) {
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 70;
    if (!msgs.length) {
        box.innerHTML = emptyState('Sin mensajes todavía', '¡Saluda para empezar la conversación!');
        box.scrollTop = box.scrollHeight;
        return;
    }
    const meId = state.user && state.user.id;
    box.innerHTML = msgs.map(m => {
        const mine = mineFlag && meId != null && m.sender && m.sender.id === meId;
        const sender = m.sender ? m.sender.username : '';
        return `<div class="chatMsg${mine ? ' mine' : ''}">
            <span class="sender">${esc(mine ? 'Tú' : sender)}</span>
            <span class="msgText">${esc(m.content)}</span>
            <span class="msgTime">${esc(fmtTime(m.createdAt))}</span>
        </div>`;
    }).join('');
    if (!keepScroll || nearBottom) box.scrollTop = box.scrollHeight;
}

/* ====================================================== chat de partida === */

$('sendGameMsgBtn').addEventListener('click', sendGameMsg);
$('gameMsgInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendGameMsg(); });

let lastGameChatJson = '';

async function loadGameChat(force) {
    if (!state.currentGameId) return;
    if (inflight.gameChat) return;
    inflight.gameChat = true;
    try {
        const msgs = await apiFetch(`/games/${state.currentGameId}/messages`);
        state.gameChat = msgs || [];
        const json = JSON.stringify(state.gameChat);
        if (!force && json === lastGameChatJson) return;
        lastGameChatJson = json;
        renderChatBox($('gameChatBox'), state.gameChat, true, !force);
    } catch (err) { console.error(err); }
    finally { inflight.gameChat = false; }
}

async function sendGameMsg() {
    if (!state.currentGameId) return;
    const input = $('gameMsgInput');
    const content = input.value.trim();
    if (!content) return;
    try {
        await apiFetch(`/games/${state.currentGameId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        input.value = '';
        await loadGameChat(true);
    } catch (err) { toast('error', err.message, err.title || 'No se pudo enviar el mensaje'); }
}

/* ============================================================== perfil ==== */

async function loadProfile() {
    await refreshMe();
    fillEditFields();
    loadHistory(true);
}

function fillEditFields() {
    if (!state.user) return;
    const active = document.activeElement;
    const setIfIdle = (id, value) => { if (active !== $(id)) $(id).value = value; };
    setIfIdle('editUsername', state.user.username || '');
    setIfIdle('editEmail', state.user.email || '');
    setIfIdle('editPassword', '');
}

function renderProfile() {
    if (!state.user) return;
    const u = state.user;
    $('profileAvatar').textContent = initials(u.username);
    $('profileUsername').textContent = u.username || '-';
    $('profileId').textContent = u.id != null ? u.id : '-';
    $('profileElo').textContent = u.elo != null ? u.elo : 1500;
    $('profileWins').textContent = u.wins || 0;
    $('profileLosses').textContent = u.losses || 0;
    const wins = u.wins || 0;
    const losses = u.losses || 0;
    const total = wins + losses;
    $('profileWinrate').textContent = total ? `${Math.round((wins / total) * 100)}%` : '—';
    $('profileSince').textContent = fmtDate(u.createdAt);
}

$('copyIdBtn').addEventListener('click', async () => {
    if (!state.user) return;
    const id = String(state.user.id);
    try {
        await navigator.clipboard.writeText(id);
        toast('success', `ID ${id} copiado al portapapeles.`, 'ID copiado');
    } catch (e) {
        const tmp = document.createElement('textarea');
        tmp.value = id;
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); toast('success', `ID ${id} copiado.`, 'ID copiado'); }
        catch (e2) { toast('error', `Tu ID es ${id}. Cópialo manualmente.`, 'No se pudo copiar'); }
        tmp.remove();
    }
});

$('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user) return;
    const form = $('profileForm');
    if (!form.reportValidity()) return;

    const username = $('editUsername').value.trim();
    const email = $('editEmail').value.trim();
    const password = $('editPassword').value;

    const body = {};
    if (username && username !== state.user.username) body.username = username;
    if (email && email !== (state.user.email || '')) body.email = email;
    if (password) {
        if (password.length < 3) { toast('warning', 'La contraseña debe tener al menos 3 caracteres.', 'Contraseña débil'); return; }
        body.password = password;
    }

    if (!Object.keys(body).length) {
        toast('info', 'No hay cambios que guardar.', 'Perfil');
        return;
    }

    try {
        const updated = await apiFetch(`/users/${state.user.id}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        state.user = { ...state.user, ...updated };
        saveUser();
        syncUserUI();
        renderProfile();
        fillEditFields();
        loadRanking(true);
        toast('success', 'Tu perfil se ha actualizado correctamente.', 'Perfil guardado');
    } catch (err) {
        toast('error', err.message, err.title || 'No se pudo actualizar el perfil');
    }
});

$('refreshHistoryBtn').addEventListener('click', () => loadHistory(true));

let lastHistoryJson = '';

async function loadHistory(force) {
    if (!state.user || !state.user.id) return;
    if (inflight.history) return;
    inflight.history = true;
    try {
        const games = await apiFetch(`/games?player=${state.user.id}`);
        state.history = games || [];
        const json = JSON.stringify(state.history);
        if (force || json !== lastHistoryJson) {
            lastHistoryJson = json;
            renderHistory();
        }
    } catch (err) { console.error(err); }
    finally { inflight.history = false; }
}

function historyBadge(g, meId) {
    if (g.status === 'WAITING') return { cls: 'wait', text: 'Esperando' };
    if (g.status === 'ACTIVE') return { cls: 'live', text: 'En curso' };
    if (g.status === 'ABANDONED') return { cls: 'off', text: 'Abandonada' };
    if (g.status === 'FINISHED') {
        if (!g.winner) return { cls: 'off', text: 'Sin resultado' };
        return g.winner.id === meId
            ? { cls: 'win', text: 'Victoria' }
            : { cls: 'loss', text: 'Derrota' };
    }
    return { cls: 'off', text: g.status || '-' };
}

function renderHistory() {
    const box = $('historyList');
    $('profileGames').textContent = state.history.length;
    if (!state.history.length) {
        box.innerHTML = emptyState('Aún no has jugado ninguna partida', 'Entra al lobby y crea tu primera partida.');
        return;
    }
    const meId = state.user && state.user.id;
    box.innerHTML = state.history.map(g => {
        const isBlack = g.blackPlayer && g.blackPlayer.id === meId;
        const opp = isBlack ? g.whitePlayer : g.blackPlayer;
        const badge = historyBadge(g, meId);
        const eloDelta = g.mode === 'RANKED'
            ? (isBlack ? g.eloChangeBlack : g.eloChangeWhite)
            : null;
        const score = g.status === 'FINISHED' && g.finalScoreBlack != null
            ? `<span>Negras ${g.finalScoreBlack} · Blancas ${g.finalScoreWhite}</span>`
            : '';
        return `<div class="historyRow">
            <span class="resultBadge resultBadge--${badge.cls}">${esc(badge.text)}</span>
            <div class="historyInfo">
                <span class="historyTitle">#${esc(g.id)} · ${opp ? 'vs ' + esc(opp.username) : 'Sin rival aún'}</span>
                <span class="historyMeta">
                    <span>${esc(g.mode)}</span>
                    <span>${esc(g.boardSize)}</span>
                    <span>${esc(fmtDate(g.createdAt))}</span>
                    ${score}
                    ${eloDelta != null ? `<span>ELO ${eloDelta >= 0 ? '+' : ''}${eloDelta}</span>` : ''}
                </span>
            </div>
            <div class="itemActions">
                <button class="btn btnGhost btnSm" data-history="${esc(g.id)}" type="button">Ver</button>
            </div>
        </div>`;
    }).join('');
}

$('historyList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-history]');
    if (btn) openGame(btn.dataset.history);
});

/* ============================================================= partida ==== */

$('passBtn').addEventListener('click', async () => {
    if (!state.currentGameId) return;
    try {
        const game = await apiFetch(`/games/${state.currentGameId}/moves`, {
            method: 'POST',
            body: JSON.stringify({ pass: true })
        });
        applyGame(game);
        toast('info', 'Has pasado turno.', 'Turno pasado');
    } catch (err) {
        toast('error', err.message, err.title || 'No se pudo pasar el turno');
    }
});

$('leaveBtn').addEventListener('click', async () => {
    if (!state.currentGameId) return;
    if (!confirm('¿Abandonar la partida? Se dará por perdida.')) return;
    try {
        await apiFetch(`/games/${state.currentGameId}/leave`, { method: 'POST' });
        state.currentGameId = null;
        state.currentGame = null;
        views.gameSection.style.display = 'none';
        views.mainSection.style.display = 'flex';
        toast('info', 'Has abandonado la partida.', 'Partida');
        loadGames(true);
    } catch (err) { toast('error', err.message, err.title || 'No se pudo abandonar'); }
});

async function openGame(gameId) {
    try {
        const game = await apiFetch(`/games/${gameId}`);
        state.currentGame = game;
        state.currentGameId = gameId;
        state.boardSize = game.boardSize === 'THIRTEEN' ? 13 : (game.boardSize === 'NINETEEN' ? 19 : 9);
        lastGameChatJson = '';
        views.mainSection.style.display = 'none';
        views.gameSection.style.display = 'flex';
        $('gameIdSpan').textContent = gameId;
        applyGame(game);
        await loadGameChat(true);
        requestAnimationFrame(fitBoard);
    } catch (err) {
        toast('error', err.message, err.title || 'No se pudo abrir la partida');
    }
}

function myColor(game) {
    if (!state.user || !game) return null;
    if (game.blackPlayer && game.blackPlayer.id === state.user.id) return 'BLACK';
    if (game.whitePlayer && game.whitePlayer.id === state.user.id) return 'WHITE';
    return null;
}

function applyGame(game) {
    const previous = state.currentGame;
    state.currentGame = game;

    const statusEl = $('gameStatus');
    const statusConf = {
        ACTIVE: { cls: 'statusChip--active', text: 'En juego' },
        WAITING: { cls: 'statusChip--wait', text: 'Esperando rival' },
        FINISHED: { cls: 'statusChip--done', text: 'Finalizada' },
        ABANDONED: { cls: 'statusChip--off', text: 'Abandonada' }
    }[game.status] || { cls: '', text: game.status || '-' };
    statusEl.className = `statusChip ${statusConf.cls}`;
    statusEl.textContent = statusConf.text;

    const turnEl = $('gameTurn');
    if (game.status === 'ACTIVE' && game.currentTurn) {
        const isBlack = game.currentTurn === 'BLACK';
        const turnPlayer = isBlack ? game.blackPlayer : game.whitePlayer;
        const mine = myColor(game) === game.currentTurn;
        turnEl.className = 'turnChip';
        turnEl.innerHTML = `<span class="stoneDot ${isBlack ? 'black' : 'white'}"></span>${mine ? 'Tu turno' : 'Turno de ' + esc(turnPlayer ? turnPlayer.username : (isBlack ? 'Negras' : 'Blancas'))}`;
    } else {
        turnEl.className = 'turnChip turnChip--hidden';
        turnEl.textContent = '';
    }

    renderPlayer('blackPlayer', game, 'BLACK', 'Negras');
    renderPlayer('whitePlayer', game, 'WHITE', 'Blancas');
    renderGameResult(game);

    if (previous && previous.status === 'ACTIVE' && game.status === 'FINISHED' && game.winner) {
        const meWon = state.user && game.winner.id === state.user.id;
        toast(meWon ? 'success' : 'info',
            `${game.winner.username} ha ganado la partida #${game.id}.`,
            'Partida finalizada');
    }

    drawBoard();
}

function renderPlayer(id, game, color, label) {
    const el = $(id);
    const player = color === 'BLACK' ? game.blackPlayer : game.whitePlayer;
    const captures = color === 'BLACK' ? game.capturesBlack : game.capturesWhite;
    const isTurn = game.status === 'ACTIVE' && game.currentTurn === color;
    const mine = myColor(game) === color;
    const komi = color === 'WHITE' && game.komi != null ? ` · komi ${game.komi}` : '';
    el.className = `playerRow${isTurn ? ' isTurn' : ''}`;
    el.innerHTML = `
        <span class="stoneDot ${color === 'BLACK' ? 'black' : 'white'}"></span>
        <div class="playerInfo">
            <span class="playerName">${esc(player ? player.username : 'Por jugar')}</span>
            <span class="playerMeta">${label} · ${captures != null ? captures : 0} capturas${komi}</span>
        </div>
        ${isTurn ? `<span class="turnTag">${mine ? 'Tu turno' : 'Turno'}</span>` : ''}`;
}

function renderGameResult(game) {
    const box = $('gameResult');
    if (game.status === 'FINISHED') {
        const myDelta = (() => {
            if (game.mode !== 'RANKED') return null;
            const mine = myColor(game);
            if (mine === 'BLACK') return game.eloChangeBlack;
            if (mine === 'WHITE') return game.eloChangeWhite;
            return null;
        })();
        box.style.display = 'block';
        box.innerHTML = `
            <div class="resultTitle">${game.winner ? `Ganador: ${esc(game.winner.username)}` : 'Partida finalizada'}</div>
            <div class="resultLine"><span>Negras</span><strong>${game.finalScoreBlack != null ? game.finalScoreBlack : '—'}</strong></div>
            <div class="resultLine"><span>Blancas</span><strong>${game.finalScoreWhite != null ? game.finalScoreWhite : '—'}</strong></div>
            ${myDelta != null ? `<div class="resultElo">Tu ELO: <span class="${myDelta >= 0 ? 'up' : 'down'}">${myDelta >= 0 ? '+' : ''}${myDelta}</span></div>` : ''}`;
    } else if (game.status === 'ABANDONED') {
        box.style.display = 'block';
        box.innerHTML = `<div class="resultTitle">Partida abandonada</div>
            <div class="resultLine"><span>Estado</span><strong>No se contabiliza</strong></div>`;
    } else {
        box.style.display = 'none';
        box.innerHTML = '';
    }
}

async function refreshActiveGame() {
    if (!state.currentGameId) return;
    if (inflight.game) return;
    inflight.game = true;
    try {
        const g = await apiFetch(`/games/${state.currentGameId}`);
        if (!g) return;
        const changed = JSON.stringify(g) !== JSON.stringify(state.currentGame);
        if (changed) applyGame(g);
        loadGameChat(false);
    } catch (e) { /* la partida puede haber desaparecido */ }
    finally { inflight.game = false; }
}

/* ------------------------------------------------------------ tablero ----- */

const canvas = $('goBoard');
const ctx = canvas.getContext('2d');
const PAD_RATIO = 1.15;
const COL_LABELS = 'ABCDEFGHJKLMNOPQRST';

let boardPx = 600;
let dpr = 1;
let hoverPoint = null;

function gridMetrics() {
    const size = state.boardSize;
    const cell = boardPx / (size - 1 + 2 * PAD_RATIO);
    return { size, cell, pad: cell * PAD_RATIO };
}

function fitBoard() {
    const frame = canvas.parentElement;
    const avail = frame ? frame.clientWidth : 0;
    if (!avail) return;
    const cssSize = Math.max(140, Math.min(Math.floor(avail), 660));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    boardPx = cssSize;
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    drawBoard();
}

function parseBoard(json) {
    if (!json) return {};
    try { return JSON.parse(json) || {}; }
    catch (e) { return {}; }
}

function drawStone(px, py, radius, color, alpha) {
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(15, 10, 5, .45)';
    ctx.shadowBlur = radius * 0.5;
    ctx.shadowOffsetY = radius * 0.18;
    const grad = ctx.createRadialGradient(px - radius * 0.35, py - radius * 0.4, radius * 0.12, px, py, radius);
    if (color === 'B') {
        grad.addColorStop(0, '#7d8797');
        grad.addColorStop(0.45, '#262c38');
        grad.addColorStop(1, '#05070c');
    } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.55, '#f2f5fa');
        grad.addColorStop(1, '#c6cdda');
    }
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(0.7, radius * 0.07);
    ctx.strokeStyle = color === 'B' ? 'rgba(0,0,0,.7)' : 'rgba(120,132,155,.85)';
    ctx.stroke();
    ctx.restore();
}

function starPoints(size) {
    if (size >= 19) return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
    if (size >= 13) return [[3, 3], [3, 6], [3, 9], [6, 3], [6, 6], [6, 9], [9, 3], [9, 6], [9, 9]];
    if (size >= 9) return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
    return [];
}

function lastMoveCoord() {
    const game = state.currentGame;
    if (!game || !game.moveHistory) return null;
    const entries = String(game.moveHistory).split(',').map(s => s.trim()).filter(Boolean);
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry === '-' || entry.length < 2) continue;
        return parseCoordLabel(entry);
    }
    return null;
}

function parseCoordLabel(label) {
    const col = label[0].toUpperCase();
    let x = col.charCodeAt(0) - 65;
    if (x > 8) x--;
    const y = parseInt(label.slice(1), 10) - 1;
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0) return null;
    return { x, y };
}

function drawBoard() {
    const { size, cell, pad } = gridMetrics();
    const end = pad + (size - 1) * cell;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, boardPx, boardPx);

    const wood = ctx.createLinearGradient(0, 0, boardPx, boardPx);
    wood.addColorStop(0, '#eed49f');
    wood.addColorStop(0.5, '#e4c184');
    wood.addColorStop(1, '#d5a961');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, boardPx, boardPx);

    ctx.strokeStyle = 'rgba(58, 38, 16, .78)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, cell * 0.045);
    for (let i = 0; i < size; i++) {
        const p = pad + i * cell;
        ctx.beginPath();
        ctx.moveTo(pad, p);
        ctx.lineTo(end, p);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p, pad);
        ctx.lineTo(p, end);
        ctx.stroke();
    }

    ctx.lineWidth = Math.max(1.4, cell * 0.08);
    ctx.strokeRect(pad, pad, end - pad, end - pad);

    ctx.fillStyle = 'rgba(48, 30, 12, .85)';
    for (const [sx, sy] of starPoints(size)) {
        ctx.beginPath();
        ctx.arc(pad + sx * cell, pad + sy * cell, Math.max(2.4, cell * 0.09), 0, Math.PI * 2);
        ctx.fill();
    }

    const labelFont = `600 ${Math.max(9, Math.round(cell * 0.3))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(58, 38, 16, .8)';
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < size; i++) {
        const p = pad + i * cell;
        if (i < COL_LABELS.length) ctx.fillText(COL_LABELS[i], p, pad * 0.48);
        ctx.fillText(String(i + 1), pad * 0.46, p);
    }

    const board = parseBoard(state.currentGame ? state.currentGame.boardState : null);
    const last = lastMoveCoord();
    const stoneR = cell * 0.44;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const c = board[x + ',' + y];
            if (c !== 'B' && c !== 'W') continue;
            const px = pad + x * cell;
            const py = pad + y * cell;
            drawStone(px, py, stoneR, c);
            if (last && last.x === x && last.y === y) {
                ctx.beginPath();
                ctx.arc(px, py, Math.max(2.5, cell * 0.11), 0, Math.PI * 2);
                ctx.fillStyle = c === 'B' ? 'rgba(96, 165, 250, .95)' : 'rgba(37, 99, 235, .9)';
                ctx.fill();
            }
        }
    }

    if (hoverPoint && canPlayHere()) {
        const { x, y } = hoverPoint;
        if (!board[x + ',' + y]) {
            drawStone(pad + x * cell, pad + y * cell, stoneR, myColor(state.currentGame) === 'WHITE' ? 'W' : 'B', 0.42);
            ctx.beginPath();
            ctx.arc(pad + x * cell, pad + y * cell, stoneR, 0, Math.PI * 2);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(37, 99, 235, .8)';
            ctx.stroke();
        }
    }
}

function canPlayHere() {
    const g = state.currentGame;
    if (!g || g.status !== 'ACTIVE') return false;
    return myColor(g) === g.currentTurn;
}

function nearestIntersection(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = (clientX - rect.left) * (boardPx / rect.width);
    const py = (clientY - rect.top) * (boardPx / rect.height);
    const { size, cell, pad } = gridMetrics();
    const ix = Math.round((px - pad) / cell);
    const iy = Math.round((py - pad) / cell);
    if (ix < 0 || ix >= size || iy < 0 || iy >= size) return null;
    if (Math.abs(pad + ix * cell - px) > cell / 2 + 0.5) return null;
    if (Math.abs(pad + iy * cell - py) > cell / 2 + 0.5) return null;
    return { x: ix, y: iy };
}

const MOVE_REASONS = {
    NOT_YOUR_TURN: 'No es tu turno: espera a que juegue tu rival.',
    OCCUPIED_CELL: 'Esa intersección ya está ocupada por otra piedra.',
    SUICIDE: 'No se permite jugar un suicidio sin capturas.',
    KO: 'Esa jugada infringiría la regla del ko.',
    OUT_OF_RANGE: 'La jugada queda fuera del tablero.'
};

function moveErrorMessage(err) {
    const match = /([A-Z_]{3,})\s*$/.exec(err.message || '');
    if (match && MOVE_REASONS[match[1]]) {
        return { title: 'Movimiento incorrecto', msg: MOVE_REASONS[match[1]] };
    }
    return { title: err.title || 'Movimiento incorrecto', msg: err.message };
}

async function onBoardClick(e) {
    if (!state.currentGameId || !state.user || !state.currentGame) return;
    const point = nearestIntersection(e.clientX, e.clientY);
    if (!point) return;

    const game = state.currentGame;
    const color = myColor(game);
    if (!color) { toast('info', 'Solo los participantes pueden mover en el tablero.', 'Espectador'); return; }
    if (game.status !== 'ACTIVE') { toast('warning', 'La partida no está en curso.', 'Partida ' + (game.status || '')); return; }
    if (game.currentTurn !== color) { toast('info', 'Espera a que juegue tu rival.', 'No es tu turno'); return; }
    if (parseBoard(game.boardState)[point.x + ',' + point.y]) {
        toast('error', MOVE_REASONS.OCCUPIED_CELL, 'Movimiento incorrecto');
        return;
    }

    try {
        const updated = await apiFetch(`/games/${state.currentGameId}/moves`, {
            method: 'POST',
            body: JSON.stringify({ x: point.x, y: point.y, pass: false })
        });
        applyGame(updated);
    } catch (err) {
        const info = moveErrorMessage(err);
        toast('error', info.msg, info.title);
        drawBoard();
    }
}

canvas.addEventListener('click', onBoardClick);
canvas.addEventListener('mousemove', (e) => {
    const point = nearestIntersection(e.clientX, e.clientY);
    const key = point ? point.x + ',' + point.y : null;
    const prevKey = hoverPoint ? hoverPoint.x + ',' + hoverPoint.y : null;
    if (key !== prevKey) {
        hoverPoint = point;
        drawBoard();
    }
});
canvas.addEventListener('mouseleave', () => {
    if (hoverPoint) {
        hoverPoint = null;
        drawBoard();
    }
});

if (window.ResizeObserver) {
    new ResizeObserver(() => fitBoard()).observe(canvas.parentElement);
} else {
    window.addEventListener('resize', fitBoard);
}

/* ================================================== refresco automático === */

const TICK_MS = 2500;

function tick() {
    if (document.hidden) return;
    if (views.gameSection.style.display !== 'none') {
        refreshActiveGame();
        return;
    }
    if (views.mainSection.style.display === 'none') return;
    const active = document.querySelector('.navBtn.active');
    const view = active ? active.dataset.view : '';
    if (view === 'lobbyView') loadGames();
    else if (view === 'rankingView') loadRanking();
    else if (view === 'friendsView') loadFriends();
    else if (view === 'chatView') loadPrivateChat(false);
}

setInterval(tick, TICK_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

/* ================================================================ inicio == */

const saved = localStorage.getItem('gousc_user');
if (saved) {
    try { setAuth(JSON.parse(saved)); } catch (e) { setAuth(null); }
} else {
    setAuth(null);
}
