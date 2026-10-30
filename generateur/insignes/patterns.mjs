/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
import { node, num } from "./svg.mjs";
export const KIT_PATTERNS = ['solid', 'stripes', 'hoops', 'halves', 'quarters', 'sash', 'diagonal', 'sleeves', 'pinstripes', 'chevron', 'band', 'bar'];
export const STRIPE_COUNT = {
    fine: { tiny: 5, small: 7, large: 9 },
    normal: { tiny: 3, small: 5, large: 7 },
    broad: { tiny: 3, small: 3, large: 5 },
};
export const PINSTRIPES = {
    tiny: { count: 3, width: 0.06 },
    small: { count: 5, width: 0.045 },
    large: { count: 9, width: 0.03 },
};
export const BAND = {
    width: { large: 0.32, small: 0.27, tiny: 0.27 },
    edge: { large: 0.05, small: 0.08, tiny: 0.1 },
};
export const SLEEVES = { width: 0.22 };
export const BAR = { height: 0.36 };
export const SASH = { width: 0.3 };
export const CHEVRON = { width: 0.26, depth: 0.22 };
export const SOLID_TRIM = { width: 0.12 };
const rect = (x, y, width, height, fill) => ({ rect: [x, y, width, height], fill });
const poly = (points, fill) => ({
    d: `M${points.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`,
    fill,
});
function overlays({ cx, cy, r, tier, colours, pattern, density = 'normal', split }) {
    const d = r * 2;
    const x0 = cx - r;
    const y0 = cy - r;
    const { secondary, tertiary } = colours;
    switch (pattern) {
        case 'solid':
            return [];
        case 'stripes': {
            const count = STRIPE_COUNT[density][tier];
            const w = d / count;
            const out = [];
            for (let i = 1; i < count; i += 2)
                out.push(rect(x0 + i * w, y0 - 1, w, d + 2, secondary));
            return out;
        }
        case 'hoops': {
            const count = STRIPE_COUNT[density][tier];
            const h = d / count;
            const out = [];
            for (let i = 1; i < count; i += 2)
                out.push(rect(x0 - 1, y0 + i * h, d + 2, h, secondary));
            return out;
        }
        case 'halves':
            return [rect(cx, y0 - 1, r + 1, d + 2, secondary)];
        case 'quarters':
            return [rect(cx, y0 - 1, r + 1, r + 1, secondary), rect(x0 - 1, cy, r + 1, r + 1, secondary)];
        case 'diagonal':
            return [poly([[x0 + d + 1, y0 - 1], [x0 + d + 1, y0 + d + 1], [x0 - 1, y0 + d + 1]], secondary)];
        case 'sleeves': {
            const w = d * SLEEVES.width;
            return [rect(x0 - 1, y0 - 1, w + 1, d + 2, secondary), rect(x0 + d - w, y0 - 1, w + 1, d + 2, secondary)];
        }
        case 'sash': {
            const w = d * SASH.width;
            const k = w / Math.SQRT2;
            return [
                poly([
                    [x0 - r + k, y0 - r - k],
                    [x0 - r + k + w * Math.SQRT2, y0 - r - k],
                    [x0 + d + r + k, y0 + d + r - k],
                    [x0 + d + r - k - w * Math.SQRT2 + 2 * k, y0 + d + r + k],
                ], secondary),
            ];
        }
        case 'pinstripes': {
            const { count, width } = PINSTRIPES[tier];
            const step = d / (count + 1);
            const w = d * width;
            const out = [];
            for (let i = 1; i <= count; i += 1)
                out.push(rect(x0 + i * step - w / 2, y0 - 1, w, d + 2, secondary));
            return out;
        }
        case 'chevron': {
            const w = d * CHEVRON.width;
            const depth = d * CHEVRON.depth;
            const top = cy - w / 2 - depth / 2;
            return [
                poly([
                    [x0 - 1, top],
                    [cx, top + depth],
                    [cx + r + 1, top],
                    [cx + r + 1, top + w],
                    [cx, top + depth + w],
                    [x0 - 1, top + w],
                ], secondary),
            ];
        }
        case 'band': {
            const w = d * BAND.width[tier];
            if (split && tertiary)
                return [rect(cx - w / 2, y0 - 1, w / 2, d + 2, secondary), rect(cx, y0 - 1, w / 2, d + 2, tertiary)];
            const out = [rect(cx - w / 2, y0 - 1, w, d + 2, secondary)];
            if (tertiary) {
                const e = d * BAND.edge[tier];
                out.push(rect(cx - w / 2 - e, y0 - 1, e, d + 2, tertiary));
                out.push(rect(cx + w / 2, y0 - 1, e, d + 2, tertiary));
            }
            return out;
        }
        case 'bar': {
            const h = d * BAR.height;
            return [rect(x0 - 1, cy - h / 2, d + 2, h, secondary)];
        }
        default:
            return assertNever(pattern);
    }
}
function assertNever(value) {
    throw new Error(`unknown kit pattern ${String(value)}`);
}
export function needsClipPath(pattern, inDisc) {
    return !inDisc || pattern === 'sash' || pattern === 'diagonal' || pattern === 'chevron';
}
const chord = (cx, cy, r, x, sign) => {
    const dx = Math.max(-r, Math.min(r, x - cx));
    return cy + sign * Math.sqrt(Math.max(0, r * r - dx * dx));
};
export function rectInDisc(cx, cy, r, x, y, width, height) {
    const eps = 0.01;
    const spansY = y <= cy - r && y + height >= cy + r;
    const spansX = x <= cx - r && x + width >= cx + r;
    if (spansY && spansX)
        return `M${num(cx - r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 1 ${num(cx + r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 1 ${num(cx - r)} ${num(cy)}Z`;
    if (spansY) {
        const a = Math.max(cx - r + eps, x);
        const b = Math.min(cx + r - eps, x + width);
        if (b <= a)
            return null;
        return `M${num(a)} ${num(chord(cx, cy, r, a, -1))}A${num(r)} ${num(r)} 0 0 1 ${num(b)} ${num(chord(cx, cy, r, b, -1))}L${num(b)} ${num(chord(cx, cy, r, b, 1))}A${num(r)} ${num(r)} 0 0 1 ${num(a)} ${num(chord(cx, cy, r, a, 1))}Z`;
    }
    if (spansX) {
        const a = Math.max(cy - r + eps, y);
        const b = Math.min(cy + r - eps, y + height);
        if (b <= a)
            return null;
        const side = (yy, sign) => chord(cy, cx, r, yy, sign);
        return `M${num(side(a, 1))} ${num(a)}A${num(r)} ${num(r)} 0 0 1 ${num(side(b, 1))} ${num(b)}L${num(side(b, -1))} ${num(b)}A${num(r)} ${num(r)} 0 0 1 ${num(side(a, -1))} ${num(a)}Z`;
    }
    const right = x + width >= cx + r - eps && x <= cx + eps && x >= cx - eps;
    const left = x <= cx - r + eps && x + width >= cx - eps && x + width <= cx + eps;
    const top = y <= cy - r + eps && y + height >= cy - eps && y + height <= cy + eps;
    const bottom = y + height >= cy + r - eps && y <= cy + eps && y >= cy - eps;
    if (right && top)
        return `M${num(cx)} ${num(cy)}L${num(cx)} ${num(cy - r)}A${num(r)} ${num(r)} 0 0 1 ${num(cx + r)} ${num(cy)}Z`;
    if (right && bottom)
        return `M${num(cx)} ${num(cy)}L${num(cx + r)} ${num(cy)}A${num(r)} ${num(r)} 0 0 1 ${num(cx)} ${num(cy + r)}Z`;
    if (left && bottom)
        return `M${num(cx)} ${num(cy)}L${num(cx)} ${num(cy + r)}A${num(r)} ${num(r)} 0 0 1 ${num(cx - r)} ${num(cy)}Z`;
    if (left && top)
        return `M${num(cx)} ${num(cy)}L${num(cx - r)} ${num(cy)}A${num(r)} ${num(r)} 0 0 1 ${num(cx)} ${num(cy - r)}Z`;
    return null;
}
export function kitShapes(options) {
    const { cx, cy, r, colours, pattern, shift, keyline, inDisc = false } = options;
    const shapes = [node('circle', { cx: num(cx), cy: num(cy), r: num(inDisc ? r : r + 1), fill: colours.primary })];
    if (pattern === 'solid') {
        const width = r * SOLID_TRIM.width;
        shapes.push(node('circle', { cx: num(cx), cy: num(cy), r: num(r - width / 2 - 0.5), fill: 'none', stroke: colours.secondary, strokeWidth: num(width) }));
        return shapes;
    }
    const dx = shift?.x ?? 0;
    const dy = shift?.y ?? 0;
    for (const shape of overlays(options)) {
        const stroke = keyline ? { stroke: keyline.colour, strokeWidth: num(keyline.width) } : {};
        if (shape.rect) {
            const [x, y, width, height] = shape.rect;
            if (inDisc) {
                const d = rectInDisc(cx, cy, r, x + dx, y + dy, width, height);
                if (d)
                    shapes.push(node('path', { d, fill: shape.fill, ...stroke }));
            }
            else {
                shapes.push(node('rect', { x: num(x + dx), y: num(y + dy), width: num(width), height: num(height), fill: shape.fill, ...stroke }));
            }
        }
        else if (shape.d) {
            shapes.push(node('path', { d: shape.d, fill: shape.fill, transform: dx || dy ? `translate(${num(dx)} ${num(dy)})` : undefined, ...stroke }));
        }
    }
    return shapes;
}
