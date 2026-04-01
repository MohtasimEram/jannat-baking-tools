// ========================================
// JANNAT BAKING TOOLS - TRACK ORDER JS
// Order tracking with Firebase
// ========================================

import { 
    db,
    collection, 
    query, 
    where, 
    orderBy,
    getDocs
} from "./firebase.js";

// ========================================
// TRACK ORDER
// ========================================
window.trackOrder = async function() {
    const phone = document.getElementById('track-phone').value.trim();
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const container = document.getElementById('results-container');

    if (!phone) {
        showToast('Please enter your phone number', 'error');
        return;
    }

    // Show loading
    btnText.textContent = 'Searching...';
    btnSpinner.classList.remove('hidden');

    container.innerHTML = `
        <div class="flex items-center justify-center gap-3 py-12">
            <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full spinner"></div>
            <span class="text-text-muted">Searching for orders...</span>
        </div>
    `;

    try {
        const ordersRef = collection(db, "orders");
        const q = query(
            ordersRef, 
            where("customer.phone", "==", phone),
            orderBy("date", "desc")
        );

        const snapshot = await getDocs(q);

        btnText.textContent = 'Search';
        btnSpinner.classList.add('hidden');

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="bg-surface rounded-2xl border border-border p-8 text-center">
                    <div class="w-20 h-20 mx-auto mb-4 bg-error/10 rounded-full flex items-center justify-center">
                        <svg class="w-10 h-10 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <h3 class="font-serif text-xl font-bold text-text mb-2">No Orders Found</h3>
                    <p class="text-text-muted mb-4">We couldn't find any orders for <strong>${phone}</strong></p>
                    <div class="text-sm text-text-secondary space-y-1">
                        <p>• Make sure you entered the correct phone number</p>
                        <p>• Check if you used a different number during checkout</p>
                        <p>• Contact us if you need help</p>
                    </div>
                </div>
            `;
            return;
        }

        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Render orders with enhanced timeline
        container.innerHTML = orders.map((order, index) => {
            const statusClass = {
                'Pending': 'status-pending',
                'Delivered': 'status-delivered',
                'Cancelled': 'status-cancelled'
            }[order.status] || 'status-pending';

            const statusIcon = {
                'Pending': '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                'Delivered': '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
                'Cancelled': '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
            }[order.status] || '';

            const itemsList = (order.cart || []).map(item => `
                <div class="flex justify-between items-center py-2 border-b border-dashed border-border last:border-0">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-bg-alt rounded-lg flex items-center justify-center">
                            <span class="text-xs font-bold text-text-muted">${item.qty}×</span>
                        </div>
                        <span class="text-text-secondary">${item.name}</span>
                    </div>
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

            // Enhanced timeline with animated dots
            let timelineHTML = '';
            if (order.status === 'Delivered') {
                timelineHTML = `
                    <div class="timeline-enhanced">
                        <div class="timeline-step completed">
                            <p class="step-title">Order Delivered ✅</p>
                            <p class="step-desc">Your order has been delivered successfully</p>
                        </div>
                        <div class="timeline-step completed">
                            <p class="step-title">Out for Delivery</p>
                            <p class="step-desc">Your order was on the way</p>
                        </div>
                        <div class="timeline-step completed">
                            <p class="step-title">Order Confirmed</p>
                            <p class="step-desc">${dateStr}</p>
                        </div>
                    </div>
                `;
            } else if (order.status === 'Pending') {
                timelineHTML = `
                    <div class="timeline-enhanced">
                        <div class="timeline-step">
                            <p class="step-title text-text-muted">Delivery</p>
                            <p class="step-desc">Estimated within 2-3 days</p>
                        </div>
                        <div class="timeline-step active">
                            <p class="step-title">Processing</p>
                            <p class="step-desc">Your order is being prepared</p>
                        </div>
                        <div class="timeline-step completed">
                            <p class="step-title">Order Confirmed</p>
                            <p class="step-desc">${dateStr}</p>
                        </div>
                    </div>
                `;
            } else {
                timelineHTML = `
                    <div class="timeline-enhanced">
                        <div class="timeline-step cancelled">
                            <p class="step-title">Order Cancelled</p>
                            <p class="step-desc">${dateStr}</p>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="order-card bg-surface rounded-2xl border border-border overflow-hidden mb-6 animate-slide-in-bottom" style="animation-delay: ${index * 0.1}s">
                    <div class="p-6 border-b border-border">
                        <div class="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="text-sm font-mono text-text-muted">#${order.id.slice(-6).toUpperCase()}</span>
                                    <span class="${statusClass} inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold">
                                        ${statusIcon}
                                        ${order.status}
                                    </span>
                                </div>
                                <p class="font-serif text-2xl font-bold text-primary">${order.total}</p>
                                ${order.deliveryFee ? `<p class="text-xs text-text-muted mt-1">Includes delivery: ${order.deliveryFee}</p>` : ''}
                            </div>
                            <div class="text-right">
                                <p class="text-sm text-text-muted">${dateStr}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="p-6">
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h4 class="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Order Items</h4>
                                <div class="bg-bg-alt rounded-xl p-4">
                                    ${itemsList || '<p class="text-sm text-text-muted">No items</p>'}
                                </div>
                                
                                <div class="mt-4 flex items-center justify-between text-sm">
                                    <span class="text-text-muted">Payment Method</span>
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium text-text capitalize">${order.payment?.method || 'Unknown'}</span>
                                        ${order.payment?.trxId ? `<span class="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">${order.payment.trxId}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <h4 class="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Order Status</h4>
                                ${timelineHTML}
                            </div>
                        </div>
                        
                        <div class="mt-6 pt-6 border-t border-border">
                            <h4 class="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Delivery Details</h4>
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 bg-primary-subtle rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                    </svg>
                                </div>
                                <div>
                                    <p class="font-semibold text-text">${order.customer?.name || 'Unknown'}</p>
                                    <p class="text-sm text-text-secondary">${order.customer?.phone || 'No phone'}</p>
                                    <p class="text-sm text-text-muted mt-1">${order.customer?.address || 'No address'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error tracking order:", error);
        btnText.textContent = 'Search';
        btnSpinner.classList.add('hidden');
        
        if (error.message.includes('requires an index')) {
            container.innerHTML = `
                <div class="bg-surface rounded-2xl border border-border p-8 text-center">
                    <div class="w-20 h-20 mx-auto mb-4 bg-warning/10 rounded-full flex items-center justify-center">
                        <svg class="w-10 h-10 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <h3 class="font-serif text-xl font-bold text-text mb-2">Database Index Required</h3>
                    <p class="text-text-muted">Please create a Firestore index for phone + date queries.</p>
                </div>
            `;
        } else {
            showToast('Error searching orders. Please try again.', 'error');
        }
    }
};

// ========================================
// TOAST
// ========================================
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');

    const colors = {
        success: 'border-l-success bg-success/5',
        error: 'border-l-error bg-error/5'
    };

    const icons = {
        success: '<svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
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
