// ========================================================================
// JANNAT BAKING TOOLS 2.0 — CLIENT-SIDE IMAGE COMPRESSION
//
// Runs in the admin's browser *before* a photo is sent to Cloudinary, so the
// cloud only ever stores a web-sized file. A typical 4–6 MB phone photo
// becomes roughly 150–300 KB with no visible difference on screen.
//
//   * longest edge capped at MAX_EDGE (plenty for a 900px product gallery
//     and a zoomed lightbox on retina screens)
//   * re-encoded as WebP (JPEG fallback on browsers that can't encode WebP)
//   * EXIF rotation is applied so phone photos never come out sideways
//   * animated GIFs are passed through untouched (re-encoding would freeze them)
//   * if "compressing" would make the file bigger, the original is kept
// ========================================================================

const MAX_EDGE = 1600;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.86;
// Files this small are already web-ready; skip the work.
const SKIP_BELOW_BYTES = 120 * 1024;

function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') {
        return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => decodeWithImg(file));
    }
    return decodeWithImg(file);
}

function decodeWithImg(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read this image.'));
        };
        img.src = url;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
        try {
            canvas.toBlob((blob) => resolve(blob), type, quality);
        } catch (err) {
            resolve(null);
        }
    });
}

let webpSupport = null;
async function supportsWebp() {
    if (webpSupport !== null) return webpSupport;
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const blob = await canvasToBlob(probe, 'image/webp', 0.8);
    webpSupport = !!blob && blob.type === 'image/webp';
    return webpSupport;
}

function renamed(name, ext) {
    const base = String(name || 'photo').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'photo';
    return base + '.' + ext;
}

/**
 * @param {File} file
 * @returns {Promise<{file: File, originalBytes: number, finalBytes: number, width: number, height: number, compressed: boolean}>}
 */
export async function compressImage(file, options) {
    const opts = Object.assign({ maxEdge: MAX_EDGE }, options || {});
    const result = {
        file,
        originalBytes: file.size,
        finalBytes: file.size,
        width: 0,
        height: 0,
        compressed: false
    };

    // Animated GIFs and already-small files go through unchanged.
    if (file.type === 'image/gif') return result;

    let bitmap;
    try {
        bitmap = await loadBitmap(file);
    } catch (err) {
        return result; // let the server deal with it rather than blocking the admin
    }

    const srcW = bitmap.width || bitmap.naturalWidth;
    const srcH = bitmap.height || bitmap.naturalHeight;
    result.width = srcW;
    result.height = srcH;

    const scale = Math.min(1, opts.maxEdge / Math.max(srcW, srcH));
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) {
        if (typeof bitmap.close === 'function') bitmap.close();
        return result;
    }

    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return result;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Try WebP first (keeps transparency for PNG logos/stickers too).
    let blob;
    if (await supportsWebp()) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
    } else {
        // JPEG has no alpha channel — paint white underneath so transparent areas aren't black.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);
        blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    }
    if (typeof bitmap.close === 'function') bitmap.close();

    if (!blob) return result;
    // Never make things worse: keep the original if we didn't shrink it.
    if (blob.size >= file.size && scale === 1) return result;

    const type = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const out = new File([blob], renamed(file.name, type === 'image/webp' ? 'webp' : 'jpg'), {
        type,
        lastModified: Date.now()
    });

    return {
        file: out,
        originalBytes: file.size,
        finalBytes: out.size,
        width: w,
        height: h,
        compressed: true
    };
}

export function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
}
