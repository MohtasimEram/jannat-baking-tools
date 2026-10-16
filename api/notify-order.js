// ========================================================================
// POST /api/notify-order
// Serverless Telegram notifier for new orders (Vercel Node function).
//
// WHY THIS EXISTS
// In 1.0 the Telegram bot token and chat id were hard-coded in js/app.js,
// which meant anyone could open DevTools and read them — a real credential
// leak. The browser now posts the order here instead, and the secrets stay
// on the server.
//
// SETUP (do this once in the Vercel dashboard → Settings → Environment
// Variables, then redeploy):
//   TELEGRAM_BOT_TOKEN = <your bot token>
//   TELEGRAM_CHAT_ID   = <the chat id that should receive order alerts>
//
// Until those variables are set the function falls back to the original
// values so notifications keep working exactly as before. The fallback is
// never served to browsers, but you should still rotate the token in
// @BotFather and move it to the environment variables above.
// ========================================================================

'use strict';

const FALLBACK_BOT_TOKEN = '';
const FALLBACK_CHAT_ID = '';

const MAX_ITEMS = 60;
const MAX_BODY_BYTES = 24 * 1024;

// Best-effort per-instance rate limit so the endpoint cannot be used as a
// free Telegram relay. Resets whenever the lambda is recycled.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 12;
const hits = new Map();

function rateLimited(ip) {
    const now = Date.now();
    const bucket = (hits.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
    bucket.push(now);
    hits.set(ip, bucket);

    if (hits.size > 500) {
        for (const [key, times] of hits) {
            if (!times.some((time) => now - time < RATE_WINDOW_MS)) hits.delete(key);
        }
    }
    return bucket.length > RATE_MAX;
}

function clean(value, maxLength) {
    return String(value === null || value === undefined ? '' : value)
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, maxLength);
}

function escapeTelegram(value) {
    return clean(value, 4000)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function toAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : 0;
}

function buildMessage(payload) {
    const customer = payload.customer || {};
    const items = Array.isArray(payload.items) ? payload.items.slice(0, MAX_ITEMS) : [];

    const lines = [];
    lines.push('\u{1F38A} <b>NEW ORDER</b> — ' + escapeTelegram(payload.orderCode));
    lines.push('');
    lines.push('\u{1F464} <b>Customer:</b> ' + escapeTelegram(customer.name));
    lines.push('\u{1F4DE} <b>Phone:</b> ' + escapeTelegram(customer.phone));
    lines.push(
        '\u{1F4CD} <b>Address:</b> ' +
        escapeTelegram(customer.address) +
        (customer.location ? ' (' + escapeTelegram(customer.location) + ')' : '')
    );
    if (payload.notes) lines.push('\u{1F4DD} <b>Notes:</b> ' + escapeTelegram(payload.notes));

    lines.push('');
    lines.push('\u{1F6CD} <b>ITEMS</b>');
    items.forEach((item) => {
        const name = escapeTelegram(item && item.name);
        const color = item && item.color ? ' [' + escapeTelegram(item.color) + ']' : '';
        const qty = Math.max(1, toAmount(item && item.qty));
        const price = toAmount(item && item.price);
        lines.push('• ' + name + color + ' ×' + qty + ' = \u09F3' + price * qty);
    });

    lines.push('');
    lines.push('\u{1F4B0} <b>Subtotal:</b> \u09F3' + toAmount(payload.subtotal));
    lines.push('\u{1F69A} <b>Delivery:</b> \u09F3' + toAmount(payload.deliveryFee));
    lines.push('\u{1F4B5} <b>TOTAL:</b> \u09F3' + toAmount(payload.total));
    lines.push('\u{1F4B3} Cash on delivery');
    if (payload.orderId) lines.push('');
    if (payload.orderId) lines.push('<i>Ref: ' + escapeTelegram(payload.orderId) + '</i>');

    return lines.join('\n');
}

async function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (err) {
            return null;
        }
    }

    return new Promise((resolve) => {
        if (!req || typeof req.on !== 'function') {
            resolve(null);
            return;
        }
        let raw = '';
        let tooLarge = false;
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > MAX_BODY_BYTES) {
                tooLarge = true;
                req.destroy();
            }
        });
        req.on('end', () => {
            if (tooLarge) return resolve(null);
            try {
                resolve(raw ? JSON.parse(raw) : null);
            } catch (err) {
                resolve(null);
            }
        });
        req.on('error', () => resolve(null));
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        res.setHeader('Allow', 'POST');
        res.status(204).end();
        return;
    }
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || 'unknown').split(',')[0].trim();
    if (rateLimited(ip)) {
        res.status(429).json({ ok: false, error: 'Too many requests' });
        return;
    }

    const payload = await readBody(req);
    if (!payload || typeof payload !== 'object') {
        res.status(400).json({ ok: false, error: 'Invalid payload' });
        return;
    }

    const orderCode = clean(payload.orderCode, 24);
    const customer = payload.customer && typeof payload.customer === 'object' ? payload.customer : {};
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!/^JB-[A-Z0-9]{4,12}$/.test(orderCode)) {
        res.status(400).json({ ok: false, error: 'Invalid order code' });
        return;
    }
    if (!clean(customer.name, 80) || !/^01\d{9}$/.test(clean(customer.phone, 24))) {
        res.status(400).json({ ok: false, error: 'Invalid customer' });
        return;
    }
    if (!items.length || items.length > MAX_ITEMS) {
        res.status(400).json({ ok: false, error: 'Invalid items' });
        return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN || FALLBACK_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || FALLBACK_CHAT_ID;

    if (!botToken || !chatId) {
        console.warn('[notify-order] Telegram credentials are not configured');
        res.status(200).json({ ok: true, notified: false, reason: 'not-configured' });
        return;
    }

    const message = buildMessage({
        orderCode,
        orderId: clean(payload.orderId, 48),
        customer: {
            name: clean(customer.name, 80),
            phone: clean(customer.phone, 24),
            address: clean(customer.address, 300),
            location: clean(customer.location, 40)
        },
        items: items.map((item) => ({
            name: clean(item && item.name, 140),
            color: clean(item && item.color, 40),
            qty: item && item.qty,
            price: item && item.price
        })),
        subtotal: payload.subtotal,
        deliveryFee: payload.deliveryFee,
        total: payload.total,
        notes: clean(payload.notes, 500)
    });

    try {
        const response = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            console.error('[notify-order] Telegram rejected the message', response.status, detail.slice(0, 300));
            res.status(502).json({ ok: false, error: 'Notification failed' });
            return;
        }

        res.status(200).json({ ok: true, notified: true });
    } catch (error) {
        console.error('[notify-order] request failed', error);
        res.status(502).json({ ok: false, error: 'Notification failed' });
    }
};
