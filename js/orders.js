// ========================================
// JANNAT BAKING TOOLS - ORDERS JS
// Order management with Firebase
// ========================================

import { 
    db,
    collection, 
    doc, 
    getDocs, 
    updateDoc, 
    query, 
    where, 
    orderBy,
    onSnapshot
} from "./firebase.js";

// ========================================
// STATE
// ========================================
let allOrders = [];
let currentFilter = 'all';
let currentDateRange = 'all';
let searchTerm = '';
let pendingAction = null;

// ========================================
// INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
});

// ========================================
// LOAD ORDERS
// ========================================
async function loadOrders() {
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, orderBy("date", "desc"));
        
        onSnapshot(q, (snapshot) => {
            allOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            updateStats();
            renderOrders();
        }, (error) => {
            console.error("Error loading orders:", error);
            showToast("Failed to load orders", "error");
        });
        
    } catch (error) {
        console.error("Error setting up orders listener:", error);
    }
}

// ========================================
// UPDATE STATISTICS
// ========================================
function updateStats() {
    const revenue = allOrders
        .filter(o => o.status === 'Delivered')
        .reduce((sum, o) => {
            const amount = parseInt(o.total?.replace(/[^0-9]/g, '') || 0);
            return sum + amount;
        }, 0);

    const pending = allOrders.filter(o => o.status === 'Pending').length;
    const total = allOrders.length;

    // Today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = allOrders.filter(o => {
        const date = o.date?.toDate ? o.date.toDate() : new Date(o.date);
        return date >= today;
    }).length;

    document.getElementById('total-revenue').textContent = `৳ ${revenue.toLocaleString()}`;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('total-orders').textContent = total;
    document.getElementById('today-count').textContent = todayCount;

    // Update badges
    const badge = document.getElementById('pending-badge');
    const tabBadge = document.getElementById('tab-pending-count');
    if (pending > 0) {
        badge.textContent = pending;
        badge.classList.remove('hidden');
        tabBadge.textContent = pending;
        tabBadge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
        tabBadge.classList.add('hidden');
    }
}

// ========================================
// SEARCH ORDERS
// ========================================
window.searchOrders = function() {
    // Support both desktop and mobile search inputs
    const desktopInput = document.getElementById('order-search');
    const mobileInput = document.getElementById('order-search-mobile');
    searchTerm = (desktopInput?.value || mobileInput?.value || '').toLowerCase();
    renderOrders();
};

// ========================================
// DATE RANGE FILTER
// ========================================
window.filterByDate = function(range) {
    currentDateRange = range;
    
    // Update active pill
    document.querySelectorAll('.date-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.range === range);
    });
    
    renderOrders();
};

function getDateFilteredOrders(orders) {
    if (currentDateRange === 'all') return orders;
    
    const now = new Date();
    let startDate;
    
    switch (currentDateRange) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            return orders;
    }
    
    return orders.filter(o => {
        const date = o.date?.toDate ? o.date.toDate() : new Date(o.date);
        return date >= startDate;
    });
}

// ========================================
// RENDER ORDERS
// ========================================
function renderOrders() {
    const container = document.getElementById('orders-container');

    let filtered = allOrders;
    
    // Apply status filter
    if (currentFilter !== 'all') {
        if (currentFilter === 'history') {
            filtered = filtered.filter(o => o.status === 'Delivered' || o.status === 'Cancelled');
        } else {
            filtered = filtered.filter(o => o.status.toLowerCase() === currentFilter);
        }
    }
    
    // Apply date range filter
    filtered = getDateFilteredOrders(filtered);
    
    // Apply search
    if (searchTerm) {
        filtered = filtered.filter(o => 
            (o.customer?.name || '').toLowerCase().includes(searchTerm) ||
            (o.customer?.phone || '').toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state text-center py-16">
                <div class="empty-icon w-24 h-24 mx-auto mb-6 bg-bg-alt rounded-full flex items-center justify-center">
                    <svg class="w-12 h-12 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                </div>
                <h3 class="font-serif text-xl font-semibold text-text mb-2">No orders found</h3>
                <p class="text-text-muted">${searchTerm ? 'No orders match your search.' : `No ${currentFilter} orders at the moment.`}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(order => {
        const statusClass = {
            'Pending': 'status-pending',
            'Delivered': 'status-delivered',
            'Cancelled': 'status-cancelled'
        }[order.status] || 'status-pending';

        const statusIcon = {
            'Pending': '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            'Delivered': '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
            'Cancelled': '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
        }[order.status] || '';

        const itemsList = (order.cart || []).map(item => `
            <div class="flex justify-between text-sm py-1.5 border-b border-dashed border-border last:border-0">
                <span class="text-text-secondary">${item.name} <span class="text-text-muted">×${item.qty}</span></span>
                <span class="font-medium text-text">৳${item.price * item.qty}</span>
            </div>
        `).join('');

        const date = order.date?.toDate ? order.date.toDate() : new Date(order.date);
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="order-card bg-surface rounded-2xl p-6 border border-border mb-4">
                <div class="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div class="flex-1">
                        <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
                            <div>
                                <div class="flex items-center gap-3 mb-1">
                                    <h3 class="font-serif text-lg font-bold text-text">${order.customer?.name || 'Unknown'}</h3>
                                    <span class="${statusClass} inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold">
                                        ${statusIcon}
                                        ${order.status}
                                    </span>
                                </div>
                                <p class="text-sm text-text-secondary">${order.customer?.phone || 'No phone'}</p>
                                <p class="text-sm text-text-muted mt-1">${order.customer?.address || 'No address'}${order.customer?.location ? ` • ${order.customer.location}` : ''}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-serif text-2xl font-bold text-primary">${order.total}</p>
                                <p class="text-xs text-text-muted mt-1">${dateStr}</p>
                                ${order.deliveryFee ? `<p class="text-xs text-text-muted">Delivery: ${order.deliveryFee}</p>` : ''}
                            </div>
                        </div>
                        
                        <div class="bg-bg-alt rounded-xl p-4 mb-4">
                            <p class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Order Items</p>
                            ${itemsList || '<p class="text-sm text-text-muted">No items</p>'}
                        </div>

                        ${order.notes ? `
                        <div class="bg-accent/5 rounded-xl p-4 mb-4 border border-accent/20">
                            <p class="text-xs font-semibold text-accent uppercase tracking-wider mb-1">Customer Note</p>
                            <p class="text-sm text-text-secondary">${order.notes}</p>
                        </div>
                        ` : ''}
                        
                        <div class="flex items-center gap-4 text-sm">
                            <span class="text-text-muted">Payment:</span>
                            <span class="font-medium text-text capitalize">${order.payment?.method || 'Unknown'}</span>
                            ${order.payment?.trxId ? `<span class="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">Trx: ${order.payment.trxId}</span>` : ''}
                        </div>
                    </div>
                    
                    ${order.status === 'Pending' ? `
                        <div class="flex lg:flex-col gap-2">
                            <button onclick="showConfirmModal('deliver', '${order.id}')" 
                                    class="btn-action flex items-center gap-2 px-4 py-2 bg-success text-white rounded-xl text-sm font-semibold hover:bg-success/90">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                </svg>
                                Deliver
                            </button>
                            <button onclick="showConfirmModal('cancel', '${order.id}')" 
                                    class="btn-action flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-xl text-sm font-semibold hover:bg-error/20">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                                Cancel
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// FILTER ORDERS
// ========================================
window.filterOrders = function(filter) {
    currentFilter = filter;

    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });

    renderOrders();
};

// ========================================
// CONFIRM MODAL
// ========================================
window.showConfirmModal = function(action, orderId) {
    pendingAction = { action, orderId };

    const modal = document.getElementById('confirm-modal');
    const icon = document.getElementById('confirm-icon');
    const title = document.getElementById('confirm-title');
    const message = document.getElementById('confirm-message');
    const actionBtn = document.getElementById('confirm-action');

    if (action === 'deliver') {
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-success/10 rounded-full flex items-center justify-center';
        icon.innerHTML = '<svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        title.textContent = 'Mark as Delivered?';
        message.textContent = 'This will mark the order as completed and add to your revenue.';
        actionBtn.className = 'flex-1 py-3 bg-success text-white rounded-xl font-semibold hover:bg-success/90 transition-colors';
        actionBtn.textContent = 'Yes, Deliver';
    } else {
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-error/10 rounded-full flex items-center justify-center';
        icon.innerHTML = '<svg class="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        title.textContent = 'Cancel Order?';
        message.textContent = 'This action cannot be undone. The order will be marked as cancelled.';
        actionBtn.className = 'flex-1 py-3 bg-error text-white rounded-xl font-semibold hover:bg-error/90 transition-colors';
        actionBtn.textContent = 'Yes, Cancel';
    }

    actionBtn.onclick = executePendingAction;

    modal.classList.remove('opacity-0', 'invisible');
    modal.querySelector('.relative').classList.remove('scale-95');
    modal.querySelector('.relative').classList.add('scale-100');
};

window.closeConfirmModal = function() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('opacity-0', 'invisible');
    modal.querySelector('.relative').classList.add('scale-95');
    modal.querySelector('.relative').classList.remove('scale-100');
    pendingAction = null;
};

async function executePendingAction() {
    if (!pendingAction) return;

    const { action, orderId } = pendingAction;

    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: action === 'deliver' ? 'Delivered' : 'Cancelled'
        });

        showToast(`Order ${action === 'deliver' ? 'delivered' : 'cancelled'} successfully!`, 'success');
        closeConfirmModal();

    } catch (error) {
        console.error("Error updating order:", error);
        showToast('Failed to update order', 'error');
    }
}

// ========================================
// SIDEBAR & UI
// ========================================
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
};

window.refreshOrders = function() {
    const icon = document.getElementById('refresh-icon');
    icon.classList.add('animate-spin');

    setTimeout(() => {
        icon.classList.remove('animate-spin');
        showToast('Orders refreshed!', 'success');
    }, 1000);
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
