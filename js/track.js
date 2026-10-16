// ========================================================================
// JANNAT BAKING TOOLS 2.0 — ORDER TRACKING
// Search by phone number or order code. Uses single-field equality
// queries only, so no composite Firestore index is required.
// ========================================================================

import { db, collection, query, where, limit, getDocs } from './firebase.js';
import {
    escapeHtml,
    escapeAttr,
    formatBDT,
    formatDate,
    toDate,
    safeImage,
    responsiveImgAttrs,
    sanitizeText,
    normalizePhone
} from './store.js';
import { mountChrome, showToast, renderCartDrawer } from './ui.js';

let searching = false;

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    mountChrome({ page: 'track' });
    renderCartDrawer();

    const form = document.getElementById('track-form');
    if (form) form.addEventListener('submit', handleSubmit);

    const input = document.getElementById('track-phone');
    if (input) {
        input.addEventListener('input', () => setError(''));
    }

    // Deep link support: track.html?phone=... or ?code=...
    try {
        const params = new URLSearchParams(window.location.search);
        const prefill = params.get('phone') || params.get('code') || '';
        if (prefill && input) {
            input.value = prefill.slice(0, 40);
            runSearch(input.value);
        }
    } catch (err) {
        /* ignore */
    }
});

/* ------------------------------------------------------------------ */
/* Search                                                             */
/* ------------------------------------------------------------------ */

function handleSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('track-phone');
    runSearch(input ? input.value : '');
}

function setError(message) {
    const el = document.getElementById('track-error');
    if (el) el.textContent = message || '';
}

function setLoading(loading) {
    const text = document.getElementById('btn-text');
    const spinner = document.getElementById('btn-spinner');
    const btn = document.getElementById('track-btn');
    if (text) text.textContent = loading ? 'Searching…' : 'Search';
    if (spinner) spinner.classList.toggle('hidden', !loading);
    if (btn) btn.disabled = loading;
}

function normalizeCode(value) {
    const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return '';
    const body = raw.startsWith('JB-') ? raw.slice(3) : raw;
    if (!/^[A-Z0-9]{4,12}$/.test(body)) return '';
    return 'JB-' + body;
}

async function runSearch(rawValue) {
    if (searching) return;

    const container = document.getElementById('results-container');
    const value = sanitizeText(rawValue, 40);

    if (!value) {
        setError('Enter your phone number or order code.');
        return;
    }

    const phone = normalizePhone(value);
    const code = phone ? '' : normalizeCode(value);

    if (!phone && !code) {
        setError('That does not look like a phone number (01712345678) or an order code (JB-7K3M9Q).');
        return;
    }

    setError('');
    searching = true;
    setLoading(true);

    if (container) {
        container.innerHTML = `
<div class="panel p-10 flex items-center justify-center gap-3">
    <span class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full spinner"></span>
    <span class="text-sm text-text-muted">Searching for your orders…</span>
</div>`;
    }

    try {
        const ordersRef = collection(db, 'orders');
        const constraint = phone ? where('customer.phone', '==', phone) : where('orderCode', '==', code);
        const snapshot = await getDocs(query(ordersRef, constraint, limit(25)));

        const orders = snapshot.docs
            .map((docSnap) => normalizeOrder(docSnap.id, docSnap.data()))
            .sort((a, b) => {
                const aTime = a.date ? a.date.getTime() : 0;
                const bTime = b.date ? b.date.getTime() : 0;
                return bTime - aTime;
            });

        if (!orders.length) {
            renderNotFound(phone || code, !!code);
            return;
        }

        renderOrders(orders);
    } catch (error) {
        console.error('[track] search failed', error);
        if (container) {
            const needsIndex = String(error && error.message).toLowerCase().includes('index');
            container.innerHTML = `
<div class="panel p-10 text-center">
    <div class="empty-state-icon">
        <svg width="18" height="18" class="w-9 h-9 text-warning-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
    </div>
    <h2 class="font-serif text-lg font-bold text-text mb-2">We couldn't complete the search</h2>
    <p class="text-sm text-text-muted mb-5">${needsIndex
                    ? 'The order database needs a moment to finish indexing. Please try again shortly.'
                    : 'Please check your internet connection and try again.'}</p>
    <a href="https://wa.me/8801874244466" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Ask us on WhatsApp</a>
</div>`;
        }
        showToast('Could not search orders. Please try again.', 'error');
    } finally {
        searching = false;
        setLoading(false);
    }
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

function amountFrom(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const digits = String(value || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
}

function normalizeOrder(id, data) {
    const raw = data || {};
    const totals = raw.totals && typeof raw.totals === 'object' ? raw.totals : {};
    const customer = raw.customer && typeof raw.customer === 'object' ? raw.customer : {};
    const payment = raw.payment && typeof raw.payment === 'object' ? raw.payment : {};
    const status = ['Pending', 'Delivered', 'Cancelled'].indexOf(raw.status) > -1 ? raw.status : 'Pending';

    const items = Array.isArray(raw.cart)
        ? raw.cart.map((item) => ({
            name: sanitizeText(item && item.name, 140) || 'Item',
            qty: Math.max(1, Math.trunc(Number(item && item.qty) || 1)),
            price: Math.max(0, Math.round(Number(item && item.price) || 0)),
            color: sanitizeText(item && item.color, 40),
            image: item && item.image ? String(item.image) : ''
        }))
        : [];

    const subtotal = Number.isFinite(totals.subtotal)
        ? totals.subtotal
        : items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const delivery = Number.isFinite(totals.delivery) ? totals.delivery : amountFrom(raw.deliveryFee);
    const total = Number.isFinite(totals.total) ? totals.total : amountFrom(raw.total) || subtotal + delivery;

    return {
        id: String(id),
        code: sanitizeText(raw.orderCode, 24) || 'JB-' + String(id).slice(-6).toUpperCase(),
        status,
        customer: {
            name: sanitizeText(customer.name, 80) || 'Customer',
            phone: sanitizeText(customer.phone, 24),
            address: sanitizeText(customer.address, 300),
            location: sanitizeText(customer.location, 40)
        },
        items,
        subtotal,
        delivery,
        total,
        notes: sanitizeText(raw.notes, 500),
        paymentMethod: sanitizeText(payment.method, 60) || 'Cash on Delivery',
        date: toDate(raw.date)
    };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                          */
/* ------------------------------------------------------------------ */

function renderNotFound(term, wasCode) {
    const container = document.getElementById('results-container');
    if (!container) return;

    container.innerHTML = `
<div class="panel p-10 text-center">
    <div class="empty-state-icon">
        <svg width="18" height="18" class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
    </div>
    <h2 class="font-serif text-lg font-bold text-text mb-2">No orders found</h2>
    <p class="text-sm text-text-muted mb-5">
        We couldn't find any orders for <strong class="text-text">${escapeHtml(term)}</strong>.
    </p>
    <ul class="text-sm text-text-secondary space-y-1.5 text-left max-w-sm mx-auto mb-6">
        <li>• Double-check the number or code for typos.</li>
        ${wasCode ? '<li>• Orders placed before the order-code update can only be found by phone number.</li>' : ''}
        <li>• Try the other phone number you may have used at checkout.</li>
        <li>• Brand-new orders can take a few seconds to appear.</li>
    </ul>
    <a href="https://wa.me/8801874244466" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Ask us on WhatsApp</a>
</div>`;
}

const STATUS_META = {
    Pending: { cls: 'status-pending', label: 'Processing' },
    Delivered: { cls: 'status-delivered', label: 'Delivered' },
    Cancelled: { cls: 'status-cancelled', label: 'Cancelled' }
};

function timelineHTML(order) {
    const dateStr = escapeHtml(formatDate(order.date));

    if (order.status === 'Delivered') {
        return `
<div class="timeline-enhanced">
    <div class="timeline-step completed">
        <p class="step-title">Delivered</p>
        <p class="step-desc">Your parcel has been handed over. Enjoy your bake!</p>
    </div>
    <div class="timeline-step completed">
        <p class="step-title">Out for delivery</p>
        <p class="step-desc">The courier was on the way to your address.</p>
    </div>
    <div class="timeline-step completed">
        <p class="step-title">Order confirmed</p>
        <p class="step-desc">${dateStr}</p>
    </div>
</div>`;
    }

    if (order.status === 'Cancelled') {
        return `
<div class="timeline-enhanced">
    <div class="timeline-step cancelled">
        <p class="step-title">Order cancelled</p>
        <p class="step-desc">Contact us on WhatsApp if this looks wrong.</p>
    </div>
    <div class="timeline-step completed">
        <p class="step-title">Order placed</p>
        <p class="step-desc">${dateStr}</p>
    </div>
</div>`;
    }

    return `
<div class="timeline-enhanced">
    <div class="timeline-step">
        <p class="step-title text-text-muted">Delivery</p>
        <p class="step-desc">Estimated within 2–3 working days.</p>
    </div>
    <div class="timeline-step active">
        <p class="step-title">Processing</p>
        <p class="step-desc">We are packing your order now.</p>
    </div>
    <div class="timeline-step completed">
        <p class="step-title">Order confirmed</p>
        <p class="step-desc">${dateStr}</p>
    </div>
</div>`;
}

function renderOrders(orders) {
    const container = document.getElementById('results-container');
    if (!container) return;

    container.innerHTML =
        `<p class="text-sm text-text-muted mb-4">${orders.length} order${orders.length === 1 ? '' : 's'} found</p>` +
        orders
            .map((order, index) => {
                const meta = STATUS_META[order.status] || STATUS_META.Pending;
                const itemsHTML = order.items.length
                    ? order.items
                        .map(
                            (item) => `
<div class="flex items-center gap-3 py-2 border-b border-dashed border-border-strong last:border-0">
    ${item.image
                                    ? `<img ${responsiveImgAttrs(item.image, { width: 72, widths: [72, 144], sizes: '36px' })} alt="" class="w-9 h-9 rounded-lg object-cover bg-surface shrink-0" loading="lazy" decoding="async">`
                                    : `<span class="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0">${item.qty}×</span>`}
    <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-text truncate">${escapeHtml(item.name)}</p>
        <p class="text-[11px] text-text-muted">${item.qty} × ${formatBDT(item.price)}${item.color ? ' · ' + escapeHtml(item.color) : ''}</p>
    </div>
    <p class="text-sm font-bold text-text shrink-0">${formatBDT(item.price * item.qty)}</p>
</div>`
                        )
                        .join('')
                    : '<p class="text-sm text-text-muted">No items recorded</p>';

                return `
<article class="panel overflow-hidden mb-6 animate-slide-in-bottom" style="animation-delay:${Math.min(index * 80, 320)}ms">
    <div class="p-5 md:p-6 border-b border-border bg-bg-alt/60">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-2">
                    <span class="font-mono text-xs font-bold text-text-secondary">${escapeHtml(order.code)}</span>
                    <span class="${meta.cls} inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold">${escapeHtml(meta.label)}</span>
                </div>
                <p class="font-serif text-2xl font-bold text-primary">${formatBDT(order.total)}</p>
                <p class="text-[11px] text-text-muted mt-0.5">Includes ${formatBDT(order.delivery)} delivery · ${escapeHtml(order.paymentMethod)}</p>
            </div>
            <p class="text-xs text-text-muted shrink-0">${escapeHtml(formatDate(order.date))}</p>
        </div>
    </div>

    <div class="p-5 md:p-6 grid md:grid-cols-2 gap-6">
        <div>
            <h3 class="text-[10px] font-bold text-text-muted uppercase tracking-[0.12em] mb-2">Order items</h3>
            <div class="bg-bg-alt rounded-xl p-3">${itemsHTML}</div>
            ${order.notes
                        ? `<div class="mt-3 p-3 rounded-xl bg-accent-light/60 border border-accent/20">
                               <p class="text-[10px] font-bold text-accent-dark uppercase tracking-[0.12em] mb-1">Your note</p>
                               <p class="text-sm text-text-secondary break-words">${escapeHtml(order.notes)}</p>
                           </div>`
                        : ''}
        </div>

        <div>
            <h3 class="text-[10px] font-bold text-text-muted uppercase tracking-[0.12em] mb-2">Status</h3>
            ${timelineHTML(order)}
        </div>
    </div>

    <div class="px-5 md:px-6 pb-5 md:pb-6">
        <h3 class="text-[10px] font-bold text-text-muted uppercase tracking-[0.12em] mb-2">Delivery details</h3>
        <div class="flex items-start gap-3">
            <span class="w-10 h-10 bg-primary-subtle rounded-full flex items-center justify-center shrink-0">
                <svg width="18" height="18" class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
            </span>
            <div class="min-w-0">
                <p class="font-bold text-text">${escapeHtml(order.customer.name)}</p>
                <p class="text-sm text-text-secondary">${escapeHtml(order.customer.phone)}</p>
                <p class="text-sm text-text-muted mt-0.5 break-words">
                    ${escapeHtml(order.customer.address)}${order.customer.location ? ' · ' + escapeHtml(order.customer.location) : ''}
                </p>
            </div>
        </div>
    </div>
</article>`;
            })
            .join('');
}
