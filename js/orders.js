// ========================================================================
// JANNAT BAKING TOOLS 2.0 — ADMIN ORDER DASHBOARD
// ========================================================================

import { db, collection, doc, updateDoc, query, orderBy, onSnapshot } from './firebase.js';
import {
    escapeHtml,
    escapeAttr,
    formatBDT,
    formatDate,
    toDate,
    safeImage,
    responsiveImgAttrs,
    sanitizeText
} from './store.js';
import { showToast } from './ui.js';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let allOrders = [];
let statusFilter = 'all';
let dateRange = 'all';
let searchTerm = '';
let pendingAction = null;
let unsubscribe = null;

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    bindControls();
    subscribeOrders();
});

function subscribeOrders() {
    try {
        if (typeof unsubscribe === 'function') unsubscribe();
        const ordersQuery = query(collection(db, 'orders'), orderBy('date', 'desc'));
        unsubscribe = onSnapshot(
            ordersQuery,
            (snapshot) => {
                allOrders = snapshot.docs.map((docSnap) => normalizeOrder(docSnap.id, docSnap.data()));
                updateStats();
                renderOrders();
            },
            (error) => {
                console.error('[orders] listener error', error);
                showToast('Failed to load orders. Check your connection.', 'error');
                const container = document.getElementById('orders-container');
                if (container) {
                    container.innerHTML =
                        '<div class="panel p-10 text-center"><p class="text-sm text-text-muted">Could not load orders.</p></div>';
                }
            }
        );
    } catch (error) {
        console.error('[orders] subscription failed', error);
    }
}

/* ------------------------------------------------------------------ */
/* Normalisation (tolerates 1.0 and 2.0 order documents)               */
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
            image: item && item.image ? String(item.image) : '',
            productId: item && item.productId ? String(item.productId) : ''
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
            name: sanitizeText(customer.name, 80) || 'Unknown',
            phone: sanitizeText(customer.phone, 24),
            address: sanitizeText(customer.address, 300),
            location: sanitizeText(customer.location, 40)
        },
        items,
        itemCount: items.reduce((sum, item) => sum + item.qty, 0),
        subtotal,
        delivery,
        total,
        notes: sanitizeText(raw.notes, 500),
        paymentMethod: sanitizeText(payment.method, 60) || 'Cash on Delivery',
        trxId: sanitizeText(payment.trxId, 60),
        date: toDate(raw.date)
    };
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

function updateStats() {
    const revenue = allOrders
        .filter((order) => order.status === 'Delivered')
        .reduce((sum, order) => sum + order.total, 0);
    const pending = allOrders.filter((order) => order.status === 'Pending').length;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = allOrders.filter((order) => order.date && order.date >= startOfToday).length;

    setText('total-revenue', formatBDT(revenue));
    setText('pending-count', String(pending));
    setText('total-orders', String(allOrders.length));
    setText('today-count', String(todayCount));

    [document.getElementById('pending-badge'), document.getElementById('tab-pending-count')].forEach((badge) => {
        if (!badge) return;
        badge.textContent = String(pending);
        badge.classList.toggle('hidden', pending === 0);
    });
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

function rangeStart() {
    const now = new Date();
    switch (dateRange) {
        case 'today':
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        case 'week':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'month':
            return new Date(now.getFullYear(), now.getMonth(), 1);
        default:
            return null;
    }
}

function visibleOrders() {
    let list = allOrders.slice();

    if (statusFilter !== 'all') {
        list = list.filter((order) => order.status.toLowerCase() === statusFilter);
    }

    const start = rangeStart();
    if (start) list = list.filter((order) => order.date && order.date >= start);

    if (searchTerm) {
        list = list.filter((order) => {
            const haystack = (
                order.customer.name +
                ' ' +
                order.customer.phone +
                ' ' +
                order.code +
                ' ' +
                order.id +
                ' ' +
                order.items.map((item) => item.name).join(' ')
            ).toLowerCase();
            return haystack.includes(searchTerm);
        });
    }

    return list;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const STATUS_META = {
    Pending: {
        cls: 'status-pending',
        icon: '<svg width="18" height="18" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    },
    Delivered: {
        cls: 'status-delivered',
        icon: '<svg width="18" height="18" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
    },
    Cancelled: {
        cls: 'status-cancelled',
        icon: '<svg width="18" height="18" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    }
};

function renderOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    const list = visibleOrders();

    if (!list.length) {
        container.innerHTML = `
<div class="panel p-12 text-center">
    <div class="empty-state-icon">
        <svg width="18" height="18" class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
    </div>
    <h2 class="font-serif text-lg font-bold text-text mb-2">No orders found</h2>
    <p class="text-sm text-text-muted">${searchTerm ? 'No orders match your search.' : 'Nothing here for the selected filters.'}</p>
</div>`;
        return;
    }

    container.innerHTML = list.map(orderCardHTML).join('');
}

function orderCardHTML(order) {
    const meta = STATUS_META[order.status] || STATUS_META.Pending;
    const phoneDigits = order.customer.phone.replace(/[^\d]/g, '');
    const waNumber = phoneDigits.startsWith('880') ? phoneDigits : '88' + phoneDigits;

    const itemsHTML = order.items.length
        ? order.items
            .map(
                (item) => `
<div class="flex items-center gap-3 py-2 border-b border-dashed border-border-strong last:border-0">
    ${item.image
                        ? `<img ${responsiveImgAttrs(item.image, { width: 72, widths: [72, 144], sizes: '36px' })} alt="" class="w-9 h-9 rounded-lg object-cover bg-surface shrink-0" loading="lazy" decoding="async">`
                        : '<span class="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0">' + item.qty + '×</span>'}
    <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-text truncate">${escapeHtml(item.name)}</p>
        <p class="text-[11px] text-text-muted">
            ${item.qty} × ${formatBDT(item.price)}${item.color ? ' · ' + escapeHtml(item.color) : ''}
        </p>
    </div>
    <p class="text-sm font-bold text-text shrink-0">${formatBDT(item.price * item.qty)}</p>
</div>`
            )
            .join('')
        : '<p class="text-sm text-text-muted">No items recorded</p>';

    return `
<article class="order-card">
    <div class="flex flex-col lg:flex-row lg:items-start gap-4">
        <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3 mb-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="font-mono text-xs font-bold text-text-muted">${escapeHtml(order.code)}</span>
                        <span class="${meta.cls} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            ${meta.icon}${escapeHtml(order.status)}
                        </span>
                    </div>
                    <h3 class="font-serif text-lg font-bold text-text truncate">${escapeHtml(order.customer.name)}</h3>
                    <div class="flex items-center gap-3 flex-wrap mt-1">
                        ${order.customer.phone
            ? `<a href="tel:${escapeAttr(order.customer.phone)}" class="text-sm font-semibold text-accent hover:text-accent-dark transition-colors">${escapeHtml(order.customer.phone)}</a>
                               <a href="https://wa.me/${escapeAttr(waNumber)}" target="_blank" rel="noopener noreferrer"
                                  class="text-xs font-bold text-success-dark hover:underline">WhatsApp</a>`
            : '<span class="text-sm text-text-muted">No phone</span>'}
                    </div>
                    <p class="text-sm text-text-muted mt-1 break-words">
                        ${escapeHtml(order.customer.address || 'No address')}${order.customer.location ? ' · <span class="font-semibold">' + escapeHtml(order.customer.location) + '</span>' : ''}
                    </p>
                </div>
                <div class="text-right shrink-0">
                    <p class="order-total">${formatBDT(order.total)}</p>
                    <p class="text-[11px] text-text-muted mt-1">${escapeHtml(formatDate(order.date))}</p>
                    <p class="text-[11px] text-text-muted">${order.itemCount} item${order.itemCount === 1 ? '' : 's'} · delivery ${formatBDT(order.delivery)}</p>
                </div>
            </div>

            <div class="order-items">
                <p class="text-[10px] font-bold text-text-muted uppercase tracking-[0.12em] mb-1">Order items</p>
                ${itemsHTML}
            </div>

            ${order.notes
            ? `<div class="bg-accent-light/60 rounded-xl p-3 mb-4 border border-accent/20">
                       <p class="text-[10px] font-bold text-accent-dark uppercase tracking-[0.12em] mb-1">Customer note</p>
                       <p class="text-sm text-text-secondary break-words">${escapeHtml(order.notes)}</p>
                   </div>`
            : ''}

            <div class="flex items-center gap-2 text-xs flex-wrap">
                <span class="text-text-muted">Payment</span>
                <span class="font-bold text-text">${escapeHtml(order.paymentMethod)}</span>
                ${order.trxId ? `<span class="badge badge-neutral">Trx: ${escapeHtml(order.trxId)}</span>` : ''}
            </div>
        </div>

        ${order.status === 'Pending'
            ? `<div class="flex lg:flex-col gap-2 shrink-0">
                   <button type="button" class="btn-action inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-success text-white rounded-xl text-sm font-bold hover:brightness-95 flex-1 lg:flex-none"
                           data-order-action="deliver" data-id="${escapeAttr(order.id)}">
                       <svg width="18" height="18" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                       </svg>
                       Delivered
                   </button>
                   <button type="button" class="btn-action inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-error-light text-error-dark rounded-xl text-sm font-bold hover:brightness-95 flex-1 lg:flex-none"
                           data-order-action="cancel" data-id="${escapeAttr(order.id)}">
                       <svg width="18" height="18" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                       </svg>
                       Cancel
                   </button>
               </div>`
            : ''}
    </div>
</article>`;
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function bindControls() {
    ['order-search', 'order-search-mobile'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', () => {
            searchTerm = input.value.trim().toLowerCase();
            ['order-search', 'order-search-mobile'].forEach((otherId) => {
                if (otherId === id) return;
                const other = document.getElementById(otherId);
                if (other && other.value !== input.value) other.value = input.value;
            });
            renderOrders();
        });
    });

    document.querySelectorAll('.date-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
            dateRange = pill.dataset.range || 'all';
            document.querySelectorAll('.date-pill').forEach((other) => {
                other.classList.toggle('active', other === pill);
            });
            renderOrders();
        });
    });

    document.querySelectorAll('.filter-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            statusFilter = tab.dataset.filter || 'all';
            document.querySelectorAll('.filter-tab').forEach((other) => {
                const active = other === tab;
                other.classList.toggle('active', active);
                other.setAttribute('aria-selected', String(active));
            });
            renderOrders();
        });
    });

    const container = document.getElementById('orders-container');
    if (container) {
        container.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-order-action]');
            if (!btn) return;
            event.preventDefault();
            openConfirm(btn.dataset.orderAction, btn.dataset.id);
        });
    }

    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-confirm-close]')) {
                event.preventDefault();
                closeConfirm();
            }
        });
    }

    const confirmBtn = document.getElementById('confirm-action');
    if (confirmBtn) confirmBtn.addEventListener('click', executePendingAction);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeConfirm();
    });

    const refresh = document.getElementById('refresh-orders');
    if (refresh) {
        refresh.addEventListener('click', () => {
            const icon = document.getElementById('refresh-icon');
            if (icon) icon.classList.add('animate-spin');
            subscribeOrders();
            setTimeout(() => {
                if (icon) icon.classList.remove('animate-spin');
                showToast('Orders refreshed', 'success');
            }, 700);
        });
    }

    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
}

/* ------------------------------------------------------------------ */
/* Confirm + update                                                    */
/* ------------------------------------------------------------------ */

function openConfirm(action, orderId) {
    const order = allOrders.find((o) => o.id === orderId);
    if (!order) return;

    pendingAction = { action, orderId };

    const icon = document.getElementById('confirm-icon');
    const actionBtn = document.getElementById('confirm-action');

    if (action === 'deliver') {
        if (icon) {
            icon.className = 'w-16 h-16 mx-auto mb-4 bg-success-light rounded-full flex items-center justify-center';
            icon.innerHTML =
                '<svg width="18" height="18" class="w-8 h-8 text-success-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        }
        setText('confirm-title', 'Mark as delivered?');
        setText('confirm-message', order.code + ' for ' + order.customer.name + ' will be counted in your revenue.');
        if (actionBtn) {
            actionBtn.className = 'btn flex-1 !bg-success !text-white hover:!brightness-95';
            actionBtn.textContent = 'Yes, delivered';
        }
    } else {
        if (icon) {
            icon.className = 'w-16 h-16 mx-auto mb-4 bg-error-light rounded-full flex items-center justify-center';
            icon.innerHTML =
                '<svg width="18" height="18" class="w-8 h-8 text-error-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        }
        setText('confirm-title', 'Cancel this order?');
        setText('confirm-message', order.code + ' for ' + order.customer.name + ' will be marked as cancelled.');
        if (actionBtn) {
            actionBtn.className = 'btn flex-1 !bg-error !text-white hover:!brightness-95';
            actionBtn.textContent = 'Yes, cancel';
        }
    }

    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');
        if (actionBtn) {
            setTimeout(() => {
                try { actionBtn.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
            }, 80);
        }
    }
}

function closeConfirm() {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    pendingAction = null;
}

async function executePendingAction() {
    if (!pendingAction) return;
    const { action, orderId } = pendingAction;
    const btn = document.getElementById('confirm-action');
    const originalLabel = btn ? btn.textContent : '';

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving…';
    }

    try {
        await updateDoc(doc(db, 'orders', orderId), {
            status: action === 'deliver' ? 'Delivered' : 'Cancelled',
            statusUpdatedAt: new Date().toISOString()
        });
        showToast(action === 'deliver' ? 'Order marked as delivered' : 'Order cancelled', 'success');
        closeConfirm();
    } catch (error) {
        console.error('[orders] update failed', error);
        showToast('Failed to update the order', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalLabel;
        }
    }
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

function csvCell(value) {
    const text = String(value === null || value === undefined ? '' : value);
    // Prefix formula-like values so spreadsheets never evaluate them.
    const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
}

function exportCsv() {
    const list = visibleOrders();
    if (!list.length) {
        showToast('Nothing to export for the current filters', 'warning');
        return;
    }

    const header = [
        'Order Code', 'Date', 'Status', 'Customer', 'Phone', 'Address', 'Zone',
        'Items', 'Units', 'Subtotal', 'Delivery', 'Total', 'Notes'
    ];

    const rows = list.map((order) => [
        order.code,
        order.date ? order.date.toISOString() : '',
        order.status,
        order.customer.name,
        order.customer.phone,
        order.customer.address,
        order.customer.location,
        order.items.map((i) => i.name + (i.color ? ' (' + i.color + ')' : '') + ' x' + i.qty).join(' | '),
        order.itemCount,
        order.subtotal,
        order.delivery,
        order.total,
        order.notes
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = 'jannat-orders-' + stamp + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('Exported ' + list.length + ' order' + (list.length === 1 ? '' : 's'), 'success');
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value === null || value === undefined ? '' : String(value);
}
