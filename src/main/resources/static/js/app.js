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
    gameChat: []
};

const views = {
    loginSection: document.getElementById('loginSection'),
    mainSection: document.getElementById('mainSection'),
    gameSection: document.getElementById('gameSection')
};

const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tabContent');
tabs.forEach(t => {
    t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        tabContents.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById(t.dataset.tab).classList.add('active');
    });
});

const navBtns = document.querySelectorAll('.navBtn');
const viewsEl = document.querySelectorAll('.view');
navBtns.forEach(b => {
    b.addEventListener('click', () => {
        navBtns.forEach(x => x.classList.remove('active'));
        viewsEl.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        document.getElementById(b.dataset.view).classList.add('active');
        if (b.dataset.view === 'rankingView') loadRanking();
        if (b.dataset.view === 'friendsView') loadFriends();
        if (b.dataset.view === 'chatView') loadChatUsers();
        if (b.dataset.view === 'lobbyView') loadGames();
    });
});

function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || '';
}

function setAuth(user) {
    state.user = user;
    if (user) {
        localStorage.setItem('gousc_user', JSON.stringify(user));
        document.getElementById('currentUser').textContent = user.username;
        document.getElementById('currentElo').textContent = user.elo || 1500;
        views.loginSection.style.display = 'none';
        views.mainSection.style.display = 'block';
        views.gameSection.style.display = 'none';
        loadGames();
        loadFriends();
        loadRanking();
        loadChatUsers();
    } else {
        localStorage.removeItem('gousc_user');
        views.loginSection.style.display = 'block';
        views.mainSection.style.display = 'none';
        views.gameSection.style.display = 'none';
    }
}

function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (state.user && state.user.id) h['X-User-Id'] = state.user.id;
    return h;
}

async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(API_BASE + path, {
            ...options,
            headers: { ...getHeaders(), ...(options.headers || {}) }
        });
        if (res.status === 204) return null;
        const text = await res.text();
        if (!text) return null;
        const data = JSON.parse(text);
        if (!res.ok) {
            const detail = data.detail || data.title || 'Error';
            throw new Error(detail);
        }
        return data;
    } catch (e) {
        throw e;
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('loginError', '');
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    if (!username || !password) { showError('loginError', 'Rellena todos los campos'); return; }
    try {
        const user = await apiFetch('/users/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        setAuth(user);
    } catch (err) {
        showError('loginError', err.message);
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('regError', '');
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    if (!username || !password) { showError('regError', 'Usuario y contraseña obligatorios'); return; }
    try {
        const user = await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, email: email || null })
        });
        showError('regError', 'Registrado correctamente. Ahora inicia sesión.');
        document.getElementById('loginUsername').value = username;
        document.getElementById('loginPassword').value = '';
        document.querySelector('.tab[data-tab="loginTab"]').click();
    } catch (err) {
        showError('regError', err.message);
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => setAuth(null));

document.getElementById('createGameBtn').addEventListener('click', async () => {
    if (!state.user) return;
    const boardSize = document.getElementById('boardSizeSelect').value;
    const mode = document.getElementById('gameModeSelect').value;
    try {
        const game = await apiFetch('/games', {
            method: 'POST',
            body: JSON.stringify({ boardSize, mode })
        });
        await loadGames();
        if (game && game.id) {
            await openGame(game.id);
        }
    } catch (err) { alert(err.message); }
});

document.getElementById('refreshLobbyBtn').addEventListener('click', loadGames);
document.getElementById('backToLobbyBtn').addEventListener('click', () => {
    state.currentGameId = null;
    state.currentGame = null;
    views.gameSection.style.display = 'none';
    views.mainSection.style.display = 'block';
    loadGames();
});

async function loadGames() {
    try {
        const games = await apiFetch('/games');
        state.games = games || [];
        renderGames();
    } catch (err) { console.error(err); }
}

function renderGames() {
    const list = document.getElementById('gamesList');
    list.innerHTML = '';
    if (!state.games.length) { list.innerHTML = '<div>No hay partidas</div>'; return; }
    state.games.forEach(g => {
        const div = document.createElement('div');
        div.className = 'gameItem';
        const info = document.createElement('div');
        const status = g.status;
        const players = `${g.blackPlayer ? g.blackPlayer.username : '-'} vs ${g.whitePlayer ? g.whitePlayer.username : '-'}`;
        info.innerHTML = `<strong>#${g.id}</strong> ${g.boardSize} ${g.mode} - ${status} | ${players}`;
        const actions = document.createElement('div');
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'Ver';
        viewBtn.onclick = () => openGame(g.id);
        actions.appendChild(viewBtn);
        if (status === 'WAITING' && state.user && g.blackPlayer && g.blackPlayer.id !== state.user.id && !g.whitePlayer) {
            const joinBtn = document.createElement('button');
            joinBtn.textContent = 'Unirse';
            joinBtn.onclick = async () => { try { await apiFetch(`/games/${g.id}/join`, { method: 'POST' }); await openGame(g.id); } catch (e) { alert(e.message); } };
            actions.appendChild(joinBtn);
        }
        div.appendChild(info);
        div.appendChild(actions);
        list.appendChild(div);
    });
}

async function openGame(gameId) {
    try {
        const game = await apiFetch(`/games/${gameId}`);
        state.currentGame = game;
        state.currentGameId = gameId;
        state.boardSize = game.boardSize === 'THIRTEEN' ? 13 : (game.boardSize === 'NINETEEN' ? 19 : 9);
        views.mainSection.style.display = 'none';
        views.gameSection.style.display = 'block';
        document.getElementById('gameIdSpan').textContent = gameId;
        document.getElementById('gameStatus').textContent = game.status;
        document.getElementById('gameTurn').textContent = game.currentTurn ? 'Turno: ' + game.currentTurn : '';
        document.getElementById('blackPlayer').textContent = 'Negras: ' + (game.blackPlayer ? game.blackPlayer.username : '-');
        document.getElementById('whitePlayer').textContent = 'Blancas: ' + (game.whitePlayer ? game.whitePlayer.username : '-');
        await loadGameChat();
        drawBoard();
    } catch (err) { alert(err.message); }
}

const canvas = document.getElementById('goBoard');
const ctx = canvas.getContext('2d');
canvas.addEventListener('click', onBoardClick);

function drawBoard() {
    const size = state.boardSize;
    const cell = canvas.width / (size + 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let i = 1; i <= size; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, cell);
        ctx.lineTo(i * cell, size * cell);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cell, i * cell);
        ctx.lineTo(size * cell, i * cell);
        ctx.stroke();
    }
    const board = parseBoard(state.currentGame ? state.currentGame.boardState : null);
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const key = x + ',' + y;
            const c = board[key];
            if (c === 'B' || c === 'W') {
                ctx.beginPath();
                ctx.arc((x + 1) * cell, (y + 1) * cell, cell * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = c === 'B' ? '#000' : '#fff';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.stroke();
            }
        }
    }
}

function parseBoard(json) {
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        return parsed || {};
    } catch (e) {
        return {};
    }
}

async function onBoardClick(e) {
    if (!state.currentGameId || !state.user || !state.currentGame) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (canvas.width / (state.boardSize + 1)));
    const y = Math.floor((e.clientY - rect.top) / (canvas.height / (state.boardSize + 1)));
    if (x < 0 || x >= state.boardSize || y < 0 || y >= state.boardSize) return;
    try {
        const game = await apiFetch(`/games/${state.currentGameId}/moves`, {
            method: 'POST',
            body: JSON.stringify({ x, y, pass: false })
        });
        state.currentGame = game;
        document.getElementById('gameStatus').textContent = game.status;
        document.getElementById('gameTurn').textContent = game.currentTurn ? 'Turno: ' + game.currentTurn : '';
        drawBoard();
    } catch (err) { alert(err.message); }
}

document.getElementById('passBtn').addEventListener('click', async () => {
    if (!state.currentGameId) return;
    try {
        const game = await apiFetch(`/games/${state.currentGameId}/moves`, {
            method: 'POST',
            body: JSON.stringify({ pass: true })
        });
        state.currentGame = game;
        document.getElementById('gameStatus').textContent = game.status;
        document.getElementById('gameTurn').textContent = game.currentTurn ? 'Turno: ' + game.currentTurn : '';
        drawBoard();
    } catch (err) { alert(err.message); }
});

document.getElementById('leaveBtn').addEventListener('click', async () => {
    if (!state.currentGameId) return;
    if (!confirm('¿Abandonar partida?')) return;
    try {
        await apiFetch(`/games/${state.currentGameId}/leave`, { method: 'POST' });
        views.gameSection.style.display = 'none';
        views.mainSection.style.display = 'block';
        loadGames();
    } catch (err) { alert(err.message); }
});

async function loadRanking() {
    try {
        const ranking = await apiFetch('/users/ranking');
        const body = document.getElementById('rankingBody');
        body.innerHTML = '';
        (ranking || []).forEach((u, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i + 1}</td><td>${u.username}</td><td>${u.elo || 1500}</td><td>${u.wins || 0}</td><td>${u.losses || 0}</td>`;
            body.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}

async function loadFriends() {
    try {
        const friends = await apiFetch('/friendships');
        const pending = await apiFetch('/friendships/pending');
        state.friends = friends || [];
        state.pending = pending || [];
        const fList = document.getElementById('friendsList');
        fList.innerHTML = '';
        state.friends.forEach(f => {
            const div = document.createElement('div');
            div.textContent = `${f.username} (ELO ${f.elo || 1500})`;
            fList.appendChild(div);
        });
        const pList = document.getElementById('pendingList');
        pList.innerHTML = '';
        state.pending.forEach(p => {
            const div = document.createElement('div');
            div.className = 'gameItem';
            const info = document.createElement('div');
            info.textContent = `Solicitud #${p.id} de ${p.requester ? p.requester.username : '-'}`;
            const acts = document.createElement('div');
            const acc = document.createElement('button');
            acc.textContent = 'Aceptar';
            acc.onclick = async () => { try { await apiFetch(`/friendships/${p.id}/accept`, { method: 'POST' }); loadFriends(); loadChatUsers(); } catch (e) { alert(e.message); } };
            const rej = document.createElement('button');
            rej.textContent = 'Rechazar';
            rej.onclick = async () => { try { await apiFetch(`/friendships/${p.id}/reject`, { method: 'POST' }); loadFriends(); } catch (e) { alert(e.message); } };
            acts.appendChild(acc); acts.appendChild(rej);
            div.appendChild(info); div.appendChild(acts);
            pList.appendChild(div);
        });
    } catch (err) { console.error(err); }
}

document.getElementById('addFriendBtn').addEventListener('click', async () => {
    const id = document.getElementById('friendIdInput').value.trim();
    if (!id) return;
    try {
        await apiFetch('/friendships', {
            method: 'POST',
            body: JSON.stringify({ addresseeId: parseInt(id) })
        });
        document.getElementById('friendIdInput').value = '';
        loadFriends();
        alert('Solicitud enviada');
    } catch (err) { alert(err.message); }
});

async function loadChatUsers() {
    try {
        const friends = await apiFetch('/friendships');
        state.friends = friends || [];
        const sel = document.getElementById('chatUserSelect');
        sel.innerHTML = '';
        state.friends.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.username;
            sel.appendChild(opt);
        });
    } catch (err) { console.error(err); }
}

document.getElementById('loadChatBtn').addEventListener('click', loadPrivateChat);
document.getElementById('sendPrivateBtn').addEventListener('click', sendPrivateMsg);

async function loadPrivateChat() {
    const withId = document.getElementById('chatUserSelect').value;
    if (!withId) return;
    try {
        const msgs = await apiFetch(`/messages?with=${withId}`);
        state.privateChat = msgs || [];
        const box = document.getElementById('privateChat');
        box.innerHTML = '';
        state.privateChat.forEach(m => {
            const div = document.createElement('div');
            div.className = 'chatMsg';
            const sender = m.sender ? m.sender.username : '';
            div.innerHTML = `<span class="sender">${sender}:</span> ${m.content}`;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    } catch (err) { alert(err.message); }
}

async function sendPrivateMsg() {
    const withId = document.getElementById('chatUserSelect').value;
    const input = document.getElementById('privateMsgInput');
    const content = input.value.trim();
    if (!withId || !content) return;
    try {
        await apiFetch(`/messages?to=${withId}`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        input.value = '';
        await loadPrivateChat();
    } catch (err) { alert(err.message); }
}

document.getElementById('sendGameMsgBtn').addEventListener('click', sendGameMsg);

async function loadGameChat() {
    if (!state.currentGameId) return;
    try {
        const msgs = await apiFetch(`/games/${state.currentGameId}/messages`);
        state.gameChat = msgs || [];
        const box = document.getElementById('gameChatBox');
        box.innerHTML = '';
        state.gameChat.forEach(m => {
            const div = document.createElement('div');
            div.className = 'chatMsg';
            const sender = m.sender ? m.sender.username : '';
            div.innerHTML = `<span class="sender">${sender}:</span> ${m.content}`;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    } catch (err) { console.error(err); }
}

async function sendGameMsg() {
    if (!state.currentGameId) return;
    const input = document.getElementById('gameMsgInput');
    const content = input.value.trim();
    if (!content) return;
    try {
        await apiFetch(`/games/${state.currentGameId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        input.value = '';
        await loadGameChat();
    } catch (err) { alert(err.message); }
}

const saved = localStorage.getItem('gousc_user');
if (saved) {
    try { setAuth(JSON.parse(saved)); } catch (e) { setAuth(null); }
} else {
    setAuth(null);
}

setInterval(() => {
    if (state.currentGameId && views.gameSection.style.display !== 'none') {
        apiFetch(`/games/${state.currentGameId}`).then(g => {
            state.currentGame = g;
            drawBoard();
            document.getElementById('gameStatus').textContent = g.status;
            document.getElementById('gameTurn').textContent = g.currentTurn ? 'Turno: ' + g.currentTurn : '';
        }).catch(() => {});
        loadGameChat();
    }
    if (views.mainSection.style.display !== 'none') {
        loadGames().catch(() => {});
    }
}, 3000);
