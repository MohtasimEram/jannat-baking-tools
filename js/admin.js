// ========================================
// JANNAT BAKING TOOLS - ADMIN JS
// Product management with Firebase
// ========================================

import { 
    db,
    storage,
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc,
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "./firebase.js";

// ========================================
// STATE
// ========================================
let products = [];
let deleteProductId = null;
let searchProductTerm = '';

// Cloudinary Config (keep your existing key)
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dgsckxyw8/image/upload";
const CLOUDINARY_PRESET = "gjzwfzxc";

// ========================================
// INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
    
    document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);
    document.getElementById('edit-form').addEventListener('submit', handleEditProduct);
});

// ========================================
// LOAD INVENTORY
// ========================================
async function loadInventory() {
    try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);
        
        products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderDashboardSummary();
        renderLowStockAlert();
        renderInventory();
        
    } catch (error) {
        console.error("Error loading inventory:", error);
        showToast("Failed to load products", "error");
    }
}

// ========================================
// DASHBOARD SUMMARY
// ========================================
function renderDashboardSummary() {
    const total = products.length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outOfStock = products.filter(p => p.stock <= 0).length;

    document.getElementById('total-products-count').textContent = total;
    document.getElementById('low-stock-count').textContent = lowStock;
    document.getElementById('out-of-stock-count').textContent = outOfStock;
}

// ========================================
// LOW STOCK ALERT
// ========================================
function renderLowStockAlert() {
    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5);
    const alertContainer = document.getElementById('low-stock-alert');
    
    if (lowStockProducts.length === 0) {
        alertContainer.classList.add('hidden');
        alertContainer.innerHTML = '';
        return;
    }
    
    alertContainer.classList.remove('hidden');
    alertContainer.innerHTML = `
        <div class="low-stock-alert">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p>
                ⚠️ <strong>${lowStockProducts.length} product${lowStockProducts.length > 1 ? 's' : ''}</strong> running low on stock: 
                <span class="low-stock-items">${lowStockProducts.map(p => `${p.name} (${p.stock} left)`).join(', ')}</span>
            </p>
        </div>
    `;
}

// ========================================
// RENDER INVENTORY
// ========================================
function renderInventory(filteredProducts = null) {
    const tbody = document.getElementById('inventory-table');
    const displayProducts = filteredProducts || products;
    
    document.getElementById('inventory-count').textContent = `${displayProducts.length} product${displayProducts.length !== 1 ? 's' : ''} in inventory`;

    if (displayProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 bg-bg-alt rounded-full flex items-center justify-center">
                        <svg class="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                        </svg>
                    </div>
                    <h3 class="font-serif text-lg font-semibold text-text mb-1">No products</h3>
                    <p class="text-sm text-text-muted">${searchProductTerm ? 'No products match your search.' : 'Add your first product above!'}</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = displayProducts.map(product => {
        const stockColor = product.stock <= 0 ? 'bg-error' : product.stock <= 5 ? 'bg-warning' : 'bg-success';
        const stockPct = Math.min((product.stock / 50) * 100, 100);
        
        return `
            <tr class="border-b border-border hover:bg-bg-alt/50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/60'}" alt="${product.name}" 
                             class="w-12 h-12 rounded-lg object-cover border border-border"
                             onerror="this.src='https://via.placeholder.com/60'">
                        <div>
                            <p class="font-semibold text-text text-sm">${product.name}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 bg-bg-alt rounded-full text-xs font-semibold text-text-secondary capitalize">${product.category || 'N/A'}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="font-semibold text-text">৳ ${product.price}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <span class="font-semibold text-sm ${product.stock <= 0 ? 'text-error' : product.stock <= 5 ? 'text-warning' : 'text-text'}">${product.stock}</span>
                        <div class="stock-indicator w-24">
                            <div class="stock-indicator-fill ${stockColor}" style="width: ${stockPct}%"></div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="openEditModal('${product.id}')" class="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors" title="Edit">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button onclick="openDeleteModal('${product.id}')" class="p-2 text-error hover:bg-error/10 rounded-lg transition-colors" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ========================================
// SEARCH PRODUCTS
// ========================================
window.searchProducts = function() {
    searchProductTerm = document.getElementById('search-products')?.value?.toLowerCase() || '';
    if (!searchProductTerm) {
        renderInventory();
        return;
    }
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchProductTerm) ||
        (p.category || '').toLowerCase().includes(searchProductTerm)
    );
    renderInventory(filtered);
};

// ========================================
// ADD PRODUCT
// ========================================
async function handleAddProduct(e) {
    e.preventDefault();

    const name = document.getElementById('p-name').value;
    const category = document.getElementById('p-category').value;
    const description = document.getElementById('p-desc').value;
    const socialLink = document.getElementById('p-social').value;
    const price = parseInt(document.getElementById('p-price').value);
    const stock = parseInt(document.getElementById('p-stock').value);
    const imageFile = document.getElementById('p-image').files[0];

    if (!imageFile) {
        showToast('Please select an image', 'error');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Uploading...
    `;

    try {
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        
        const cloudinaryRes = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData
        });
        const cloudinaryData = await cloudinaryRes.json();
        
        if (!cloudinaryRes.ok || !cloudinaryData.secure_url) {
            const errorMsg = cloudinaryData.error?.message || 'Failed to upload image to Cloudinary';
            throw new Error(`Cloudinary Error: ${errorMsg}. (Check if your upload preset "${CLOUDINARY_PRESET}" exists and is set to Unsigned)`);
        }

        const imageUrl = cloudinaryData.secure_url;

        // Save to Firestore
        await addDoc(collection(db, "products"), {
            name,
            category,
            description,
            socialLink,
            price,
            stock,
            imageUrl,
            createdAt: new Date().toISOString()
        });

        showToast('Product added successfully! 🎉', 'success');
        document.getElementById('add-product-form').reset();
        document.getElementById('file-label').classList.remove('has-file');

        loadInventory();
        
    } catch (error) {
        console.error("Error adding product:", error);
        showToast('Failed to add product', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
    }
}

// ========================================
// EDIT PRODUCT
// ========================================
window.openEditModal = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('edit-id').value = productId;
    document.getElementById('edit-name').value = product.name;
    document.getElementById('edit-social').value = product.socialLink || '';
    document.getElementById('edit-price').value = product.price;
    document.getElementById('edit-stock').value = product.stock;

    const modal = document.getElementById('edit-modal');
    modal.classList.remove('opacity-0', 'invisible');
};

window.closeEditModal = function() {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('opacity-0', 'invisible');
};

async function handleEditProduct(e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const name = document.getElementById('edit-name').value;
    const socialLink = document.getElementById('edit-social').value;
    const price = parseInt(document.getElementById('edit-price').value);
    const stock = parseInt(document.getElementById('edit-stock').value);

    try {
        const productRef = doc(db, "products", id);
        await updateDoc(productRef, { name, socialLink, price, stock });

        showToast('Product updated! ✅', 'success');
        closeEditModal();
        loadInventory();

    } catch (error) {
        console.error("Error updating product:", error);
        showToast('Failed to update product', 'error');
    }
}

// ========================================
// DELETE PRODUCT
// ========================================
window.openDeleteModal = function(productId) {
    deleteProductId = productId;
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('opacity-0', 'invisible');
};

window.closeDeleteModal = function() {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('opacity-0', 'invisible');
    deleteProductId = null;
};

window.confirmDelete = async function() {
    if (!deleteProductId) return;

    try {
        await deleteDoc(doc(db, "products", deleteProductId));
        showToast('Product deleted', 'success');
        closeDeleteModal();
        loadInventory();

    } catch (error) {
        console.error("Error deleting product:", error);
        showToast('Failed to delete product', 'error');
    }
};

// ========================================
// IMAGE PREVIEW
// ========================================
window.previewImage = function(input) {
    const label = document.getElementById('file-label');
    if (input.files && input.files[0]) {
        label.classList.add('has-file');
        label.innerHTML = `
            <svg class="w-8 h-8 text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="text-sm text-primary font-semibold">${input.files[0].name}</span>
        `;
    } else {
        label.classList.remove('has-file');
        label.innerHTML = `
            <svg class="w-8 h-8 text-text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span class="text-sm text-text-muted">Click to upload image</span>
        `;
    }
};

// ========================================
// SIDEBAR
// ========================================
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
};

// ========================================
// TOAST
// ========================================
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');

    const colors = {
        success: 'border-l-success bg-success/5',
        error: 'border-l-error bg-error/5',
        warning: 'border-l-warning bg-warning/5'
    };

    const icons = {
        success: '<svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
        warning: '<svg class="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 bg-surface rounded-xl shadow-xl border-l-4 ${colors[type]} animate-slide-in-up`;
    toast.innerHTML = `
        ${icons[type]}
        <span class="text-sm font-medium text-text">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 right-6 z-[200] flex flex-col gap-3';
    document.body.appendChild(container);
    return container;
}