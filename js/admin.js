// ========================================================================
// JANNAT BAKING TOOLS 2.0 — ADMIN PRODUCT MANAGER
// Multi-image uploads, colour options and full product editing.
// ========================================================================

import {
    db,
    collection,
    doc,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc
} from './firebase.js';
import {
    CATEGORIES,
    normalizeProduct,
    escapeHtml,
    escapeAttr,
    formatBDT,
    safeImage,
    responsiveImgAttrs,
    safeUrl,
    sanitizeText,
    categoryLabel
} from './store.js';
import { showToast } from './ui.js';
import { compressImage, formatBytes } from './image-compress.js';

/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dgsckxyw8/image/upload';
const CLOUDINARY_PRESET = 'gjzwfzxc';

const MAX_IMAGES = 6;
// Raw phone photos can be large; they are compressed in the browser before upload.
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

let products = [];
let deleteTargetId = null;
let addImages = null;
let editImages = null;
let addColors = null;
let editColors = null;
let busy = false;

const tableFilters = { search: '', category: 'all', stock: 'all' };

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    addImages = createImageManager({
        managerId: 'p-image-manager',
        inputId: 'p-image',
        countId: 'p-image-count',
        errorId: 'err-p-image'
    });
    editImages = createImageManager({
        managerId: 'edit-image-manager',
        inputId: 'edit-image',
        countId: 'edit-image-count',
        errorId: 'err-edit-image'
    });
    addColors = createColorEditor('p-colors', 'p-add-color');
    editColors = createColorEditor('edit-colors', 'edit-add-color');

    const addForm = document.getElementById('add-product-form');
    if (addForm) {
        addForm.addEventListener('submit', handleAddProduct);
        addForm.addEventListener('reset', () => {
            setTimeout(() => {
                addImages.clear();
                addColors.setColors([]);
                clearErrors(['p-name', 'p-category', 'p-price', 'p-stock', 'p-desc', 'p-social', 'p-image', 'p-colors']);
                const label = document.getElementById('file-label');
                if (label) label.classList.remove('has-file');
            }, 0);
        });
    }

    const editForm = document.getElementById('edit-form');
    if (editForm) editForm.addEventListener('submit', handleEditProduct);

    bindModalDismiss('edit-modal', '[data-edit-close]', closeEditModal);
    bindModalDismiss('delete-modal', '[data-delete-close]', closeDeleteModal);

    const confirmDelete = document.getElementById('confirm-delete-btn');
    if (confirmDelete) confirmDelete.addEventListener('click', confirmDeleteProduct);

    bindTableControls();

    const refresh = document.getElementById('refresh-inventory');
    if (refresh) {
        refresh.addEventListener('click', () => {
            const icon = document.getElementById('refresh-icon');
            if (icon) icon.classList.add('animate-spin');
            loadInventory().finally(() => {
                setTimeout(() => {
                    if (icon) icon.classList.remove('animate-spin');
                }, 400);
            });
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeEditModal();
        closeDeleteModal();
    });

    loadInventory();
});

/* ------------------------------------------------------------------ */
/* Load + render                                                       */
/* ------------------------------------------------------------------ */

async function loadInventory() {
    try {
        const snapshot = await getDocs(collection(db, 'products'));
        products = snapshot.docs
            .map((docSnap) => normalizeProduct(docSnap.id, docSnap.data()))
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        renderSummary();
        renderLowStockAlert();
        renderInventory();
    } catch (error) {
        console.error('[admin] failed to load inventory', error);
        showToast('Failed to load products. Check your connection.', 'error');
        const tbody = document.getElementById('inventory-table');
        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="!py-10 text-center text-sm text-text-muted">Could not load inventory.</td></tr>';
        }
    }
}

function renderSummary() {
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    setText('total-products-count', String(products.length));
    setText('total-stock-count', String(totalStock));
    setText('low-stock-count', String(products.filter((p) => p.stock > 0 && p.stock <= 5).length));
    setText('out-of-stock-count', String(products.filter((p) => p.stock <= 0).length));
}

function renderLowStockAlert() {
    const host = document.getElementById('low-stock-alert');
    if (!host) return;

    const low = products.filter((p) => p.stock > 0 && p.stock <= 5);
    if (!low.length) {
        host.classList.add('hidden');
        host.innerHTML = '';
        return;
    }

    host.classList.remove('hidden');
    host.innerHTML = `
<div class="low-stock-alert">
    <svg width="18" height="18" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>
    <p>
        <strong>${low.length} product${low.length > 1 ? 's' : ''}</strong> running low:
        <span class="low-stock-items">${low.map((p) => escapeHtml(p.name) + ' (' + p.stock + ')').join(', ')}</span>
    </p>
</div>`;
}

function filteredProducts() {
    return products.filter((p) => {
        if (tableFilters.category !== 'all' && p.category !== tableFilters.category) return false;
        if (tableFilters.stock === 'low' && !(p.stock > 0 && p.stock <= 5)) return false;
        if (tableFilters.stock === 'out' && p.stock > 0) return false;
        if (tableFilters.search) {
            const haystack = (p.name + ' ' + categoryLabel(p.category) + ' ' + p.description).toLowerCase();
            if (!haystack.includes(tableFilters.search)) return false;
        }
        return true;
    });
}

function renderInventory() {
    const tbody = document.getElementById('inventory-table');
    if (!tbody) return;

    const list = filteredProducts();
    setText(
        'inventory-count',
        list.length === products.length
            ? products.length + (products.length === 1 ? ' product' : ' products') + ' in inventory'
            : list.length + ' of ' + products.length + ' products shown'
    );

    if (!list.length) {
        tbody.innerHTML = `
<tr>
    <td colspan="5" class="!py-12 text-center">
        <div class="empty-state-icon">
            <svg width="18" height="18" class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
        </div>
        <h3 class="font-serif text-base font-bold text-text mb-1">No products found</h3>
        <p class="text-sm text-text-muted">${products.length ? 'Try a different search or filter.' : 'Add your first product using the form above.'}</p>
    </td>
</tr>`;
        return;
    }

    tbody.innerHTML = list
        .map((product) => {
            const stockColor = product.stock <= 0 ? 'bg-error' : product.stock <= 5 ? 'bg-warning' : 'bg-success';
            const stockPct = Math.min((product.stock / 50) * 100, 100);
            const stockText =
                product.stock <= 0 ? 'text-error' : product.stock <= 5 ? 'text-warning-dark' : 'text-text';

            return `
<tr>
    <td data-label="Product">
        <div class="flex items-center gap-3 min-w-0">
            <div class="relative shrink-0">
                <img ${responsiveImgAttrs(product.image, { width: 96, widths: [96, 192], sizes: '48px' })} alt=""
                     class="w-12 h-12 rounded-xl object-cover border border-border bg-bg-alt" loading="lazy" decoding="async">
                ${product.images.length > 1
                    ? `<span class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-text text-white text-[9px] font-bold">${product.images.length}</span>`
                    : ''}
            </div>
            <div class="min-w-0">
                <p class="font-bold text-text text-sm truncate max-w-[16rem]">${escapeHtml(product.name)}</p>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                    ${product.colors.length
                    ? '<span class="swatch-row">' +
                    product.colors
                        .slice(0, 5)
                        .map(
                            (c) =>
                                '<span class="swatch-dot" style="background:' +
                                escapeAttr(c.hex) +
                                '" title="' +
                                escapeAttr(c.name) +
                                '"></span>'
                        )
                        .join('') +
                    (product.colors.length > 5 ? '<span class="swatch-more">+' + (product.colors.length - 5) + '</span>' : '') +
                    '</span>'
                    : '<span class="text-[10px] text-text-muted">No colours</span>'}
                    ${product.featured ? '<span class="badge badge-primary !text-[9px] !px-2 !py-0.5">Featured</span>' : ''}
                </div>
            </div>
        </div>
    </td>
    <td data-label="Category">
        <span class="badge badge-neutral capitalize">${escapeHtml(categoryLabel(product.category))}</span>
    </td>
    <td data-label="Price">
        <span class="font-bold text-text text-sm">${formatBDT(product.price)}</span>
    </td>
    <td data-label="Stock">
        <div class="flex items-center gap-3 justify-end md:justify-start">
            <span class="font-bold text-sm ${stockText}">${product.stock}</span>
            <span class="stock-indicator w-20 hidden md:block">
                <span class="stock-indicator-fill ${stockColor}" style="width:${stockPct}%"></span>
            </span>
        </div>
    </td>
    <td data-label="Actions">
        <div class="flex items-center justify-end gap-1">
            <a href="product.html?id=${encodeURIComponent(product.id)}" target="_blank" rel="noopener"
               class="p-2 text-text-muted hover:text-text hover:bg-bg-alt rounded-lg transition-colors" title="View on shop">
                <svg width="18" height="18" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
            </a>
            <button type="button" data-action="edit" data-id="${escapeAttr(product.id)}"
                    class="p-2 text-accent hover:bg-accent-light rounded-lg transition-colors" title="Edit">
                <svg width="18" height="18" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
            </button>
            <button type="button" data-action="delete" data-id="${escapeAttr(product.id)}"
                    class="p-2 text-error hover:bg-error-light rounded-lg transition-colors" title="Delete">
                <svg width="18" height="18" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
            </button>
        </div>
    </td>
</tr>`;
        })
        .join('');
}

function bindTableControls() {
    const search = document.getElementById('search-products');
    if (search) {
        search.addEventListener('input', () => {
            tableFilters.search = search.value.trim().toLowerCase();
            renderInventory();
        });
    }

    const category = document.getElementById('filter-category');
    if (category) {
        category.addEventListener('change', () => {
            tableFilters.category = category.value;
            renderInventory();
        });
    }

    const stock = document.getElementById('filter-stock');
    if (stock) {
        stock.addEventListener('change', () => {
            tableFilters.stock = stock.value;
            renderInventory();
        });
    }

    const tbody = document.getElementById('inventory-table');
    if (tbody) {
        tbody.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-action]');
            if (!btn) return;
            event.preventDefault();
            if (btn.dataset.action === 'edit') openEditModal(btn.dataset.id);
            if (btn.dataset.action === 'delete') openDeleteModal(btn.dataset.id);
        });
    }
}

/* ------------------------------------------------------------------ */
/* Image manager                                                       */
/* ------------------------------------------------------------------ */

function createImageManager(options) {
    const host = document.getElementById(options.managerId);
    const input = document.getElementById(options.inputId);
    const countEl = options.countId ? document.getElementById(options.countId) : null;
    let items = [];

    function revoke(item) {
        if (item && item.kind === 'file' && item.preview) {
            try { URL.revokeObjectURL(item.preview); } catch (err) { /* ignore */ }
        }
    }

    function render() {
        if (countEl) countEl.textContent = items.length + ' / ' + MAX_IMAGES;
        if (!host) return;

        if (!items.length) {
            host.innerHTML =
                '<p class="text-xs text-text-muted col-span-full">No photos added yet.</p>';
            return;
        }

        host.innerHTML = items
            .map(
                (item, index) => `
<div class="img-tile${index === 0 ? ' primary' : ''}">
    <img ${item.kind === 'file' ? 'src="' + escapeAttr(item.preview) + '"' : responsiveImgAttrs(item.url, { width: 320, widths: [240, 320, 480], sizes: '160px' })} alt="Photo ${index + 1}" decoding="async">
    ${index === 0 ? '<span class="primary-flag">Cover</span>' : ''}
    <div class="tile-actions">
        <button type="button" data-img-action="left" data-index="${index}" ${index === 0 ? 'disabled' : ''}
                title="Move left" aria-label="Move photo ${index + 1} left">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
            </svg>
        </button>
        <button type="button" data-img-action="right" data-index="${index}" ${index === items.length - 1 ? 'disabled' : ''}
                title="Move right" aria-label="Move photo ${index + 1} right">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/>
            </svg>
        </button>
        <button type="button" data-img-action="remove" data-index="${index}"
                title="Remove" aria-label="Remove photo ${index + 1}">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    </div>
</div>`
            )
            .join('');
    }

    function addFiles(fileList) {
        const files = Array.prototype.slice.call(fileList || []);
        if (!files.length) return;

        let rejectedType = 0;
        let rejectedSize = 0;
        let rejectedCount = 0;

        files.forEach((file) => {
            if (items.length >= MAX_IMAGES) {
                rejectedCount++;
                return;
            }
            if (ALLOWED_TYPES.indexOf(file.type) === -1) {
                rejectedType++;
                return;
            }
            if (file.size > MAX_FILE_BYTES) {
                rejectedSize++;
                return;
            }
            items.push({ kind: 'file', file, preview: URL.createObjectURL(file) });
        });

        if (rejectedType) showToast(rejectedType + ' file(s) skipped — only JPG, PNG, WebP or GIF.', 'warning');
        if (rejectedSize) showToast(rejectedSize + ' file(s) skipped — each photo must be under 30MB.', 'warning');
        if (rejectedCount) showToast('Maximum ' + MAX_IMAGES + ' photos per product.', 'warning');

        render();
        setError(options.errorId, '');
    }

    if (input) {
        input.addEventListener('change', () => {
            addFiles(input.files);
            input.value = '';
            const label = document.getElementById(options.inputId === 'p-image' ? 'file-label' : 'edit-file-label');
            if (label && options.inputId === 'p-image') label.classList.toggle('has-file', items.length > 0);
        });
    }

    if (host) {
        host.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-img-action]');
            if (!btn || btn.disabled) return;
            event.preventDefault();
            const index = Number(btn.dataset.index);
            if (!Number.isInteger(index) || index < 0 || index >= items.length) return;

            if (btn.dataset.imgAction === 'remove') {
                revoke(items[index]);
                items.splice(index, 1);
            } else {
                const target = btn.dataset.imgAction === 'left' ? index - 1 : index + 1;
                if (target < 0 || target >= items.length) return;
                const moved = items.splice(index, 1)[0];
                items.splice(target, 0, moved);
            }
            render();
        });
    }

    render();

    return {
        count: () => items.length,
        clear() {
            items.forEach(revoke);
            items = [];
            render();
        },
        setUrls(urls) {
            items.forEach(revoke);
            items = (urls || [])
                .map((url) => safeUrl(url))
                .filter(Boolean)
                .slice(0, MAX_IMAGES)
                .map((url) => ({ kind: 'url', url }));
            render();
        },
        /** Uploads any pending files and returns the ordered URL list. */
        async resolve(onProgress) {
            const pending = items.filter((item) => item.kind === 'file');
            let done = 0;
            if (pending.length && typeof onProgress === 'function') {
                onProgress(0, pending.length);
            }

            const resolved = [];
            let savedBytes = 0;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'url') {
                    resolved.push(item.url);
                    continue;
                }
                // Shrink + convert to WebP in the browser first, so the cloud
                // only ever stores a web-sized file (and uploads are faster).
                let toUpload = item.file;
                try {
                    const packed = await compressImage(item.file);
                    toUpload = packed.file;
                    savedBytes += Math.max(0, packed.originalBytes - packed.finalBytes);
                } catch (err) {
                    console.warn('[admin] compression skipped', err);
                }
                // Sequential upload keeps the unsigned Cloudinary preset happy
                // and gives the admin accurate progress feedback.
                const url = await uploadToCloudinary(toUpload);
                resolved.push(url);
                done++;
                if (typeof onProgress === 'function') onProgress(done, pending.length);
            }
            if (savedBytes > 100 * 1024) {
                showToast('Photos optimised — saved ' + formatBytes(savedBytes) + ' of storage.', 'success');
            }
            return resolved;
        }
    };
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
    let data = {};
    try {
        data = await response.json();
    } catch (err) {
        data = {};
    }

    if (!response.ok || !data.secure_url) {
        const message = (data.error && data.error.message) || 'Upload failed';
        throw new Error('Image upload failed: ' + message);
    }
    return data.secure_url;
}

/* ------------------------------------------------------------------ */
/* Colour editor                                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_SWATCHES = ['#E85A4F', '#D4A574', '#4A90A4', '#6B5B52', '#22C55E', '#F59E0B'];

function createColorEditor(hostId, addButtonId) {
    const host = document.getElementById(hostId);
    const addBtn = document.getElementById(addButtonId);

    function rowHTML(name, hex) {
        return `
<div class="color-row">
    <input type="color" value="${escapeAttr(hex)}" aria-label="Colour swatch" data-color-hex>
    <input type="text" value="${escapeAttr(name)}" placeholder="Colour name (e.g. Pastel Pink)"
           maxlength="40" aria-label="Colour name" data-color-name>
    <button type="button" class="remove-color" data-color-remove aria-label="Remove colour">
        <svg width="18" height="18" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
    </button>
</div>`;
    }

    function addRow(name, hex) {
        if (!host) return;
        const index = host.querySelectorAll('.color-row').length;
        const swatch = hex || DEFAULT_SWATCHES[index % DEFAULT_SWATCHES.length];
        host.insertAdjacentHTML('beforeend', rowHTML(name || '', swatch));
        const rows = host.querySelectorAll('.color-row');
        const last = rows[rows.length - 1];
        const nameInput = last ? last.querySelector('[data-color-name]') : null;
        if (nameInput && !name) nameInput.focus();
    }

    if (addBtn) {
        addBtn.addEventListener('click', (event) => {
            event.preventDefault();
            if (host && host.querySelectorAll('.color-row').length >= 20) {
                showToast('That is plenty of colours (max 20).', 'warning');
                return;
            }
            addRow('');
        });
    }

    if (host) {
        host.addEventListener('click', (event) => {
            const remove = event.target.closest('[data-color-remove]');
            if (!remove) return;
            event.preventDefault();
            const row = remove.closest('.color-row');
            if (row) row.remove();
        });
    }

    return {
        setColors(colors) {
            if (!host) return;
            host.innerHTML = '';
            (colors || []).forEach((color) => addRow(color.name, color.hex));
        },
        /** @returns {{colors: Array, error: string}} */
        read() {
            if (!host) return { colors: [], error: '' };
            const rows = Array.prototype.slice.call(host.querySelectorAll('.color-row'));
            const colors = [];
            const seen = new Set();
            let error = '';

            rows.forEach((row) => {
                const nameInput = row.querySelector('[data-color-name]');
                const hexInput = row.querySelector('[data-color-hex]');
                const name = sanitizeText(nameInput ? nameInput.value : '', 40);
                const hex = hexInput ? hexInput.value : '';
                // Rows left blank are simply ignored.
                if (!name) return;

                const key = name.toLowerCase();
                if (seen.has(key)) {
                    error = 'Duplicate colour name: ' + name;
                    return;
                }
                seen.add(key);
                colors.push({ name, hex: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : '#d4a574' });
            });

            return { colors, error };
        }
    };
}

/* ------------------------------------------------------------------ */
/* Add product                                                         */
/* ------------------------------------------------------------------ */

async function handleAddProduct(event) {
    event.preventDefault();
    if (busy) return;

    const name = sanitizeText(getValue('p-name'), 140);
    const category = getValue('p-category');
    const description = sanitizeText(getValue('p-desc'), 4000);
    const socialRaw = getValue('p-social').trim();
    const price = getNumber('p-price');
    const stock = getNumber('p-stock');
    const featured = isChecked('p-featured');
    const colorResult = addColors.read();

    const errors = {};
    if (name.length < 2) errors['p-name'] = 'Enter a product name.';
    if (!CATEGORIES.some((c) => c.id === category)) errors['p-category'] = 'Choose a category.';
    if (description.length < 5) errors['p-desc'] = 'Add a short description.';
    if (!Number.isFinite(price) || price < 0) errors['p-price'] = 'Enter a price (0 or more).';
    if (!Number.isFinite(stock) || stock < 0) errors['p-stock'] = 'Enter a stock amount (0 or more).';
    if (socialRaw && !safeUrl(socialRaw)) errors['p-social'] = 'Use a full https:// link.';
    if (addImages.count() === 0) errors['p-image'] = 'Add at least one photo.';
    if (colorResult.error) errors['p-colors'] = colorResult.error;

    showErrors(errors, ['p-name', 'p-category', 'p-price', 'p-stock', 'p-desc', 'p-social', 'p-image', 'p-colors']);
    if (Object.keys(errors).length) {
        showToast('Please fix the highlighted fields.', 'warning');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    busy = true;
    setButtonLoading(submitBtn, true, 'Uploading…');

    try {
        const images = await addImages.resolve((done, total) => {
            setButtonLoading(submitBtn, true, 'Uploading ' + done + '/' + total + '…');
        });
        setButtonLoading(submitBtn, true, 'Saving…');

        const now = new Date().toISOString();
        await addDoc(collection(db, 'products'), {
            name,
            category,
            description,
            socialLink: safeUrl(socialRaw),
            price: Math.round(price),
            stock: Math.trunc(stock),
            images,
            // `imageUrl` stays in sync so any older client keeps working.
            imageUrl: images[0],
            colors: colorResult.colors,
            featured,
            createdAt: now,
            updatedAt: now
        });

        showToast('Product added successfully', 'success');
        const form = document.getElementById('add-product-form');
        if (form) form.reset();
        addImages.clear();
        addColors.setColors([]);
        const label = document.getElementById('file-label');
        if (label) label.classList.remove('has-file');

        await loadInventory();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('[admin] add product failed', error);
        showToast(error && error.message ? error.message : 'Failed to add product', 'error', 6000);
    } finally {
        busy = false;
        setButtonLoading(submitBtn, false, 'Add product');
    }
}

/* ------------------------------------------------------------------ */
/* Edit product                                                        */
/* ------------------------------------------------------------------ */

function openEditModal(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
        showToast('Product not found — refreshing list.', 'warning');
        loadInventory();
        return;
    }

    setValue('edit-id', product.id);
    setValue('edit-name', product.name);
    setValue('edit-desc', product.description);
    setValue('edit-social', product.socialLink);
    setValue('edit-price', String(product.price));
    setValue('edit-stock', String(product.stock));

    const categorySelect = document.getElementById('edit-category');
    if (categorySelect) {
        categorySelect.value = CATEGORIES.some((c) => c.id === product.category) ? product.category : 'molds';
    }
    const featured = document.getElementById('edit-featured');
    if (featured) featured.checked = !!product.featured;

    // Real stored images only — never persist the generated placeholder.
    const stored = product.images.filter((url) => safeUrl(url) && url.indexOf('data:image/svg+xml') !== 0);
    editImages.setUrls(stored);
    editColors.setColors(product.colors);
    clearErrors(['edit-name', 'edit-price', 'edit-stock', 'edit-desc', 'edit-social', 'edit-image', 'edit-colors']);

    openModal('edit-modal');
}

function closeEditModal() {
    closeModal('edit-modal');
}

async function handleEditProduct(event) {
    event.preventDefault();
    if (busy) return;

    const id = getValue('edit-id');
    if (!id) return;

    const name = sanitizeText(getValue('edit-name'), 140);
    const category = getValue('edit-category');
    const description = sanitizeText(getValue('edit-desc'), 4000);
    const socialRaw = getValue('edit-social').trim();
    const price = getNumber('edit-price');
    const stock = getNumber('edit-stock');
    const featured = isChecked('edit-featured');
    const colorResult = editColors.read();

    const errors = {};
    if (name.length < 2) errors['edit-name'] = 'Enter a product name.';
    if (description.length < 5) errors['edit-desc'] = 'Add a short description.';
    if (!Number.isFinite(price) || price < 0) errors['edit-price'] = 'Enter a price (0 or more).';
    if (!Number.isFinite(stock) || stock < 0) errors['edit-stock'] = 'Enter a stock amount (0 or more).';
    if (socialRaw && !safeUrl(socialRaw)) errors['edit-social'] = 'Use a full https:// link.';
    if (editImages.count() === 0) errors['edit-image'] = 'Keep at least one photo.';
    if (colorResult.error) errors['edit-colors'] = colorResult.error;

    showErrors(errors, ['edit-name', 'edit-price', 'edit-stock', 'edit-desc', 'edit-social', 'edit-image', 'edit-colors']);
    if (Object.keys(errors).length) {
        showToast('Please fix the highlighted fields.', 'warning');
        return;
    }

    const submitBtn = document.getElementById('edit-submit');
    busy = true;
    setButtonLoading(submitBtn, true, 'Saving…');

    try {
        const images = await editImages.resolve((done, total) => {
            setButtonLoading(submitBtn, true, 'Uploading ' + done + '/' + total + '…');
        });

        await updateDoc(doc(db, 'products', id), {
            name,
            category,
            description,
            socialLink: safeUrl(socialRaw),
            price: Math.round(price),
            stock: Math.trunc(stock),
            images,
            imageUrl: images[0],
            colors: colorResult.colors,
            featured,
            updatedAt: new Date().toISOString()
        });

        showToast('Product updated', 'success');
        closeEditModal();
        await loadInventory();
    } catch (error) {
        console.error('[admin] update failed', error);
        showToast(error && error.message ? error.message : 'Failed to update product', 'error', 6000);
    } finally {
        busy = false;
        setButtonLoading(submitBtn, false, 'Save changes');
    }
}

/* ------------------------------------------------------------------ */
/* Delete product                                                      */
/* ------------------------------------------------------------------ */

function openDeleteModal(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    deleteTargetId = productId;
    setText('delete-name', product.name);
    openModal('delete-modal');
}

function closeDeleteModal() {
    closeModal('delete-modal');
    deleteTargetId = null;
}

async function confirmDeleteProduct() {
    if (!deleteTargetId || busy) return;
    const btn = document.getElementById('confirm-delete-btn');
    busy = true;
    setButtonLoading(btn, true, 'Deleting…');

    try {
        await deleteDoc(doc(db, 'products', deleteTargetId));
        showToast('Product deleted', 'success');
        closeDeleteModal();
        await loadInventory();
    } catch (error) {
        console.error('[admin] delete failed', error);
        showToast('Failed to delete product', 'error');
    } finally {
        busy = false;
        setButtonLoading(btn, false, 'Delete');
    }
}

/* ------------------------------------------------------------------ */
/* Modal helpers                                                       */
/* ------------------------------------------------------------------ */

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    const focusable = modal.querySelector('input, select, textarea, button');
    if (focusable) {
        setTimeout(() => {
            try { focusable.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
        }, 80);
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    const anyOpen = document.querySelector('.modal-overlay.active');
    if (!anyOpen) document.body.classList.remove('no-scroll');
}

function bindModalDismiss(modalId, selector, handler) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.addEventListener('click', (event) => {
        if (event.target.closest(selector)) {
            event.preventDefault();
            handler();
        }
    });
}

/* ------------------------------------------------------------------ */
/* Form helpers                                                        */
/* ------------------------------------------------------------------ */

function setButtonLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = loading;
    const span = btn.querySelector('span');
    if (span) span.textContent = label;
    else btn.textContent = label;
}

function showErrors(errors, fields) {
    fields.forEach((field) => {
        const message = errors[field] || '';
        setError('err-' + field, message);
        const input = document.getElementById(field);
        if (!input) return;
        if (message) {
            input.setAttribute('aria-invalid', 'true');
            input.classList.add('error');
        } else {
            input.removeAttribute('aria-invalid');
            input.classList.remove('error');
        }
    });

    const first = fields.find((field) => errors[field]);
    if (first) {
        const input = document.getElementById(first);
        if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                try { input.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
            }, 220);
        }
    }
}

function clearErrors(fields) {
    showErrors({}, fields);
}

function setError(id, message) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.textContent = message || '';
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value === null || value === undefined ? '' : String(value);
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value === null || value === undefined ? '' : String(value);
}

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

/**
 * Reads a numeric field.
 * Returns NaN for blank or non-numeric input so validation can catch it —
 * `Number('')` is 0, which would silently save a free product.
 */
function getNumber(id) {
    const raw = getValue(id).trim();
    if (raw === '') return NaN;
    const value = Number(raw);
    return Number.isFinite(value) ? value : NaN;
}

function isChecked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
}
