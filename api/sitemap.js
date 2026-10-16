// ========================================================================
// GET /sitemap.xml  (rewritten to /api/sitemap in vercel.json)
//
// Builds the sitemap from the live product catalogue, so a product you add
// in the admin panel is discoverable by Google without touching any file.
// ========================================================================

'use strict';

const { SITE_URL, listProducts } = require('./_lib/firestore');

function xml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function isoDate(value) {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}

function urlEntry(loc, opts) {
    let out = '  <url>\n    <loc>' + xml(loc) + '</loc>\n';
    if (opts.lastmod) out += '    <lastmod>' + opts.lastmod + '</lastmod>\n';
    if (opts.changefreq) out += '    <changefreq>' + opts.changefreq + '</changefreq>\n';
    if (opts.priority) out += '    <priority>' + opts.priority + '</priority>\n';
    if (opts.image) out += '    <image:image><image:loc>' + xml(opts.image) + '</image:loc></image:image>\n';
    return out + '  </url>\n';
}

module.exports = async function handler(req, res) {
    let products = [];
    try {
        products = await listProducts();
    } catch (error) {
        // Still serve a valid sitemap (home + track) if Firestore is briefly unreachable.
        console.error('[sitemap] catalogue unavailable', error);
    }

    let body =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    body += urlEntry(SITE_URL + '/', { changefreq: 'daily', priority: '1.0' });

    products.forEach((product) => {
        body += urlEntry(SITE_URL + '/product.html?id=' + encodeURIComponent(product.id), {
            lastmod: isoDate(product.updatedAt),
            changefreq: 'weekly',
            priority: '0.8',
            image: product.images[0]
        });
    });

    body += '</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(body);
};
