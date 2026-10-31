/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
import { DISPLAY_CUT, SMALL_CUT } from "./glyphs.generated.mjs";
export const CUTS = { display: DISPLAY_CUT, small: SMALL_CUT };
function transformPath(d, fn, precision) {
    let out = '';
    const re = /([MLQCZ])([^MLQCZ]*)/g;
    let match;
    const fix = (v) => {
        const s = v.toFixed(precision);
        return s.replace(/\.?0+$/, '').replace(/^-0$/, '0');
    };
    while ((match = re.exec(d))) {
        const cmd = match[1];
        if (cmd === 'Z') {
            out += 'Z';
            continue;
        }
        const nums = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
        const pairs = [];
        for (let i = 0; i + 1 < nums.length; i += 2) {
            const [x, y] = fn(nums[i], nums[i + 1]);
            pairs.push(`${fix(x)} ${fix(y)}`);
        }
        out += cmd + pairs.join(' ');
    }
    return out;
}
function place(text, cut, tracking, kern) {
    const placed = [];
    let x = 0;
    const chars = Array.from(text);
    chars.forEach((ch, index) => {
        const glyph = cut.glyphs[ch] ?? cut.glyphs[' '];
        placed.push({ ch, x });
        if (!glyph)
            return;
        const next = chars[index + 1];
        const pair = next ? cut.kern[ch + next] ?? 0 : 0;
        const override = kern[index] ?? 0;
        x += glyph.adv + (next ? pair + tracking + override : 0);
    });
    return placed;
}
export function layoutText(text, options) {
    const cut = CUTS[options.cut ?? 'display'];
    const scale = options.capHeight / cut.capHeight;
    const placed = place(text, cut, options.tracking ?? 0, options.kern ?? {});
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const { ch, x } of placed) {
        const glyph = cut.glyphs[ch];
        if (!glyph || glyph.d === '')
            continue;
        xMin = Math.min(xMin, x + glyph.box[0]);
        xMax = Math.max(xMax, x + glyph.box[2]);
        yMin = Math.min(yMin, glyph.box[1]);
        yMax = Math.max(yMax, glyph.box[3]);
    }
    if (!Number.isFinite(xMin))
        return { d: '', box: { x: options.cx, y: options.cy, width: 0, height: 0 }, scale };
    const inkCentre = (xMin + xMax) / 2;
    const nudgeX = options.nudge?.x ?? 0;
    const nudgeY = options.nudge?.y ?? 0;
    const baseline = options.cy + (cut.capHeight * scale) / 2 + nudgeY;
    const originX = options.cx - inkCentre * scale + nudgeX;
    const parts = [];
    for (const { ch, x } of placed) {
        const glyph = cut.glyphs[ch];
        if (!glyph || glyph.d === '')
            continue;
        parts.push(transformPath(glyph.d, (gx, gy) => [originX + (x + gx) * scale, baseline - gy * scale], 2));
    }
    return {
        d: parts.join(''),
        box: {
            x: originX + xMin * scale,
            y: baseline - yMax * scale,
            width: (xMax - xMin) * scale,
            height: (yMax - yMin) * scale,
        },
        scale,
    };
}
export function layoutArcText(text, options) {
    const cut = CUTS[options.cut ?? 'small'];
    const scale = options.capHeight / cut.capHeight;
    const placed = place(text, cut, options.tracking ?? 0, {});
    const last = placed[placed.length - 1];
    const lastGlyph = last ? cut.glyphs[last.ch] : undefined;
    const totalAdvance = last && lastGlyph ? last.x + lastGlyph.adv : 0;
    const totalArc = (totalAdvance * scale) / options.radius;
    const inside = options.side === 'inside';
    const middle = (options.angle * Math.PI) / 180;
    const start = inside ? middle + totalArc / 2 : middle - totalArc / 2;
    const parts = [];
    for (const { ch, x } of placed) {
        const glyph = cut.glyphs[ch];
        if (!glyph || glyph.d === '')
            continue;
        const glyphArc = (glyph.adv * scale) / options.radius;
        const theta = inside ? start - (x * scale) / options.radius - glyphArc / 2 : start + (x * scale) / options.radius + glyphArc / 2;
        const px = options.cx + options.radius * Math.sin(theta);
        const py = options.cy - options.radius * Math.cos(theta);
        const rot = inside ? theta + Math.PI : theta;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const half = (glyph.adv * scale) / 2;
        parts.push(transformPath(glyph.d, (gx, gy) => {
            const lx = gx * scale - half;
            const ly = gy * scale;
            return [px + lx * cos + ly * sin, py + lx * sin - ly * cos];
        }, 2));
    }
    return parts.join('');
}
export function measureText(text, capHeight, cut = 'display', tracking = 0) {
    const c = CUTS[cut];
    const placed = place(text, c, tracking, {});
    const last = placed[placed.length - 1];
    const glyph = last ? c.glyphs[last.ch] : undefined;
    return last && glyph ? ((last.x + glyph.adv) * capHeight) / c.capHeight : 0;
}
