// ========================================================================
// JANNAT BAKING TOOLS 2.0 — CART & CHECKOUT PAGE
// ========================================================================

import {
    db,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    increment,
    serverTimestamp
} from './firebase.js';
import {
    normalizeProduct,
    reconcileCart,
    getCart,
    cartCount,
    cartSubtotal,
    changeCartQty,
    removeFromCart,
    clearCart,
    onCartChange,
    escapeHtml,
    escapeAttr,
    formatBDT,
    plainBDT,
    safeImage,
    responsiveImgAttrs,
    productUrl,
    deliveryFeeFor,
    validateCheckout,
    generateOrderCode,
    getSavedCheckout,
    saveCheckout,
    copyText,
    DEFAULT_LOCATION,
    MAX_QTY_PER_ITEM
} from './store.js';
import { mountChrome, showToast, setProductLookup, renderWishlistDrawer, ICONS } from './ui.js';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let productsById = new Map();
let submitting = false;
let orderPlaced = false;

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    mountChrome({ page: 'cart' });
    setProductLookup((id) => productsById.get(String(id)) || null);

    prefillCheckout();
    bindEvents();
    render();
    loadProducts();

    onCartChange(() => {
        if (!orderPlaced) render();
    });
});

async function loadProducts() {
    try {
        const snapshot = await getDocs(collection(db, 'products'));
        const products = snapshot.docs.map((docSnap) => normalizeProduct(docSnap.id, docSnap.data()));
        productsById = new Map(products.map((p) => [p.id, p]));

        if (!orderPlaced) {
            const result = reconcileCart(products);
            if (result.removed > 0) {
                showToast('Some items were removed because they are no longer available.', 'warning', 5000);
            } else if (result.adjusted > 0) {
                showToast('Your cart was updated to match current stock and prices.', 'info', 5000);
            }
            render();
        }
        renderWishlistDrawer();
    } catch (error) {
        console.warn('[cart] could not refresh stock', error);
    }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render() {
    const items = getCart();
    const layout = document.getElementById('cart-layout');
    const empty = document.getElementById('cart-empty');
    const success = document.getElementById('order-success');

    if (success && !success.classList.contains('hidden')) return;

    if (!items.length) {
        if (layout) layout.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (layout) layout.classList.remove('hidden');

    renderLines(items);
    renderTotals(items);
}

function stockCapFor(item) {
    const product = productsById.get(item.id);
    if (!product) return MAX_QTY_PER_ITEM;
    const otherVariants = getCart()
        .filter((i) => i.id === item.id && i.key !== item.key)
        .reduce((sum, i) => sum + i.qty, 0);
    return Math.max(1, Math.min(MAX_QTY_PER_ITEM, product.stock - otherVariants));
}

function renderLines(items) {
    const host = document.getElementById('cart-lines');
    const headline = document.getElementById('cart-headline');
    if (!host) return;

    const total = cartCount();
    if (headline) {
        headline.textContent =
            total + (total === 1 ? ' item' : ' items') + ' · ' + formatBDT(cartSubtotal()) + ' subtotal';
    }

    host.innerHTML = items
        .map((item) => {
            const cap = stockCapFor(item);
            const product = productsById.get(item.id);
            const lowStock = product && product.stock > 0 && product.stock <= 5;
            return `
<article class="panel p-3 sm:p-4 flex gap-3 sm:gap-4 items-start">
    <a href="${escapeAttr(productUrl(item.id))}" class="shrink-0" aria-label="View ${escapeAttr(item.name)}">
        <img ${responsiveImgAttrs(item.image, { width: 192, widths: [160, 192, 384], sizes: '96px' })} alt="${escapeAttr(item.name)}"
             class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover bg-bg-alt" loading="lazy" decoding="async">
    </a>

    <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <a href="${escapeAttr(productUrl(item.id))}"
                   class="font-serif font-bold text-text text-sm sm:text-base leading-snug hover:text-primary transition-colors line-clamp-2">
                    ${escapeHtml(item.name)}
                </a>
                ${item.color
                    ? `<span class="cart-item-variant mt-1"><span class="swatch-dot" style="background:${escapeAttr(item.colorHex || '#D4A574')}"></span>${escapeHtml(item.color)}</span>`
                    : ''}
                <p class="text-xs text-text-muted mt-0.5">${formatBDT(item.price)} each</p>
                ${lowStock ? `<p class="text-[11px] font-bold text-warning-dark mt-1">Only ${product.stock} left in stock</p>` : ''}
            </div>
            <button type="button" class="cart-remove" data-line-action="remove" data-key="${escapeAttr(item.key)}"
                    aria-label="Remove ${escapeAttr(item.name)}">${ICONS.trash}</button>
        </div>

        <div class="flex items-end justify-between gap-3 mt-3">
            <div class="qty-stepper !h-9" role="group" aria-label="Quantity for ${escapeAttr(item.name)}">
                <button type="button" class="!w-9 !h-9" data-line-action="dec" data-key="${escapeAttr(item.key)}"
                        aria-label="Decrease quantity">&minus;</button>
                <span class="qty-value !min-w-[2.25rem] text-sm">${item.qty}</span>
                <button type="button" class="!w-9 !h-9" data-line-action="inc" data-key="${escapeAttr(item.key)}"
                        ${item.qty >= cap ? 'disabled' : ''} aria-label="Increase quantity">+</button>
            </div>
            <p class="font-extrabold text-primary text-base sm:text-lg">${formatBDT(item.price * item.qty)}</p>
        </div>
    </div>
</article>`;
        })
        .join('');
}

function renderTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const locationEl = document.getElementById('delivery-location');
    const location = locationEl && locationEl.value ? locationEl.value : DEFAULT_LOCATION;
    const delivery = deliveryFeeFor(location);

    setText('sum-items', String(cartCount()));
    setText('sum-subtotal', formatBDT(subtotal));
    setText('sum-delivery', formatBDT(delivery));
    setText('sum-total', formatBDT(subtotal + delivery));
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

function bindEvents() {
    const lines = document.getElementById('cart-lines');
    if (lines) {
        lines.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-line-action]');
            if (!btn) return;
            event.preventDefault();

            const key = btn.dataset.key;
            const item = getCart().find((i) => i.key === key);
            if (!item) return;

            if (btn.dataset.lineAction === 'remove') {
                removeFromCart(key);
                showToast('Removed from cart', 'info');
                return;
            }
            if (btn.dataset.lineAction === 'inc') {
                const result = changeCartQty(key, 1, stockCapFor(item));
                if (result.reason === 'max-stock') showToast('No more stock available', 'warning');
                return;
            }
            if (btn.dataset.lineAction === 'dec') {
                if (item.qty <= 1) {
                    removeFromCart(key);
                    showToast('Removed from cart', 'info');
                    return;
                }
                changeCartQty(key, -1, stockCapFor(item));
            }
        });
    }

    const clearBtn = document.getElementById('clear-cart');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!getCart().length) return;
            // eslint-disable-next-line no-alert
            if (!window.confirm('Remove every item from your cart?')) return;
            clearCart();
            showToast('Cart cleared', 'info');
        });
    }

    const location = document.getElementById('delivery-location');
    if (location) {
        location.addEventListener('change', () => renderTotals(getCart()));
    }

    const form = document.getElementById('checkout-form');
    if (form) form.addEventListener('submit', handleCheckout);

    ['cust-name', 'cust-phone', 'cust-address'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', () => {
            input.removeAttribute('aria-invalid');
            input.classList.remove('error');
            setText('err-' + id.replace('cust-', ''), '');
        });
    });

    const copyBtn = document.getElementById('copy-code');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const code = document.getElementById('success-code');
            const ok = await copyText(code ? code.textContent.trim() : '');
            showToast(ok ? 'Order code copied' : 'Could not copy the code', ok ? 'success' : 'error');
        });
    }
}

function prefillCheckout() {
    const saved = getSavedCheckout();
    if (!saved) return;
    setValue('cust-name', saved.name);
    setValue('cust-phone', saved.phone);
    setValue('cust-address', saved.address);
    const location = document.getElementById('delivery-location');
    if (location && saved.location) location.value = saved.location;
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

function showFieldErrors(errors) {
    const map = { name: 'cust-name', phone: 'cust-phone', address: 'cust-address' };
    Object.keys(map).forEach((field) => {
        const input = document.getElementById(map[field]);
        const message = errors[field] || '';
        setText('err-' + field, message);
        if (!input) return;
        if (message) {
            input.setAttribute('aria-invalid', 'true');
            input.classList.add('error');
        } else {
            input.removeAttribute('aria-invalid');
            input.classList.remove('error');
        }
    });
}

function setCheckoutLoading(loading) {
    const btn = document.getElementById('place-order-btn');
    const label = document.getElementById('place-order-label');
    if (!btn) return;
    btn.disabled = loading;
    if (label) label.textContent = loading ? 'Placing your order…' : 'Place order';
}

async function handleCheckout(event) {
    event.preventDefault();
    if (submitting) return;

    const items = getCart();
    if (!items.length) {
        showToast('Your cart is empty', 'error');
        render();
        return;
    }

    const locationEl = document.getElementById('delivery-location');
    const validation = validateCheckout({
        name: getValue('cust-name'),
        phone: getValue('cust-phone'),
        address: getValue('cust-address'),
        notes: getValue('order-notes'),
        location: locationEl ? locationEl.value : DEFAULT_LOCATION
    });

    showFieldErrors(validation.errors);
    if (!validation.valid) {
        const firstField = Object.keys(validation.errors)[0];
        const input = document.getElementById('cust-' + firstField);
        if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 250);
        }
        showToast('Please fix the highlighted fields', 'warning');
        return;
    }

    submitting = true;
    setCheckoutLoading(true);

    try {
        // --- Re-validate against live stock and prices before charging anyone ---
        const snapshot = await getDocs(collection(db, 'products'));
        const fresh = snapshot.docs.map((docSnap) => normalizeProduct(docSnap.id, docSnap.data()));
        productsById = new Map(fresh.map((p) => [p.id, p]));

        const problems = [];
        const perProduct = new Map();
        items.forEach((item) => {
            perProduct.set(item.id, (perProduct.get(item.id) || 0) + item.qty);
        });

        perProduct.forEach((qty, id) => {
            const product = productsById.get(id);
            if (!product) {
                problems.push('An item in your cart is no longer available.');
                return;
            }
            if (product.stock < qty) {
                problems.push(
                    product.stock > 0
                        ? 'Only ' + product.stock + ' left of ' + product.name + '.'
                        : product.name + ' just went out of stock.'
                );
            }
        });

        items.forEach((item) => {
            const product = productsById.get(item.id);
            if (product && product.price !== item.price) {
                problems.push('The price of ' + product.name + ' has changed.');
            }
        });

        if (problems.length) {
            reconcileCart(fresh);
            render();
            showToast(problems[0] + ' Your cart was updated — please review and try again.', 'warning', 6000);
            return;
        }

        // --- Build the order ---
        const values = validation.values;
        const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const deliveryFee = deliveryFeeFor(values.location);
        const total = subtotal + deliveryFee;
        const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
        const orderCode = generateOrderCode();

        const orderData = {
            orderCode,
            customer: {
                name: values.name,
                address: values.address,
                phone: values.phone,
                location: values.location
            },
            // Keep the 1.0 field shape so the existing dashboards keep working.
            cart: items.map((item) => ({
                productId: item.id,
                name: item.name,
                qty: item.qty,
                price: item.price,
                color: item.color || '',
                image: item.image || ''
            })),
            itemCount,
            subtotal: plainBDT(subtotal),
            deliveryFee: plainBDT(deliveryFee),
            total: plainBDT(total),
            totals: { subtotal, delivery: deliveryFee, total },
            notes: values.notes,
            status: 'Pending',
            payment: { method: 'Cash on Delivery', trxId: null },
            date: serverTimestamp()
        };

        const created = await addDoc(collection(db, 'orders'), orderData);

        // --- Notify the shop (never blocks the customer) ---
        notifyShop({
            orderCode,
            orderId: created.id,
            customer: orderData.customer,
            items: orderData.cart,
            subtotal,
            deliveryFee,
            total,
            notes: values.notes
        });

        // --- Reduce stock atomically; failures never break a placed order ---
        const updates = [];
        perProduct.forEach((qty, id) => {
            updates.push(
                updateDoc(doc(db, 'products', id), { stock: increment(-qty) }).catch((err) => {
                    console.warn('[cart] stock update skipped for ' + id, err && err.code);
                })
            );
        });
        await Promise.allSettled(updates);

        saveCheckout(values);
        orderPlaced = true;
        clearCart();
        showSuccess(orderCode, total, itemCount);
    } catch (error) {
        console.error('[cart] checkout failed', error);
        showToast('We could not place your order. Please check your connection and try again.', 'error', 6000);
    } finally {
        submitting = false;
        setCheckoutLoading(false);
    }
}

function showSuccess(orderCode, total, itemCount) {
    const layout = document.getElementById('cart-layout');
    const empty = document.getElementById('cart-empty');
    const success = document.getElementById('order-success');

    if (layout) layout.classList.add('hidden');
    if (empty) empty.classList.add('hidden');
    if (success) {
        setText('success-code', orderCode);
        setText('success-total', formatBDT(total));
        setText('success-items', String(itemCount));
        success.classList.remove('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Posts the order to the serverless notifier.
 * The bot token lives only in Vercel environment variables, never in the browser.
 */
function notifyShop(payload) {
    try {
        fetch('/api/notify-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then((response) => {
                if (!response.ok) {
                    console.warn('[cart] order notification responded with', response.status);
                }
            })
            .catch((err) => console.warn('[cart] order notification unavailable', err));
    } catch (err) {
        console.warn('[cart] order notification failed to send', err);
    }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value === null || value === undefined ? '' : String(value);
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
}

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}
