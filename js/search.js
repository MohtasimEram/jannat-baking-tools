// ========================================================================
// JANNAT BAKING TOOLS — PRODUCT SEARCH
//
// Two parts:
//   1. createSearchIndex(products)  -> search(query) returns products ranked
//      by relevance. Forgiving: case-insensitive, matches the start of words
//      ("sil" -> "Silicone"), ignores plural "s" ("molds" -> "mold"), and
//      tolerates a small typo ("silcone" -> "Silicone"). Works with Bangla.
//   2. initSearchSuggest(...)  -> the "suggestions as you type" dropdown that
//      sits under a search input (mouse, touch and keyboard friendly).
// ========================================================================

import { escapeHtml, escapeAttr, formatBDT, safeImage, optimizeImage, productUrl, categoryLabel } from './store.js';

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

/** Lower-case, strip accents / punctuation, keep letters, numbers and Bangla marks. */
export function normalizeText(value) {
    return String(value === null || value === undefined ? '' : value)
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
        .trim();
}

function tokenize(value) {
    const text = normalizeText(value);
    return text ? text.split(' ') : [];
}

/** Edit distance (insert / delete / replace / swap), gives up above `max`. */
function editDistance(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev.push(j);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
            if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, prev2[j - 2] + 1);
            }
            row.push(value);
            if (value < rowMin) rowMin = value;
        }
        if (rowMin > max) return max + 1;
        prev2 = prev;
        prev = row;
    }
    return prev[b.length];
}

/** How well does one query word match one text word? 0 = no match. */
function wordScore(q, word, allowFuzzy) {
    if (word === q) return 10;
    if (word.startsWith(q)) return 8;
    // "molds" -> "mold", "cakes" -> "cake"
    if (q.length > 3 && q.endsWith('s') && word.startsWith(q.slice(0, -1))) return 7;
    if (q.length >= 3 && word.includes(q)) return 4;
    // Typo tolerance only for longer words, where one slip is unambiguous
    // ("mold" must never match "gold").
    if (allowFuzzy && q.length >= 5) {
        const allowed = q.length >= 8 ? 2 : 1;
        if (editDistance(q, word, allowed) <= allowed) return 3;
        if (word.length > q.length && editDistance(q, word.slice(0, q.length), 1) <= 1) return 3;
    }
    return 0;
}

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

const FIELD_WEIGHTS = { name: 5, category: 3, colors: 2, description: 1 };

export function createSearchIndex(products) {
    const entries = (products || []).map((product) => ({
        product,
        name: tokenize(product.name),
        nameText: normalizeText(product.name),
        category: tokenize(categoryLabel(product.category)),
        colors: tokenize((product.colors || []).map((c) => c.name).join(' ')),
        description: tokenize(product.description)
    }));

    function scoreWord(entry, q) {
        let best = 0;
        Object.keys(FIELD_WEIGHTS).forEach((field) => {
            const words = entry[field];
            for (let i = 0; i < words.length; i++) {
                const s = wordScore(q, words[i], field !== 'description');
                if (s) {
                    const weighted = s * FIELD_WEIGHTS[field];
                    if (weighted > best) best = weighted;
                    if (s === 10 && field === 'name') break;
                }
            }
        });
        return best;
    }

    /** Returns [{ product, score }] best match first. Every query word must match. */
    function search(query, options) {
        const opts = options || {};
        const words = tokenize(query);
        if (!words.length) return [];

        const results = [];
        entries.forEach((entry) => {
            if (opts.filter && !opts.filter(entry.product)) return;
            let total = 0;
            for (let i = 0; i < words.length; i++) {
                const s = scoreWord(entry, words[i]);
                if (!s) return;
                total += s;
            }
            const phrase = words.join(' ');
            if (entry.nameText === phrase) total += 60;
            else if (entry.nameText.startsWith(phrase)) total += 30;
            else if (entry.nameText.includes(phrase)) total += 15;
            if (entry.product.stock > 0) total += 1;
            results.push({ product: entry.product, score: total });
        });

        results.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
        return results;
    }

    return { search };
}

/* ------------------------------------------------------------------ */
/* Highlighting                                                        */
/* ------------------------------------------------------------------ */

/** Escapes `text` and wraps the parts that start with a query word in <mark>. */
export function highlightHTML(text, query) {
    const raw = String(text || '');
    const words = tokenize(query).filter((w) => w.length > 0);
    if (!words.length) return escapeHtml(raw);

    const lower = raw.toLowerCase();
    const ranges = [];
    words.forEach((word) => {
        // Compare against the lower-cased original so offsets stay aligned.
        const candidates = [word];
        if (word.length > 3 && word.endsWith('s')) candidates.push(word.slice(0, -1));
        candidates.forEach((cand) => {
            let from = 0;
            while (from < lower.length) {
                const at = lower.indexOf(cand, from);
                if (at === -1) break;
                const startsWord = at === 0 || !/[\p{L}\p{N}]/u.test(lower[at - 1]);
                if (startsWord) ranges.push([at, at + cand.length]);
                from = at + cand.length;
            }
        });
    });
    if (!ranges.length) return escapeHtml(raw);

    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged = [];
    ranges.forEach((r) => {
        const last = merged[merged.length - 1];
        if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
        else merged.push(r.slice());
    });

    let out = '';
    let cursor = 0;
    merged.forEach(([start, end]) => {
        out += escapeHtml(raw.slice(cursor, start));
        out += '<mark>' + escapeHtml(raw.slice(start, end)) + '</mark>';
        cursor = end;
    });
    return out + escapeHtml(raw.slice(cursor));
}

/* ------------------------------------------------------------------ */
/* Suggestions dropdown                                                */
/* ------------------------------------------------------------------ */

const MAX_SUGGESTIONS = 6;
let uid = 0;

/**
 * Attaches a suggestions dropdown to `input`.
 *
 * options:
 *   host        element the dropdown is appended to (must be position:relative)
 *   getIndex()  returns the current search index, or null while loading
 *   isFailed()  true if the catalogue could not be loaded
 *   onSeeAll(q) called when the visitor chooses "See all results"
 *
 * Returns { refresh, close }.
 */
export function initSearchSuggest(input, options) {
    const opts = options || {};
    const host = opts.host || input.parentElement;
    const id = 'search-suggest-' + ++uid;

    const box = document.createElement('div');
    box.className = 'search-suggest';
    box.id = id;
    box.setAttribute('role', 'listbox');
    box.setAttribute('aria-label', 'Search suggestions');
    box.hidden = true;
    host.appendChild(box);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', id);

    let items = []; // [{ el, href|null }]
    let active = -1;
    let lastQuery = '';

    function setActive(next) {
        if (active >= 0 && items[active]) {
            items[active].el.classList.remove('is-active');
            items[active].el.setAttribute('aria-selected', 'false');
        }
        active = next;
        if (active >= 0 && items[active]) {
            const el = items[active].el;
            el.classList.add('is-active');
            el.setAttribute('aria-selected', 'true');
            input.setAttribute('aria-activedescendant', el.id);
            if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    function close() {
        box.hidden = true;
        box.innerHTML = '';
        items = [];
        active = -1;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    function isOpen() {
        return !box.hidden;
    }

    function message(text) {
        box.innerHTML = '<div class="search-suggest-msg">' + escapeHtml(text) + '</div>';
        items = [];
        active = -1;
        box.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    }

    function render() {
        const query = input.value.trim();
        lastQuery = query;
        if (!normalizeText(query)) {
            close();
            return;
        }

        const index = opts.getIndex ? opts.getIndex() : null;
        if (!index) {
            if (opts.isFailed && opts.isFailed()) message('Search is unavailable right now.');
            else message('Loading products…');
            return;
        }

        const results = index.search(query);
        if (!results.length) {
            message('No products match “' + query.slice(0, 40) + '”');
            return;
        }

        const top = results.slice(0, MAX_SUGGESTIONS);
        let html = '';
        top.forEach(({ product }, i) => {
            const out = product.stock <= 0;
            html +=
                '<a class="search-suggest-item" role="option" aria-selected="false" id="' + id + '-' + i + '"' +
                ' href="' + escapeAttr(productUrl(product.id)) + '">' +
                '<img src="' + escapeAttr(optimizeImage(safeImage(product.image), 96)) + '" alt="" width="44" height="44" loading="lazy" decoding="async">' +
                '<span class="search-suggest-text">' +
                '<span class="search-suggest-name">' + highlightHTML(product.name, query) + '</span>' +
                '<span class="search-suggest-meta">' + escapeHtml(categoryLabel(product.category)) + (out ? ' · Out of stock' : '') + '</span>' +
                '</span>' +
                '<span class="search-suggest-price">' + escapeHtml(formatBDT(product.price)) + '</span>' +
                '</a>';
        });
        html +=
            '<button type="button" class="search-suggest-all" role="option" aria-selected="false" id="' + id + '-all">' +
            'See all ' + results.length + (results.length === 1 ? ' result' : ' results') + ' for “' + escapeHtml(query.slice(0, 40)) + '”' +
            '</button>';
        box.innerHTML = html;
        box.hidden = false;
        input.setAttribute('aria-expanded', 'true');

        items = Array.from(box.querySelectorAll('.search-suggest-item, .search-suggest-all')).map((el) => ({
            el,
            href: el.tagName === 'A' ? el.getAttribute('href') : null
        }));
        active = -1;
    }

    function seeAll() {
        const query = input.value.trim();
        close();
        if (opts.onSeeAll) opts.onSeeAll(query);
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', () => {
        if (input.value.trim()) render();
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!isOpen()) {
                if (input.value.trim()) render();
                if (!isOpen()) return;
            }
            if (!items.length) return;
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const next = active === -1
                ? (step === 1 ? 0 : items.length - 1)
                : (active + step + items.length) % items.length;
            setActive(next);
            return;
        }
        if (event.key === 'Enter' && isOpen() && active >= 0 && items[active]) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const chosen = items[active];
            if (chosen.href) window.location.href = chosen.href;
            else seeAll();
            return;
        }
        if (event.key === 'Escape' && isOpen()) {
            // First Escape closes the list; a second one (handled by the caller) clears the text.
            // preventDefault stops the browser's own "clear a search field" shortcut.
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
        }
        if (event.key === 'Tab') close();
    });

    // mousedown (not click) so the choice registers before the input loses focus.
    // Product rows are real links: we only stop the input from blurring and let
    // the browser follow the link normally (so ctrl/middle-click still work).
    box.addEventListener('mousedown', (event) => {
        if (event.target.closest('.search-suggest-all')) {
            event.preventDefault();
            seeAll();
        } else {
            event.preventDefault();
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (!isOpen()) return;
        if (box.contains(event.target) || input.contains(event.target)) return;
        close();
    });
    document.addEventListener('touchstart', (event) => {
        if (!isOpen()) return;
        if (box.contains(event.target) || input === event.target) return;
        close();
    }, { passive: true });

    input.addEventListener('blur', () => {
        // Delay so a tap on a suggestion is not swallowed.
        setTimeout(() => {
            if (document.activeElement !== input && !box.contains(document.activeElement)) close();
        }, 150);
    });

    return {
        /** Re-render with fresh data (e.g. after the catalogue finished loading). */
        refresh() {
            if (document.activeElement === input && input.value.trim()) render();
            else if (isOpen() && lastQuery) render();
        },
        close
    };
}
