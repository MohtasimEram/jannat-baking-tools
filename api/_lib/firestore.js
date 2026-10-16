// ========================================================================
// Shared server-side helpers: read the public product catalogue from
// Firestore over its REST API (no SDK / no package.json needed).
//
// Products are world-readable per firestore.rules, so no credentials are
// required here beyond the public web API key that is already shipped to
// every browser in js/firebase.js.
// ========================================================================

'use strict';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'jannat-baking-tools-web-15b09';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAZUnF_3TU3qoZCXYoCg4SvmMPlESjMx_g';
const SITE_URL = (process.env.SITE_URL || 'https://jannatbakingtools.vercel.app').replace(/\/+$/, '');

const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

/** Firestore REST "typed value" -> plain JS value. */
function decodeValue(v) {
    if (!v || typeof v !== 'object') return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(decodeValue);
    if ('mapValue' in v) return decodeFields((v.mapValue && v.mapValue.fields) || {});
    return null;
}

function decodeFields(fields) {
    const out = {};
    Object.keys(fields || {}).forEach((key) => {
        out[key] = decodeValue(fields[key]);
    });
    return out;
}

function clean(value, max) {
    return String(value === null || value === undefined ? '' : value)
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
}

function safeHttps(url) {
    const raw = String(url || '').trim();
    return /^https?:\/\//i.test(raw) ? raw : '';
}

/** Mirrors normalizeProduct() in js/store.js (server-side subset). */
function normalizeDoc(doc) {
    const id = String(doc.name || '').split('/').pop();
    const raw = decodeFields(doc.fields || {});
    const price = Number(raw.price);
    const stock = Number(raw.stock);

    const images = [];
    (Array.isArray(raw.images) ? raw.images : []).forEach((url) => {
        const clean = safeHttps(url);
        if (clean && !images.includes(clean)) images.push(clean);
    });
    const legacy = safeHttps(raw.imageUrl);
    if (legacy && !images.includes(legacy)) images.push(legacy);

    const colors = [];
    (Array.isArray(raw.colors) ? raw.colors : []).forEach((entry) => {
        const name = clean(typeof entry === 'string' ? entry : entry && entry.name, 40);
        if (name && !colors.includes(name)) colors.push(name);
    });

    return {
        id,
        name: clean(raw.name, 140) || 'Untitled product',
        category: clean(raw.category, 40).toLowerCase(),
        description: clean(raw.description, 2000),
        price: Number.isFinite(price) && price >= 0 ? Math.round(price) : 0,
        stock: Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : 0,
        images,
        colors,
        featured: raw.featured === true,
        updatedAt: raw.updatedAt || raw.createdAt || null
    };
}

async function listProducts() {
    const products = [];
    let pageToken = '';
    // Hard stop at 5 pages x 300 so a runaway collection can't hang the function.
    for (let page = 0; page < 5; page++) {
        const url =
            BASE + '/products?pageSize=300&key=' + encodeURIComponent(API_KEY) +
            (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Firestore list failed: ' + response.status);
        const data = await response.json();
        (data.documents || []).forEach((doc) => products.push(normalizeDoc(doc)));
        if (!data.nextPageToken) break;
        pageToken = data.nextPageToken;
    }
    return products;
}

/** Returns the product, or null when the document does not exist. Throws on other failures. */
async function getProduct(id) {
    const url = BASE + '/products/' + encodeURIComponent(id) + '?key=' + encodeURIComponent(API_KEY);
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Firestore get failed: ' + response.status);
    return normalizeDoc(await response.json());
}

/** Same 1200x630 JPEG crop the browser uses for og:image. */
function socialImage(url) {
    const match = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i.exec(String(url || ''));
    if (!match) return String(url || '');
    if (/^[a-z]{1,3}_[^/,]+(,[a-z]{1,3}_[^/,]+)*$/.test(match[2].split('/')[0])) return String(url);
    return match[1] + 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630/' + match[2];
}

module.exports = { SITE_URL, listProducts, getProduct, socialImage, clean };
