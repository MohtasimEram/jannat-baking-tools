// ========================================================================
// WHAT THE CHATBOT KNOWS ABOUT YOUR STORE (besides the live product list)
//
// Everything below is taken from what your website already says. The chatbot
// will only state these as fact — it is told never to invent policies.
//
// >>> EDIT THIS FILE to change what the assistant tells customers. <<<
// Fill in `returns` (and anything under `extra`) with YOUR real rules. While
// `returns` is empty, the assistant tells customers it can't confirm the
// return policy and sends them to WhatsApp instead of guessing.
// ========================================================================

'use strict';

module.exports = {
    storeName: 'Jannat Baking Tools & Home Decor',
    location: 'Chittagong, Bangladesh',
    whatsapp: '01874244466 (https://wa.me/8801874244466)',
    phone: '01874244466',
    email: 'info@jannatbaking.com',
    facebook: 'https://www.facebook.com/share/1AEsBQVnNB/',

    categories: 'Molds (silicone molds), Tools (baking tools), Decor (home decor), Essence (food essence)',

    delivery: [
        'Delivery charge: ৳80 inside Chittagong ("Inside CTG"), ৳150 outside Chittagong ("Outside CTG"). The customer picks the zone at checkout and the charge is added to the total.',
        'Dispatch & timing: same-day dispatch inside Chittagong; 2–3 day nationwide shipping (the tracking page says "within 2–3 working days").',
        'We deliver all across Bangladesh.'
    ],

    payment: 'Cash on Delivery only: the customer pays when the parcel arrives. There is no online payment on the website.',

    ordering: [
        'Add products to the cart (some products need a colour chosen first), open the cart, then fill in name, phone number (11 digits, starting with 01), full delivery address and delivery zone, and place the order.',
        'Orders start as "Pending". Customers can also order or ask questions on WhatsApp.',
        'Wholesale: the site says we offer retail and wholesale rates with no hidden charges. For wholesale quantities or custom requests, customers should message us on WhatsApp.'
    ],

    tracking:
        'Customers track an order on the Track Order page (track.html) using the phone number they ordered with (or their order code). Statuses are Pending, Delivered or Cancelled. You cannot look up individual orders yourself.',

    quality: 'Products are described as food-grade and tested for safety. Only repeat this in general terms; do not promise specific certifications.',

    // ---- FILL THESE IN WITH YOUR REAL POLICIES ----------------------------
    // Leave an empty string if you don't have a rule yet; the assistant will
    // then refer customers to WhatsApp rather than make something up.
    returns: '',
    // Example: 'Damaged or wrong item? Message us on WhatsApp within 24 hours of delivery with a photo and we will replace it.'

    // Any other facts you want the assistant to know (opening hours, how to
    // care for silicone molds, shop address for pickup, etc.). One per line.
    extra: []
};
