// ========================================================================
// GET /product.html?id=<productId>   (rewritten to /api/product in vercel.json)
//
// WHY THIS EXISTS
// The shop is a static site that renders products in the browser, so the raw
// HTML of product.html says "Product" for every item. Google can run
// JavaScript, but WhatsApp / Facebook / Messenger / Telegram link previews
// cannot — they only read the HTML they are given. This function returns the
// normal product.html with the real product name, description, price, photo,
// canonical URL and Product structured data already written into <head>.
//
// The page itself (js/product.js) still renders exactly as before.
//
// SAFETY: if anything goes wrong the plain, unmodified product.html is
// served instead, so a Firestore hiccup can never break a product page.
// A product that definitely does not exist returns HTTP 404 (+ noindex).
// ========================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const { SITE_URL, getProduct, socialImage, clean } = require('./_lib/firestore');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function esc(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function loadTemplate(req) {
    try {
        return fs.readFileSync(path.join(process.cwd(), 'product.html'), 'utf8');
    } catch (err) {
        // Fallback: fetch the static file (no ?id= so the rewrite doesn't match).
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const response = await fetch(proto + '://' + req.headers.host + '/product.html');
        if (!response.ok) throw new Error('template unavailable');
        return response.text();
    }
}

function categoryLabel(id) {
    const labels = { molds: 'Molds', tools: 'Tools', decor: 'Decor', essence: 'Essence' };
    return labels[id] || '';
}

function buildHead(product) {
    const url = SITE_URL + '/product.html?id=' + encodeURIComponent(product.id);
    const title = product.name + ' — Jannat Baking Tools';
    const fallbackDesc =
        'Buy ' + product.name + ' at Jannat Baking Tools. Cash on delivery and fast shipping across Bangladesh.';
    const description = (product.description || fallbackDesc).slice(0, 160);
    const image = socialImage(product.images[0] || '') || SITE_URL + '/assets/og-default.jpg';

    const jsonld = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': url + '#product',
        sku: product.id,
        name: product.name,
        description: (product.description || fallbackDesc).slice(0, 500),
        image: product.images.length ? product.images : [image],
        category: categoryLabel(product.category) || undefined,
        brand: { '@type': 'Brand', name: 'Jannat Baking Tools' },
        offers: {
            '@type': 'Offer',
            url,
            price: product.price,
            priceCurrency: 'BDT',
            itemCondition: 'https://schema.org/NewCondition',
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: 'Jannat Baking Tools' }
        }
    };
    if (product.colors.length) jsonld.color = product.colors.join(', ');

    return {
        title,
        description,
        tags: [
            '<link rel="canonical" href="' + esc(url) + '">',
            '<meta property="og:site_name" content="Jannat Baking Tools">',
            '<meta property="og:locale" content="en_BD">',
            '<meta property="og:type" content="product">',
            '<meta property="og:title" content="' + esc(product.name) + '">',
            '<meta property="og:description" content="' + esc(description) + '">',
            '<meta property="og:url" content="' + esc(url) + '">',
            '<meta property="og:image" content="' + esc(image) + '">',
            '<meta property="og:image:alt" content="' + esc(product.name) + '">',
            '<meta property="product:price:amount" content="' + product.price + '">',
            '<meta property="product:price:currency" content="BDT">',
            '<meta name="twitter:card" content="summary_large_image">',
            '<meta name="twitter:title" content="' + esc(product.name) + '">',
            '<meta name="twitter:description" content="' + esc(description) + '">',
            '<meta name="twitter:image" content="' + esc(image) + '">',
            // id matches js/product.js so the browser updates this tag instead of adding a second one.
            '<script type="application/ld+json" id="pd-jsonld">' +
                JSON.stringify(jsonld).replace(/</g, '\\u003c') +
                '</script>'
        ].join('\n    ')
    };
}

function inject(template, product) {
    const head = buildHead(product);
    // Drop the generic placeholder social tags from the static file so crawlers
    // (which use the FIRST og:image they see) only ever find the real ones.
    let html = template
        .replace(/[ \t]*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\s*\n?/gi, '')
        .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(head.title) + '</title>')
        .replace(
            /<meta\s+name="description"[\s\S]*?>/i,
            '<meta name="description" content="' + esc(head.description) + '">'
        );
    return html.replace(/<\/head>/i, '    ' + head.tags + '\n</head>');
}

module.exports = async function handler(req, res) {
    const id = clean(req.query && req.query.id, 80);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    let template;
    try {
        template = await loadTemplate(req);
    } catch (error) {
        console.error('[product] template missing', error);
        res.status(500).send('Temporarily unavailable');
        return;
    }

    if (!ID_RE.test(id)) {
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
        res.status(404).send(template.replace('</head>', '<meta name="robots" content="noindex">\n</head>'));
        return;
    }

    try {
        const product = await getProduct(id);
        if (!product) {
            res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
            res.status(404).send(template.replace('</head>', '<meta name="robots" content="noindex">\n</head>'));
            return;
        }
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
        res.status(200).send(inject(template, product));
    } catch (error) {
        console.error('[product] could not enrich page, serving plain template', error);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(template);
    }
};
