'use strict';

/* ==========================================================================
   GoUSC · cliente web (JavaScript vanilla, sin dependencias)
   ========================================================================== */

const API_BASE = '';
const TICK_MS = 2500;
const BASE_TITLE = 'GoUSC · Go online';

const state = {
    user: null,
    view: 'lobbyView',
    lobbyFilter: 'open',
    games: [],
    ranking: [],
    friends: [],
    pending: [],
    chatWith: null,
    history: [],
    game: null,
    gameId: null
};

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------- almacenamiento -- */

const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* modo privado */ } }
};

const prefs = {
    theme: store.get('gousc_theme') || 'dark',
    sound: store.get('gousc_sound') !== 'off'
};

/* ============================================================ utilidades === */

function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function icon(name) {
    return `<svg class="ic"><use href="#i-${name}"/></svg>`;
}

function initials(name) {
    const s = String(name || '?').trim();
    if (!s) return '?';
    const parts = s.split(/[\s._-]+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : s.slice(0, 2)).toUpperCase();
}

/** Tono estable por nombre: cada jugador tiene siempre el mismo color de avatar. */
function hue(name) {
    let h = 7;
    for (const c of String(name || '')) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return h % 360;
}

function avatar(name, cls = 'avatarSm') {
    return `<span class="avatar ${cls}" style="--hue:${hue(name)}">${esc(initials(name))}</span>`;
}

function setAvatar(el, name) {
    el.textContent = initials(name);
    el.style.setProperty('--hue', hue(name));
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

function fmtAgo(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'ahora';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return fmtDate(iso);
}

const SIZE_LABEL = { NINE: '9×9', THIRTEEN: '13×13', NINETEEN: '19×19' };
const SIZE_NUM = { NINE: 9, THIRTEEN: 13, NINETEEN: 19 };
const MODE_LABEL = { CASUAL: 'Casual', RANKED: 'Ranked' };

function modeChip(mode) {
    return `<span class="chip ${mode === 'RANKED' ? 'chip--ranked' : ''}">${esc(MODE_LABEL[mode] || mode)}</span>`;
}

const STATUS = {
    WAITING: { cls: 'chip--wait', text: 'Esperando' },
    ACTIVE: { cls: 'chip--live', text: 'En juego' },
    FINISHED: { cls: 'chip--done', text: 'Terminada' },
    ABANDONED: { cls: 'chip--off', text: 'Abandonada' }
};

function statusChip(status) {
    const s = STATUS[status] || { cls: '', text: status || '-' };
    return `<span class="chip ${s.cls}">${esc(s.text)}</span>`;
}

function emptyState(title, sub) {
    return `<div class="emptyState">
        <span class="emptyStones"><i></i><i></i></span>
        <strong>${esc(title)}</strong>
        ${sub ? `<span>${esc(sub)}</span>` : ''}
    </div>`;
}

/* ============================================================== toasts ==== */

const TOAST = {
    success: { icon: 'check', title: 'Hecho' },
    error: { icon: 'x', title: 'Error' },
    warning: { icon: 'flag', title: 'Aviso' },
    info: { icon: 'info', title: 'Información' }
};

function toast(type, message, title) {
    const container = $('toastContainer');
    const kind = TOAST[type] ? type : 'info';
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.innerHTML = `
        <span class="toastIcon">${icon(TOAST[kind].icon)}</span>
        <div class="toastBody">
            <div class="toastTitle">${esc(title || TOAST[kind].title)}</div>
            <div class="toastMsg">${esc(message || '')}</div>
        </div>
        <button class="toastClose" type="button" aria-label="Cerrar">${icon('x')}</button>`;
    const remove = () => {
        if (!el.parentNode || el.classList.contains('leaving')) return;
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 220);
    };
    el.querySelector('.toastClose').addEventListener('click', remove);
    container.appendChild(el);
    setTimeout(remove, 4600);
    while (container.children.length > 4) container.firstElementChild.remove();
}

/* ================================================================ API ===== */

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.user && state.user.id) headers['X-User-Id'] = state.user.id;
    const res = await fetch(API_BASE + path, { ...options, headers });
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
        const err = new Error((data && (data.detail || data.title)) || 'Error de conexión con el servidor');
        err.title = data && data.title;
        err.status = res.status;
        throw err;
    }
    return data;
}

/* ============================================================== sonido ==== */

/** Sonidos sintetizados con WebAudio: nada de ficheros externos. */
const Sound = {
    ctx: null,

    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    },

    /** "Clac" de piedra sobre madera: ruido filtrado + un golpe grave. */
    stone(delay = 0, volume = 1) {
        if (!prefs.sound) return;
        const ctx = this.ensure();
        if (!ctx) return;
        const t = ctx.currentTime + delay;
        const len = 0.09;
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 7);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 2100;
        band.Q.value = 0.8;
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.85 * volume, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + len);
        noise.connect(band).connect(g1).connect(ctx.destination);
        noise.start(t);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(85, t + 0.08);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.32 * volume, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        osc.connect(g2).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
    },

    /** Captura: la piedra y, después, las prisioneras cayendo en la tapa. */
    capture(count) {
        this.stone();
        for (let i = 0; i < Math.min(count, 5); i++) this.stone(0.12 + i * 0.055, 0.4);
    },

    /** Campanita para momentos importantes (rival encontrado, fin de partida). */
    chime(up = true) {
        if (!prefs.sound) return;
        const ctx = this.ensure();
        if (!ctx) return;
        const notes = up ? [523.25, 783.99] : [659.25, 440];
        notes.forEach((f, i) => {
            const t = ctx.currentTime + i * 0.14;
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = f;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            osc.connect(g).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.55);
        });
    }
};

document.addEventListener('pointerdown', () => { if (prefs.sound) Sound.ensure(); }, { once: true });

/* ============================================================== tablero === */

/** Dibujo del goban: madera de kaya procedural, piedras de pizarra y concha. */
const Board = (() => {
    const COLS = 'ABCDEFGHJKLMNOPQRST';
    const woodCache = new Map();

    /** Generador pseudoaleatorio con semilla: la veta es siempre la misma. */
    function rng(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function wood(px) {
        const key = Math.round(px);
        if (woodCache.has(key)) return woodCache.get(key);
        const c = document.createElement('canvas');
        c.width = c.height = key;
        const g = c.getContext('2d');
        const rand = rng(1982);

        const base = g.createLinearGradient(0, 0, key, key * 0.35);
        base.addColorStop(0, '#e6bf7c');
        base.addColorStop(0.5, '#dcae66');
        base.addColorStop(1, '#d4a25a');
        g.fillStyle = base;
        g.fillRect(0, 0, key, key);

        // vetas: líneas onduladas casi horizontales de grosor y tono variables
        const lines = Math.round(key / 3.2);
        for (let i = 0; i < lines; i++) {
            const y0 = rand() * key * 1.1 - key * 0.05;
            const amp = 1.5 + rand() * key * 0.012;
            const freq = (0.4 + rand() * 1.4) * Math.PI * 2 / key;
            const phase = rand() * Math.PI * 2;
            const drift = (rand() - 0.5) * key * 0.06;
            g.beginPath();
            for (let x = -4; x <= key + 4; x += 6) {
                const y = y0 + Math.sin(x * freq + phase) * amp + drift * (x / key);
                if (x === -4) g.moveTo(x, y); else g.lineTo(x, y);
            }
            const dark = rand() < 0.75;
            g.strokeStyle = dark
                ? `rgba(122, 72, 24, ${0.035 + rand() * 0.08})`
                : `rgba(255, 236, 190, ${0.05 + rand() * 0.08})`;
            g.lineWidth = 0.4 + rand() * (rand() < 0.12 ? 3.2 : 1.4);
            g.stroke();
        }

        // viñeta suave y brillo diagonal (barniz)
        const vig = g.createRadialGradient(key / 2, key / 2, key * 0.25, key / 2, key / 2, key * 0.75);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(70,35,5,.18)');
        g.fillStyle = vig;
        g.fillRect(0, 0, key, key);
        const sheen = g.createLinearGradient(0, 0, key, key);
        sheen.addColorStop(0, 'rgba(255,255,255,.10)');
        sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
        g.fillStyle = sheen;
        g.fillRect(0, 0, key, key);

        woodCache.set(key, c);
        if (woodCache.size > 6) woodCache.delete(woodCache.keys().next().value);
        return c;
    }

    function starPoints(size) {
        if (size === 19) return [3, 9, 15].flatMap(a => [3, 9, 15].map(b => [a, b]));
        if (size === 13) return [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]];
        if (size === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
        return [];
    }

    function metrics(px, size, padRatio) {
        const cell = px / (size - 1 + 2 * padRatio);
        return { cell, pad: cell * padRatio };
    }

    /** Coordenadas de juego (x, y desde abajo) a píxeles: la fila 1 queda abajo, como en un goban real. */
    function toPx(x, y, size, m) {
        return [m.pad + x * m.cell, m.pad + (size - 1 - y) * m.cell];
    }

    function stone(ctx, cx, cy, r, color, alpha, seed) {
        ctx.save();
        if (alpha != null) ctx.globalAlpha = alpha;

        // sombra proyectada
        if (alpha == null) {
            ctx.beginPath();
            ctx.arc(cx + r * 0.1, cy + r * 0.16, r * 0.98, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(40, 20, 0, .32)';
            ctx.shadowColor = 'rgba(40, 20, 0, .45)';
            ctx.shadowBlur = r * 0.35;
            ctx.fill();
            ctx.shadowColor = 'transparent';
        }

        const grad = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx, cy, r * 1.02);
        if (color === 'B') {
            grad.addColorStop(0, '#77797d');
            grad.addColorStop(0.28, '#34363a');
            grad.addColorStop(1, '#08090b');
        } else {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.55, '#efebe2');
            grad.addColorStop(1, '#c3bcae');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        if (color === 'W') {
            // estrías de concha (hamaguri): arcos concéntricos muy suaves
            ctx.save();
            ctx.clip();
            const ang = ((seed * 137) % 360) * Math.PI / 180;
            const ox = cx + Math.cos(ang) * r * 1.9;
            const oy = cy + Math.sin(ang) * r * 1.9;
            ctx.lineWidth = Math.max(0.5, r * 0.035);
            for (let k = 1; k <= 9; k++) {
                ctx.beginPath();
                ctx.arc(ox, oy, r * (0.95 + k * 0.22), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(150, 138, 112, ${k % 2 ? 0.13 : 0.07})`;
                ctx.stroke();
            }
            ctx.restore();
            ctx.lineWidth = Math.max(0.6, r * 0.05);
            ctx.strokeStyle = 'rgba(110, 100, 80, .45)';
            ctx.beginPath();
            ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // brillo especular de la pizarra
            ctx.beginPath();
            ctx.ellipse(cx - r * 0.32, cy - r * 0.38, r * 0.34, r * 0.2, -0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, .10)';
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * opts: { px, dpr, size, board, last, ghost, ghostColor, coords, padRatio, marks }
     * board: objeto { "x,y": "B" | "W" } tal y como lo guarda el backend.
     */
    function draw(ctx, opts) {
        const { px, dpr = 1, size, board = {}, last = null, ghost = null, ghostColor = 'B', coords = true, marks = [] } = opts;
        const padRatio = opts.padRatio != null ? opts.padRatio : (coords ? 1.05 : 0.7);
        const m = metrics(px, size, padRatio);
        const end = m.pad + (size - 1) * m.cell;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, px, px);
        ctx.drawImage(wood(px * dpr), 0, 0, px, px);

        // líneas
        ctx.strokeStyle = 'rgba(46, 26, 8, .82)';
        ctx.lineWidth = Math.max(0.8, m.cell * 0.034);
        ctx.beginPath();
        for (let i = 0; i < size; i++) {
            const p = Math.round(m.pad + i * m.cell) + 0.5;
            ctx.moveTo(m.pad, p); ctx.lineTo(end, p);
            ctx.moveTo(p, m.pad); ctx.lineTo(p, end);
        }
        ctx.stroke();
        ctx.lineWidth = Math.max(1.4, m.cell * 0.07);
        ctx.strokeRect(m.pad, m.pad, end - m.pad, end - m.pad);

        // hoshi
        ctx.fillStyle = 'rgba(46, 26, 8, .9)';
        for (const [sx, sy] of starPoints(size)) {
            const [hx, hy] = toPx(sx, sy, size, m);
            ctx.beginPath();
            ctx.arc(hx, hy, Math.max(2.2, m.cell * 0.1), 0, Math.PI * 2);
            ctx.fill();
        }

        // coordenadas A–T (sin I) y 1–N, con la fila 1 abajo
        if (coords) {
            ctx.fillStyle = 'rgba(70, 40, 12, .78)';
            ctx.font = `600 ${Math.max(8, Math.round(m.cell * 0.32))}px "Noto Sans", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const off = m.pad * 0.5;
            for (let i = 0; i < size; i++) {
                const p = m.pad + i * m.cell;
                ctx.fillText(COLS[i], p, off);
                ctx.fillText(COLS[i], p, px - off);
                const row = String(size - i);
                ctx.fillText(row, off, p);
                ctx.fillText(row, px - off, p);
            }
        }

        const r = m.cell * 0.47;
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const c = board[x + ',' + y];
                if (c !== 'B' && c !== 'W') continue;
                const [cx, cy] = toPx(x, y, size, m);
                stone(ctx, cx, cy, r, c, null, x * 31 + y * 17);
            }
        }

        // marca de la última jugada: anillo rojo sello
        if (last && board[last.x + ',' + last.y]) {
            const [cx, cy] = toPx(last.x, last.y, size, m);
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(1.5, r * 0.15);
            ctx.strokeStyle = '#d0473b';
            ctx.stroke();
        }

        // marcas del tutorial: libertades, territorio, objetivo y jugada rechazada
        for (const mk of marks) {
            const [cx, cy] = toPx(mk.x, mk.y, size, m);
            ctx.beginPath();
            if (mk.type === 'lib') {
                ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(56, 142, 60, .9)';
                ctx.fill();
            } else if (mk.type === 'terrB' || mk.type === 'terrW') {
                const s = r * 0.62;
                ctx.rect(cx - s / 2, cy - s / 2, s, s);
                ctx.fillStyle = mk.type === 'terrB' ? 'rgba(18, 18, 20, .85)' : 'rgba(255, 253, 248, .95)';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(46, 26, 8, .55)';
                ctx.stroke();
            } else if (mk.type === 'target') {
                ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
                ctx.setLineDash([r * 0.22, r * 0.16]);
                ctx.lineWidth = Math.max(1.5, r * 0.12);
                ctx.strokeStyle = '#d0473b';
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (mk.type === 'x') {
                const s = r * 0.42;
                ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
                ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
                ctx.lineWidth = Math.max(2, r * 0.16);
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#d0473b';
                ctx.stroke();
                ctx.lineCap = 'butt';
            }
        }

        if (ghost && !board[ghost.x + ',' + ghost.y]) {
            const [cx, cy] = toPx(ghost.x, ghost.y, size, m);
            stone(ctx, cx, cy, r, ghostColor, 0.5, 0);
        }
    }

    /** Intersección más cercana a un punto de la pantalla (o null si cae fuera). */
    function pick(canvas, px, size, clientX, clientY, padRatio = 1.05) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const lx = (clientX - rect.left) * (px / rect.width);
        const ly = (clientY - rect.top) * (px / rect.height);
        const m = metrics(px, size, padRatio);
        const ix = Math.round((lx - m.pad) / m.cell);
        const iy = Math.round((ly - m.pad) / m.cell);
        if (ix < 0 || iy < 0 || ix >= size || iy >= size) return null;
        if (Math.hypot(m.pad + ix * m.cell - lx, m.pad + iy * m.cell - ly) > m.cell * 0.62) return null;
        return { x: ix, y: size - 1 - iy };
    }

    /** "D4" -> {x: 3, y: 3} (inverso de GoRules.formatCoordinate en el backend). */
    function parseCoord(label) {
        if (!label || label === '-' || label.length < 2) return null;
        const x = COLS.indexOf(label[0].toUpperCase());
        const y = parseInt(label.slice(1), 10) - 1;
        if (x < 0 || isNaN(y) || y < 0) return null;
        return { x, y };
    }

    /** {x: 3, y: 3} -> "D4". */
    function formatCoord(x, y) {
        return COLS[x] + (y + 1);
    }

    return { draw, pick, parseCoord, formatCoord };
})();

/* ======================================================= tema y sonido === */

function applyTheme() {
    document.documentElement.dataset.theme = prefs.theme;
    document.querySelector('meta[name="theme-color"]').content = prefs.theme === 'light' ? '#f1ede5' : '#161512';
    $('themeToggle').innerHTML = icon(prefs.theme === 'light' ? 'moon' : 'sun');
    $('themeToggle').title = prefs.theme === 'light' ? 'Tema oscuro' : 'Tema claro';
}

function applySound() {
    $('soundToggle').innerHTML = icon(prefs.sound ? 'sound' : 'mute');
    $('soundToggle').title = prefs.sound ? 'Silenciar' : 'Activar sonido';
}

$('themeToggle').addEventListener('click', () => {
    prefs.theme = prefs.theme === 'light' ? 'dark' : 'light';
    store.set('gousc_theme', prefs.theme);
    applyTheme();
});

$('soundToggle').addEventListener('click', () => {
    prefs.sound = !prefs.sound;
    store.set('gousc_sound', prefs.sound ? 'on' : 'off');
    applySound();
    if (prefs.sound) Sound.stone();
});

/* ============================================================== sesión ==== */

function saveUser() {
    if (state.user) store.set('gousc_user', JSON.stringify(state.user));
}

function syncUserUI() {
    if (!state.user) return;
    $('currentUser').textContent = state.user.username || '-';
    $('currentElo').textContent = state.user.elo != null ? state.user.elo : 1500;
    setAvatar($('headerAvatar'), state.user.username);
    renderSideMe();
}

function setAuth(user) {
    state.user = user;
    if (user) {
        saveUser();
        $('loginSection').hidden = true;
        $('mainSection').hidden = false;
        syncUserUI();
        switchView('lobbyView');
        loadRanking();
        loadFriends();
        refreshMe();
    } else {
        store.del('gousc_user');
        state.gameId = null;
        state.game = null;
        $('mainSection').hidden = true;
        $('loginSection').hidden = false;
        document.title = BASE_TITLE;
        drawHero();
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
            if (state.view === 'profileView') renderProfile();
        }
    } catch (e) {
        if (e.status === 404) {
            toast('warning', 'Tu cuenta ya no existe en el servidor. Vuelve a entrar.', 'Sesión caducada');
            setAuth(null);
        }
    }
}

/* ============================================================ acceso ===== */

document.querySelectorAll('.segBtn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.segBtn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tabPane').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab));
    });
});

$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginError').textContent = '';
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    if (!username || !password) { $('loginError').textContent = 'Rellena usuario y contraseña.'; return; }
    try {
        const user = await apiFetch('/users/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        setAuth(user);
        toast('success', `Bienvenido, ${user.username}. ¡Buenas partidas!`, 'Sesión iniciada');
    } catch (err) {
        $('loginError').textContent = err.message;
    }
});

$('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('regError').textContent = '';
    const username = $('regUsername').value.trim();
    const password = $('regPassword').value;
    const email = $('regEmail').value.trim();
    if (username.length < 3) { $('regError').textContent = 'El usuario necesita al menos 3 caracteres.'; return; }
    if (password.length < 3) { $('regError').textContent = 'La contraseña necesita al menos 3 caracteres.'; return; }
    try {
        await apiFetch('/users', { method: 'POST', body: JSON.stringify({ username, password, email: email || null }) });
        const user = await apiFetch('/users/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        setAuth(user);
        toast('success', 'Tu cuenta está lista. Empieza con una partida rápida.', `¡Hola, ${user.username}!`);
    } catch (err) {
        $('regError').textContent = err.message;
    }
});

$('logoutBtn').addEventListener('click', () => {
    setAuth(null);
    toast('info', 'Has cerrado la sesión.', 'Hasta pronto');
});

/* ========================================================= navegación ===== */

function switchView(viewId) {
    const leavingGame = state.view === 'gameView' && viewId !== 'gameView';
    state.view = viewId;
    document.querySelectorAll('.navBtn').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    $('userChip').classList.toggle('active', viewId === 'profileView');
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));

    if (leavingGame) {
        state.gameId = null;
        state.game = null;
        document.title = BASE_TITLE;
    }
    if (viewId !== 'gameView') window.scrollTo({ top: 0 });

    if (viewId === 'lobbyView') { loadGames(true); loadRanking(); renderProverb(); }
    if (viewId === 'rankingView') loadRanking(true);
    if (viewId === 'friendsView') loadFriends(true);
    if (viewId === 'chatView') openChatView();
    if (viewId === 'profileView') loadProfile();
    if (viewId === 'learnView') openLearnView();
}

document.querySelectorAll('.navBtn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.goto)));
$('userChip').addEventListener('click', () => switchView('profileView'));
$('brandHome').addEventListener('click', () => switchView('lobbyView'));

/* ============================================================== lobby ===== */

const inflight = {};
let lastGamesJson = '';

$('poolGrid').addEventListener('click', async (e) => {
    const pool = e.target.closest('.pool');
    if (!pool || !state.user) return;
    const pools = document.querySelectorAll('.pool');
    pools.forEach(p => { p.disabled = true; });
    try {
        const game = await apiFetch('/games', {
            method: 'POST',
            body: JSON.stringify({ boardSize: pool.dataset.size, mode: pool.dataset.mode })
        });
        Sound.stone();
        await openGame(game.id);
    } catch (err) {
        toast('error', err.message, err.title || 'No se pudo crear la partida');
    } finally {
        pools.forEach(p => { p.disabled = false; });
    }
});

$('lobbyTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.lineTab');
    if (!tab) return;
    state.lobbyFilter = tab.dataset.filter;
    document.querySelectorAll('#lobbyTabs .lineTab').forEach(t => t.classList.toggle('active', t === tab));
    renderGames();
});

$('refreshLobbyBtn').addEventListener('click', () => loadGames(true));

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

const LOBBY_FILTERS = {
    open: g => g.status === 'WAITING',
    live: g => g.status === 'ACTIVE',
    done: g => g.status === 'FINISHED' || g.status === 'ABANDONED'
};

function isMineGame(g) {
    const me = state.user && state.user.id;
    return me != null && ((g.blackPlayer && g.blackPlayer.id === me) || (g.whitePlayer && g.whitePlayer.id === me));
}

function playerLine(p, color, fallback) {
    const stoneCls = color === 'B' ? 'stone--b' : 'stone--w';
    if (!p) return `<span class="grName"><span class="stone ${stoneCls}"></span><small>${esc(fallback)}</small></span>`;
    return `<span class="grName"><span class="stone ${stoneCls}"></span>${esc(p.username)} <small>${esc(p.elo != null ? p.elo : 1500)}</small></span>`;
}

function renderGames() {
    $('countOpen').textContent = state.games.filter(LOBBY_FILTERS.open).length;
    $('countLive').textContent = state.games.filter(LOBBY_FILTERS.live).length;
    $('countDone').textContent = state.games.filter(LOBBY_FILTERS.done).length;

    let list = state.games.filter(LOBBY_FILTERS[state.lobbyFilter]);
    if (state.lobbyFilter === 'done') list = list.slice(0, 30);
    // mis partidas primero
    list = [...list.filter(isMineGame), ...list.filter(g => !isMineGame(g))];

    const box = $('gamesList');
    if (!list.length) {
        const msg = {
            open: ['No hay salas abiertas', 'Crea una con los botones de partida rápida y espera rival.'],
            live: ['Nadie está jugando ahora mismo', 'Sé el primero: crea una partida.'],
            done: ['Todavía no ha terminado ninguna partida', '']
        }[state.lobbyFilter];
        box.innerHTML = emptyState(msg[0], msg[1]);
        return;
    }

    const me = state.user && state.user.id;
    box.innerHTML = `
        <div class="gameRow gameRowHead"><span>Jugadores</span><span>Tablero</span><span>Modo</span><span>Estado</span><span></span></div>
        ${list.map(g => {
            const mine = isMineGame(g);
            const canJoin = g.status === 'WAITING' && !mine && g.blackPlayer && g.blackPlayer.id !== me;
            let action;
            if (canJoin) action = `<button class="btn btnPrimary btnSm" data-action="join" data-id="${esc(g.id)}" type="button">${icon('play')}Unirse</button>`;
            else if (mine && (g.status === 'WAITING' || g.status === 'ACTIVE')) action = `<button class="btn btnGood btnSm" data-action="view" data-id="${esc(g.id)}" type="button">Continuar</button>`;
            else action = `<button class="btn btnGhost btnSm" data-action="view" data-id="${esc(g.id)}" type="button">${icon('eye')}Ver</button>`;
            const owner = g.blackPlayer ? g.blackPlayer.username : '?';
            return `<div class="gameRow${mine ? ' isMine' : ''}">
                <div class="grPlayers">
                    ${avatar(owner, 'avatarSm')}
                    <div class="grNames">
                        ${playerLine(g.blackPlayer, 'B', '—')}
                        ${playerLine(g.whitePlayer, 'W', 'esperando rival…')}
                    </div>
                </div>
                <span class="grSize">${esc(SIZE_LABEL[g.boardSize] || g.boardSize)}</span>
                <span class="grMode">${modeChip(g.mode)}</span>
                <span class="grState">${statusChip(g.status)} <span class="grId">#${esc(g.id)}</span></span>
                <div class="grActions">${action}</div>
            </div>`;
        }).join('')}`;
}

$('gamesList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'view') return openGame(id);
    await joinGame(id);
});

async function joinGame(id) {
    try {
        await apiFetch(`/games/${id}/join`, { method: 'POST' });
        Sound.chime(true);
        toast('success', `Juegas con blancas en la partida #${id}. ¡Suerte!`, 'Te has unido');
        await openGame(id);
    } catch (err) {
        toast('error', err.message, err.title || 'No te pudiste unir');
        loadGames(true);
    }
}

/* ------------------------------------------------- columna lateral ----- */

function renderSideMe() {
    const u = state.user;
    const box = $('sideMe');
    if (!u || !box) return;
    const pos = state.ranking.findIndex(r => r.id === u.id);
    const total = (u.wins || 0) + (u.losses || 0);
    box.innerHTML = `
        <div class="meTop">
            ${avatar(u.username, 'avatarLg')}
            <div>
                <div class="meName">${esc(u.username)}</div>
                <div class="meSub">ID #${esc(u.id)}${pos >= 0 ? ` · ${pos + 1}º del ranking` : ''}</div>
            </div>
        </div>
        <div class="meStats">
            <div class="meStat"><b>${esc(u.elo != null ? u.elo : 1500)}</b><span>ELO</span></div>
            <div class="meStat"><b class="good">${esc(u.wins || 0)}</b><span>Vict.</span></div>
            <div class="meStat"><b class="bad">${esc(u.losses || 0)}</b><span>Derr.</span></div>
        </div>
        ${total === 0 ? '<p class="muted small" style="margin:0">Aún no tienes partidas Ranked. ¿Una 9×9 para calentar?</p>' : ''}`;
}

function renderSideTop() {
    const me = state.user && state.user.id;
    const top = state.ranking.slice(0, 5);
    $('sideTop').innerHTML = top.length
        ? top.map((u, i) => `<li class="${u.id === me ? 'isMe' : ''}">
                <span class="miniPos">${i + 1}</span>
                ${avatar(u.username, 'avatarXs')}
                <span class="miniName">${esc(u.username)}</span>
                <span class="miniElo">${esc(u.elo)}</span>
            </li>`).join('')
        : `<li class="muted small">Sin jugadores todavía</li>`;
}

const PROVERBS = [
    'Juega lejos de tu propio grosor.',
    'El punto clave de tu rival es también tu punto clave.',
    'Los grandes dragones nunca mueren.',
    'Hay muerte en el hane.',
    'Pierde tus primeras cincuenta partidas lo más rápido posible.',
    'Los principiantes juegan atari.',
    'Haz hane en la cabeza de dos piedras.',
    'El triángulo vacío es malo.',
    'No vayas de pesca mientras tu casa está en llamas.',
    'Primero las esquinas, después los lados y al final el centro.',
    'Ataca la cintura del salto de caballo.',
    'No intentes cortar el salto de un punto.',
    'Sacrifica piedras para ganar la iniciativa.',
    'Un grupo con dos ojos vive.'
];

function renderProverb() {
    const day = Math.floor(Date.now() / 86400000);
    $('proverbText').textContent = '«' + PROVERBS[day % PROVERBS.length] + '»';
}

/* ============================================================ ranking ===== */

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
            renderSideTop();
            renderSideMe();
        }
    } catch (err) { console.error(err); }
    finally { inflight.ranking = false; }
}

function renderRanking() {
    const me = state.user && state.user.id;
    const top = state.ranking.slice(0, 3);
    $('podium').innerHTML = top.map((u, i) => `
        <div class="podiumCard p${i + 1}${u.id === me ? ' isMe' : ''}">
            <span class="podiumPos">${i + 1}</span>
            ${avatar(u.username, i === 0 ? 'avatarXl' : 'avatarLg')}
            <span class="podiumName">${esc(u.username)}</span>
            <span class="podiumElo">${esc(u.elo)}</span>
            <span class="podiumWl">${esc(u.wins || 0)} V · ${esc(u.losses || 0)} D</span>
        </div>`).join('');

    const body = $('rankingBody');
    if (!state.ranking.length) {
        body.innerHTML = `<tr><td colspan="6">${emptyState('Aún no hay jugadores en el ranking')}</td></tr>`;
        return;
    }
    body.innerHTML = state.ranking.map((u, i) => {
        const total = (u.wins || 0) + (u.losses || 0);
        const pct = total ? Math.round((u.wins || 0) * 100 / total) : null;
        return `<tr class="${u.id === me ? 'isMe' : ''}">
            <td class="colRank"><span class="rankPos${i < 3 ? ' top' : ''}">${i + 1}</span></td>
            <td><div class="playerCell">${avatar(u.username, 'avatarXs')}${esc(u.username)}${u.id === me ? '<span class="youTag">TÚ</span>' : ''}</div></td>
            <td class="colNum eloCell">${esc(u.elo)}</td>
            <td class="colNum ${u.wins ? 'good' : 'muted'}">${esc(u.wins || 0)}</td>
            <td class="colNum ${u.losses ? 'bad' : 'muted'}">${esc(u.losses || 0)}</td>
            <td class="colNum colHide">${pct == null ? '<span class="muted">—</span>' : `<span class="bar"><i style="width:${pct}%"></i></span>${pct}%`}</td>
        </tr>`;
    }).join('');
}

/* ============================================================= amigos ===== */

let lastFriendsJson = '';

async function loadFriends(force) {
    if (inflight.friends) return;
    inflight.friends = true;
    try {
        const [friends, pending] = await Promise.all([apiFetch('/friendships'), apiFetch('/friendships/pending')]);
        state.friends = friends || [];
        state.pending = pending || [];
        const badge = $('pendingBadge');
        badge.textContent = state.pending.length;
        badge.hidden = state.pending.length === 0;
        const json = JSON.stringify([state.friends, state.pending]);
        if (force || json !== lastFriendsJson) {
            lastFriendsJson = json;
            renderFriends();
            if (state.view === 'chatView') renderConversations();
        }
    } catch (err) { console.error(err); }
    finally { inflight.friends = false; }
}

function renderFriends() {
    $('pendingCount').textContent = state.pending.length;
    $('friendsCount').textContent = state.friends.length;

    $('pendingList').innerHTML = state.pending.length ? state.pending.map(p => `
        <div class="itemRow">
            ${avatar(p.requester && p.requester.username)}
            <div class="itemInfo">
                <span class="itemName">${esc(p.requester ? p.requester.username : 'Desconocido')}</span>
                <span class="itemMeta">ELO ${esc(p.requester ? p.requester.elo : '-')} · ${esc(fmtAgo(p.createdAt))}</span>
            </div>
            <div class="itemActions">
                <button class="iconBtn iconBtnSm iconBtnAccent" data-action="accept" data-id="${esc(p.id)}" type="button" title="Aceptar">${icon('check')}</button>
                <button class="iconBtn iconBtnSm" data-action="reject" data-id="${esc(p.id)}" type="button" title="Rechazar">${icon('x')}</button>
            </div>
        </div>`).join('') : emptyState('Sin solicitudes pendientes');

    $('friendsList').innerHTML = state.friends.length ? state.friends.map(f => `
        <div class="itemRow">
            ${avatar(f.username)}
            <div class="itemInfo">
                <span class="itemName">${esc(f.username)}</span>
                <span class="itemMeta">ELO ${esc(f.elo != null ? f.elo : 1500)} · ${esc(f.wins || 0)} V / ${esc(f.losses || 0)} D · ID ${esc(f.id)}</span>
            </div>
            <div class="itemActions">
                <button class="btn btnGhost btnSm" data-action="chat" data-id="${esc(f.id)}" type="button">${icon('chat')}Chat</button>
            </div>
        </div>`).join('') : emptyState('Todavía no tienes amigos', 'Añade jugadores por su ID desde el panel de la izquierda.');
}

$('pendingList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const accept = btn.dataset.action === 'accept';
    try {
        await apiFetch(`/friendships/${btn.dataset.id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
        toast(accept ? 'success' : 'info', accept ? 'Ya sois amigos.' : 'Solicitud rechazada.', 'Amigos');
        loadFriends(true);
    } catch (err) { toast('error', err.message, err.title || 'No se pudo procesar'); }
});

$('friendsList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="chat"]');
    if (!btn) return;
    state.chatWith = Number(btn.dataset.id);
    switchView('chatView');
});

$('addFriendForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('friendIdInput').value.trim().replace(/^#/, '');
    if (!/^\d+$/.test(id)) { toast('warning', 'Introduce el ID numérico del jugador.', 'ID no válido'); return; }
    if (state.user && String(state.user.id) === id) { toast('warning', 'No puedes enviarte una solicitud a ti mismo.', 'ID no válido'); return; }
    try {
        await apiFetch('/friendships', { method: 'POST', body: JSON.stringify({ addresseeId: parseInt(id, 10) }) });
        $('friendIdInput').value = '';
        toast('success', `Solicitud enviada al jugador #${id}.`, 'Solicitud enviada');
        loadFriends(true);
    } catch (err) { toast('error', err.message, err.title || 'No se pudo enviar la solicitud'); }
});

/* =============================================================== chat ===== */

let lastPrivateKey = '';

async function openChatView() {
    await loadFriends(true);
    if (!state.friends.some(f => f.id === state.chatWith)) {
        state.chatWith = state.friends.length ? state.friends[0].id : null;
    }
    renderConversations();
    loadPrivateChat(true);
}

function renderConversations() {
    const box = $('convItems');
    if (!state.friends.length) {
        box.innerHTML = emptyState('Sin conversaciones', 'Añade amigos para chatear.');
    } else {
        box.innerHTML = state.friends.map(f => `
            <button class="convItem${f.id === state.chatWith ? ' active' : ''}" data-id="${esc(f.id)}" type="button">
                ${avatar(f.username)}
                <span class="itemInfo"><span class="itemName">${esc(f.username)}</span><span class="itemMeta">ELO ${esc(f.elo)}</span></span>
            </button>`).join('');
    }
    const f = state.friends.find(x => x.id === state.chatWith);
    $('convTop').innerHTML = f
        ? `${avatar(f.username)}<div class="itemInfo"><span class="convTopName">${esc(f.username)}</span><span class="itemMeta">ELO ${esc(f.elo)} · ID ${esc(f.id)}</span></div>`
        : '<span class="muted">Elige una conversación</span>';
    $('privateMsgInput').disabled = !f;
}

$('convItems').addEventListener('click', (e) => {
    const item = e.target.closest('.convItem');
    if (!item) return;
    state.chatWith = Number(item.dataset.id);
    renderConversations();
    loadPrivateChat(true);
    $('privateMsgInput').focus();
});

async function loadPrivateChat(force) {
    const withId = state.chatWith;
    const box = $('privateChat');
    if (!withId) {
        lastPrivateKey = '';
        box.innerHTML = emptyState('Elige una conversación', 'Selecciona un amigo para empezar a hablar.');
        return;
    }
    if (inflight.privateChat) return;
    inflight.privateChat = true;
    try {
        const msgs = await apiFetch(`/messages?with=${withId}`);
        if (state.chatWith !== withId) return;
        const key = withId + ':' + JSON.stringify(msgs);
        if (!force && key === lastPrivateKey) return;
        const sameConversation = lastPrivateKey.startsWith(withId + ':');
        lastPrivateKey = key;
        renderChatBox(box, msgs || [], sameConversation && !force, false);
    } catch (err) {
        if (force) toast('error', err.message, err.title || 'No se pudo cargar el chat');
    } finally { inflight.privateChat = false; }
}

$('privateChatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('privateMsgInput');
    const content = input.value.trim();
    if (!state.chatWith || !content) return;
    try {
        await apiFetch(`/messages?to=${state.chatWith}`, { method: 'POST', body: JSON.stringify({ content }) });
        input.value = '';
        await loadPrivateChat(true);
    } catch (err) { toast('error', err.message, err.title || 'No se pudo enviar el mensaje'); }
});

/** Burbujas de chat. Los mensajes seguidos del mismo autor se agrupan. */
function renderChatBox(box, msgs, keepScroll, showNames) {
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (!msgs.length) {
        box.innerHTML = emptyState('Sin mensajes todavía', '¡Saluda para romper el hielo!');
        return;
    }
    const me = state.user && state.user.id;
    box.innerHTML = msgs.map((m, i) => {
        const mine = me != null && m.sender && m.sender.id === me;
        const next = msgs[i + 1];
        const cont = next && next.sender && m.sender && next.sender.id === m.sender.id;
        const who = mine ? '' : (showNames && m.sender ? esc(m.sender.username) + ' · ' : '');
        return `<div class="chatMsg${mine ? ' mine' : ''}${cont ? ' cont' : ''}">
            <span class="bubble">${esc(m.content)}</span>
            <span class="msgMeta">${who}${esc(fmtTime(m.createdAt))}</span>
        </div>`;
    }).join('');
    if (!keepScroll || nearBottom) box.scrollTop = box.scrollHeight;
}

/* ============================================================= perfil ===== */

async function loadProfile() {
    await refreshMe();
    renderProfile();
    fillEditFields();
    loadHistory(true);
}

function fillEditFields() {
    if (!state.user) return;
    $('editUsername').value = state.user.username || '';
    $('editEmail').value = state.user.email || '';
    $('editPassword').value = '';
}

function renderProfile() {
    const u = state.user;
    if (!u) return;
    setAvatar($('profileAvatar'), u.username);
    $('profileUsername').textContent = u.username || '-';
    $('profileId').textContent = u.id != null ? u.id : '-';
    $('profileElo').textContent = u.elo != null ? u.elo : 1500;
    $('profileWins').textContent = u.wins || 0;
    $('profileLosses').textContent = u.losses || 0;
    const total = (u.wins || 0) + (u.losses || 0);
    $('profileWinrate').textContent = total ? `${Math.round((u.wins || 0) * 100 / total)}%` : '—';
    $('profileSince').textContent = fmtDate(u.createdAt);
}

$('copyIdBtn').addEventListener('click', async () => {
    if (!state.user) return;
    const id = String(state.user.id);
    try {
        await navigator.clipboard.writeText(id);
        toast('success', `Tu ID (${id}) está en el portapapeles.`, 'ID copiado');
    } catch (e) {
        toast('info', `Tu ID es ${id}.`, 'Cópialo a mano');
    }
});

$('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user) return;
    const username = $('editUsername').value.trim();
    const email = $('editEmail').value.trim();
    const password = $('editPassword').value;

    const body = {};
    if (username && username !== state.user.username) {
        if (username.length < 3 || username.length > 50) { toast('warning', 'El nombre debe tener entre 3 y 50 caracteres.', 'Nombre no válido'); return; }
        body.username = username;
    }
    if (email && email !== (state.user.email || '')) body.email = email;
    if (password) {
        if (password.length < 3) { toast('warning', 'La contraseña debe tener al menos 3 caracteres.', 'Contraseña débil'); return; }
        body.password = password;
    }
    if (!Object.keys(body).length) { toast('info', 'No hay cambios que guardar.', 'Perfil'); return; }

    try {
        const updated = await apiFetch(`/users/${state.user.id}`, { method: 'PUT', body: JSON.stringify(body) });
        state.user = { ...state.user, ...updated };
        saveUser();
        syncUserUI();
        renderProfile();
        fillEditFields();
        loadRanking(true);
        toast('success', 'Tu perfil se ha actualizado.', 'Guardado');
    } catch (err) {
        toast('error', err.message, err.title || 'No se pudo actualizar el perfil');
    }
});

$('refreshHistoryBtn').addEventListener('click', () => loadHistory(true));

let lastHistoryJson = '';

async function loadHistory(force) {
    if (!state.user || inflight.history) return;
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

function historyBadge(g, me) {
    if (g.status === 'WAITING') return { cls: 'wait', text: '…', label: 'Esperando rival' };
    if (g.status === 'ACTIVE') return { cls: 'live', text: '●', label: 'En curso' };
    if (!g.winner) return { cls: 'off', text: '—', label: 'Cancelada' };
    const won = g.winner.id === me;
    const how = g.status === 'ABANDONED' ? ' por abandono' : '';
    return won ? { cls: 'win', text: 'V', label: 'Victoria' + how } : { cls: 'loss', text: 'D', label: 'Derrota' + how };
}

function renderHistory() {
    const box = $('historyList');
    $('profileGames').textContent = state.history.length;
    if (!state.history.length) {
        box.innerHTML = emptyState('Aún no has jugado ninguna partida', 'Ve al lobby y lanza una partida rápida.');
        return;
    }
    const me = state.user.id;
    box.innerHTML = state.history.map(g => {
        const isBlack = g.blackPlayer && g.blackPlayer.id === me;
        const opp = isBlack ? g.whitePlayer : g.blackPlayer;
        const badge = historyBadge(g, me);
        const delta = g.mode === 'RANKED' ? (isBlack ? g.eloChangeBlack : g.eloChangeWhite) : null;
        const score = g.status === 'FINISHED' && g.finalScoreBlack != null
            ? `<span>${esc(g.finalScoreBlack)} – ${esc(g.finalScoreWhite)}</span>` : '';
        return `<div class="itemRow">
            <span class="resultBadge resultBadge--${badge.cls}" title="${esc(badge.label)}">${badge.text}</span>
            <div class="itemInfo">
                <span class="itemName"><span class="stone ${isBlack ? 'stone--b' : 'stone--w'}"></span> ${opp ? 'vs ' + esc(opp.username) : 'Sin rival'} <span class="muted small">· ${esc(badge.label)}</span></span>
                <span class="historyMeta">
                    <span>#${esc(g.id)}</span>
                    <span>${esc(SIZE_LABEL[g.boardSize])}</span>
                    <span>${esc(MODE_LABEL[g.mode])}</span>
                    ${score}
                    ${delta != null ? `<span class="eloDelta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${esc(delta)} ELO</span>` : ''}
                    <span>${esc(fmtDate(g.createdAt))}</span>
                </span>
            </div>
            <button class="iconBtn iconBtnSm" data-history="${esc(g.id)}" type="button" title="Ver partida">${icon('eye')}</button>
        </div>`;
    }).join('');
}

$('historyList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-history]');
    if (btn) openGame(btn.dataset.history);
});

/* ============================================================ partida ===== */

const canvas = $('goBoard');
const bctx = canvas.getContext('2d');
let boardPx = 640;
let boardDpr = 1;
let hoverPoint = null;
let lastGameChatJson = '';

function boardSize() {
    return state.game ? (SIZE_NUM[state.game.boardSize] || 9) : 9;
}

function myColor(g) {
    if (!state.user || !g) return null;
    if (g.blackPlayer && g.blackPlayer.id === state.user.id) return 'BLACK';
    if (g.whitePlayer && g.whitePlayer.id === state.user.id) return 'WHITE';
    return null;
}

function canPlay() {
    const g = state.game;
    return !!g && g.status === 'ACTIVE' && myColor(g) === g.currentTurn;
}

function moveEntries(g) {
    return g && g.moveHistory ? String(g.moveHistory).split(',').map(s => s.trim()).filter(Boolean) : [];
}

function parseBoard(json) {
    if (!json) return {};
    try { return JSON.parse(json) || {}; } catch (e) { return {}; }
}

function lastMove(g) {
    const entries = moveEntries(g);
    for (let i = entries.length - 1; i >= 0; i--) {
        const c = Board.parseCoord(entries[i]);
        if (c) return c;
    }
    return null;
}

async function openGame(gameId) {
    try {
        const g = await apiFetch(`/games/${gameId}`);
        state.gameId = String(gameId);
        state.game = null;
        lastGameChatJson = '';
        hoverPoint = null;
        $('leaveConfirm').hidden = true;
        switchView('gameView');
        applyGame(g);
        loadGameChat(true);
        requestAnimationFrame(fitBoard);
    } catch (err) {
        toast('error', err.message, err.title || 'No se pudo abrir la partida');
    }
}

$('backToLobbyBtn').addEventListener('click', () => switchView('lobbyView'));

function applyGame(g) {
    const prev = state.game && String(state.game.id) === String(g.id) ? state.game : null;
    state.game = g;
    const mine = myColor(g);

    // --- sonidos y avisos según lo que haya cambiado
    if (prev) {
        const before = moveEntries(prev);
        const after = moveEntries(g);
        if (after.length > before.length) {
            const last = after[after.length - 1];
            const caps = (g.capturesBlack + g.capturesWhite) - (prev.capturesBlack + prev.capturesWhite);
            if (last !== '-') {
                if (caps > 0) Sound.capture(caps); else Sound.stone();
            }
            if (last === '-' && mine && g.status === 'ACTIVE' && g.currentTurn === mine) {
                toast('info', 'Tu rival ha pasado. Si pasas tú también, termina la partida.', 'El rival pasa');
            }
        }
        if (prev.status === 'WAITING' && g.status === 'ACTIVE') {
            Sound.chime(true);
            toast('success', `${g.whitePlayer ? g.whitePlayer.username : 'Tu rival'} se ha unido. Empiezan negras.`, '¡Rival encontrado!');
        }
        if (prev.status === 'ACTIVE' && (g.status === 'FINISHED' || g.status === 'ABANDONED')) {
            const won = g.winner && state.user && g.winner.id === state.user.id;
            Sound.chime(!!won || !mine);
            if (g.winner) {
                toast(won ? 'success' : 'info',
                    won ? '¡Enhorabuena, has ganado!' : `${g.winner.username} gana la partida.`,
                    g.status === 'ABANDONED' ? 'Victoria por abandono' : 'Partida terminada');
            }
            refreshMe();
            loadRanking(true);
        }
    }

    // --- cabecera
    $('gameIdSpan').textContent = g.id;
    $('gameMeta').textContent = `${SIZE_LABEL[g.boardSize]} · ${MODE_LABEL[g.mode]}`;
    const st = STATUS[g.status] || { cls: '', text: g.status };
    $('gameStatus').className = `chip ${st.cls}`;
    $('gameStatus').textContent = st.text;

    // --- jugadores: tú siempre abajo (si miras, negras abajo)
    const bottom = mine || 'BLACK';
    renderPlayerCard($('bottomPlayer'), g, bottom);
    renderPlayerCard($('topPlayer'), g, bottom === 'BLACK' ? 'WHITE' : 'BLACK');

    renderTurn(g, mine);
    renderMoves(g);
    renderActions(g, mine);
    renderResult(g, mine);
    renderOverlay(g, mine);

    // --- chat: el backend solo admite mensajes de jugadores en partidas activas
    const chatOk = !!mine && g.status === 'ACTIVE';
    $('gameMsgInput').disabled = !chatOk;
    $('sendGameMsgBtn').disabled = !chatOk;
    $('gameMsgInput').placeholder = chatOk ? 'Di algo amable...'
        : (mine ? 'Chat cerrado' : 'Solo para jugadores');

    $('boardFrame').classList.toggle('readonly', !canPlay());
    document.title = canPlay() ? `● Tu turno · Partida #${g.id}` : `Partida #${g.id} · GoUSC`;
    drawBoard();
}

function renderPlayerCard(el, g, color) {
    const p = color === 'BLACK' ? g.blackPlayer : g.whitePlayer;
    const caps = color === 'BLACK' ? g.capturesBlack : g.capturesWhite;
    const isTurn = g.status === 'ACTIVE' && g.currentTurn === color;
    const isMe = p && state.user && p.id === state.user.id;
    const delta = g.mode === 'RANKED' ? (color === 'BLACK' ? g.eloChangeBlack : g.eloChangeWhite) : null;
    el.className = `playerCard${isTurn ? ' isTurn' : ''}${p ? '' : ' empty'}`;
    el.innerHTML = `
        <span class="stone ${color === 'BLACK' ? 'stone--b' : 'stone--w'}"></span>
        <div class="pcInfo">
            <span class="pcName">${p ? esc(p.username) : 'Esperando rival…'}${isMe ? '<small>(tú)</small>' : ''}</span>
            <span class="pcMeta">${p ? `ELO ${esc(p.elo)}` : 'Sala abierta'}${delta != null ? ` · <span class="eloDelta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${esc(delta)}</span>` : ''}${color === 'WHITE' ? ` · komi ${esc(g.komi)}` : ''}</span>
        </div>
        <div class="pcCaps" title="Piedras capturadas"><b>${esc(caps || 0)}</b><span>presas</span></div>`;
}

function renderTurn(g, mine) {
    const el = $('gameTurn');
    el.className = 'turnBanner';
    if (g.status === 'ACTIVE') {
        const black = g.currentTurn === 'BLACK';
        const p = black ? g.blackPlayer : g.whitePlayer;
        const isMine = mine === g.currentTurn;
        if (isMine) el.classList.add('mine');
        el.innerHTML = `<span class="stone ${black ? 'stone--b' : 'stone--w'}"></span>${isMine ? 'Te toca jugar' : `Turno de ${esc(p ? p.username : (black ? 'negras' : 'blancas'))}`}`;
    } else if (g.status === 'WAITING') {
        el.textContent = 'Esperando a que se una un rival';
    } else {
        el.textContent = g.status === 'FINISHED' ? 'Partida terminada' : 'Partida abandonada';
    }
}

let lastMovesKey = '';

function renderMoves(g) {
    const entries = moveEntries(g);
    const key = g.id + ':' + entries.length;
    if (key === lastMovesKey) return;
    lastMovesKey = key;
    const box = $('moveList');
    if (!entries.length) {
        box.innerHTML = `<div class="emptyMoves">${g.status === 'WAITING' ? 'La partida aún no ha empezado' : 'Negras abren la partida'}</div>`;
        return;
    }
    let html = '';
    for (let i = 0; i < entries.length; i += 2) {
        html += `<span class="mvNum">${i / 2 + 1}</span>`;
        for (let j = i; j < i + 2; j++) {
            if (j >= entries.length) { html += '<span class="mv"></span>'; continue; }
            const pass = entries[j] === '-';
            html += `<span class="mv${pass ? ' pass' : ''}${j === entries.length - 1 ? ' last' : ''}">${pass ? 'pasa' : esc(entries[j])}</span>`;
        }
    }
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

function renderActions(g, mine) {
    const show = !!mine && g.status === 'ACTIVE';
    $('gameActions').hidden = !show;
    if (!show) $('leaveConfirm').hidden = true;
    $('passBtn').disabled = !canPlay();
}

function renderResult(g, mine) {
    const box = $('gameResult');
    if (g.status !== 'FINISHED' && g.status !== 'ABANDONED') { box.hidden = true; return; }
    box.hidden = false;
    const delta = g.mode === 'RANKED' && mine ? (mine === 'BLACK' ? g.eloChangeBlack : g.eloChangeWhite) : null;
    const winnerColor = g.winner && g.blackPlayer && g.winner.id === g.blackPlayer.id ? 'b' : 'w';
    let html;
    if (!g.winner) {
        html = `<div class="resultHead">Partida cancelada</div><div class="resultWinner">Sin resultado</div>`;
    } else {
        const head = g.status === 'ABANDONED' ? 'Victoria por abandono' : 'Resultado';
        html = `<div class="resultHead">${head}</div>
            <div class="resultWinner"><span class="stone stone--${winnerColor}"></span>${esc(g.winner.username)} gana</div>`;
        if (g.status === 'FINISHED' && g.finalScoreBlack != null) {
            const diff = Math.abs(g.finalScoreWhite - g.finalScoreBlack);
            html += `<div class="resultScores">
                <span><span class="stone stone--b"></span> <b>${esc(g.finalScoreBlack)}</b></span>
                <span><span class="stone stone--w"></span> <b>${esc(g.finalScoreWhite)}</b></span>
                <span>por ${esc(diff)} pts</span>
            </div>`;
        }
    }
    if (delta != null) html += `<div class="resultElo ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${esc(delta)} ELO</div>`;
    box.innerHTML = html;
}

function renderOverlay(g, mine) {
    const el = $('boardOverlay');
    if (g.status !== 'WAITING') { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    if (mine) {
        el.innerHTML = `<div class="overlayCard">
            <span class="waitingStones"><span class="stone stone--b"></span><span class="stone stone--w"></span><span class="stone stone--b"></span></span>
            <div class="overlayTitle">Esperando rival…</div>
            <div class="overlayText">Tu sala <b>#${esc(g.id)}</b> aparece en el lobby. En cuanto alguien se una empezáis: tú juegas con negras.</div>
            <button class="btn btnGhost btnSm" id="cancelWaitBtn" type="button">${icon('x')}Cancelar sala</button>
        </div>`;
        $('cancelWaitBtn').addEventListener('click', () => leaveGame(true));
    } else {
        el.innerHTML = `<div class="overlayCard">
            <div class="overlayTitle">Sala abierta</div>
            <div class="overlayText">${esc(g.blackPlayer.username)} (${esc(g.blackPlayer.elo)}) busca rival para una ${esc(SIZE_LABEL[g.boardSize])} ${esc(MODE_LABEL[g.mode])}.</div>
            <button class="btn btnPrimary" id="overlayJoinBtn" type="button">${icon('play')}Jugar con blancas</button>
        </div>`;
        $('overlayJoinBtn').addEventListener('click', () => joinGame(g.id));
    }
}

async function refreshActiveGame() {
    if (!state.gameId || inflight.game) return;
    inflight.game = true;
    const id = state.gameId;
    try {
        const g = await apiFetch(`/games/${id}`);
        if (state.gameId !== id || !g) return;
        if (JSON.stringify(g) !== JSON.stringify(state.game)) applyGame(g);
        loadGameChat(false);
    } catch (e) { /* conexión intermitente: se reintenta en el siguiente tick */ }
    finally { inflight.game = false; }
}

/* ------------------------------------------------------------- jugar --- */

const MOVE_REASONS = {
    NOT_YOUR_TURN: 'No es tu turno: espera a que juegue tu rival.',
    OCCUPIED_CELL: 'Esa intersección ya está ocupada.',
    SUICIDE: 'Jugada suicida: tu grupo se quedaría sin libertades.',
    KO: 'Regla del ko: no puedes recapturar inmediatamente.',
    OUT_OF_RANGE: 'La jugada queda fuera del tablero.'
};

function moveErrorMessage(err) {
    const match = /([A-Z_]{3,})\s*$/.exec(err.message || '');
    if (match && MOVE_REASONS[match[1]]) return { title: 'Jugada no válida', msg: MOVE_REASONS[match[1]] };
    return { title: err.title || 'Jugada no válida', msg: err.message };
}

let moving = false;

async function sendMove(body) {
    if (moving) return;
    moving = true;
    try {
        const g = await apiFetch(`/games/${state.gameId}/moves`, { method: 'POST', body: JSON.stringify(body) });
        hoverPoint = null;
        applyGame(g);
    } catch (err) {
        const info = moveErrorMessage(err);
        toast('error', info.msg, info.title);
    } finally {
        moving = false;
    }
}

canvas.addEventListener('click', (e) => {
    const g = state.game;
    if (!g) return;
    const p = Board.pick(canvas, boardPx, boardSize(), e.clientX, e.clientY);
    if (!p) return;
    const mine = myColor(g);
    if (!mine) return;
    if (g.status !== 'ACTIVE') return;
    if (g.currentTurn !== mine) { toast('info', 'Espera a que juegue tu rival.', 'No es tu turno'); return; }
    if (parseBoard(g.boardState)[p.x + ',' + p.y]) return;
    sendMove({ x: p.x, y: p.y, pass: false });
});

canvas.addEventListener('mousemove', (e) => {
    const p = canPlay() ? Board.pick(canvas, boardPx, boardSize(), e.clientX, e.clientY) : null;
    const key = p ? p.x + ',' + p.y : '';
    const prevKey = hoverPoint ? hoverPoint.x + ',' + hoverPoint.y : '';
    if (key !== prevKey) { hoverPoint = p; drawBoard(); }
});
canvas.addEventListener('mouseleave', () => { if (hoverPoint) { hoverPoint = null; drawBoard(); } });

$('passBtn').addEventListener('click', () => {
    if (!canPlay()) return;
    sendMove({ pass: true });
});

$('leaveBtn').addEventListener('click', () => { $('leaveConfirm').hidden = false; });
$('leaveNo').addEventListener('click', () => { $('leaveConfirm').hidden = true; });
$('leaveYes').addEventListener('click', () => leaveGame(false));

async function leaveGame(cancelOnly) {
    if (!state.gameId) return;
    try {
        const g = await apiFetch(`/games/${state.gameId}/leave`, { method: 'POST' });
        $('leaveConfirm').hidden = true;
        if (cancelOnly) {
            toast('info', 'La sala se ha cerrado.', 'Sala cancelada');
            switchView('lobbyView');
        } else {
            applyGame(g);   // detecta el cambio a ABANDONED: aviso, sonido y ELO
        }
    } catch (err) { toast('error', err.message, err.title || 'No se pudo abandonar'); }
}

/* ------------------------------------------------------ chat partida --- */

async function loadGameChat(force) {
    if (!state.gameId || inflight.gameChat) return;
    inflight.gameChat = true;
    const id = state.gameId;
    try {
        const msgs = await apiFetch(`/games/${id}/messages`);
        if (state.gameId !== id) return;
        const json = JSON.stringify(msgs);
        if (!force && json === lastGameChatJson) return;
        lastGameChatJson = json;
        renderChatBox($('gameChatBox'), msgs || [], !force, true);
    } catch (err) { console.error(err); }
    finally { inflight.gameChat = false; }
}

$('gameChatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('gameMsgInput');
    const content = input.value.trim();
    if (!state.gameId || !content) return;
    try {
        await apiFetch(`/games/${state.gameId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
        input.value = '';
        await loadGameChat(true);
    } catch (err) { toast('error', err.message, err.title || 'No se pudo enviar el mensaje'); }
});

/* --------------------------------------------------------- dibujo ------ */

function fitBoard() {
    const frame = $('boardFrame');
    const w = Math.floor(frame.clientWidth);
    if (!w) return;
    boardDpr = Math.min(window.devicePixelRatio || 1, 2);
    boardPx = w;
    canvas.width = Math.round(w * boardDpr);
    canvas.height = Math.round(w * boardDpr);
    drawBoard();
}

function drawBoard() {
    const g = state.game;
    const mine = myColor(g);
    Board.draw(bctx, {
        px: boardPx,
        dpr: boardDpr,
        size: boardSize(),
        board: parseBoard(g ? g.boardState : null),
        last: lastMove(g),
        ghost: hoverPoint && canPlay() ? hoverPoint : null,
        ghostColor: mine === 'WHITE' ? 'W' : 'B'
    });
}

if (window.ResizeObserver) {
    new ResizeObserver(() => { if (state.view === 'gameView') fitBoard(); }).observe($('boardFrame'));
} else {
    window.addEventListener('resize', fitBoard);
}

/** Tablero decorativo de la pantalla de acceso. */
function drawHero() {
    const hero = $('heroBoard');
    if (!hero || !hero.offsetWidth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = 420;
    hero.width = px * dpr;
    hero.height = px * dpr;
    const b = {};
    [[2, 6], [3, 6], [2, 4], [3, 3], [6, 2], [5, 3], [6, 6], [4, 2], [2, 2]].forEach(([x, y]) => { b[x + ',' + y] = 'B'; });
    [[6, 5], [5, 6], [4, 5], [5, 4], [4, 4], [6, 3], [3, 5], [7, 4]].forEach(([x, y]) => { b[x + ',' + y] = 'W'; });
    Board.draw(hero.getContext('2d'), { px, dpr, size: 9, board: b, last: { x: 4, y: 4 }, coords: false });
}

/* =========================================================== aprender ===== */

/**
 * Reglas del Go en el cliente, con la misma lógica que GoRules en el backend
 * (captura, suicidio, ko y territorio). Solo las usa el tutorial: las partidas
 * reales siempre las valida el servidor.
 */
const LocalGo = {
    neighbors(x, y, size) {
        return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
            .filter(([a, b]) => a >= 0 && b >= 0 && a < size && b < size);
    },

    /** Grupo de la piedra en (x, y): sus piedras y sus libertades ("x,y"). */
    group(board, x, y, size) {
        const color = board[x + ',' + y];
        const stones = [];
        const libs = new Set();
        const seen = new Set([x + ',' + y]);
        const stack = [[x, y]];
        while (stack.length) {
            const [cx, cy] = stack.pop();
            stones.push([cx, cy]);
            for (const [nx, ny] of this.neighbors(cx, cy, size)) {
                const k = nx + ',' + ny;
                if (!board[k]) libs.add(k);
                else if (board[k] === color && !seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
            }
        }
        return { stones, libs };
    },

    /** Devuelve { board, captured } o { error: 'OCCUPIED' | 'SUICIDE' | 'KO' }. */
    play(board, size, color, x, y, previous) {
        const k = x + ',' + y;
        if (board[k]) return { error: 'OCCUPIED' };
        const next = { ...board, [k]: color };
        const enemy = color === 'B' ? 'W' : 'B';
        const captured = new Set();
        for (const [nx, ny] of this.neighbors(x, y, size)) {
            if (next[nx + ',' + ny] !== enemy || captured.has(nx + ',' + ny)) continue;
            const g = this.group(next, nx, ny, size);
            if (!g.libs.size) g.stones.forEach(([a, b]) => captured.add(a + ',' + b));
        }
        if (!captured.size && !this.group(next, x, y, size).libs.size) return { error: 'SUICIDE' };
        captured.forEach(c => delete next[c]);
        if (previous && this.same(next, previous)) return { error: 'KO' };
        return { board: next, captured: captured.size };
    },

    same(a, b) {
        const ka = Object.keys(a);
        return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
    },

    /** Territorio: regiones vacías que solo tocan piedras de un color. */
    territory(board, size) {
        const result = { B: [], W: [] };
        const seen = new Set();
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const start = x + ',' + y;
                if (board[start] || seen.has(start)) continue;
                const region = [];
                const owners = new Set();
                const stack = [[x, y]];
                seen.add(start);
                while (stack.length) {
                    const [cx, cy] = stack.pop();
                    region.push([cx, cy]);
                    for (const [nx, ny] of this.neighbors(cx, cy, size)) {
                        const k = nx + ',' + ny;
                        if (board[k]) owners.add(board[k]);
                        else if (!seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
                    }
                }
                if (owners.size === 1) result[[...owners][0]].push(...region);
            }
        }
        return result;
    }
};

/*
 * Lecciones. Cada una tiene una posición inicial (setup) y una lista de pasos.
 * Un paso indica el color que juega, las jugadas que acepta (o 'any'), y opcionalmente:
 *   expect: la lección consiste en intentar una jugada ilegal ('SUICIDE' o 'KO').
 *   reply:  jugadas candidatas con las que responde el otro color.
 *   wrong:  mensajes para jugadas concretas que no son la buscada.
 * Las lecciones con `free` son de juego libre: N piedras alternando colores.
 */
const LESSONS = [
    {
        title: 'El tablero y las piedras',
        text: `<p>El Go se juega en las <b>intersecciones</b> de las líneas, no dentro de los cuadrados.
            El tablero oficial es de 19×19; en GoUSC también hay 9×9 y 13×13, ideales para aprender.</p>
            <p><b>Negro empieza</b> y los jugadores se turnan colocando <b>una piedra</b> cada vez.
            Una piedra <b>no se mueve</b> nunca: solo sale del tablero si la capturan.</p>
            <p>El objetivo es <b>rodear más territorio</b> que el rival.</p>`,
        free: 4,
        task: 'Coloca cuatro piedras donde quieras. Negras y blancas se alternan.',
        done: 'Así se juega una piedra. En tu turno también puedes <b>pasar</b> en lugar de colocar.'
    },
    {
        title: 'Libertades',
        text: `<p>Las <b>libertades</b> de una piedra son las intersecciones vacías <b>pegadas</b> a ella en horizontal
            o vertical (las diagonales no cuentan). Los puntos verdes las marcan.</p>
            <p>En el centro una piedra tiene 4 libertades, en el borde 3 y en la esquina solo 2:
            por eso las piedras del borde son más fáciles de atrapar.</p>`,
        setup: { B: 'E5 J5 A1' },
        showLibs: 'B',
        steps: [{
            color: 'W', accept: ['E6', 'E4', 'D5', 'F5'],
            task: 'Juega con blancas en una libertad de la piedra negra del centro.',
            hint: 'Busca uno de los cuatro puntos verdes que rodean E5.'
        }],
        done: 'La piedra del centro ha pasado de 4 a 3 libertades. Quitar libertades es la forma de atacar.'
    },
    {
        title: 'Capturar',
        text: `<p>Cuando una piedra se queda <b>sin libertades</b> queda <b>capturada</b>: se retira del tablero
            y cuenta como <b>prisionero</b>, un punto más para quien la captura.</p>`,
        setup: { B: 'E6 D5 F5', W: 'E5' },
        showLibs: 'W',
        steps: [{
            color: 'B', accept: ['E4'],
            task: 'La piedra blanca solo tiene una libertad. Captúrala con negras.',
            hint: 'Juega en la última libertad de la piedra blanca (el punto verde).'
        }],
        done: '¡Capturada! Cada prisionero vale un punto al final de la partida.'
    },
    {
        title: 'Grupos',
        text: `<p>Las piedras del mismo color <b>unidas en línea</b> (no en diagonal) forman un <b>grupo</b>:
            comparten sus libertades y viven o mueren juntas.</p>
            <p>Para capturar un grupo hay que quitarle <b>todas</b> sus libertades.</p>`,
        setup: { B: 'D6 E6 C5 F5 D4', W: 'D5 E5' },
        showLibs: 'W',
        steps: [{
            color: 'B', accept: ['E4'],
            task: 'Captura las dos piedras blancas de una sola vez.',
            hint: 'Las dos blancas comparten una única libertad.'
        }],
        done: '¡Dos prisioneros de golpe! Cuanto más grande es un grupo, más duele perderlo.'
    },
    {
        title: 'Atari: escapar',
        text: `<p>Un grupo con <b>una sola libertad</b> está en <b>atari</b>: si el rival juega ahí, lo captura.</p>
            <p>Cuando te hacen atari, lo normal es <b>alargarte</b> por esa libertad para conseguir más.</p>`,
        setup: { B: 'E5', W: 'E6 D5 F5' },
        showLibs: 'B',
        steps: [{
            color: 'B', accept: ['E4'],
            task: 'Tu piedra negra está en atari. Sálvala.',
            hint: 'Alarga la piedra por su única libertad.'
        }],
        done: 'Ahora tu grupo tiene 3 libertades y ya no está en peligro inmediato.'
    },
    {
        title: 'Prohibido el suicidio',
        text: `<p>No puedes jugar en un punto donde tu piedra se quedaría <b>sin libertades</b>:
            sería un <b>suicidio</b> y está prohibido.</p>`,
        setup: { W: 'E6 D5 F5 E4' },
        steps: [{
            color: 'B', expect: 'SUICIDE', accept: ['E5'], target: 'E5',
            task: 'Intenta jugar con negras en el punto marcado (E5).',
            hint: 'Prueba en E5, el punto rodeado por las blancas.'
        }],
        done: 'No se puede: la piedra no tendría ninguna libertad. GoUSC rechaza esa jugada en las partidas igual que aquí.'
    },
    {
        title: 'Capturar va primero',
        text: `<p>Hay una excepción al suicidio: si al jugar <b>capturas</b> piedras rivales, la jugada es legal,
            porque al retirarlas tu piedra gana libertades.</p>`,
        setup: { B: 'A3 B2 C1', W: 'A2 B1' },
        showLibs: 'W',
        steps: [{
            color: 'B', accept: ['A1'],
            task: 'Captura las dos piedras blancas de la esquina.',
            hint: 'Las dos blancas comparten su última libertad en la esquina.'
        }],
        done: 'La piedra en A1 parecía no tener libertades, pero al capturar se quedó con dos.'
    },
    {
        title: 'La regla del ko',
        text: `<p>A veces los dos jugadores podrían capturarse una piedra el uno al otro para siempre.
            Para evitarlo existe el <b>ko</b>: no puedes hacer una jugada que deje el tablero
            <b>igual que estaba antes</b> de la última jugada de tu rival.</p>
            <p>Hay que jugar antes en otro sitio y, si el rival no cierra el ko, recapturar después.</p>`,
        setup: { B: 'E6 D5 E4', W: 'F6 E5 G5 F4' },
        steps: [
            {
                color: 'B', accept: ['F5'],
                task: 'Captura con negras la piedra blanca en atari.',
                hint: 'La piedra blanca de E5 solo tiene una libertad.',
                ok: 'Capturada. Ahora juegas tú con blancas.'
            },
            {
                color: 'W', expect: 'KO', accept: ['E5'], target: 'E5',
                task: 'Con blancas, intenta recapturar en seguida en E5.',
                hint: 'Prueba a recapturar en E5.',
                ok: 'Recapturar ahora repetiría la posición. Primero hay que jugar en otro sitio.'
            },
            {
                color: 'W', accept: 'any', reply: ['C2', 'G2', 'C8', 'G8', 'B5', 'H5'],
                task: 'Juega con blancas en cualquier otro punto del tablero.',
                ok: 'Negro ha respondido en otro sitio sin cerrar el ko.'
            },
            {
                color: 'W', accept: ['E5'], target: 'E5',
                task: 'Ahora sí: recaptura en E5.',
                hint: 'Recaptura la piedra negra en E5.'
            }
        ],
        done: 'Ahora es negro quien tiene que esperar un turno. Un ko puede alargarse mucho: lo gana quien tenga más amenazas.'
    },
    {
        title: 'Dos ojos: grupos vivos',
        text: `<p>Un <b>ojo</b> es un punto vacío rodeado por tus piedras. Un grupo con <b>dos ojos separados</b>
            está <b>vivo</b> para siempre: el rival no puede jugar en ninguno (sería suicidio),
            así que nunca podrá quitarle la última libertad.</p>
            <p>Un grupo con un solo ojo, en cambio, acaba capturado.</p>`,
        setup: { B: 'A2 B2 C2 D2 E2 A1 E1', W: 'A3 B3 C3 D3 E3 F3 F2 F1' },
        steps: [
            {
                color: 'B', accept: ['C1'],
                task: 'El grupo negro tiene un hueco de tres puntos. Juega donde lo dividas en dos ojos.',
                hint: 'El punto clave es el centro del hueco.',
                wrong: {
                    B1: 'Así queda un solo ojo de dos puntos y blanco podría matar el grupo. Busca el punto que lo divide en dos.',
                    D1: 'Así queda un solo ojo de dos puntos y blanco podría matar el grupo. Busca el punto que lo divide en dos.'
                },
                ok: 'Dos ojos: B1 y D1. Ahora juegas tú con blancas.'
            },
            {
                color: 'W', expect: 'SUICIDE', accept: ['B1', 'D1'],
                task: 'Con blancas, intenta jugar dentro de uno de los ojos negros.',
                hint: 'Prueba en B1 o en D1.'
            }
        ],
        done: 'Imposible: cada ojo es un suicidio para blanco. Este grupo negro ya no se puede capturar.'
    },
    {
        title: 'Territorio y final',
        text: `<p>Cuando ya no se puede ganar nada más, los dos jugadores <b>pasan</b>.
            Con <b>dos pases seguidos</b> la partida termina y cada uno suma:</p>
            <ul>
                <li><b>Territorio</b>: puntos vacíos rodeados solo por tus piedras (los cuadraditos).</li>
                <li><b>Prisioneros</b>: las piedras que has capturado.</li>
                <li><b>Komi</b>: blanco suma 6,5 puntos por empezar segundo; el medio punto evita empates.</li>
            </ul>
            <p>Si una zona toca piedras de los dos colores, no cuenta para nadie. En GoUSC las piedras muertas
            no se retiran solas: captúralas antes de pasar.</p>`,
        setup: { B: 'E1 E2 E3 E4 E6 E7 E8 E9', W: 'F1 F2 F3 F4 F5 F6 F7 F8 F9' },
        showTerritory: true,
        steps: [{
            color: 'B', accept: ['E5'], target: 'E5',
            task: 'Hay un hueco en el muro negro y la zona de la izquierda no es de nadie. Ciérralo.',
            hint: 'El hueco está en E5.'
        }],
        done: (ls) => {
            const t = LocalGo.territory(ls.board, 9);
            const b = t.B.length;
            const w = t.W.length + 6.5;
            const fmt = (n) => String(n).replace('.', ',');
            return `Negro: <b>${b}</b> de territorio. Blanco: <b>${t.W.length}</b> + 6,5 de komi = <b>${fmt(w)}</b>.
                Gana ${b > w ? 'negro' : 'blanco'} por ${fmt(Math.abs(b - w))} puntos.`;
        }
    },
    {
        title: 'Consejos para empezar',
        text: `<ul>
                <li><b>Esquinas, lados y centro</b>, por ese orden: en las esquinas se rodea territorio con menos piedras.</li>
                <li><b>Cuida las libertades</b> de tus grupos y conecta las piedras que estén en peligro.</li>
                <li><b>No persigas cada piedra</b>: a veces vale más hacer territorio que capturar.</li>
                <li><b>Pasa</b> cuando no quede nada útil por jugar; con dos pases seguidos se cuenta.</li>
                <li>Empieza con partidas <b>9×9 Casual</b>: son cortas y no mueven tu ELO.</li>
            </ul>`,
        setup: { B: 'C3 G7 E5', W: 'G3 C7' },
        steps: [],
        done: 'Ya conoces las reglas. ¡Ahora toca jugar!'
    }
];

const LEARN_ERRORS = {
    OCCUPIED: { title: 'Punto ocupado', msg: 'Ahí ya hay una piedra.' },
    SUICIDE: { title: 'Suicidio', msg: 'Tu piedra se quedaría sin libertades.' },
    KO: { title: 'Ko', msg: 'No puedes recapturar en seguida: repetiría la posición.' }
};

const learnCanvas = $('learnBoard');
const lctx = learnCanvas.getContext('2d');
const ls = { idx: 0, board: {}, prev: null, step: 0, turn: 'B', placed: 0, done: false, last: null, flash: null, hover: null, busy: false };
let learnPx = 640;
let learnDpr = 1;
let flashTimer = null;

function learnDoneSet() {
    try { return new Set(JSON.parse(store.get('gousc_learn') || '[]')); } catch (e) { return new Set(); }
}

function markLessonDone(i) {
    const set = learnDoneSet();
    set.add(i);
    store.set('gousc_learn', JSON.stringify([...set]));
}

function setupBoard(setup) {
    const board = {};
    for (const color of ['B', 'W']) {
        String((setup && setup[color]) || '').split(/\s+/).filter(Boolean).forEach(label => {
            const c = Board.parseCoord(label);
            if (c) board[c.x + ',' + c.y] = color;
        });
    }
    return board;
}

function learnColor() {
    const L = LESSONS[ls.idx];
    if (L.free) return ls.turn;
    const step = L.steps[ls.step];
    return step ? step.color : null;
}

function openLesson(i) {
    clearTimeout(flashTimer);
    const L = LESSONS[i];
    Object.assign(ls, { idx: i, board: setupBoard(L.setup), prev: null, step: 0, turn: 'B', placed: 0, done: false, last: null, flash: null, hover: null, busy: false });
    $('lessonFeedback').hidden = true;
    if (!L.free && !L.steps.length) completeLesson(false);
    renderLesson();
}

function renderLesson() {
    const L = LESSONS[ls.idx];
    const doneSet = learnDoneSet();
    $('lessonKicker').textContent = `Lección ${ls.idx + 1} de ${LESSONS.length}`;
    $('lessonTitle').textContent = L.title;
    $('lessonText').innerHTML = L.text;

    const color = learnColor();
    const step = L.steps && L.steps[ls.step];
    const task = L.free ? `${L.task} <span class="muted">(${ls.placed}/${L.free})</span>` : step ? step.task : '';
    $('lessonTask').hidden = ls.done || !task;
    $('lessonTask').innerHTML = task
        ? `<span class="stone stone--${color === 'W' ? 'w' : 'b'}"></span><span><b>${color === 'W' ? 'Blancas' : 'Negras'}</b> · ${task}</span>`
        : '';

    $('lessonPrev').disabled = ls.idx === 0;
    const last = ls.idx === LESSONS.length - 1;
    $('lessonNext').innerHTML = last ? `${icon('play')}<span>Ir a jugar</span>` : '<span>Siguiente</span>';
    $('lessonNext').classList.toggle('btnPrimary', ls.done);
    $('lessonNext').classList.toggle('btnGhost', !ls.done);

    $('lessonList').innerHTML = LESSONS.map((l, i) => `
        <li><button class="lessonItem ${i === ls.idx ? 'active' : ''} ${doneSet.has(i) ? 'done' : ''}" data-lesson="${i}" type="button">
            <span class="lessonNum">${doneSet.has(i) ? icon('check') : i + 1}</span>
            <span class="lessonName">${esc(l.title)}</span>
        </button></li>`).join('');
    $('learnProgress').textContent = `${doneSet.size} de ${LESSONS.length} completadas`;
    drawLearn();
}

function learnFeedback(type, html) {
    const el = $('lessonFeedback');
    el.className = 'lessonFeedback lessonFeedback--' + type;
    el.innerHTML = `${icon(type === 'good' ? 'check' : type === 'bad' ? 'x' : 'info')}<span>${html}</span>`;
    el.hidden = false;
}

function completeLesson(withSound = true) {
    const L = LESSONS[ls.idx];
    ls.done = true;
    markLessonDone(ls.idx);
    const text = typeof L.done === 'function' ? L.done(ls) : L.done;
    learnFeedback('good', L.steps && !L.steps.length ? text : `<b>¡Bien hecho!</b> ${text}`);
    if (withSound) Sound.chime(true);
}

/** Muestra una X roja un momento sobre una jugada rechazada. */
function flashPoint(p) {
    ls.flash = p;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { ls.flash = null; drawLearn(); }, 900);
}

function applyLearnMove(color, p, res) {
    ls.prev = ls.board;
    ls.board = res.board;
    ls.last = p;
    if (res.captured) Sound.capture(res.captured); else Sound.stone();
}

function learnClick(p) {
    const L = LESSONS[ls.idx];
    if (ls.done || ls.busy) return;
    const color = learnColor();
    const label = Board.formatCoord(p.x, p.y);
    const res = LocalGo.play(ls.board, 9, color, p.x, p.y, ls.prev);

    if (L.free) {
        if (res.error) { flashPoint(p); learnFeedback('bad', LEARN_ERRORS[res.error].msg); renderLesson(); return; }
        applyLearnMove(color, p, res);
        ls.turn = color === 'B' ? 'W' : 'B';
        ls.placed++;
        $('lessonFeedback').hidden = true;
        if (ls.placed >= L.free) completeLesson();
        renderLesson();
        return;
    }

    const step = L.steps[ls.step];
    const wanted = step.accept === 'any' || step.accept.includes(label);

    if (step.expect) {
        // en este paso lo que se busca es comprobar que la jugada está prohibida
        flashPoint(p);
        if (wanted && res.error === step.expect) {
            Sound.stone(0, 0.4);
            advanceLesson(step, `<b>${LEARN_ERRORS[res.error].title}.</b> ${step.ok || LEARN_ERRORS[res.error].msg}`);
        } else if (res.error) {
            learnFeedback('bad', LEARN_ERRORS[res.error].msg);
        } else {
            learnFeedback('bad', step.hint);
        }
        renderLesson();
        return;
    }

    if (res.error) { flashPoint(p); learnFeedback('bad', `<b>${LEARN_ERRORS[res.error].title}.</b> ${LEARN_ERRORS[res.error].msg}`); renderLesson(); return; }
    if (!wanted) {
        flashPoint(p);
        learnFeedback('bad', (step.wrong && step.wrong[label]) || step.hint);
        renderLesson();
        return;
    }

    applyLearnMove(color, p, res);
    if (step.reply) {
        // el otro color responde en el primer punto libre de la lista
        ls.busy = true;
        renderLesson();
        setTimeout(() => {
            const other = color === 'B' ? 'W' : 'B';
            for (const r of step.reply) {
                const c = Board.parseCoord(r);
                const rr = LocalGo.play(ls.board, 9, other, c.x, c.y, ls.prev);
                if (!rr.error) { applyLearnMove(other, c, rr); break; }
            }
            ls.busy = false;
            advanceLesson(step, step.ok);
            renderLesson();
        }, 500);
        return;
    }
    advanceLesson(step, step.ok);
    renderLesson();
}

function advanceLesson(step, okMsg) {
    ls.step++;
    if (ls.step >= LESSONS[ls.idx].steps.length) completeLesson();
    else if (okMsg) learnFeedback('good', okMsg);
    else $('lessonFeedback').hidden = true;
}

function learnMarks() {
    const L = LESSONS[ls.idx];
    const marks = [];
    if (L.showLibs) {
        const libs = new Set();
        for (const [k, c] of Object.entries(ls.board)) {
            if (c !== L.showLibs) continue;
            const [x, y] = k.split(',').map(Number);
            LocalGo.group(ls.board, x, y, 9).libs.forEach(l => libs.add(l));
        }
        libs.forEach(l => { const [x, y] = l.split(',').map(Number); marks.push({ x, y, type: 'lib' }); });
    }
    if (L.showTerritory) {
        const t = LocalGo.territory(ls.board, 9);
        t.B.forEach(([x, y]) => marks.push({ x, y, type: 'terrB' }));
        t.W.forEach(([x, y]) => marks.push({ x, y, type: 'terrW' }));
    }
    const step = !ls.done && L.steps && L.steps[ls.step];
    if (step && step.target) {
        const c = Board.parseCoord(step.target);
        if (c && !ls.board[c.x + ',' + c.y]) marks.push({ x: c.x, y: c.y, type: 'target' });
    }
    if (ls.flash) marks.push({ x: ls.flash.x, y: ls.flash.y, type: 'x' });
    return marks;
}

function fitLearn() {
    const w = Math.floor($('learnFrame').clientWidth);
    if (!w) return;
    learnDpr = Math.min(window.devicePixelRatio || 1, 2);
    learnPx = w;
    learnCanvas.width = Math.round(w * learnDpr);
    learnCanvas.height = Math.round(w * learnDpr);
    drawLearn();
}

function drawLearn() {
    const color = learnColor();
    Board.draw(lctx, {
        px: learnPx,
        dpr: learnDpr,
        size: 9,
        board: ls.board,
        last: ls.last,
        ghost: !ls.done && !ls.busy && color ? ls.hover : null,
        ghostColor: color || 'B',
        marks: learnMarks()
    });
}

learnCanvas.addEventListener('click', (e) => {
    const p = Board.pick(learnCanvas, learnPx, 9, e.clientX, e.clientY);
    if (p) learnClick(p);
});
learnCanvas.addEventListener('mousemove', (e) => {
    const p = Board.pick(learnCanvas, learnPx, 9, e.clientX, e.clientY);
    const key = p ? p.x + ',' + p.y : '';
    const prevKey = ls.hover ? ls.hover.x + ',' + ls.hover.y : '';
    if (key !== prevKey) { ls.hover = p; drawLearn(); }
});
learnCanvas.addEventListener('mouseleave', () => { if (ls.hover) { ls.hover = null; drawLearn(); } });

$('lessonList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lesson]');
    if (b) openLesson(Number(b.dataset.lesson));
});
$('lessonPrev').addEventListener('click', () => { if (ls.idx > 0) openLesson(ls.idx - 1); });
$('lessonReset').addEventListener('click', () => openLesson(ls.idx));
$('lessonNext').addEventListener('click', () => {
    if (ls.idx < LESSONS.length - 1) openLesson(ls.idx + 1);
    else switchView('lobbyView');
});

function openLearnView() {
    const doneSet = learnDoneSet();
    if (!ls.started) {
        // al entrar por primera vez, abre la primera lección sin completar
        ls.started = true;
        const first = LESSONS.findIndex((l, i) => !doneSet.has(i));
        openLesson(first >= 0 ? first : 0);
    } else {
        renderLesson();
    }
    requestAnimationFrame(fitLearn);
}

if (window.ResizeObserver) {
    new ResizeObserver(() => { if (state.view === 'learnView') fitLearn(); }).observe($('learnFrame'));
} else {
    window.addEventListener('resize', () => { if (state.view === 'learnView') fitLearn(); });
}

/* ================================================== refresco automático === */

let ticks = 0;

function tick() {
    if (document.hidden || !state.user) return;
    ticks++;
    switch (state.view) {
        case 'gameView': refreshActiveGame(); break;
        case 'lobbyView': loadGames(); if (ticks % 4 === 0) loadRanking(); break;
        case 'rankingView': loadRanking(); break;
        case 'friendsView': loadFriends(); break;
        case 'chatView': loadPrivateChat(false); break;
        case 'profileView': loadHistory(false); break;
    }
    if (ticks % 6 === 0 && state.view !== 'friendsView') loadFriends();
    if (ticks % 12 === 0) refreshMe();
}

setInterval(tick, TICK_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

/* ================================================================ inicio == */

applyTheme();
applySound();
renderProverb();

(() => {
    const saved = store.get('gousc_user');
    let user = null;
    try { user = saved ? JSON.parse(saved) : null; } catch (e) { user = null; }
    setAuth(user && user.id ? user : null);
})();
