// ========================================================================
// JANNAT BAKING TOOLS 2.0 — PRODUCT DETAIL PAGE
// ========================================================================

import { db, doc, getDoc, collection, getDocs } from './firebase.js';
import {
    normalizeProduct,
    reconcileCart,
    categoryLabel,
    escapeHtml,
    escapeAttr,
    formatBDT,
    safeImage,
    optimizeImage,
    imageSrcset,
    responsiveImgAttrs,
    socialImage,
    linkify,
    stockState,
    absoluteProductUrl,
    copyText,
    addToCart,
    isWishlisted,
    toggleWishlist,
    pushRecentlyViewed,
    onWishlistChange,
    MAX_QTY_PER_ITEM
} from './store.js';
import {
    mountChrome,
    showToast,
    setProductLookup,
    productCardHTML,
    initReveal,
    syncWishlistHearts,
    bumpCartIcon,
    renderWishlistDrawer,
    openCart
} from './ui.js';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let product = null;
let images = [];
let imageIndex = 0;
let selectedColor = '';
let qty = 1;

let catalog = [];
let catalogById = new Map();

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    mountChrome({ page: 'shop' });
    setProductLookup((id) => catalogById.get(String(id)) || null);
    bindAccordions();
    bindGalleryControls();
    bindLightbox();

    const params = new URLSearchParams(window.location.search);
    const id = (params.get('id') || params.get('product') || '').trim();

    if (!id) {
        showNotFound('No product was specified in the link.');
        return;
    }

    loadProduct(id, params.get('color') || '');
    loadCatalog(id);
});

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

async function loadProduct(id, preferredColor) {
    try {
        const snap = await getDoc(doc(db, 'products', id));
        if (!snap.exists()) {
            showNotFound('This product may have been removed or the link is incorrect.');
            return;
        }
        product = normalizeProduct(snap.id, snap.data());
        catalogById.set(product.id, product);
        renderProduct(preferredColor);
        pushRecentlyViewed(product.id);
    } catch (error) {
        console.error('[product] failed to load', error);
        showNotFound('We could not load this product. Please check your connection and try again.');
    }
}

async function loadCatalog(currentId) {
    try {
        const snapshot = await getDocs(collection(db, 'products'));
        catalog = snapshot.docs.map((docSnap) => normalizeProduct(docSnap.id, docSnap.data()));
        catalogById = new Map(catalog.map((p) => [p.id, p]));
        if (product) catalogById.set(product.id, product);

        reconcileCart(catalog);
        renderWishlistDrawer();
        renderRelated(currentId);
    } catch (error) {
        console.warn('[product] related products unavailable', error);
    }
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function showNotFound(message) {
    const loading = document.getElementById('pd-loading');
    const notFound = document.getElementById('pd-notfound');
    const msg = document.getElementById('pd-notfound-msg');
    if (loading) loading.classList.add('hidden');
    if (notFound) notFound.classList.remove('hidden');
    if (msg && message) msg.textContent = message;
    document.title = 'Product not found — Jannat Baking Tools';
}

function renderProduct(preferredColor) {
    const loading = document.getElementById('pd-loading');
    const content = document.getElementById('pd-content');
    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    images = product.images.slice();
    imageIndex = 0;

    applySeo();
    renderBreadcrumbs();
    renderGallery();
    renderInfo();
    renderColors(preferredColor);
    updateQtyUi();
    bindActions();
    initBuyBar();
    initReveal();
}

function applySeo() {
    const title = product.name + ' — Jannat Baking Tools';
    document.title = title;

    setMeta('description',
        (product.description || product.name).slice(0, 160).replace(/\s+/g, ' ').trim());
    setMetaProperty('og:title', product.name);
    setMetaProperty('og:type', 'product');
    setMetaProperty('og:description',
        (product.description || product.name).slice(0, 200).replace(/\s+/g, ' ').trim());
    setMetaProperty('og:image', socialImage(product.image));
    setMetaProperty('og:image:alt', product.name);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:image', socialImage(product.image));
    setMetaProperty('og:url', absoluteProductUrl(product.id));

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', absoluteProductUrl(product.id));

    const data = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': absoluteProductUrl(product.id) + '#product',
        sku: product.id,
        name: product.name,
        description: (product.description || '').slice(0, 500),
        image: product.images,
        category: categoryLabel(product.category),
        brand: { '@type': 'Brand', name: 'Jannat Baking Tools' },
        offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: 'BDT',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', name: 'Jannat Baking Tools' },
            availability: product.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url: absoluteProductUrl(product.id)
        }
    };
    if (product.colors.length) data.color = product.colors.map((c) => c.name).join(', ');

    let script = document.getElementById('pd-jsonld');
    if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'pd-jsonld';
        document.head.appendChild(script);
    }
    // Escaping `<` prevents the JSON payload from closing the script tag.
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
}

function setMeta(name, content) {
    let tag = document.querySelector('meta[name="' + name + '"]');
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
}

function setMetaProperty(property, content) {
    let tag = document.querySelector('meta[property="' + property + '"]');
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
}

function renderBreadcrumbs() {
    const host = document.getElementById('pd-breadcrumbs');
    if (!host) return;
    const catHref = product.category
        ? 'index.html?cat=' + encodeURIComponent(product.category) + '#products-section'
        : 'index.html#products-section';
    host.innerHTML = `
<a href="index.html" class="hover:text-primary transition-colors">Home</a>
<span class="sep" aria-hidden="true">/</span>
<a href="${escapeAttr(catHref)}" class="hover:text-primary transition-colors">${escapeHtml(categoryLabel(product.category))}</a>
<span class="sep" aria-hidden="true">/</span>
<span class="text-text-secondary font-semibold truncate max-w-[16rem]" aria-current="page">${escapeHtml(product.name)}</span>`;
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

function renderGallery() {
    const main = document.getElementById('gallery-main-img');
    const thumbs = document.getElementById('gallery-thumbs');
    const prev = document.getElementById('gallery-prev');
    const next = document.getElementById('gallery-next');
    const counter = document.getElementById('gallery-counter');

    if (main) {
        applyMainImage(main, images[0]);
        main.alt = product.name;
    }

    const multiple = images.length > 1;
    if (prev) prev.classList.toggle('hidden', !multiple);
    if (next) next.classList.toggle('hidden', !multiple);
    if (counter) counter.classList.toggle('hidden', !multiple);

    if (thumbs) {
        if (!multiple) {
            thumbs.innerHTML = '';
        } else {
            thumbs.innerHTML = images
                .map(
                    (url, index) => `
<button type="button" class="gallery-thumb${index === 0 ? ' active' : ''}" data-image-index="${index}"
        role="listitem" aria-label="Show image ${index + 1} of ${images.length}">
    <img ${responsiveImgAttrs(url, { width: 160, widths: [160, 320], sizes: '80px' })} alt="" loading="lazy" decoding="async">
</button>`
                )
                .join('');
        }
    }

    updateCounter();
}

/** Sets the main gallery image with a responsive, auto-format Cloudinary srcset. */
function applyMainImage(img, rawUrl) {
    const safe = safeImage(rawUrl);
    img.src = optimizeImage(safe, 900);
    const set = imageSrcset(safe, [480, 720, 900, 1200]);
    if (set) {
        img.srcset = set;
        img.sizes = '(min-width: 1024px) 560px, 100vw';
    } else {
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
    }
}

function updateCounter() {
    const counter = document.getElementById('gallery-counter');
    if (counter) counter.textContent = imageIndex + 1 + ' / ' + images.length;
}

function showImage(index) {
    if (!images.length) return;
    const total = images.length;
    imageIndex = ((index % total) + total) % total;

    const main = document.getElementById('gallery-main-img');
    if (main) {
        main.style.opacity = '0';
        const raw = images[imageIndex];
        const url = optimizeImage(safeImage(raw), 1000);
        const preload = new Image();
        preload.onload = () => {
            applyMainImage(main, raw);
            main.style.opacity = '1';
        };
        preload.onerror = () => {
            main.src = safeImage(raw);
            main.removeAttribute('srcset');
            main.style.opacity = '1';
        };
        preload.src = url;
    }

    document.querySelectorAll('.gallery-thumb').forEach((thumb) => {
        thumb.classList.toggle('active', Number(thumb.dataset.imageIndex) === imageIndex);
    });
    updateCounter();
    const lightbox = document.getElementById('lightbox');
    if (lightbox && lightbox.classList.contains('open')) {
        syncLightbox();
    }
}

function bindGalleryControls() {
    const thumbs = document.getElementById('gallery-thumbs');
    if (thumbs) {
        thumbs.addEventListener('click', (event) => {
            const thumb = event.target.closest('[data-image-index]');
            if (!thumb) return;
            showImage(Number(thumb.dataset.imageIndex));
        });
    }

    const prev = document.getElementById('gallery-prev');
    const next = document.getElementById('gallery-next');
    if (prev) prev.addEventListener('click', () => showImage(imageIndex - 1));
    if (next) next.addEventListener('click', () => showImage(imageIndex + 1));

    const zoom = document.getElementById('gallery-zoom');
    const main = document.getElementById('gallery-main-img');
    if (zoom) zoom.addEventListener('click', openLightbox);
    if (main) {
        main.style.cursor = 'zoom-in';
        main.addEventListener('click', openLightbox);
    }

    // Swipe on touch devices.
    const stage = document.querySelector('.gallery-main');
    if (stage) {
        let startX = 0;
        let startY = 0;
        let tracking = false;
        stage.addEventListener('touchstart', (event) => {
            if (event.touches.length !== 1) return;
            tracking = true;
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
        }, { passive: true });
        stage.addEventListener('touchend', (event) => {
            if (!tracking || !event.changedTouches.length) return;
            tracking = false;
            const dx = event.changedTouches[0].clientX - startX;
            const dy = event.changedTouches[0].clientY - startY;
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
                showImage(imageIndex + (dx < 0 ? 1 : -1));
            }
        }, { passive: true });
    }

    document.addEventListener('keydown', (event) => {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox || !lightbox.classList.contains('open')) return;
        if (event.key === 'ArrowLeft') {
            showImage(imageIndex - 1);
        } else if (event.key === 'ArrowRight') {
            showImage(imageIndex + 1);
        }
    });
}

function syncLightbox() {
    const img = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    const prev = document.getElementById('lightbox-prev');
    const next = document.getElementById('lightbox-next');

    if (img && images.length) {
        img.src = optimizeImage(safeImage(images[imageIndex]), 1600);
        img.alt = product ? product.name : '';
    }

    const hasMultiple = images.length > 1;
    if (counter) {
        counter.textContent = hasMultiple ? (imageIndex + 1) + ' / ' + images.length : '';
        counter.style.display = hasMultiple ? 'block' : 'none';
    }
    if (prev) {
        prev.style.display = hasMultiple ? 'flex' : 'none';
    }
    if (next) {
        next.style.display = hasMultiple ? 'flex' : 'none';
    }
}

function openLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || !images.length) return;
    syncLightbox();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    const close = document.getElementById('lightbox-close');
    if (close) setTimeout(() => { try { close.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
}

function bindLightbox() {
    const lightbox = document.getElementById('lightbox');
    const close = document.getElementById('lightbox-close');
    const prev = document.getElementById('lightbox-prev');
    const next = document.getElementById('lightbox-next');

    if (close) close.addEventListener('click', closeLightbox);

    if (prev) {
        prev.addEventListener('click', (event) => {
            event.stopPropagation();
            showImage(imageIndex - 1);
        });
    }

    if (next) {
        next.addEventListener('click', (event) => {
            event.stopPropagation();
            showImage(imageIndex + 1);
        });
    }

    if (lightbox) {
        lightbox.addEventListener('click', (event) => {
            if (event.target === lightbox) closeLightbox();
        });

        // Touch swipe support in lightbox on mobile devices
        let touchStartX = 0;
        let touchStartY = 0;
        let isTouching = false;
        lightbox.addEventListener('touchstart', (event) => {
            if (event.touches.length !== 1) return;
            isTouching = true;
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        }, { passive: true });

        lightbox.addEventListener('touchend', (event) => {
            if (!isTouching || !event.changedTouches.length) return;
            isTouching = false;
            const dx = event.changedTouches[0].clientX - touchStartX;
            const dy = event.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                showImage(imageIndex + (dx < 0 ? 1 : -1));
            }
        }, { passive: true });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeLightbox();
    });
}

/* ------------------------------------------------------------------ */
/* Info + colours                                                      */
/* ------------------------------------------------------------------ */

function renderInfo() {
    setText('pd-category', categoryLabel(product.category));
    setText('pd-name', product.name);
    setText('pd-price', formatBDT(product.price));

    const state = stockState(product.stock);
    const stockEl = document.getElementById('pd-stock');
    if (stockEl) {
        stockEl.textContent = state.label;
        stockEl.className =
            'badge ' +
            (state.key === 'out' ? 'badge-error' : state.key === 'in' ? 'badge-success' : 'badge-warning');
    }

    const short = document.getElementById('pd-short');
    if (short) {
        const firstLine = (product.description || '').split(/\n+/)[0] || '';
        short.textContent = firstLine
            ? firstLine.slice(0, 220)
            : 'Premium ' + categoryLabel(product.category).toLowerCase() + ' from Jannat Baking Tools.';
    }

    const desc = document.getElementById('pd-desc');
    if (desc) {
        desc.innerHTML = product.description
            ? linkify(product.description)
            : '<span class="text-text-muted">No additional details provided for this product yet. Message us on WhatsApp and we will help.</span>';
    }

    const socialWrap = document.getElementById('pd-social-wrap');
    const social = document.getElementById('pd-social');
    const socialText = document.getElementById('pd-social-text');
    const socialIcon = document.getElementById('pd-social-icon');
    if (socialWrap && social) {
        if (product.socialLink) {
            socialWrap.classList.remove('hidden');
            social.href = product.socialLink;
            const instagram = /instagram\.com/i.test(product.socialLink);
            if (socialText) socialText.textContent = instagram ? 'View on Instagram' : 'View on Facebook';
            if (socialIcon) {
                socialIcon.innerHTML = instagram
                    ? '<svg width="18" height="18" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>'
                    : '<svg width="18" height="18" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
            }
        } else {
            socialWrap.classList.add('hidden');
            social.removeAttribute('href');
        }
    }

    const whatsapp = document.getElementById('pd-whatsapp');
    if (whatsapp) {
        const text = 'Hi! I would like to know more about: ' + product.name + ' (' + absoluteProductUrl(product.id) + ')';
        whatsapp.href = 'https://wa.me/8801874244466?text=' + encodeURIComponent(text);
    }

    syncWishButton();
    onWishlistChange(syncWishButton);
}

function renderColors(preferredColor) {
    const wrap = document.getElementById('pd-colors-wrap');
    const host = document.getElementById('pd-colors');
    if (!wrap || !host) return;

    if (!product.colors.length) {
        wrap.classList.add('hidden');
        host.innerHTML = '';
        selectedColor = '';
        return;
    }

    wrap.classList.remove('hidden');
    host.innerHTML = product.colors
        .map(
            (color) => `
<button type="button" class="color-option" role="radio" aria-checked="false"
        data-color="${escapeAttr(color.name)}">
    <span class="chip" style="background:${escapeAttr(color.hex)}" aria-hidden="true"></span>
    <span>${escapeHtml(color.name)}</span>
</button>`
        )
        .join('');

    host.addEventListener('click', (event) => {
        const option = event.target.closest('[data-color]');
        if (!option) return;
        selectColor(option.dataset.color);
    });

    host.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const options = Array.prototype.slice.call(host.querySelectorAll('[data-color]'));
        if (!options.length) return;
        const current = options.findIndex((o) => o.dataset.color === selectedColor);
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = ((current < 0 ? 0 : current + step) + options.length) % options.length;
        event.preventDefault();
        selectColor(options[nextIndex].dataset.color);
        options[nextIndex].focus();
    });

    // Auto-select: URL hint first, otherwise the only option available.
    const hinted = product.colors.find(
        (c) => c.name.toLowerCase() === String(preferredColor || '').toLowerCase()
    );
    if (hinted) selectColor(hinted.name);
    else if (product.colors.length === 1) selectColor(product.colors[0].name);
}

function selectColor(name) {
    const match = product.colors.find((c) => c.name === name);
    if (!match) return;
    selectedColor = match.name;

    document.querySelectorAll('#pd-colors [data-color]').forEach((option) => {
        const active = option.dataset.color === selectedColor;
        option.classList.toggle('selected', active);
        option.setAttribute('aria-checked', String(active));
    });

    const label = document.getElementById('pd-color-selected');
    if (label) label.textContent = ' · ' + selectedColor;
    setText('pd-color-error', '');
}

/* ------------------------------------------------------------------ */
/* Quantity                                                            */
/* ------------------------------------------------------------------ */

function maxQty() {
    return Math.max(1, Math.min(product ? product.stock : 1, MAX_QTY_PER_ITEM));
}

function updateQtyUi() {
    const limit = maxQty();
    if (qty > limit) qty = limit;
    if (qty < 1) qty = 1;

    const value = document.getElementById('qty-val');
    const dec = document.getElementById('qty-dec');
    const inc = document.getElementById('qty-inc');
    const note = document.getElementById('pd-stock-note');

    if (value) value.textContent = String(qty);
    if (dec) dec.disabled = qty <= 1 || product.stock <= 0;
    if (inc) inc.disabled = qty >= limit || product.stock <= 0;
    if (note) {
        note.textContent = product.stock <= 0
            ? 'Currently unavailable'
            : product.stock <= 10
                ? 'Only ' + product.stock + ' available'
                : '';
    }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function bindActions() {
    const dec = document.getElementById('qty-dec');
    const inc = document.getElementById('qty-inc');
    if (dec) dec.addEventListener('click', () => { qty -= 1; updateQtyUi(); });
    if (inc) inc.addEventListener('click', () => { qty += 1; updateQtyUi(); });

    const add = document.getElementById('pd-add');
    const buy = document.getElementById('pd-buy');
    const barAdd = document.getElementById('buybar-add');

    const out = product.stock <= 0;
    [add, buy, barAdd].forEach((btn) => {
        if (!btn) return;
        btn.disabled = out;
        if (out) btn.setAttribute('aria-disabled', 'true');
    });
    if (out) {
        const label = add ? add.querySelector('span') : null;
        if (label) label.textContent = 'Out of stock';
        if (buy) buy.textContent = 'Notify me on WhatsApp';
        if (buy) {
            buy.disabled = false;
            buy.removeAttribute('aria-disabled');
            buy.addEventListener('click', () => {
                const text = 'Hi! Please let me know when this is back in stock: ' + product.name;
                window.open('https://wa.me/8801874244466?text=' + encodeURIComponent(text), '_blank', 'noopener');
            });
        }
    } else {
        if (add) add.addEventListener('click', () => handleAdd({ open: true }));
        if (barAdd) barAdd.addEventListener('click', () => handleAdd({ open: true }));
        if (buy) buy.addEventListener('click', () => handleAdd({ checkout: true }));
    }

    const wish = document.getElementById('pd-wish');
    if (wish) {
        wish.addEventListener('click', () => {
            const result = toggleWishlist(product.id);
            if (result.ok) {
                showToast(result.added ? 'Saved to wishlist' : 'Removed from wishlist',
                    result.added ? 'success' : 'info');
            }
        });
    }

    const share = document.getElementById('pd-share');
    if (share) {
        share.addEventListener('click', async () => {
            const link = absoluteProductUrl(product.id);
            if (navigator.share) {
                try {
                    await navigator.share({ title: product.name, text: product.name, url: link });
                    return;
                } catch (err) {
                    /* cancelled — fall through to copy */
                }
            }
            const ok = await copyText(link);
            showToast(ok ? 'Product link copied' : 'Could not copy the link', ok ? 'success' : 'error');
        });
    }
}

function handleAdd(options) {
    const opts = options || {};
    if (!product) return;

    if (product.colors.length && !selectedColor) {
        setText('pd-color-error', 'Please choose a colour before adding to the cart.');
        const wrap = document.getElementById('pd-colors-wrap');
        if (wrap) {
            wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
            wrap.classList.add('animate-shake');
            setTimeout(() => wrap.classList.remove('animate-shake'), 450);
        }
        showToast('Select a colour first', 'warning');
        return;
    }

    const result = addToCart(product, { qty, color: selectedColor });

    if (!result.ok) {
        if (result.reason === 'out-of-stock') showToast('This product is out of stock', 'error');
        else if (result.reason === 'max-stock') showToast('You already have all available stock in your cart', 'warning');
        else if (result.reason === 'color-required') showToast('Select a colour first', 'warning');
        else showToast('Could not add to cart', 'error');
        return;
    }

    bumpCartIcon();

    if (result.reason === 'partial') {
        showToast('Only ' + result.qty + ' left — added ' + result.qty + ' to your cart', 'warning', 4000);
    } else {
        showToast(product.name + (selectedColor ? ' (' + selectedColor + ')' : '') + ' added to cart', 'success');
    }

    if (opts.checkout) {
        window.location.href = 'cart.html';
        return;
    }
    if (opts.open) openCart();
}

function syncWishButton() {
    const wish = document.getElementById('pd-wish');
    const label = document.getElementById('pd-wish-label');
    if (!wish || !product) return;
    const saved = isWishlisted(product.id);
    wish.setAttribute('aria-pressed', String(saved));
    wish.classList.toggle('!text-primary', saved);
    const svg = wish.querySelector('svg');
    if (svg) svg.setAttribute('fill', saved ? 'currentColor' : 'none');
    if (label) label.textContent = saved ? 'Saved' : 'Save';
}

/* ------------------------------------------------------------------ */
/* Sticky buy bar                                                      */
/* ------------------------------------------------------------------ */

function initBuyBar() {
    const bar = document.getElementById('buybar');
    const anchor = document.getElementById('pd-add');
    if (!bar || !anchor) return;

    setText('buybar-name', product.name);
    setText('buybar-price', formatBDT(product.price));
    document.body.classList.add('has-buy-bar');

    const activate = (show) => bar.classList.toggle('is-active', show);

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => entries.forEach((entry) => activate(!entry.isIntersecting)),
            { threshold: 0 }
        );
        observer.observe(anchor);
    } else {
        activate(true);
    }
}

/* ------------------------------------------------------------------ */
/* Related products                                                    */
/* ------------------------------------------------------------------ */

function renderRelated(currentId) {
    const section = document.getElementById('related-section');
    const grid = document.getElementById('related-grid');
    if (!section || !grid || !catalog.length) return;

    const others = catalog.filter((p) => p.id !== String(currentId));
    const sameCategory = others.filter(
        (p) => product && p.category === product.category && p.stock > 0
    );
    const fallback = others.filter((p) => p.stock > 0 && !sameCategory.includes(p));
    const list = sameCategory.concat(fallback).slice(0, 8);

    if (!list.length) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    grid.innerHTML = list
        .map((item, index) => productCardHTML(item, { index, quickView: false }))
        .join('');
    initReveal(grid);
    syncWishlistHearts();
}

/* ------------------------------------------------------------------ */
/* Accordions                                                          */
/* ------------------------------------------------------------------ */

function bindAccordions() {
    document.querySelectorAll('[data-acc] .acc-trigger').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            const item = trigger.closest('[data-acc]');
            if (!item) return;
            const open = item.classList.toggle('open');
            trigger.setAttribute('aria-expanded', String(open));
        });
    });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value === null || value === undefined ? '' : String(value);
}
