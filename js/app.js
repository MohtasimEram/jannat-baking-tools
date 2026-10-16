// ========================================================================
// JANNAT BAKING TOOLS 2.0 — SHOP HOME
// ========================================================================

import { db, collection, getDocs } from './firebase.js';
import {
    CATEGORIES,
    normalizeProduct,
    reconcileCart,
    getRecentlyViewed,
    categoryLabel,
    escapeHtml,
    escapeAttr,
    formatBDT,
    safeImage,
    optimizeImage,
    imageSrcset,
    linkify,
    stockState,
    productUrl,
    absoluteProductUrl,
    copyText,
    debounce,
    addToCart
} from './store.js';
import {
    mountChrome,
    showToast,
    setProductLookup,
    productCardHTML,
    skeletonCardsHTML,
    initReveal,
    syncWishlistHearts,
    bumpCartIcon,
    renderWishlistDrawer,
    ICONS
} from './ui.js';
import { createSearchIndex, initSearchSuggest } from './search.js';

/* ------------------------------------------------------------------ */
/* Legacy deep links: index.html?product=ID -> product.html?id=ID      */
/* ------------------------------------------------------------------ */
(function redirectLegacyProductLink() {
    try {
        const params = new URLSearchParams(window.location.search);
        const legacyId = params.get('product');
        if (legacyId) {
            window.location.replace(productUrl(legacyId));
        }
    } catch (err) {
        /* ignore */
    }
})();

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let products = [];
let productsById = new Map();
let loadFailed = false;
let searchIndex = null;
const suggesters = [];

const filters = {
    category: 'all',
    search: '',
    sort: 'default',
    inStockOnly: false
};

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    mountChrome({ page: 'home' });
    setProductLookup((id) => productsById.get(String(id)) || null);

    readFiltersFromUrl();
    renderCategoryPills();
    renderFooterCategories();
    bindControls();
    bindQuickView();

    const grid = document.getElementById('product-grid');
    if (grid) grid.innerHTML = skeletonCardsHTML(8);

    loadProducts();
});

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

async function loadProducts() {
    const grid = document.getElementById('product-grid');
    try {
        const snapshot = await getDocs(collection(db, 'products'));
        products = snapshot.docs.map((docSnap) => normalizeProduct(docSnap.id, docSnap.data()));
        productsById = new Map(products.map((p) => [p.id, p]));
        loadFailed = false;
        searchIndex = createSearchIndex(products);
        suggesters.forEach((s) => s.refresh());

        const result = reconcileCart(products);
        if (result.removed > 0) {
            showToast('Some cart items are no longer available and were removed.', 'warning', 4500);
        } else if (result.adjusted > 0) {
            showToast('Your cart was updated to match current stock and prices.', 'info', 4500);
        }

        renderFeatured();
        renderGrid();
        renderRecentlyViewed();
        renderWishlistDrawer();
    } catch (error) {
        console.error('[shop] failed to load products', error);
        loadFailed = true;
        suggesters.forEach((s) => s.refresh());
        if (grid) {
            grid.setAttribute('aria-busy', 'false');
            grid.innerHTML = `
<div class="col-span-full" style="grid-column:1/-1">
    <div class="panel p-10 text-center">
        <div class="empty-state-icon">${ICONS.alert}</div>
        <h3 class="font-serif text-lg font-bold text-text mb-2">We couldn't load the shop</h3>
        <p class="text-sm text-text-muted mb-5">Please check your internet connection and try again.</p>
        <button type="button" id="retry-load" class="btn btn-primary btn-sm">Try again</button>
    </div>
</div>`;
            const retry = document.getElementById('retry-load');
            if (retry) {
                retry.addEventListener('click', () => {
                    grid.innerHTML = skeletonCardsHTML(8);
                    grid.setAttribute('aria-busy', 'true');
                    loadProducts();
                });
            }
        }
        showToast('Failed to load products. Please try again.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/* URL <-> filters                                                     */
/* ------------------------------------------------------------------ */

function readFiltersFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const cat = params.get('cat');
        if (cat && (cat === 'all' || CATEGORIES.some((c) => c.id === cat))) filters.category = cat;
        const q = params.get('q');
        if (q) filters.search = q.slice(0, 80);
        const sort = params.get('sort');
        if (sort) filters.sort = sort;
    } catch (err) {
        /* ignore */
    }
}

const syncUrl = debounce(() => {
    try {
        const url = new URL(window.location.href);
        const set = (key, value, fallback) => {
            if (value && value !== fallback) url.searchParams.set(key, value);
            else url.searchParams.delete(key);
        };
        set('cat', filters.category, 'all');
        set('q', filters.search, '');
        set('sort', filters.sort, 'default');
        window.history.replaceState({}, '', url);
    } catch (err) {
        /* ignore */
    }
}, 350);

/* ------------------------------------------------------------------ */
/* Static chrome rendering                                             */
/* ------------------------------------------------------------------ */

function renderCategoryPills() {
    const host = document.getElementById('category-filters');
    if (!host) return;
    const all = [{ id: 'all', label: 'All items' }].concat(CATEGORIES);
    host.innerHTML = all
        .map(
            (cat) => `
<button type="button" class="category-pill${filters.category === cat.id ? ' active' : ''}"
        data-cat="${escapeAttr(cat.id)}" aria-pressed="${filters.category === cat.id}">${escapeHtml(cat.label)}</button>`
        )
        .join('');

    host.addEventListener('click', (event) => {
        const pill = event.target.closest('[data-cat]');
        if (!pill) return;
        setCategory(pill.dataset.cat);
    });
}

function renderFooterCategories() {
    const host = document.getElementById('footer-categories');
    if (!host) return;
    host.innerHTML =
        '<li><a href="index.html#products-section" class="text-text-secondary hover:text-primary transition-colors">All products</a></li>' +
        CATEGORIES.map(
            (cat) =>
                `<li><a href="index.html?cat=${encodeURIComponent(cat.id)}#products-section" class="text-text-secondary hover:text-primary transition-colors">${escapeHtml(cat.label)}</a></li>`
        ).join('');
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function syncCategoryPills(category) {
    document.querySelectorAll('.category-pill').forEach((pill) => {
        const active = pill.dataset.cat === category;
        pill.classList.toggle('active', active);
        pill.setAttribute('aria-pressed', String(active));
    });
}

function setCategory(category) {
    filters.category = category;
    syncCategoryPills(category);
    renderGrid();
    syncUrl();
}

/**
 * Applies the search text to the product grid.
 * `fromUser` is true when the visitor typed it: a category filter that would
 * hide matches from the rest of the shop is reset, so a search always looks
 * through every product.
 */
function setSearch(value, sourceId, fromUser) {
    filters.search = String(value || '').slice(0, 80);
    if (fromUser && filters.search.trim() && filters.category !== 'all') {
        filters.category = 'all';
        syncCategoryPills('all');
    }
    ['search-input', 'search-input-mobile'].forEach((id) => {
        if (id === sourceId) return;
        const input = document.getElementById(id);
        if (input && input.value !== filters.search) input.value = filters.search;
    });
    ['search-clear', 'search-clear-mobile'].forEach((id) => {
        const clear = document.getElementById(id);
        if (clear) clear.classList.toggle('is-visible', filters.search.length > 0);
    });
    renderGrid();
    syncUrl();
}

function scrollToProducts() {
    const section = document.getElementById('products-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindControls() {
    const debouncedSearch = debounce((value, id) => setSearch(value, id, true), 150);

    ['search-input', 'search-input-mobile'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.value = filters.search;

        // Created BEFORE the key handler below so its Escape / Enter handling
        // (close the list, open the highlighted product) runs first.
        const suggest = initSearchSuggest(input, {
            host: input.parentElement,
            getIndex: () => searchIndex,
            isFailed: () => loadFailed,
            onSeeAll: (query) => {
                setSearch(query, id, true);
                scrollToProducts();
            }
        });
        suggesters.push(suggest);

        input.addEventListener('input', () => debouncedSearch(input.value, id));
        input.addEventListener('search', () => setSearch(input.value, id, true));
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                suggest.close();
                setSearch(input.value, id, true);
                scrollToProducts();
            }
            if (event.key === 'Escape') {
                input.value = '';
                suggest.close();
                setSearch('', id, true);
            }
        });
    });

    [['search-clear', 'search-input'], ['search-clear-mobile', 'search-input-mobile']].forEach(([clearId, inputId]) => {
        const clear = document.getElementById(clearId);
        if (!clear) return;
        clear.classList.toggle('is-visible', filters.search.length > 0);
        clear.addEventListener('click', () => {
            const input = document.getElementById(inputId);
            if (input) input.value = '';
            suggesters.forEach((s) => s.close());
            setSearch('', '', true);
            if (input) input.focus();
        });
    });

    const mobileSearchBtn = document.getElementById('mobile-search-btn');
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            const input = document.getElementById('search-input-mobile') || document.getElementById('search-input');
            if (!input) return;
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => input.focus({ preventScroll: true }), 320);
        });
    }

    const sort = document.getElementById('sort-select');
    if (sort) {
        if (sort.querySelector('option[value="' + filters.sort + '"]')) sort.value = filters.sort;
        else filters.sort = 'default';
        sort.addEventListener('change', () => {
            filters.sort = sort.value;
            renderGrid();
            syncUrl();
        });
    }

    const inStock = document.getElementById('instock-toggle');
    if (inStock) {
        inStock.addEventListener('change', () => {
            filters.inStockOnly = inStock.checked;
            renderGrid();
        });
    }

    const recentClear = document.getElementById('recent-clear');
    if (recentClear) {
        recentClear.addEventListener('click', () => {
            try {
                window.localStorage.removeItem('jannat_recent');
            } catch (err) {
                /* ignore */
            }
            const section = document.getElementById('recent-section');
            if (section) section.classList.add('hidden');
        });
    }
}

/* ------------------------------------------------------------------ */
/* Filtering + grid                                                    */
/* ------------------------------------------------------------------ */

function visibleProducts() {
    const allowed = (p) =>
        (filters.category === 'all' || p.category === filters.category) &&
        (!filters.inStockOnly || p.stock > 0);

    const term = filters.search.trim();
    if (term && searchIndex) {
        // Best match first. Only an explicit sort choice overrides relevance.
        const matches = searchIndex.search(term, { filter: allowed }).map((r) => r.product);
        return filters.sort === 'default' ? matches : sortProducts(matches);
    }

    return sortProducts(products.filter(allowed));
}

function sortProducts(list) {
    const sorted = list.slice();
    switch (filters.sort) {
        case 'price-low':
            sorted.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            sorted.sort((a, b) => b.price - a.price);
            break;
        case 'stock-low':
            sorted.sort((a, b) => a.stock - b.stock);
            break;
        case 'name-az':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'newest':
            sorted.sort(byNewest);
            break;
        default:
            // Featured first, then in-stock, then newest.
            sorted.sort((a, b) => {
                if (a.featured !== b.featured) return a.featured ? -1 : 1;
                const aIn = a.stock > 0 ? 0 : 1;
                const bIn = b.stock > 0 ? 0 : 1;
                if (aIn !== bIn) return aIn - bIn;
                return byNewest(a, b);
            });
    }
    return sorted;
}

function byNewest(a, b) {
    const aKey = String(a.createdAt || '');
    const bKey = String(b.createdAt || '');
    if (aKey && bKey) return bKey.localeCompare(aKey);
    if (aKey) return -1;
    if (bKey) return 1;
    return a.name.localeCompare(b.name);
}

function renderGrid() {
    const grid = document.getElementById('product-grid');
    const countEl = document.getElementById('result-count');
    if (!grid || loadFailed) return;

    const list = visibleProducts();
    grid.setAttribute('aria-busy', 'false');

    if (countEl) {
        if (!products.length) {
            countEl.textContent = '';
        } else {
            countEl.textContent =
                list.length + (list.length === 1 ? ' product' : ' products') +
                (filters.category !== 'all' ? ' in ' + categoryLabel(filters.category) : '');
        }
    }

    if (!products.length) {
        grid.innerHTML = `
<div style="grid-column:1/-1">
    <div class="panel p-10 text-center">
        <div class="empty-state-icon">${ICONS.cart}</div>
        <h3 class="font-serif text-lg font-bold text-text mb-2">No products yet</h3>
        <p class="text-sm text-text-muted">New baking essentials are on their way — check back soon.</p>
    </div>
</div>`;
        return;
    }

    if (!list.length) {
        grid.innerHTML = `
<div style="grid-column:1/-1">
    <div class="panel p-10 text-center">
        <div class="empty-state-icon">
            <svg width="18" height="18" class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
        </div>
        <h3 class="font-serif text-lg font-bold text-text mb-2">No matching products</h3>
        <p class="text-sm text-text-muted mb-5">Try a different search term or clear your filters.</p>
        <button type="button" id="reset-filters" class="btn btn-secondary btn-sm">Reset filters</button>
    </div>
</div>`;
        const reset = document.getElementById('reset-filters');
        if (reset) {
            reset.addEventListener('click', () => {
                filters.inStockOnly = false;
                const toggle = document.getElementById('instock-toggle');
                if (toggle) toggle.checked = false;
                setSearch('');
                setCategory('all');
            });
        }
        return;
    }

    grid.innerHTML = list.map((product, index) => productCardHTML(product, { index })).join('');
    initReveal(grid);
    syncWishlistHearts();
}

/* ------------------------------------------------------------------ */
/* Featured + recently viewed rails                                    */
/* ------------------------------------------------------------------ */

function renderFeatured() {
    const section = document.getElementById('featured-section');
    const rail = document.getElementById('featured-rail');
    if (!section || !rail) return;

    // Only products the owner has explicitly marked "Featured" in the admin
    // panel appear here. Nothing is auto-promoted, so with no featured
    // products the whole section stays hidden.
    const list = products
        .filter((p) => p.featured === true && p.stock > 0)
        .sort(byNewest)
        .slice(0, 10);

    if (!list.length) {
        section.classList.add('hidden');
        rail.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');
    rail.innerHTML = list
        .map((product, index) => productCardHTML(product, { index, reveal: false }))
        .join('');
    syncWishlistHearts();
}

function renderRecentlyViewed() {
    const section = document.getElementById('recent-section');
    const rail = document.getElementById('recent-rail');
    if (!section || !rail) return;

    const list = getRecentlyViewed()
        .map((id) => productsById.get(id))
        .filter(Boolean)
        .slice(0, 8);

    if (list.length < 2) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    rail.innerHTML = list
        .map((product, index) => productCardHTML(product, { index, reveal: false }))
        .join('');
    syncWishlistHearts();
}

/* ------------------------------------------------------------------ */
/* Quick view                                                          */
/* ------------------------------------------------------------------ */

let quickViewProduct = null;
let quickViewLastFocus = null;

function bindQuickView() {
    const modal = document.getElementById('quick-view');
    if (!modal) return;

    document.addEventListener('jb:quickview', (event) => {
        const id = event.detail && event.detail.id;
        openQuickView(id);
    });

    modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-qv-close]')) {
            event.preventDefault();
            closeQuickView();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('active')) closeQuickView();
    });

    const addBtn = document.getElementById('qv-add');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (!quickViewProduct) return;
            if (quickViewProduct.colors.length) {
                window.location.href = productUrl(quickViewProduct.id);
                return;
            }
            const result = addToCart(quickViewProduct, { qty: 1 });
            if (result.ok) {
                showToast(quickViewProduct.name + ' added to cart', 'success');
                bumpCartIcon();
                closeQuickView();
            } else if (result.reason === 'max-stock') {
                showToast('No more stock available', 'warning');
            } else {
                showToast('This product is out of stock', 'error');
            }
        });
    }

    const shareBtn = document.getElementById('qv-share');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (!quickViewProduct) return;
            const link = absoluteProductUrl(quickViewProduct.id);
            if (navigator.share) {
                try {
                    await navigator.share({ title: quickViewProduct.name, url: link });
                    return;
                } catch (err) {
                    /* user cancelled — fall back to copy */
                }
            }
            const ok = await copyText(link);
            showToast(ok ? 'Product link copied' : 'Could not copy the link', ok ? 'success' : 'error');
        });
    }
}

function openQuickView(id) {
    const product = productsById.get(String(id));
    const modal = document.getElementById('quick-view');
    if (!product || !modal) {
        if (id) window.location.href = productUrl(id);
        return;
    }

    quickViewProduct = product;
    quickViewLastFocus = document.activeElement;

    const img = document.getElementById('qv-img');
    if (img) {
        img.src = optimizeImage(safeImage(product.image), 900);
        img.srcset = imageSrcset(safeImage(product.image), [480, 720, 960]);
        img.sizes = '(min-width: 768px) 384px, 100vw';
        img.alt = product.name;
    }

    const state = stockState(product.stock);
    const stockEl = document.getElementById('qv-stock');
    if (stockEl) {
        stockEl.className = 'stock-pill ' + state.cls;
        stockEl.textContent = state.label;
    }

    setText('qv-category', categoryLabel(product.category));
    setText('qv-title', product.name);
    const priceEl = document.getElementById('qv-price');
    if (priceEl) priceEl.textContent = formatBDT(product.price);

    const descEl = document.getElementById('qv-desc');
    if (descEl) {
        descEl.innerHTML = product.description
            ? linkify(product.description)
            : '<span class="text-text-muted">No description available.</span>';
    }

    const colorsWrap = document.getElementById('qv-colors-wrap');
    const colorsEl = document.getElementById('qv-colors');
    if (colorsWrap && colorsEl) {
        if (product.colors.length) {
            colorsWrap.classList.remove('hidden');
            colorsEl.innerHTML = product.colors
                .map(
                    (c) =>
                        `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-alt border border-border text-xs font-semibold text-text-secondary">
                            <span class="swatch-dot" style="background:${escapeAttr(c.hex)}"></span>${escapeHtml(c.name)}
                        </span>`
                )
                .join('');
        } else {
            colorsWrap.classList.add('hidden');
            colorsEl.innerHTML = '';
        }
    }

    const details = document.getElementById('qv-details');
    if (details) details.href = productUrl(product.id);

    const addBtn = document.getElementById('qv-add');
    if (addBtn) {
        const out = product.stock <= 0;
        addBtn.disabled = out;
        addBtn.textContent = out ? 'Out of stock' : product.colors.length ? 'Choose colour' : 'Add to cart';
    }

    const social = document.getElementById('qv-social');
    if (social) {
        if (product.socialLink) {
            social.href = product.socialLink;
            social.classList.remove('hidden');
        } else {
            social.classList.add('hidden');
            social.removeAttribute('href');
        }
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');

    const closeBtn = modal.querySelector('[data-qv-close]');
    if (closeBtn && typeof closeBtn.focus === 'function') {
        setTimeout(() => {
            try { closeBtn.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
        }, 60);
    }
}

function closeQuickView() {
    const modal = document.getElementById('quick-view');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    quickViewProduct = null;
    if (quickViewLastFocus && typeof quickViewLastFocus.focus === 'function') {
        try { quickViewLastFocus.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
