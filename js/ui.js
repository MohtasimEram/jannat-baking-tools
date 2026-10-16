// ========================================================================
// JANNAT BAKING TOOLS 2.0 — SHARED UI CHROME
// Toasts, cart drawer, wishlist drawer, mobile nav, back-to-top, reveals.
// Every storefront page mounts this so the experience is identical.
// ========================================================================

import {
    escapeHtml,
    escapeAttr,
    formatBDT,
    safeImage,
    responsiveImgAttrs,
    getCart,
    cartCount,
    cartSubtotal,
    wishlistCount,
    getWishlist,
    isWishlisted,
    changeCartQty,
    removeFromCart,
    addToCart,
    toggleWishlist,
    onCartChange,
    onWishlistChange,
    productUrl,
    categoryLabel,
    stockState,
    WHATSAPP_NUMBER,
    MAX_QTY_PER_ITEM
} from './store.js';

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
    cart: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>',
    heart: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
    close: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    trash: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
    arrowRight: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>',
    home: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
    grid: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>',
    truck: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>',
    up: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>',
    whatsapp: '<svg width="18" height="18" class="jb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>',
    check: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    alert: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    info: '<svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
};

export { ICONS };

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

function toastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    return container;
}

const TOAST_ICONS = {
    success: '<span class="text-success">' + ICONS.check + '</span>',
    error: '<span class="text-error">' + ICONS.close + '</span>',
    warning: '<span class="text-warning">' + ICONS.alert + '</span>',
    info: '<span class="text-accent">' + ICONS.info + '</span>'
};

export function showToast(message, type = 'success', duration = 3000) {
    const container = toastContainer();
    const kind = TOAST_ICONS[type] ? type : 'info';

    // Collapse duplicate consecutive toasts instead of stacking spam.
    const last = container.lastElementChild;
    if (last && last.dataset.message === String(message)) {
        last.classList.remove('animate-slide-in-up');
        void last.offsetWidth;
        last.classList.add('animate-slide-in-up');
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast ' + kind;
    toast.dataset.message = String(message);
    toast.innerHTML = TOAST_ICONS[kind] + '<span class="min-w-0">' + escapeHtml(message) + '</span>';
    container.appendChild(toast);

    while (container.children.length > 4) {
        container.removeChild(container.firstElementChild);
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 300);
    }, Math.max(1200, duration));
}

/* ------------------------------------------------------------------ */
/* Product lookup (lets the drawer respect live stock)                 */
/* ------------------------------------------------------------------ */

let productLookup = () => null;

export function setProductLookup(fn) {
    if (typeof fn === 'function') productLookup = fn;
}

function stockCapFor(item) {
    const product = productLookup(item.id);
    if (!product) return MAX_QTY_PER_ITEM;
    const otherVariants = getCart()
        .filter((i) => i.id === item.id && i.key !== item.key)
        .reduce((sum, i) => sum + i.qty, 0);
    return Math.max(1, Math.min(MAX_QTY_PER_ITEM, (Number(product.stock) || 0) - otherVariants));
}

/* ------------------------------------------------------------------ */
/* Chrome markup                                                       */
/* ------------------------------------------------------------------ */

function drawerMarkup() {
    return `
<div class="drawer-overlay" id="jb-drawer-overlay" aria-hidden="true"></div>

<aside class="drawer" id="jb-cart-drawer" role="dialog" aria-modal="true"
       aria-labelledby="jb-cart-title" aria-hidden="true" tabindex="-1">
    <div class="drawer-head">
        <div>
            <h2 id="jb-cart-title" class="font-serif text-xl font-bold text-text">Your Cart</h2>
            <p class="text-xs text-text-muted" id="cart-item-count">0 items</p>
        </div>
        <button type="button" class="icon-btn" data-drawer-close aria-label="Close cart">${ICONS.close}</button>
    </div>
    <div class="drawer-body" id="jb-cart-items"></div>
    <div class="drawer-foot hidden" id="jb-cart-foot">
        <div class="sum-row"><span>Subtotal</span><span class="font-bold text-text" id="cart-subtotal">৳ 0</span></div>
        <div class="sum-row"><span>Delivery</span><span class="text-xs font-semibold text-text-secondary">Calculated at checkout</span></div>
        <a href="cart.html" class="btn btn-primary w-full mt-4" id="jb-cart-checkout">
            <span>Proceed to Checkout</span>${ICONS.arrowRight}
        </a>
        <button type="button" class="btn btn-ghost w-full mt-1 text-sm" data-drawer-close>Continue shopping</button>
    </div>
</aside>

<aside class="drawer" id="jb-wishlist-drawer" role="dialog" aria-modal="true"
       aria-labelledby="jb-wishlist-title" aria-hidden="true" tabindex="-1">
    <div class="drawer-head">
        <div>
            <h2 id="jb-wishlist-title" class="font-serif text-xl font-bold text-text">Your Wishlist</h2>
            <p class="text-xs text-text-muted" id="wishlist-item-count">0 items</p>
        </div>
        <button type="button" class="icon-btn" data-drawer-close aria-label="Close wishlist">${ICONS.close}</button>
    </div>
    <div class="drawer-body" id="jb-wishlist-items"></div>
</aside>`;
}

function mobileNavMarkup(active) {
    const item = (key, href, icon, label, badgeId) => {
        const isActive = active === key ? ' active' : '';
        const badge = badgeId
            ? `<span id="${badgeId}" class="mobile-cart-badge" style="display:none">0</span>`
            : '';
        if (href) {
            return `<a href="${href}" class="nav-item${isActive}">${icon}<span>${label}</span>${badge}</a>`;
        }
        return `<button type="button" class="nav-item${isActive}" data-mobile-action="${key}">${icon}<span>${label}</span>${badge}</button>`;
    };

    return `
<nav class="mobile-bottom-nav" id="mobile-nav" aria-label="Primary">
    <div class="nav-items">
        ${item('home', 'index.html', ICONS.home, 'Home')}
        ${item('shop', 'index.html#products-section', ICONS.grid, 'Shop')}
        ${item('wishlist', null, ICONS.heart, 'Saved', 'mobile-wishlist-badge')}
        ${item('cart', null, ICONS.cart, 'Cart', 'mobile-cart-badge')}
        ${item('track', 'track.html', ICONS.truck, 'Track')}
    </div>
</nav>`;
}

/* ------------------------------------------------------------------ */
/* Drawer behaviour                                                    */
/* ------------------------------------------------------------------ */

let openDrawerId = null;
let lastFocused = null;
let savedScrollY = 0;

function lockScroll() {
    savedScrollY = window.scrollY || 0;
    document.body.classList.add('no-scroll');
}

function unlockScroll() {
    document.body.classList.remove('no-scroll');
}

function focusables(root) {
    return Array.prototype.slice
        .call(root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function openDrawer(id) {
    const drawer = document.getElementById(id);
    const overlay = document.getElementById('jb-drawer-overlay');
    if (!drawer || !overlay) return;

    if (openDrawerId && openDrawerId !== id) closeDrawer({ keepScrollLock: true });

    lastFocused = document.activeElement;
    openDrawerId = id;
    overlay.classList.add('open');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    lockScroll();

    if (id === 'jb-cart-drawer') renderCartDrawer();
    if (id === 'jb-wishlist-drawer') renderWishlistDrawer();

    const target = focusables(drawer)[0] || drawer;
    setTimeout(() => {
        try { target.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    }, 60);
}

function closeDrawer(options) {
    const opts = options || {};
    const overlay = document.getElementById('jb-drawer-overlay');
    const drawer = openDrawerId ? document.getElementById(openDrawerId) : null;

    if (drawer) {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
    }
    if (overlay && !opts.keepScrollLock) overlay.classList.remove('open');
    openDrawerId = null;

    if (!opts.keepScrollLock) {
        unlockScroll();
        window.scrollTo({ top: savedScrollY, behavior: 'auto' });
        if (lastFocused && typeof lastFocused.focus === 'function') {
            try { lastFocused.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
        }
    }
}

export function openCart() { openDrawer('jb-cart-drawer'); }
export function openWishlist() { openDrawer('jb-wishlist-drawer'); }
export function closeDrawers() { closeDrawer(); }

export function toggleCart() {
    if (openDrawerId === 'jb-cart-drawer') closeDrawer();
    else openDrawer('jb-cart-drawer');
}

export function toggleWishlistPanel() {
    if (openDrawerId === 'jb-wishlist-drawer') closeDrawer();
    else openDrawer('jb-wishlist-drawer');
}

/* ------------------------------------------------------------------ */
/* Renderers                                                           */
/* ------------------------------------------------------------------ */

function emptyBlock(title, subtitle, icon) {
    return `
<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <h3 class="font-serif font-bold text-text">${escapeHeading(title)}</h3>
    <p>${escapeHeading(subtitle)}</p>
</div>`;
}

function escapeHeading(value) {
    return escapeHtml(value);
}

export function renderCartDrawer() {
    const container = document.getElementById('jb-cart-items');
    const foot = document.getElementById('jb-cart-foot');
    const countEl = document.getElementById('cart-item-count');
    const subtotalEl = document.getElementById('cart-subtotal');
    if (!container) return;

    const items = getCart();
    const count = cartCount();

    if (countEl) countEl.textContent = count + (count === 1 ? ' item' : ' items');
    if (subtotalEl) subtotalEl.textContent = formatBDT(cartSubtotal());
    if (foot) foot.classList.toggle('hidden', items.length === 0);

    if (!items.length) {
        container.innerHTML = emptyBlock(
            'Your cart is empty',
            'Add a few baking essentials to get started.',
            ICONS.cart
        );
        return;
    }

    container.innerHTML = items
        .map((item) => {
            const cap = stockCapFor(item);
            const atMax = item.qty >= cap;
            return `
<div class="cart-item cart-item-new">
    <a href="${escapeAttr(productUrl(item.id))}" class="flex-shrink-0" aria-label="View ${escapeAttr(item.name)}">
        <img ${responsiveImgAttrs(item.image, { width: 160, widths: [160, 320], sizes: '80px' })} alt="${escapeAttr(item.name)}" class="cart-item-image" loading="lazy" decoding="async">
    </a>
    <div class="cart-item-details">
        <a href="${escapeAttr(productUrl(item.id))}" class="cart-item-name hover:text-primary transition-colors">${escapeHtml(item.name)}</a>
        ${item.color
                    ? `<span class="cart-item-variant"><span class="swatch-dot" style="background:${escapeAttr(item.colorHex || '#D4A574')}"></span>${escapeHtml(item.color)}</span>`
                    : ''}
        <p class="cart-item-price">${formatBDT(item.price * item.qty)}
            <span class="text-text-muted text-xs font-medium">(${formatBDT(item.price)} each)</span>
        </p>
        <div class="cart-item-qty">
            <button type="button" class="qty-btn" data-cart-action="dec" data-key="${escapeAttr(item.key)}" aria-label="Decrease quantity">&minus;</button>
            <span class="font-bold text-text text-sm min-w-[1.5rem] text-center">${item.qty}</span>
            <button type="button" class="qty-btn" data-cart-action="inc" data-key="${escapeAttr(item.key)}" ${atMax ? 'disabled' : ''} aria-label="Increase quantity">+</button>
        </div>
    </div>
    <button type="button" class="cart-remove" data-cart-action="remove" data-key="${escapeAttr(item.key)}" aria-label="Remove ${escapeAttr(item.name)} from cart">${ICONS.trash}</button>
</div>`;
        })
        .join('');
}

export function renderWishlistDrawer() {
    const container = document.getElementById('jb-wishlist-items');
    const countEl = document.getElementById('wishlist-item-count');
    if (!container) return;

    const ids = getWishlist();
    const products = ids.map((id) => productLookup(id)).filter(Boolean);
    const unresolved = ids.length - products.length;

    if (countEl) {
        countEl.textContent = ids.length + (ids.length === 1 ? ' item' : ' items');
    }

    if (!ids.length) {
        container.innerHTML = emptyBlock(
            'Your wishlist is empty',
            'Tap the heart on any product you love.',
            ICONS.heart
        );
        return;
    }

    if (!products.length) {
        container.innerHTML = `
<div class="empty-state">
    <div class="empty-state-icon">${ICONS.heart}</div>
    <h3 class="font-serif font-bold text-text">${ids.length} saved ${ids.length === 1 ? 'item' : 'items'}</h3>
    <p>Open the shop to view your saved products.</p>
    <a href="index.html" class="btn btn-primary btn-sm mt-4">Go to shop</a>
</div>`;
        return;
    }

    container.innerHTML =
        products
            .map(
                (product) => `
<div class="wishlist-item">
    <a href="${escapeAttr(productUrl(product.id))}" class="flex-shrink-0">
        <img ${responsiveImgAttrs(product.image, { width: 160, widths: [160, 320], sizes: '80px' })} alt="${escapeAttr(product.name)}" class="wishlist-item-image" loading="lazy" decoding="async">
    </a>
    <div class="wishlist-item-details">
        <a href="${escapeAttr(productUrl(product.id))}" class="wishlist-item-name hover:text-primary transition-colors">${escapeHtml(product.name)}</a>
        <p class="wishlist-item-price">${formatBDT(product.price)}</p>
        <button type="button" class="wishlist-add-cart-btn" data-wishlist-action="add" data-id="${escapeAttr(product.id)}" ${product.stock <= 0 ? 'disabled' : ''}>
            ${ICONS.cart}
            <span>${product.stock > 0 ? (product.colors.length ? 'Choose options' : 'Add to Cart') : 'Out of Stock'}</span>
        </button>
    </div>
    <button type="button" class="wishlist-remove-btn" data-wishlist-action="remove" data-id="${escapeAttr(product.id)}" aria-label="Remove ${escapeAttr(product.name)} from wishlist">
        ${ICONS.close}
    </button>
</div>`
            )
            .join('') +
        (unresolved > 0
            ? `<p class="text-xs text-text-muted text-center mt-3">${unresolved} saved item${unresolved === 1 ? '' : 's'} ${unresolved === 1 ? 'is' : 'are'} no longer available.</p>`
            : '');
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function refreshBadges() {
    const cartTotal = cartCount();
    const wishTotal = wishlistCount();

    document.querySelectorAll('[data-badge="cart"]').forEach((el) => {
        el.textContent = cartTotal > 99 ? '99+' : String(cartTotal);
        el.classList.toggle('is-visible', cartTotal > 0);
    });
    document.querySelectorAll('[data-badge="wishlist"]').forEach((el) => {
        el.textContent = wishTotal > 99 ? '99+' : String(wishTotal);
        el.classList.toggle('is-visible', wishTotal > 0);
    });

    const mobileCart = document.getElementById('mobile-cart-badge');
    if (mobileCart) {
        mobileCart.textContent = cartTotal > 99 ? '99+' : String(cartTotal);
        mobileCart.style.display = cartTotal > 0 ? 'flex' : 'none';
    }
    const mobileWish = document.getElementById('mobile-wishlist-badge');
    if (mobileWish) {
        mobileWish.textContent = wishTotal > 99 ? '99+' : String(wishTotal);
        mobileWish.style.display = wishTotal > 0 ? 'flex' : 'none';
    }

    // Legacy ids from 1.0 (harmless when absent).
    const legacyCart = document.getElementById('cart-count');
    if (legacyCart) {
        legacyCart.textContent = String(cartTotal);
        legacyCart.classList.toggle('scale-0', cartTotal === 0);
        legacyCart.classList.toggle('scale-100', cartTotal > 0);
    }
    const legacyWish = document.getElementById('wishlist-count');
    if (legacyWish) {
        legacyWish.textContent = String(wishTotal);
        legacyWish.classList.toggle('scale-0', wishTotal === 0);
        legacyWish.classList.toggle('scale-100', wishTotal > 0);
    }
}

export function bumpCartIcon() {
    document.querySelectorAll('[data-cart-trigger]').forEach((btn) => {
        btn.classList.remove('animate-shake');
        void btn.offsetWidth;
        btn.classList.add('animate-shake');
        setTimeout(() => btn.classList.remove('animate-shake'), 450);
    });
}

/* ------------------------------------------------------------------ */
/* Scroll reveal + back to top                                         */
/* ------------------------------------------------------------------ */

export function initReveal(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll('.reveal:not(.is-visible)');
    if (!nodes.length) return;

    if (!('IntersectionObserver' in window)) {
        nodes.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    nodes.forEach((el) => observer.observe(el));
}

function initBackToTop() {
    let btn = document.getElementById('back-to-top');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'back-to-top';
        btn.type = 'button';
        btn.className = 'back-to-top';
        btn.setAttribute('aria-label', 'Back to top');
        btn.innerHTML = ICONS.up;
        document.body.appendChild(btn);
    }
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    let ticking = false;
    const update = () => {
        btn.classList.toggle('visible', window.scrollY > 320);
        ticking = false;
    };
    window.addEventListener(
        'scroll',
        () => {
            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(update);
            }
        },
        { passive: true }
    );
    update();
}

function initWhatsapp() {
    if (document.querySelector('.whatsapp-float')) return;
    const link = document.createElement('a');
    link.className = 'whatsapp-float';
    link.href = 'https://wa.me/' + WHATSAPP_NUMBER;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Chat with us on WhatsApp');
    link.innerHTML = ICONS.whatsapp + '<span class="tooltip">Chat with us</span>';
    document.body.appendChild(link);
}

/* ------------------------------------------------------------------ */
/* Mount                                                               */
/* ------------------------------------------------------------------ */

let mounted = false;

/**
 * Mount the shared chrome.
 * @param {{page?: string, mobileNav?: boolean, whatsapp?: boolean, backToTop?: boolean}} options
 */
export function mountChrome(options) {
    if (mounted) return;
    mounted = true;
    const opts = Object.assign({ page: '', mobileNav: true, whatsapp: true, backToTop: true }, options || {});

    const host = document.createElement('div');
    host.id = 'jb-chrome';
    host.innerHTML = drawerMarkup() + (opts.mobileNav ? mobileNavMarkup(opts.page) : '');
    document.body.appendChild(host);

    if (opts.mobileNav) document.body.classList.add('has-mobile-nav');
    if (opts.backToTop) initBackToTop();
    if (opts.whatsapp) initWhatsapp();

    // ---- Global delegated handlers (no inline JS, no injection surface) ----
    document.addEventListener('click', (event) => {
        const closeBtn = event.target.closest('[data-drawer-close]');
        if (closeBtn) {
            event.preventDefault();
            closeDrawer();
            return;
        }

        const overlay = event.target.closest('#jb-drawer-overlay');
        if (overlay) {
            closeDrawer();
            return;
        }

        const cartTrigger = event.target.closest('[data-cart-trigger]');
        if (cartTrigger) {
            event.preventDefault();
            toggleCart();
            return;
        }

        const wishTrigger = event.target.closest('[data-wishlist-trigger]');
        if (wishTrigger) {
            event.preventDefault();
            toggleWishlistPanel();
            return;
        }

        const mobileAction = event.target.closest('[data-mobile-action]');
        if (mobileAction) {
            event.preventDefault();
            const action = mobileAction.dataset.mobileAction;
            if (action === 'cart') toggleCart();
            if (action === 'wishlist') toggleWishlistPanel();
            return;
        }

        const cartAction = event.target.closest('[data-cart-action]');
        if (cartAction) {
            event.preventDefault();
            handleCartAction(cartAction.dataset.cartAction, cartAction.dataset.key);
            return;
        }

        const wishAction = event.target.closest('[data-wishlist-action]');
        if (wishAction) {
            event.preventDefault();
            handleWishlistAction(wishAction.dataset.wishlistAction, wishAction.dataset.id);
            return;
        }

        const cardAction = event.target.closest('[data-card-action]');
        if (cardAction) {
            event.preventDefault();
            event.stopPropagation();
            handleCardAction(cardAction.dataset.cardAction, cardAction.dataset.id, cardAction);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && openDrawerId) {
            closeDrawer();
            return;
        }
        if (event.key !== 'Tab' || !openDrawerId) return;

        const drawer = document.getElementById(openDrawerId);
        if (!drawer) return;
        const items = focusables(drawer);
        if (!items.length) return;

        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    onCartChange(() => {
        refreshBadges();
        renderCartDrawer();
    });
    onWishlistChange(() => {
        refreshBadges();
        renderWishlistDrawer();
        syncWishlistHearts();
    });

    refreshBadges();
    renderCartDrawer();
    initReveal();

    // Backwards-compatible globals (old markup / bookmarks may still call these).
    window.showToast = showToast;
    window.toggleCart = toggleCart;
    window.toggleWishlistPanel = toggleWishlistPanel;
    window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCartAction(action, key) {
    if (!key) return;
    const item = getCart().find((i) => i.key === key);
    if (!item) return;

    if (action === 'remove') {
        removeFromCart(key);
        showToast('Removed from cart', 'info');
        return;
    }
    if (action === 'inc') {
        const result = changeCartQty(key, 1, stockCapFor(item));
        if (result.reason === 'max-stock') showToast('No more stock available', 'warning');
        return;
    }
    if (action === 'dec') {
        if (item.qty <= 1) {
            removeFromCart(key);
            showToast('Removed from cart', 'info');
            return;
        }
        changeCartQty(key, -1, stockCapFor(item));
    }
}

function handleWishlistAction(action, id) {
    if (!id) return;

    if (action === 'remove') {
        toggleWishlist(id);
        showToast('Removed from wishlist', 'info');
        return;
    }

    if (action === 'add') {
        const product = productLookup(id);
        if (!product) {
            showToast('This product is no longer available', 'error');
            return;
        }
        if (product.colors.length) {
            window.location.href = productUrl(product.id);
            return;
        }
        const result = addToCart(product, { qty: 1 });
        if (result.ok) {
            showToast(product.name + ' added to cart', 'success');
            bumpCartIcon();
        } else if (result.reason === 'out-of-stock') {
            showToast('This product is out of stock', 'error');
        } else if (result.reason === 'max-stock') {
            showToast('No more stock available', 'warning');
        } else {
            showToast('Could not add to cart', 'error');
        }
    }
}

/* ------------------------------------------------------------------ */
/* Product card (shared by the shop grid, rails and related items)     */
/* ------------------------------------------------------------------ */

function swatchRowHTML(colors) {
    if (!colors || !colors.length) return '';
    const shown = colors.slice(0, 4);
    const rest = colors.length - shown.length;
    return (
        '<div class="swatch-row" aria-label="Available colours">' +
        shown
            .map(
                (c) =>
                    '<span class="swatch-dot" style="background:' +
                    escapeAttr(c.hex) +
                    '" title="' +
                    escapeAttr(c.name) +
                    '"></span>'
            )
            .join('') +
        (rest > 0 ? '<span class="swatch-more">+' + rest + '</span>' : '') +
        '</div>'
    );
}

/**
 * @param {object} product normalised product
 * @param {{quickView?: boolean, reveal?: boolean, index?: number}} options
 */
export function productCardHTML(product, options) {
    const opts = Object.assign({ quickView: true, reveal: true, index: 0 }, options || {});
    if (!product) return '';

    const state = stockState(product.stock);
    const saved = isWishlisted(product.id);
    const url = productUrl(product.id);
    const outOfStock = product.stock <= 0;
    const needsOptions = product.colors.length > 0;

    return `
<article class="product-card${opts.reveal ? ' reveal' : ''}" data-product-id="${escapeAttr(product.id)}"
         style="transition-delay:${Math.min(opts.index * 35, 280)}ms">
    <a class="product-link" href="${escapeAttr(url)}" aria-label="View ${escapeAttr(product.name)}"></a>
    <div class="product-image">
        <img ${responsiveImgAttrs(product.image, { width: 480, widths: [320, 480, 640, 800], sizes: '(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw' })} alt="${escapeAttr(product.name)}"
             loading="lazy" decoding="async" width="600" height="600">
        <span class="stock-pill ${state.cls}">${escapeHtml(state.label)}</span>
        <button type="button" class="wishlist-btn${saved ? ' active' : ''}" data-card-action="wishlist"
                data-id="${escapeAttr(product.id)}" aria-pressed="${saved ? 'true' : 'false'}"
                aria-label="${saved ? 'Remove from wishlist' : 'Save to wishlist'}">
            <svg width="18" height="18" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
        </button>
        <div class="card-actions">
            <button type="button" class="quick-add" data-card-action="add" data-id="${escapeAttr(product.id)}"
                    ${outOfStock ? 'disabled' : ''}
                    aria-label="${outOfStock ? 'Out of stock' : needsOptions ? 'Choose options for ' + escapeAttr(product.name) : 'Add ' + escapeAttr(product.name) + ' to cart'}">
                ${outOfStock
            ? '<span>Sold out</span>'
            : needsOptions
                ? '<span>Choose options</span>'
                : ICONS.cart + '<span>Add</span>'}
            </button>
            ${opts.quickView
            ? `<button type="button" class="quick-view" data-card-action="view" data-id="${escapeAttr(product.id)}"
                        aria-label="Quick view ${escapeAttr(product.name)}" title="Quick view">
                    <svg width="18" height="18" class="jb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                </button>`
            : ''}
        </div>
    </div>
    <div class="product-body">
        <p class="product-cat">${escapeHtml(categoryLabel(product.category))}</p>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        ${swatchRowHTML(product.colors)}
        <div class="mt-auto pt-1 flex items-center justify-between gap-2">
            <span class="product-price">${formatBDT(product.price)}</span>
            ${product.stock > 0 && product.stock <= 5
            ? '<span class="text-[10px] font-bold uppercase tracking-wide text-warning-dark">Low stock</span>'
            : ''}
        </div>
    </div>
</article>`;
}

export function skeletonCardsHTML(count = 8) {
    let out = '';
    for (let i = 0; i < count; i++) {
        out += `
<div class="skeleton-card" aria-hidden="true">
    <div class="skeleton sk-img"></div>
    <div class="sk-body">
        <div class="skeleton h-3 w-1/3 rounded"></div>
        <div class="skeleton h-4 w-5/6 rounded"></div>
        <div class="skeleton h-4 w-1/2 rounded"></div>
    </div>
</div>`;
    }
    return out;
}

/** Keep every rendered wishlist heart in sync with the saved list. */
export function syncWishlistHearts() {
    document.querySelectorAll('[data-card-action="wishlist"]').forEach((btn) => {
        const saved = isWishlisted(btn.dataset.id);
        btn.classList.toggle('active', saved);
        btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        btn.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Save to wishlist');
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('fill', saved ? 'currentColor' : 'none');
    });
}

function handleCardAction(action, id, element) {
    if (!id) return;

    if (action === 'wishlist') {
        const result = toggleWishlist(id);
        if (!result.ok) return;
        if (element) {
            element.classList.add('animate-heart');
            setTimeout(() => element.classList.remove('animate-heart'), 420);
        }
        showToast(result.added ? 'Saved to wishlist' : 'Removed from wishlist', result.added ? 'success' : 'info');
        return;
    }

    if (action === 'add') {
        handleWishlistAction('add', id);
        return;
    }

    if (action === 'view') {
        if (document.getElementById('quick-view')) {
            document.dispatchEvent(new CustomEvent('jb:quickview', { detail: { id } }));
        } else {
            window.location.href = productUrl(id);
        }
    }
}

