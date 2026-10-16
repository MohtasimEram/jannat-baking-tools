// ========================================================================
// JANNAT BAKING TOOLS 2.0 — AI SHOPPING ASSISTANT (browser side)
//
// A floating chat widget that talks to POST /api/chat (api/chat.js). All AI
// calls happen on the server — no API key ever reaches the browser.
//
// Included on the storefront pages with:
//     <script type="module" src="js/chatbot.js"></script>
// ========================================================================

import { escapeHtml, WHATSAPP_NUMBER } from './store.js';

const API_URL = '/api/chat';
const STORAGE_KEY = 'jannat_chat_v1';
const MAX_INPUT = 500;
const MAX_HISTORY = 14;
const REQUEST_TIMEOUT_MS = 30000;

const GREETING =
    "Hi! I'm Jannat's shopping assistant. Ask me about our products, prices, delivery, payment or returns.";

let panel;
let launcher;
let listEl;
let formEl;
let inputEl;
let chipsEl;
let sendBtn;
let history = [];
let pending = false;
let isOpen = false;

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function loadHistory() {
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
            return parsed
                .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
                .slice(-MAX_HISTORY);
        }
    } catch (err) {
        /* storage unavailable */
    }
    return [];
}

function saveHistory() {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (err) {
        /* ignore */
    }
}

/* ------------------------------------------------------------------ */
/* Safe mini-markdown (escape first, then allow a tiny whitelist)      */
/* ------------------------------------------------------------------ */

const SAFE_HREF =
    /^(product\.html\?id=[A-Za-z0-9_-]{1,64}|track\.html|cart\.html|index\.html(\?[A-Za-z0-9_=&;%-]{0,80})?(#[a-z-]{1,30})?|https:\/\/wa\.me\/8801874244466[A-Za-z0-9_=&;%?.+-]*)$/;

function inlineMarkdown(text) {
    const stash = [];
    const hold = (html) => {
        stash.push(html);
        return '\u0000' + (stash.length - 1) + '\u0000';
    };
    const linkHtml = (label, href) => {
        const external = /^https:/.test(href);
        return (
            '<a href="' + href + '"' +
            (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>'
        );
    };

    // Everything is escaped before any markup is added.
    let s = escapeHtml(text);

    // [label](href) — href must match the whitelist, otherwise only the label is kept.
    s = s.replace(/\[([^\]]{1,120})\]\(([^)\s]{1,220})\)/g, (m, label, href) =>
        SAFE_HREF.test(href) ? hold(linkHtml(label, href)) : label
    );
    // Bare WhatsApp links.
    s = s.replace(/https:\/\/wa\.me\/8801874244466[A-Za-z0-9_=&;%?.+-]*/g, (href) =>
        hold(linkHtml('WhatsApp', href))
    );
    s = s.replace(/\*\*([^*]{1,200})\*\*/g, '<strong>$1</strong>');

    // eslint-disable-next-line no-control-regex
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[Number(i)] || '');
}

function renderMarkdown(text) {
    const lines = String(text || '').split('\n');
    let html = '';
    let inList = false;
    lines.forEach((line) => {
        const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
        if (bullet) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            html += '<li>' + inlineMarkdown(bullet[1]) + '</li>';
            return;
        }
        if (inList) {
            html += '</ul>';
            inList = false;
        }
        if (line.trim()) html += '<p>' + inlineMarkdown(line) + '</p>';
    });
    if (inList) html += '</ul>';
    return html;
}

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

const ICON_CHAT =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/></svg>';
const ICON_CLOSE =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12"/></svg>';
const ICON_SEND =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

function currentProductId() {
    try {
        if (!/product\.html$/i.test(window.location.pathname)) return '';
        const id = new URLSearchParams(window.location.search).get('id') || '';
        return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : '';
    } catch (err) {
        return '';
    }
}

function quickReplies() {
    const base = ['What are the delivery charges?', 'How do I place an order?', 'What is your return policy?', 'How can I track my order?'];
    return currentProductId() ? ['Is this item in stock?'].concat(base.slice(0, 3)) : base;
}

function build() {
    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'jb-chat-launcher';
    launcher.setAttribute('aria-label', 'Chat with our shopping assistant');
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'jb-chat-panel');
    launcher.innerHTML = ICON_CHAT + '<span class="jb-chat-launcher-label">Ask us</span>';

    panel = document.createElement('section');
    panel.className = 'jb-chat-panel';
    panel.id = 'jb-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Shopping assistant');
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
    panel.innerHTML = `
<header class="jb-chat-head">
    <div class="jb-chat-title">
        <strong>Jannat Assistant</strong>
        <span>AI helper · may make mistakes</span>
    </div>
    <button type="button" class="jb-chat-close" aria-label="Close chat">${ICON_CLOSE}</button>
</header>
<div class="jb-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
<div class="jb-chat-chips" aria-label="Suggested questions"></div>
<form class="jb-chat-form" autocomplete="off">
    <label class="sr-only" for="jb-chat-input">Your message</label>
    <input id="jb-chat-input" type="text" maxlength="${MAX_INPUT}" placeholder="Ask about products, delivery, returns…" enterkeyhint="send">
    <button type="submit" class="jb-chat-send" aria-label="Send message">${ICON_SEND}</button>
</form>
<p class="jb-chat-foot">For order problems, <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer">message us on WhatsApp</a>.</p>`;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    listEl = panel.querySelector('.jb-chat-messages');
    chipsEl = panel.querySelector('.jb-chat-chips');
    formEl = panel.querySelector('.jb-chat-form');
    inputEl = panel.querySelector('#jb-chat-input');
    sendBtn = panel.querySelector('.jb-chat-send');

    launcher.addEventListener('click', () => (isOpen ? closeChat() : openChat()));
    panel.querySelector('.jb-chat-close').addEventListener('click', closeChat);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen) closeChat();
    });

    formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        send(inputEl.value);
    });

    chipsEl.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-chip]');
        if (chip) send(chip.dataset.chip);
    });

    // Open when something on the page asks for it: <a data-open-chat>
    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-open-chat]')) {
            event.preventDefault();
            openChat();
        }
    });
}

function addBubble(role, content, extraClass) {
    const div = document.createElement('div');
    div.className = 'jb-msg jb-msg-' + (role === 'user' ? 'user' : 'bot') + (extraClass ? ' ' + extraClass : '');
    if (role === 'user') div.textContent = content;
    else div.innerHTML = renderMarkdown(content);
    listEl.appendChild(div);
    listEl.scrollTop = listEl.scrollHeight;
    return div;
}

function renderChips() {
    const show = history.filter((m) => m.role === 'user').length === 0;
    chipsEl.hidden = !show;
    chipsEl.innerHTML = show
        ? quickReplies()
            .map((q) => `<button type="button" class="jb-chip" data-chip="${escapeHtml(q)}">${escapeHtml(q)}</button>`)
            .join('')
        : '';
}

function renderAll() {
    listEl.innerHTML = '';
    addBubble('assistant', GREETING);
    history.forEach((m) => addBubble(m.role, m.content));
    renderChips();
}

/* ------------------------------------------------------------------ */
/* Open / close                                                        */
/* ------------------------------------------------------------------ */

function openChat() {
    isOpen = true;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    // next frame so the CSS transition runs
    window.requestAnimationFrame(() => panel.classList.add('open'));
    launcher.classList.add('is-open');
    launcher.setAttribute('aria-expanded', 'true');
    document.body.classList.add('jb-chat-open');
    listEl.scrollTop = listEl.scrollHeight;
    setTimeout(() => {
        try { inputEl.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    }, 120);
}

function closeChat() {
    isOpen = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('jb-chat-open');
    setTimeout(() => {
        if (!isOpen) panel.hidden = true;
    }, 220);
    try { launcher.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

function setPending(value) {
    pending = value;
    sendBtn.disabled = value;
    inputEl.disabled = value;
    panel.classList.toggle('is-pending', value);
}

function friendlyError(status) {
    if (status === 429) return "You're sending messages a little fast — please wait a moment and try again.";
    if (status === 503 || status === 404) {
        return "Our assistant isn't available right now. Please message us on WhatsApp and we'll help you straight away.";
    }
    return "Sorry, I couldn't get an answer just now. Please try again, or message us on [WhatsApp](https://wa.me/" + WHATSAPP_NUMBER + ').';
}

async function send(raw) {
    const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT);
    if (!text || pending) return;

    inputEl.value = '';
    history.push({ role: 'user', content: text });
    saveHistory();
    addBubble('user', text);
    renderChips();
    setPending(true);

    const typing = addBubble('assistant', '', 'jb-typing');
    typing.innerHTML = '<span class="jb-dot"></span><span class="jb-dot"></span><span class="jb-dot"></span>';
    typing.setAttribute('aria-label', 'Assistant is typing');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                messages: history.slice(-MAX_HISTORY),
                context: { productId: currentProductId() }
            })
        });

        let data = {};
        try { data = await response.json(); } catch (err) { data = {}; }

        typing.remove();
        if (!response.ok || !data.reply) {
            addBubble('assistant', friendlyError(response.status), 'jb-msg-error');
            // Drop the unanswered question so retrying doesn't send a dangling turn.
            history.pop();
            saveHistory();
        } else {
            history.push({ role: 'assistant', content: data.reply });
            saveHistory();
            addBubble('assistant', data.reply);
        }
    } catch (err) {
        typing.remove();
        addBubble('assistant', friendlyError(0), 'jb-msg-error');
        history.pop();
        saveHistory();
    } finally {
        clearTimeout(timer);
        setPending(false);
        if (isOpen) {
            try { inputEl.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
        }
    }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function init() {
    if (document.getElementById('jb-chat-panel')) return;
    history = loadHistory();
    build();
    renderAll();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
