/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
export function normalizeHex(value) {
    if (!value)
        return null;
    const hex = value.trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
}
export function hexToRgb(hex) {
    const c = hex.replace('#', '');
    return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
}
export function rgbToHex({ r, g, b }) {
    const channel = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}
export function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const lin = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrastRatio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}
export function mix(over, under, amount) {
    const o = hexToRgb(over);
    const u = hexToRgb(under);
    const t = Math.max(0, Math.min(1, amount));
    return rgbToHex({ r: u.r + (o.r - u.r) * t, g: u.g + (o.g - u.g) * t, b: u.b + (o.b - u.b) * t });
}
export function withAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}
export function mostContrasting(ground, candidates) {
    let best = candidates[0];
    let bestRatio = -1;
    for (const candidate of candidates) {
        const ratio = contrastRatio(candidate, ground);
        if (ratio > bestRatio) {
            best = candidate;
            bestRatio = ratio;
        }
    }
    return best;
}
export function isLight(hex) {
    return luminance(hex) > 0.4;
}
export function toHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rn)
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn)
        h = ((bn - rn) / d + 2) / 6;
    else
        h = ((rn - gn) / d + 4) / 6;
    return { h, s, l };
}
export function fromHsl({ h, s, l }) {
    const hue2rgb = (p, q, t) => {
        let tt = t;
        if (tt < 0)
            tt += 1;
        if (tt > 1)
            tt -= 1;
        if (tt < 1 / 6)
            return p + (q - p) * 6 * tt;
        if (tt < 1 / 2)
            return q;
        if (tt < 2 / 3)
            return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    if (s === 0)
        return rgbToHex({ r: l * 255, g: l * 255, b: l * 255 });
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return rgbToHex({ r: hue2rgb(p, q, h + 1 / 3) * 255, g: hue2rgb(p, q, h) * 255, b: hue2rgb(p, q, h - 1 / 3) * 255 });
}
export function deepenUntil(hex, ink, ratio) {
    if (contrastRatio(ink, hex) >= ratio)
        return hex;
    const hsl = toHsl(hex);
    for (let l = hsl.l; l >= 0; l -= 0.01) {
        const candidate = fromHsl({ h: hsl.h, s: hsl.s, l: Math.max(0, l) });
        if (contrastRatio(ink, candidate) >= ratio)
            return candidate;
    }
    return '#000000';
}
export function lightenUntil(hex, ink, ratio) {
    if (contrastRatio(ink, hex) >= ratio)
        return hex;
    const hsl = toHsl(hex);
    for (let l = hsl.l; l <= 1; l += 0.01) {
        const candidate = fromHsl({ h: hsl.h, s: hsl.s, l: Math.min(1, l) });
        if (contrastRatio(ink, candidate) >= ratio)
            return candidate;
    }
    return '#FFFFFF';
}
