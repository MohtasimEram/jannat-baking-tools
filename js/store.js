// ========================================================================
// JANNAT BAKING TOOLS 2.0 — SHARED STORE & UTILITIES
// Single source of truth for escaping, formatting, product shape,
// the cart (with colour variants), the wishlist and recently viewed items.
// ========================================================================

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const CURRENCY = '৳';

export const CATEGORIES = [
    { id: 'molds', label: 'Molds' },
    { id: 'tools', label: 'Tools' },
    { id: 'decor', label: 'Decor' },
    { id: 'essence', label: 'Essence' }
];

export const DELIVERY = {
    'Inside CTG': 80,
    'Outside CTG': 150
};

export const DEFAULT_LOCATION = 'Inside CTG';

export const WHATSAPP_NUMBER = '8801874244466';
export const CONTACT_PHONE = '01874244466';
export const CONTACT_EMAIL = 'info@jannatbaking.com';
export const FACEBOOK_URL = 'https://www.facebook.com/share/1AEsBQVnNB/';

export const MAX_QTY_PER_ITEM = 99;

/** Neutral inline placeholder — no external dependency, never 404s. */
export const PLACEHOLDER_IMG =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">' +
        '<rect width="600" height="600" fill="#FDF8F3"/>' +
        '<g fill="none" stroke="#E3D4C5" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M190 360l60-70 50 58 40-44 70 86z"/>' +
        '<circle cx="243" cy="245" r="22"/>' +
        '<rect x="150" y="170" width="300" height="260" rx="26"/>' +
        '</g>' +
        '<text x="300" y="484" font-family="Inter,Arial,sans-serif" font-size="26" fill="#A89B93" ' +
        'text-anchor="middle">Jannat Baking</text></svg>'
    );

/* ------------------------------------------------------------------ */
/* Escaping & sanitising                                               */
/* ------------------------------------------------------------------ */

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;'
};

/** Escape every character that can break out of HTML text or an attribute. */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch]);
}

/** Alias kept for readability at attribute call-sites. */
export const escapeAttr = escapeHtml;

/** Only allow http(s) / mailto / tel / data:image URLs. Blocks javascript:. */
export function safeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return raw;
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(raw)) return raw;
    return '';
}

/** Safe <img src>: falls back to the inline placeholder. */
export function safeImage(value) {
    return safeUrl(value) || PLACEHOLDER_IMG;
}

/* ------------------------------------------------------------------ */
/* Responsive / optimised delivery (Cloudinary)                         */
/* ------------------------------------------------------------------ */

const CLOUDINARY_RE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;
const CLOUDINARY_TRANSFORM_RE = /^[a-z]{1,3}_[^/,]+(,[a-z]{1,3}_[^/,]+)*$/;

/**
 * Ask Cloudinary for a resized, auto-format (WebP/AVIF) and auto-quality copy
 * of an image. Non-Cloudinary URLs (and the inline placeholder) are returned
 * untouched, so this is always safe to wrap around any image URL.
 *
 *   optimizeImage(url, 480)  ->  .../upload/f_auto,q_auto,c_limit,w_480/v123/abc.jpg
 */
export function optimizeImage(url, width, extra) {
    const raw = String(url || '');
    const match = CLOUDINARY_RE.exec(raw);
    if (!match) return raw;
    const rest = match[2];
    // Already carries a transformation segment — don't stack another one.
    if (CLOUDINARY_TRANSFORM_RE.test(rest.split('/')[0])) return raw;
    const w = Math.max(48, Math.min(2400, Math.round(Number(width) || 800)));
    const transform = (extra ? extra + ',' : '') + 'f_auto,q_auto,c_limit,w_' + w;
    return match[1] + transform + '/' + rest;
}

/** srcset string for Cloudinary images; empty string for anything else. */
export function imageSrcset(url, widths) {
    if (!CLOUDINARY_RE.test(String(url || ''))) return '';
    return (widths || [320, 480, 640, 800])
        .map((w) => optimizeImage(url, w) + ' ' + w + 'w')
        .join(', ');
}

/**
 * Ready-to-embed `src` (+ `srcset`/`sizes`) attributes for an <img>.
 * Everything is escaped, so the result can be dropped straight into a template.
 */
export function responsiveImgAttrs(url, options) {
    const opts = Object.assign({ width: 640, widths: [320, 480, 640, 800], sizes: '' }, options || {});
    const safe = safeImage(url);
    const src = optimizeImage(safe, opts.width);
    const srcset = imageSrcset(safe, opts.widths);
    let out = 'src="' + escapeAttr(src) + '"';
    if (srcset) {
        out += ' srcset="' + escapeAttr(srcset) + '"';
        if (opts.sizes) out += ' sizes="' + escapeAttr(opts.sizes) + '"';
    }
    return out;
}

/** 1200x630 JPEG crop for social previews (og:image), which can't use WebP everywhere. */
export function socialImage(url) {
    const raw = String(url || '');
    const match = CLOUDINARY_RE.exec(raw);
    if (!match) return raw;
    if (CLOUDINARY_TRANSFORM_RE.test(match[2].split('/')[0])) return raw;
    return match[1] + 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630/' + match[2];
}

/** Trim + hard length cap for anything we persist or render. */
export function sanitizeText(value, maxLength = 500) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, maxLength);
}

/**
 * Escape text then turn bare URLs into links.
 * URLs are tokenised *before* escaping so query strings stay intact, and the
 * protocol is validated so `javascript:` can never become an href.
 */
export function linkify(text) {
    const value = String(text === null || text === undefined ? '' : text);
    if (!value) return '';
    const parts = value.split(/(https?:\/\/[^\s<>"']+)/gi);
    return parts
        .map((part) => {
            if (/^https?:\/\//i.test(part)) {
                const url = safeUrl(part);
                if (!url) return escapeHtml(part);
                return (
                    '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener noreferrer nofollow">' +
                    escapeHtml(part) +
                    '</a>'
                );
            }
            return escapeHtml(part);
        })
        .join('');
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "৳ 1,250" — display only. */
export function formatBDT(amount) {
    const n = Number(amount);
    const safe = Number.isFinite(n) ? Math.round(n) : 0;
    return CURRENCY + ' ' + safe.toLocaleString('en-US');
}

/** "৳ 1250" — matches the 1.0 order document format for backwards compatibility. */
export function plainBDT(amount) {
    const n = Number(amount);
    return CURRENCY + ' ' + (Number.isFinite(n) ? Math.round(n) : 0);
}

export function formatDate(value) {
    const date = toDate(value);
    if (!date) return '—';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/** Accepts a Firestore Timestamp, Date, number or ISO string. */
export function toDate(value) {
    if (!value) return null;
    try {
        if (typeof value.toDate === 'function') return value.toDate();
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    } catch (err) {
        return null;
    }
}

export function categoryLabel(id) {
    const match = CATEGORIES.find((c) => c.id === id);
    return match ? match.label : (id ? String(id) : 'Uncategorised');
}

/* ------------------------------------------------------------------ */
/* Product shape (backwards compatible with 1.0 documents)             */
/* ------------------------------------------------------------------ */

function normalizeHex(value) {
    const raw = String(value || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw.toLowerCase();
    if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return '#' + raw.toLowerCase();
    return '#d4a574';
}

/** Always returns at least one usable image URL. */
export function productImages(product) {
    if (!product) return [PLACEHOLDER_IMG];
    const list = [];
    if (Array.isArray(product.images)) {
        product.images.forEach((url) => {
            const clean = safeUrl(url);
            if (clean && !list.includes(clean)) list.push(clean);
        });
    }
    const legacy = safeUrl(product.imageUrl);
    if (legacy && !list.includes(legacy)) list.push(legacy);
    return list.length ? list : [PLACEHOLDER_IMG];
}

/** Returns [{ name, hex }] — empty array when the product has no colours. */
export function productColors(product) {
    if (!product || !Array.isArray(product.colors)) return [];
    const seen = new Set();
    const out = [];
    product.colors.forEach((entry) => {
        if (!entry) return;
        const name = sanitizeText(typeof entry === 'string' ? entry : entry.name, 40);
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ name, hex: normalizeHex(typeof entry === 'string' ? '' : entry.hex) });
    });
    return out;
}

/** Canonical in-memory product object used by every page. */
export function normalizeProduct(id, data) {
    const raw = data || {};
    const price = Number(raw.price);
    const stock = Number(raw.stock);
    const images = productImages(raw);
    return {
        id: String(id),
        name: sanitizeText(raw.name, 140) || 'Untitled product',
        category: sanitizeText(raw.category, 40).toLowerCase(),
        description: sanitizeText(raw.description, 4000),
        socialLink: safeUrl(raw.socialLink),
        price: Number.isFinite(price) && price >= 0 ? Math.round(price) : 0,
        stock: Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : 0,
        images,
        image: images[0],
        colors: productColors(raw),
        featured: raw.featured === true,
        createdAt: raw.createdAt || null,
        updatedAt: raw.updatedAt || null
    };
}

export function stockState(stock) {
    const n = Number(stock) || 0;
    if (n <= 0) return { key: 'out', label: 'Out of Stock', cls: 'out' };
    if (n <= 5) return { key: 'low', label: 'Only ' + n + ' left', cls: 'low' };
    if (n <= 15) return { key: 'limited', label: n + ' in stock', cls: 'low' };
    return { key: 'in', label: 'In stock', cls: 'in' };
}

/* ------------------------------------------------------------------ */
/* Safe localStorage                                                   */
/* ------------------------------------------------------------------ */

const memoryStore = new Map();

function readStore(key) {
    try {
        const value = window.localStorage.getItem(key);
        if (value !== null) return value;
    } catch (err) {
        /* storage blocked (private mode) — fall through to memory */
    }
    return memoryStore.has(key) ? memoryStore.get(key) : null;
}

function writeStore(key, value) {
    memoryStore.set(key, value);
    try {
        window.localStorage.setItem(key, value);
    } catch (err) {
        /* ignore quota / private mode errors — memory copy still works */
    }
}

function readJSON(key, fallback) {
    const raw = readStore(key);
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        writeStore(key, JSON.stringify(value));
    } catch (err) {
        /* ignore */
    }
}

const CART_KEY = 'jannat_cart';
const WISHLIST_KEY = 'jannat_wishlist';
const RECENT_KEY = 'jannat_recent';
const CHECKOUT_KEY = 'jannat_checkout_info';

/* ------------------------------------------------------------------ */
/* Tiny event bus                                                      */
/* ------------------------------------------------------------------ */

const listeners = { cart: new Set(), wishlist: new Set() };

function emit(channel) {
    listeners[channel].forEach((fn) => {
        try {
            fn();
        } catch (err) {
            console.error('[store] listener error', err);
        }
    });
}

export function onCartChange(fn) {
    listeners.cart.add(fn);
    return () => listeners.cart.delete(fn);
}

export function onWishlistChange(fn) {
    listeners.wishlist.add(fn);
    return () => listeners.wishlist.delete(fn);
}

/* ------------------------------------------------------------------ */
/* Cart (with colour variants + 1.0 migration)                         */
/* ------------------------------------------------------------------ */

export function variantKey(productId, colorName) {
    return String(productId) + '::' + (colorName ? String(colorName) : '');
}

function normalizeCartItem(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const id = sanitizeText(entry.id, 120);
    if (!id) return null;

    const price = Number(entry.price);
    const qty = Number(entry.qty);
    const color = entry.color ? sanitizeText(entry.color, 40) : '';

    return {
        key: entry.key && typeof entry.key === 'string' ? entry.key : variantKey(id, color),
        id,
        name: sanitizeText(entry.name, 140) || 'Product',
        price: Number.isFinite(price) && price >= 0 ? Math.round(price) : 0,
        // `imageUrl` is the 1.0 field name — keep reading it so old carts survive.
        image: safeImage(entry.image || entry.imageUrl),
        color,
        colorHex: color ? normalizeHex(entry.colorHex) : '',
        qty: Number.isFinite(qty) && qty > 0 ? Math.min(Math.trunc(qty), MAX_QTY_PER_ITEM) : 1
    };
}

let cartItems = (function loadCart() {
    const raw = readJSON(CART_KEY, []);
    if (!Array.isArray(raw)) return [];
    const merged = [];
    raw.forEach((entry) => {
        const item = normalizeCartItem(entry);
        if (!item) return;
        const existing = merged.find((i) => i.key === item.key);
        if (existing) {
            existing.qty = Math.min(existing.qty + item.qty, MAX_QTY_PER_ITEM);
        } else {
            merged.push(item);
        }
    });
    return merged;
})();

function persistCart() {
    writeJSON(CART_KEY, cartItems);
    emit('cart');
}

export function getCart() {
    return cartItems.map((item) => Object.assign({}, item));
}

export function cartCount() {
    return cartItems.reduce((sum, item) => sum + item.qty, 0);
}

export function cartSubtotal() {
    return cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function cartLineCount() {
    return cartItems.length;
}

export function findCartItem(key) {
    const item = cartItems.find((i) => i.key === key);
    return item ? Object.assign({}, item) : null;
}

export function cartQtyForProduct(productId) {
    return cartItems
        .filter((item) => item.id === String(productId))
        .reduce((sum, item) => sum + item.qty, 0);
}

/**
 * Add a product (optionally a colour variant) to the cart.
 * Returns { ok, reason, qty } — never throws.
 */
export function addToCart(product, options) {
    const opts = options || {};
    if (!product || !product.id) return { ok: false, reason: 'missing' };

    const stock = Math.max(0, Number(product.stock) || 0);
    if (stock <= 0) return { ok: false, reason: 'out-of-stock' };

    const colors = productColors(product);
    let color = opts.color ? sanitizeText(opts.color, 40) : '';
    if (colors.length) {
        const match = colors.find((c) => c.name.toLowerCase() === color.toLowerCase());
        if (!match) return { ok: false, reason: 'color-required', colors };
        color = match.name;
    } else {
        color = '';
    }

    const colorHex = color ? (colors.find((c) => c.name === color) || {}).hex || '' : '';
    const requested = Math.max(1, Math.trunc(Number(opts.qty) || 1));
    const key = variantKey(product.id, color);

    // Total units of this product already reserved across all of its variants.
    const otherVariants = cartItems
        .filter((item) => item.id === product.id && item.key !== key)
        .reduce((sum, item) => sum + item.qty, 0);

    const existing = cartItems.find((item) => item.key === key);
    const currentQty = existing ? existing.qty : 0;
    const roomLeft = Math.min(stock - otherVariants, MAX_QTY_PER_ITEM) - currentQty;

    if (roomLeft <= 0) return { ok: false, reason: 'max-stock', qty: currentQty };

    const addQty = Math.min(requested, roomLeft);
    const images = productImages(product);

    if (existing) {
        existing.qty += addQty;
        existing.price = Math.round(Number(product.price) || existing.price);
        existing.name = product.name || existing.name;
        existing.image = images[0];
    } else {
        cartItems.push({
            key,
            id: String(product.id),
            name: sanitizeText(product.name, 140) || 'Product',
            price: Math.round(Number(product.price) || 0),
            image: images[0],
            color,
            colorHex,
            qty: addQty
        });
    }

    persistCart();
    return {
        ok: true,
        reason: addQty < requested ? 'partial' : 'added',
        qty: addQty,
        color
    };
}

/** Set an absolute quantity. `max` caps it against live stock. */
export function setCartQty(key, qty, max) {
    const item = cartItems.find((i) => i.key === key);
    if (!item) return { ok: false, reason: 'missing' };

    const target = Math.trunc(Number(qty));
    if (!Number.isFinite(target) || target <= 0) {
        return removeFromCart(key);
    }

    const ceiling = Number.isFinite(Number(max)) ? Math.max(1, Math.trunc(Number(max))) : MAX_QTY_PER_ITEM;
    const capped = Math.min(target, ceiling, MAX_QTY_PER_ITEM);
    const clamped = capped < target;

    item.qty = capped;
    persistCart();
    return { ok: true, reason: clamped ? 'max-stock' : 'updated', qty: capped };
}

export function changeCartQty(key, delta, max) {
    const item = cartItems.find((i) => i.key === key);
    if (!item) return { ok: false, reason: 'missing' };
    return setCartQty(key, item.qty + Number(delta || 0), max);
}

export function removeFromCart(key) {
    const before = cartItems.length;
    cartItems = cartItems.filter((item) => item.key !== key);
    if (cartItems.length === before) return { ok: false, reason: 'missing' };
    persistCart();
    return { ok: true, reason: 'removed' };
}

export function clearCart() {
    cartItems = [];
    persistCart();
}

/** Drop lines whose product disappeared and re-sync names/prices/stock caps. */
export function reconcileCart(products) {
    if (!Array.isArray(products) || !products.length) return { removed: 0, adjusted: 0 };

    const byId = new Map(products.map((p) => [p.id, p]));
    let removed = 0;
    let adjusted = 0;
    const perProduct = new Map();

    const next = [];
    cartItems.forEach((item) => {
        const product = byId.get(item.id);
        if (!product) {
            removed++;
            return;
        }

        // Variant no longer offered -> drop the colour but keep the item.
        const colors = productColors(product);
        if (item.color && colors.length && !colors.some((c) => c.name === item.color)) {
            removed++;
            return;
        }
        if (item.color && !colors.length) {
            item.color = '';
            item.colorHex = '';
            item.key = variantKey(item.id, '');
            adjusted++;
        }

        const used = perProduct.get(item.id) || 0;
        const room = Math.max(0, product.stock - used);
        if (room <= 0) {
            removed++;
            return;
        }
        if (item.qty > room) {
            item.qty = room;
            adjusted++;
        }
        perProduct.set(item.id, used + item.qty);

        const nextPrice = Math.round(Number(product.price) || 0);
        if (nextPrice !== item.price) {
            item.price = nextPrice;
            adjusted++;
        }
        item.name = product.name;
        item.image = product.image;
        next.push(item);
    });

    if (removed || adjusted) {
        // Stripping a colour can collide with an existing colourless line,
        // so merge any duplicate keys before persisting.
        const merged = [];
        next.forEach((item) => {
            const existing = merged.find((i) => i.key === item.key);
            if (existing) {
                existing.qty = Math.min(existing.qty + item.qty, MAX_QTY_PER_ITEM);
                adjusted++;
            } else {
                merged.push(item);
            }
        });
        cartItems = merged;
        persistCart();
    }
    return { removed, adjusted };
}

/* ------------------------------------------------------------------ */
/* Wishlist                                                            */
/* ------------------------------------------------------------------ */

let wishlistIds = (function loadWishlist() {
    const raw = readJSON(WISHLIST_KEY, []);
    if (!Array.isArray(raw)) return [];
    const out = [];
    raw.forEach((id) => {
        const clean = sanitizeText(id, 120);
        if (clean && !out.includes(clean)) out.push(clean);
    });
    return out;
})();

export function getWishlist() {
    return wishlistIds.slice();
}

export function wishlistCount() {
    return wishlistIds.length;
}

export function isWishlisted(productId) {
    return wishlistIds.includes(String(productId));
}

export function toggleWishlist(productId) {
    const id = sanitizeText(productId, 120);
    if (!id) return { ok: false, added: false };
    const index = wishlistIds.indexOf(id);
    if (index > -1) {
        wishlistIds.splice(index, 1);
    } else {
        wishlistIds.push(id);
    }
    writeJSON(WISHLIST_KEY, wishlistIds);
    emit('wishlist');
    return { ok: true, added: index === -1 };
}

export function removeFromWishlist(productId) {
    const id = String(productId);
    if (!wishlistIds.includes(id)) return;
    wishlistIds = wishlistIds.filter((x) => x !== id);
    writeJSON(WISHLIST_KEY, wishlistIds);
    emit('wishlist');
}

/* ------------------------------------------------------------------ */
/* Recently viewed                                                     */
/* ------------------------------------------------------------------ */

export function pushRecentlyViewed(productId, maxItems = 8) {
    const id = sanitizeText(productId, 120);
    if (!id) return;
    const current = readJSON(RECENT_KEY, []);
    const list = Array.isArray(current) ? current.filter((x) => typeof x === 'string' && x !== id) : [];
    list.unshift(id);
    writeJSON(RECENT_KEY, list.slice(0, maxItems));
}

export function getRecentlyViewed() {
    const list = readJSON(RECENT_KEY, []);
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
}

/* ------------------------------------------------------------------ */
/* Saved checkout details (convenience, never sensitive)               */
/* ------------------------------------------------------------------ */

export function getSavedCheckout() {
    const saved = readJSON(CHECKOUT_KEY, null);
    if (!saved || typeof saved !== 'object') return null;
    return {
        name: sanitizeText(saved.name, 80),
        phone: sanitizeText(saved.phone, 24),
        address: sanitizeText(saved.address, 300),
        location: DELIVERY[saved.location] ? saved.location : DEFAULT_LOCATION
    };
}

export function saveCheckout(info) {
    if (!info) return;
    writeJSON(CHECKOUT_KEY, {
        name: sanitizeText(info.name, 80),
        phone: sanitizeText(info.phone, 24),
        address: sanitizeText(info.address, 300),
        location: DELIVERY[info.location] ? info.location : DEFAULT_LOCATION
    });
}

/* ------------------------------------------------------------------ */
/* Delivery + validation                                               */
/* ------------------------------------------------------------------ */

export function deliveryFeeFor(location) {
    const fee = DELIVERY[location];
    return Number.isFinite(fee) ? fee : DELIVERY[DEFAULT_LOCATION];
}

/** Bangladeshi mobile numbers: 01XXXXXXXXX, optionally +88 prefixed. */
export function normalizePhone(value) {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (/^8801\d{9}$/.test(digits)) return '0' + digits.slice(3);
    if (/^01\d{9}$/.test(digits)) return digits;
    if (/^1\d{9}$/.test(digits)) return '0' + digits;
    return '';
}

export function isValidPhone(value) {
    return normalizePhone(value) !== '';
}

/**
 * Validate the checkout form.
 * Returns { valid, errors: { field: message }, values }
 */
export function validateCheckout(input) {
    const errors = {};
    const name = sanitizeText(input && input.name, 80);
    const address = sanitizeText(input && input.address, 300);
    const phoneRaw = sanitizeText(input && input.phone, 24);
    const phone = normalizePhone(phoneRaw);
    const notes = sanitizeText(input && input.notes, 500);
    const location = DELIVERY[input && input.location] ? input.location : DEFAULT_LOCATION;

    if (name.length < 2) errors.name = 'Please enter your full name.';
    if (!/^[\p{L}\p{M}\s.'-]+$/u.test(name) && name.length >= 2) {
        errors.name = 'Name can only contain letters, spaces, apostrophes and hyphens.';
    }
    if (address.length < 10) errors.address = 'Please enter a complete delivery address (min 10 characters).';
    if (!phone) errors.phone = 'Enter a valid Bangladeshi mobile number, e.g. 01712345678.';

    return {
        valid: Object.keys(errors).length === 0,
        errors,
        values: { name, address, phone, notes, location }
    };
}

/** Short, human-friendly order reference, e.g. JB-7K3M9Q. */
export function generateOrderCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    const bytes = new Uint8Array(6);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        window.crypto.getRandomValues(bytes);
        for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
    } else {
        for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return 'JB-' + out;
}

/* ------------------------------------------------------------------ */
/* Misc helpers                                                        */
/* ------------------------------------------------------------------ */

export function debounce(fn, wait = 220) {
    let timer = null;
    return function debounced(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

export function productUrl(productId) {
    return 'product.html?id=' + encodeURIComponent(productId);
}

export function absoluteProductUrl(productId) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return base + productUrl(productId);
}

/** Copy text to the clipboard with a document.execCommand fallback. */
export async function copyText(text) {
    const value = String(text || '');
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (err) {
        /* fall through */
    }
    try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch (err) {
        return false;
    }
}

// Keep tabs in sync: another tab changing the cart/wishlist updates this one.
window.addEventListener('storage', (event) => {
    if (event.key === CART_KEY) {
        const raw = readJSON(CART_KEY, []);
        cartItems = Array.isArray(raw)
            ? raw.map(normalizeCartItem).filter(Boolean)
            : [];
        emit('cart');
    }
    if (event.key === WISHLIST_KEY) {
        const raw = readJSON(WISHLIST_KEY, []);
        wishlistIds = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
        emit('wishlist');
    }
});
