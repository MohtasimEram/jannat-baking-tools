// ========================================
// JANNAT BAKING TOOLS - MAIN APP
// Shop functionality with Firebase
// ========================================

import {
    db,
    storage,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp,
    ref,
    uploadBytes,
    getDownloadURL
} from "./firebase.js";

// ========================================
// STATE
// ========================================
let cart = JSON.parse(localStorage.getItem('jannat_cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('jannat_wishlist')) || [];
let products = [];
let currentCategory = 'all';
let currentSort = 'default';

// HELPER FUNCTIONS
function saveCart() {
    localStorage.setItem('jannat_cart', JSON.stringify(cart));
}

function saveWishlist() {
    localStorage.setItem('jannat_wishlist', JSON.stringify(wishlist));
}

// ========================================
// INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartUI();
    updateWishlistBadge();
    setupEventListeners();
    setupBackToTop();
    updateDeliveryFee();
});

function setupEventListeners() {
    document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
}

// ========================================
// BACK TO TOP
// ========================================
function setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });
}

window.scrollToTop = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ========================================
// DELIVERY FEE
// ========================================
window.updateDeliveryFee = function () {
    const location = document.getElementById('delivery-location');
    const feeDisplay = document.getElementById('delivery-fee-display');
    if (!location || !feeDisplay) return;

    const fee = location.value === 'Inside CTG' ? 80 : 150;
    feeDisplay.textContent = `৳ ${fee}`;
    feeDisplay.classList.add('has-fee');

    // Recalculate total
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const totalEl = document.getElementById('cart-total');
    if (totalEl) {
        totalEl.textContent = `৳ ${subtotal + fee}`;
    }
};

function getDeliveryFee() {
    const location = document.getElementById('delivery-location');
    if (!location) return 60;
    return location.value === 'Inside CTG' ? 80 : 150;
}

// ========================================
// LOAD PRODUCTS FROM FIREBASE
// ========================================
async function loadProducts() {
    try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);

        products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        updateCategoryCounts();
        renderProducts();

        // Check for product link in URL and auto-open modal
        checkProductLink();
    } catch (error) {
        console.error("Error loading products:", error);
        showToast("Failed to load products. Please refresh.", "error");

        document.getElementById('product-grid').innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-text-muted">Failed to load products. Please try again.</p>
                <button onclick="location.reload()" class="mt-4 px-6 py-2 bg-primary text-white rounded-lg">Retry</button>
            </div>
        `;
    }
}

// ========================================
// PRODUCT DEEP LINKING
// ========================================
function checkProductLink() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            // Small delay to let the page render first
            setTimeout(() => {
                openProductModal(productId);
                // Scroll to products section
                const section = document.getElementById('products-section');
                if (section) section.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        }
    }
}

// ========================================
// CATEGORY COUNTS
// ========================================
function updateCategoryCounts() {
    const categories = ['molds', 'tools', 'decor', 'essence'];
    categories.forEach(cat => {
        const count = products.filter(p => p.category === cat).length;
        const el = document.getElementById(`count-${cat}`);
        if (el) el.textContent = `${count} items`;
    });
}

// ========================================
// RENDER PRODUCTS
// ========================================
function renderProducts(filteredProducts = null) {
    const grid = document.getElementById('product-grid');
    let displayProducts = filteredProducts || products;

    // Apply category filter
    if (!filteredProducts && currentCategory !== 'all') {
        displayProducts = products.filter(p => p.category === currentCategory);
    }

    // Apply search
    const searchVal = document.getElementById('search-input')?.value?.toLowerCase() || '';
    if (searchVal) {
        displayProducts = displayProducts.filter(p =>
            p.name.toLowerCase().includes(searchVal) ||
            (p.description && p.description.toLowerCase().includes(searchVal))
        );
    }

    // Apply sort
    displayProducts = sortArray(displayProducts);

    if (displayProducts.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full empty-state py-16">
                <div class="w-20 h-20 mx-auto mb-4 bg-bg-alt rounded-full flex items-center justify-center">
                    <svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </div>
                <h3 class="font-serif text-lg font-semibold text-text mb-2">No products found</h3>
                <p class="text-sm text-text-muted">Try adjusting your search or filter</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = displayProducts.map((product, index) => {
        const isWishlisted = wishlist.includes(product.id);
        return `
        <div class="product-card bg-surface rounded-2xl border border-border overflow-hidden shadow-soft animate-fade-in" 
             style="animation-delay: ${index * 0.05}s"
             onclick="openProductModal('${product.id}')">
            <div class="product-image relative aspect-[4/3] overflow-hidden bg-bg-alt">
                <img src="${product.imageUrl || 'https://via.placeholder.com/400x300'}" 
                     alt="${product.name}" 
                     class="w-full h-full object-cover transition-transform duration-500"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/400x300'">
                ${product.stock > 0 ? `<span class="absolute top-3 right-3 px-3 py-1.5 text-white text-xs font-bold rounded-lg shadow-md ${product.stock < 5 ? 'bg-red-500' : product.stock < 15 ? 'bg-amber-500' : 'bg-emerald-500'}">${product.stock} in stock</span>` : `<span class="absolute top-3 right-3 px-3 py-1.5 bg-gray-500 text-white text-xs font-bold rounded-lg shadow-md">Out of Stock</span>`}
                
                <button onclick="event.stopPropagation(); toggleWishlist('${product.id}')" 
                        class="wishlist-btn ${isWishlisted ? 'active' : ''}" title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">
                    <svg fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                </button>
                
                <button onclick="event.stopPropagation(); addToCart('${product.id}')" 
                        class="quick-add absolute bottom-3 right-3 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                </button>
            </div>
            <div class="p-4">
                <h3 class="font-serif font-bold text-text mb-1 line-clamp-2">${product.name}</h3>
                <p class="text-primary font-bold text-lg">৳ ${product.price}</p>
            </div>
        </div>
    `;
    }).join('');
}

// ========================================
// SORT PRODUCTS
// ========================================
function sortArray(arr) {
    const sorted = [...arr];
    switch (currentSort) {
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
    }
    return sorted;
}

window.sortProducts = function () {
    currentSort = document.getElementById('sort-select').value;
    renderProducts();
};

// ========================================
// WISHLIST
// ========================================
window.toggleWishlist = function (productId) {
    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        showToast('Removed from wishlist', 'success');
    } else {
        wishlist.push(productId);
        showToast('Added to wishlist! ❤️', 'success');
    }
    saveWishlist();
    updateWishlistBadge();
    renderWishlistPanel();
    renderProducts();
};

// ========================================
// WISHLIST PANEL
// ========================================
window.toggleWishlistPanel = function () {
    const panel = document.getElementById('wishlist-panel');
    const overlay = document.getElementById('wishlist-overlay');
    if (!panel || !overlay) return;

    panel.classList.toggle('translate-x-full');
    overlay.classList.toggle('opacity-0');
    overlay.classList.toggle('invisible');
    document.body.classList.toggle('overflow-hidden');

    // Render when opening
    if (!panel.classList.contains('translate-x-full')) {
        renderWishlistPanel();
    }
};

function renderWishlistPanel() {
    const container = document.getElementById('wishlist-items');
    const countEl = document.getElementById('wishlist-item-count');
    if (!container) return;

    const wishlistedProducts = products.filter(p => wishlist.includes(p.id));

    if (countEl) {
        countEl.textContent = `${wishlistedProducts.length} item${wishlistedProducts.length !== 1 ? 's' : ''}`;
    }

    if (wishlistedProducts.length === 0) {
        container.innerHTML = `
            <div class="empty-state py-12">
                <div class="w-20 h-20 mx-auto mb-4 bg-bg-alt rounded-full flex items-center justify-center">
                    <svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                </div>
                <h3 class="font-serif text-lg font-semibold text-text mb-2">Your wishlist is empty</h3>
                <p class="text-sm text-text-muted">Tap the heart on items you love!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = wishlistedProducts.map(product => `
        <div class="wishlist-item animate-fade-in">
            <img src="${product.imageUrl || 'https://via.placeholder.com/100'}" alt="${product.name}" class="wishlist-item-image">
            <div class="wishlist-item-details">
                <h4 class="wishlist-item-name">${product.name}</h4>
                <p class="wishlist-item-price">৳ ${product.price}</p>
                <button onclick="addToCart('${product.id}'); showToast('Added to cart!', 'success');" 
                        class="wishlist-add-cart-btn" ${product.stock <= 0 ? 'disabled' : ''}>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                    </svg>
                    ${product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
            </div>
            <button onclick="toggleWishlist('${product.id}')" class="wishlist-remove-btn" title="Remove from wishlist">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function updateWishlistBadge() {
    const count = wishlist.length;

    // Desktop badge
    const badge = document.getElementById('wishlist-count');
    if (badge) {
        badge.textContent = count;
        badge.classList.toggle('scale-0', count === 0);
        badge.classList.toggle('scale-100', count > 0);
    }

    // Mobile badge
    const mobileBadge = document.getElementById('mobile-wishlist-badge');
    if (mobileBadge) {
        mobileBadge.textContent = count;
        mobileBadge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// ========================================
// FILTER PRODUCTS
// ========================================
window.filterProducts = function () {
    renderProducts();
};

window.filterByCategory = function (category) {
    currentCategory = category;

    // Update pill active state
    document.querySelectorAll('.category-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === category);
    });

    // Update category card active state  
    document.querySelectorAll('.category-card').forEach(card => {
        card.style.borderColor = card.dataset.category === category ? '#E85A4F' : '';
    });

    renderProducts();
};

// ========================================
// CART FUNCTIONS
// ========================================
window.addToCart = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) {
        showToast('Product is out of stock!', 'error');
        return;
    }

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        if (existingItem.qty < product.stock) {
            existingItem.qty++;
            showToast('Quantity updated!', 'success');
        } else {
            showToast('Maximum stock reached!', 'warning');
            return;
        }
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            qty: 1
        });
        showToast(`${product.name} added to cart!`, 'success');
    }

    saveCart();
    updateCartUI();

    // Animate cart icon
    const cartBtn = document.getElementById('cart-btn');
    cartBtn.classList.add('animate-shake');
    setTimeout(() => cartBtn.classList.remove('animate-shake'), 400);
};

function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    const cartItems = document.getElementById('cart-items');
    const cartFooter = document.getElementById('cart-footer');
    const cartItemCount = document.getElementById('cart-item-count');
    const cartSubtotal = document.getElementById('cart-subtotal');
    const cartTotal = document.getElementById('cart-total');

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const deliveryFee = cart.length > 0 ? getDeliveryFee() : 0;

    // Update badge
    cartCount.textContent = totalItems;
    cartCount.classList.toggle('scale-0', totalItems === 0);
    cartCount.classList.toggle('scale-100', totalItems > 0);

    // Update mobile cart badge
    const mobileBadge = document.getElementById('mobile-cart-badge');
    if (mobileBadge) {
        mobileBadge.textContent = totalItems;
        mobileBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    // Update item count text
    cartItemCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;

    // Show/hide footer
    cartFooter.classList.toggle('hidden', cart.length === 0);

    // Update totals
    cartSubtotal.textContent = `৳ ${subtotal}`;
    cartTotal.textContent = `৳ ${subtotal + deliveryFee}`;

    // Update delivery fee display
    const feeDisplay = document.getElementById('delivery-fee-display');
    if (feeDisplay && cart.length > 0) {
        feeDisplay.textContent = `৳ ${deliveryFee}`;
        feeDisplay.classList.add('has-fee');
    }

    // Render items
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-state py-12 my-auto">
                <div class="w-20 h-20 mx-auto mb-4 bg-bg-alt rounded-full flex items-center justify-center">
                    <svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                    </svg>
                </div>
                <h3 class="font-serif text-lg font-semibold text-text mb-2">Your cart is empty</h3>
                <p class="text-sm text-text-muted">Add some delicious items to get started!</p>
            </div>
        `;
    } else {
        cartItems.innerHTML = '<div class="my-auto w-full">' + cart.map(item => `
            <div class="cart-item cart-item-new">
                <img src="${item.imageUrl || 'https://via.placeholder.com/100'}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <h4 class="cart-item-name">${item.name}</h4>
                    <p class="cart-item-price">৳ ${item.price} <span class="text-text-muted text-xs">× ${item.qty} = ৳ ${item.price * item.qty}</span></p>
                    <div class="cart-item-qty">
                        <button onclick="updateQty('${item.id}', -1)" class="qty-btn">−</button>
                        <span class="font-semibold text-text">${item.qty}</span>
                        <button onclick="updateQty('${item.id}', 1)" class="qty-btn">+</button>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.id}')" class="p-2 text-text-muted hover:text-error transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `).join('') + '</div>';
    }
}

window.updateQty = function (productId, change) {
    const item = cart.find(i => i.id === productId);
    const product = products.find(p => p.id === productId);

    if (!item) return;

    const newQty = item.qty + change;

    if (newQty <= 0) {
        removeFromCart(productId);
    } else if (newQty <= (product?.stock || 0)) {
        item.qty = newQty;
        saveCart();
        updateCartUI();
    } else {
        showToast('Maximum stock reached!', 'warning');
    }
};

window.removeFromCart = function (productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showToast('Item removed from cart', 'success');
};

window.toggleCart = function () {
    const panel = document.getElementById('cart-panel');
    const overlay = document.getElementById('cart-overlay');

    panel.classList.toggle('translate-x-full');
    overlay.classList.toggle('opacity-0');
    overlay.classList.toggle('invisible');
    document.body.classList.toggle('overflow-hidden');
};

// ========================================
// PRODUCT MODAL
// ========================================
window.openProductModal = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Update URL with product ID (without reloading)
    const url = new URL(window.location);
    url.searchParams.set('product', productId);
    window.history.replaceState({}, '', url);

    document.getElementById('modal-img').src = product.imageUrl || 'https://via.placeholder.com/600x400';
    document.getElementById('modal-title').textContent = product.name;
    document.getElementById('modal-price').innerHTML = `৳ ${product.price} <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ml-3 ${product.stock < 5 ? 'bg-red-500 text-white' : product.stock < 15 ? 'bg-amber-500 text-white' : product.stock > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}">${product.stock > 0 ? product.stock + ' left' : 'Out of Stock'}</span>`;
    const descText = product.description || 'No description available.';
    // Convert URLs to clickable styled links
    const formattedDesc = descText.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" class="text-primary hover:text-primary-dark underline decoration-primary/30 hover:decoration-primary transition-all break-all">$1</a>'
    );
    document.getElementById('modal-desc').innerHTML = formattedDesc;
    
    // Social Link rendering
    const socialContainer = document.getElementById('modal-social-container');
    const socialLinkEl = document.getElementById('modal-social-link');
    const socialIcon = document.getElementById('modal-social-icon');
    const socialText = document.getElementById('modal-social-text');

    if (product.socialLink) {
        socialContainer.classList.remove('hidden');
        socialLinkEl.href = product.socialLink;
        
        if (product.socialLink.includes('instagram.com')) {
            socialLinkEl.className = 'inline-flex items-center gap-2 px-4 py-2.5 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-xl text-sm font-semibold transition-colors';
            socialText.textContent = 'View on Instagram';
            socialIcon.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clip-rule="evenodd" /></svg>';
        } else {
            // Default to Facebook / Generic
            socialLinkEl.className = 'inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-semibold transition-colors';
            socialText.textContent = 'View on Facebook';
            socialIcon.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clip-rule="evenodd" /></svg>';
        }
    } else {
        socialContainer.classList.add('hidden');
    }

    const addBtn = document.getElementById('modal-add-btn');
    addBtn.onclick = () => {
        addToCart(productId);
        closeModal();
    };
    addBtn.disabled = product.stock <= 0;
    addBtn.classList.toggle('opacity-50', product.stock <= 0);

    // Wire up share button
    const shareBtn = document.getElementById('modal-share-btn');
    shareBtn.onclick = (e) => {
        e.stopPropagation();
        copyProductLink(productId);
    };

    const modal = document.getElementById('product-modal');
    modal.classList.remove('opacity-0', 'invisible');
    modal.querySelector('.relative').classList.remove('scale-95');
    modal.querySelector('.relative').classList.add('scale-100');
    document.body.classList.add('overflow-hidden');
};

window.closeModal = function () {
    const modal = document.getElementById('product-modal');
    modal.classList.add('opacity-0', 'invisible');
    modal.querySelector('.relative').classList.add('scale-95');
    modal.querySelector('.relative').classList.remove('scale-100');
    document.body.classList.remove('overflow-hidden');

    // Remove product ID from URL
    const url = new URL(window.location);
    url.searchParams.delete('product');
    window.history.replaceState({}, '', url);
};

// ========================================
// COPY PRODUCT LINK
// ========================================
window.copyProductLink = function (productId) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('product', productId);
    const link = url.toString();

    navigator.clipboard.writeText(link).then(() => {
        showToast('Product link copied! 🔗', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Product link copied! 🔗', 'success');
    });
};

// ========================================
// CHECKOUT
// ========================================
async function handleCheckout(e) {
    e.preventDefault();

    if (cart.length === 0) {
        showToast('Your cart is empty!', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnContent = submitBtn.innerHTML;

    const name = document.getElementById('cust-name').value;
    const address = document.getElementById('cust-address').value;
    const phone = document.getElementById('cust-phone').value;
    const location = document.getElementById('delivery-location').value;
    const notes = document.getElementById('order-notes')?.value || '';
    const deliveryFee = getDeliveryFee();

    // Disable Button & Show Spinner
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing...
    `;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const total = subtotal + deliveryFee;

    const orderData = {
        customer: { name, address, phone, location },
        cart: cart.map(item => ({
            name: item.name,
            qty: item.qty,
            price: item.price
        })),
        total: `৳ ${total}`,
        subtotal: `৳ ${subtotal}`,
        deliveryFee: `৳ ${deliveryFee}`,
        notes: notes,
        status: 'Pending',
        payment: {
            method: 'Cash on Delivery',
            trxId: null
        },
        date: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "orders"), orderData);

        // --- Telegram Notification ---
        const botToken = '8732117075:AAFt4i3wtC1g3vujq_5QWDxDmjBZucG9dkg';
        // TODO: REMEMBER TO CHANGE CHAT ID TO CLIENT'S BEFORE DEPLOYMENT
        const chatId = '6162073059';
        
        let messageText = `🎊 <b>NEW ORDER RECEIVED!</b>\n\n`;
        messageText += `👤 <b>Customer:</b> ${name}\n`;
        messageText += `📞 <b>Phone:</b> ${phone}\n`;
        messageText += `📍 <b>Address:</b> ${address} (${location})\n`;
        if (notes) messageText += `📝 <b>Notes:</b> ${notes}\n`;
        
        messageText += `\n🛍️ <b>ITEMS:</b>\n`;
        cart.forEach(item => {
            messageText += `- ${item.name} (x${item.qty}) = ৳${item.price * item.qty}\n`;
        });
        
        messageText += `\n💰 <b>Subtotal:</b> ৳${subtotal}\n`;
        messageText += `🚚 <b>Delivery:</b> ৳${deliveryFee}\n`;
        messageText += `💵 <b>TOTAL:</b> ৳${total}\n`;
        
        // Send to Telegram asynchronously
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'HTML'
            })
        }).catch(err => console.error("Telegram notification error:", err));
        // -----------------------------

        // Update product stock (Wrapped in try/catch so permission errors don't crash checkout)
        try {
            for (const item of cart) {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    const productRef = doc(db, "products", item.id);
                    await updateDoc(productRef, {
                        stock: product.stock - item.qty
                    });
                }
            }
        } catch (stockError) {
            console.warn("Stock update skipped (likely due to security rules). Order still placed successfully.");
        }

        // Show success
        toggleCart();
        const successModal = document.getElementById('success-modal');
        successModal.classList.remove('opacity-0', 'invisible');
        successModal.querySelector('.relative').classList.remove('scale-95');
        successModal.querySelector('.relative').classList.add('scale-100');

        // Clear cart and reload products
        cart = [];
        localStorage.removeItem('jannat_cart');
        updateCartUI();
        loadProducts();

        // Reset form fields
        e.target.reset();

    } catch (error) {
        console.error("Checkout error:", error);
        showToast('Failed to place order. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
    }
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
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