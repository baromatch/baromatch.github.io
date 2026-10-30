/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
import { withAlpha } from "./colour.mjs";
import { C, COASTER, EDGE, annulusPath, atLeastPx, badgeTier, cardboard, grainPattern, innerShade, rimText, seeded } from "./coaster.mjs";
import { badgeRoot, coordinatesLabel } from "./badge.mjs";
import { node, num, svgString } from "./svg.mjs";
import { layoutText, measureText } from "./type.mjs";
function freehand(points, rnd, tremor) {
    const pts = points.map(([x, y]) => [x + (rnd() - 0.5) * tremor, y + (rnd() - 0.5) * tremor]);
    let d = `M${num(pts[0][0])} ${num(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${num(c1[0])} ${num(c1[1])} ${num(c2[0])} ${num(c2[1])} ${num(p2[0])} ${num(p2[1])}`;
    }
    return d;
}
const stroke = (d, width, opacity, extra = {}) => node('path', { d, fill: 'none', stroke: COASTER.ink, strokeWidth: num(width), strokeOpacity: opacity, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra });
function ripples(from, to, offsets, rnd, width) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return offsets.map((o, i) => {
        const t0 = 0.12 + i * 0.07;
        const t1 = 0.5 + i * 0.09;
        const a = [from[0] + dx * t0 + nx * o, from[1] + dy * t0 + ny * o];
        const b = [from[0] + dx * t1 + nx * o, from[1] + dy * t1 + ny * o];
        const m = [(a[0] + b[0]) / 2 + nx * 1.5, (a[1] + b[1]) / 2 + ny * 1.5];
        return stroke(freehand([a, m, b], rnd, 1), width * 0.55, 0.38);
    });
}
function featureLines(feature, cx, cy, r, rnd, w) {
    const x = (k) => cx + k * r;
    const y = (k) => cy + k * r;
    switch (feature) {
        case 'river':
            return [
                stroke(freehand([[x(-1.05), y(0.25)], [x(-0.55), y(-0.2)], [x(-0.1), y(0.3)], [x(0.4), y(-0.25)], [x(1.05), y(0.05)]], rnd, 2.5), w, 0.85),
                stroke(freehand([[x(-1.05), y(0.42)], [x(-0.55), y(-0.02)], [x(-0.1), y(0.48)], [x(0.42), y(-0.07)], [x(1.05), y(0.22)]], rnd, 2.5), w * 0.5, 0.35),
            ];
        case 'bend':
            return [
                stroke(freehand([[x(-1.05), y(-0.55)], [x(-0.5), y(-0.45)], [x(-0.15), y(-0.1)], [x(0.05), y(0.4)], [x(0.5), y(0.6)], [x(1.05), y(0.55)]], rnd, 2.5), w, 0.85),
                stroke(freehand([[x(-1.05), y(-0.35)], [x(-0.45), y(-0.25)], [x(0.05), y(0.1)], [x(0.25), y(0.55)], [x(0.6), y(0.78)], [x(1.05), y(0.75)]], rnd, 2.5), w * 0.5, 0.35),
            ];
        case 'confluence':
            return [
                stroke(freehand([[x(-1.05), y(-0.6)], [x(-0.55), y(-0.4)], [x(-0.15), y(-0.05)], [x(0.3), y(0.3)], [x(1.05), y(0.55)]], rnd, 2.5), w, 0.85),
                stroke(freehand([[x(-0.9), y(0.75)], [x(-0.5), y(0.45)], [x(-0.15), y(0.05)]], rnd, 2.2), w * 0.8, 0.75),
            ];
        case 'estuary':
            return [
                stroke(freehand([[x(-1.05), y(-0.1)], [x(-0.5), y(0.05)], [x(0), y(-0.05)], [x(0.45), y(-0.35)], [x(1.05), y(-0.6)]], rnd, 2.5), w, 0.85),
                stroke(freehand([[x(-1.05), y(0.1)], [x(-0.5), y(0.25)], [x(0), y(0.3)], [x(0.45), y(0.55)], [x(1.05), y(0.85)]], rnd, 2.5), w, 0.85),
                ...ripples([x(0.2), y(0.1)], [x(1.05), y(0.12)], [0, 10, -10], rnd, w),
            ];
        case 'coast':
            return [
                stroke(freehand([[x(-1.05), y(0.15)], [x(-0.6), y(0.25)], [x(-0.2), y(0.05)], [x(0.15), y(0.3)], [x(0.6), y(0.2)], [x(1.05), y(0.35)]], rnd, 2.5), w, 0.85),
                ...ripples([x(-1), y(0.55)], [x(1), y(0.6)], [0, 9, 18], rnd, w),
            ];
        case 'strait':
            return [
                stroke(freehand([[x(-0.25), y(-1.05)], [x(-0.35), y(-0.5)], [x(-0.1), y(0)], [x(-0.3), y(0.5)], [x(-0.15), y(1.05)]], rnd, 2.5), w, 0.85),
                stroke(freehand([[x(0.25), y(-1.05)], [x(0.1), y(-0.5)], [x(0.35), y(0)], [x(0.15), y(0.5)], [x(0.3), y(1.05)]], rnd, 2.5), w, 0.85),
                ...ripples([x(0), y(-0.8)], [x(0), y(0.8)], [0], rnd, w),
            ];
        case 'lake':
            return [
                stroke(freehand([[x(-0.85), y(-0.05)], [x(-0.55), y(-0.4)], [x(0.1), y(-0.45)], [x(0.7), y(-0.3)], [x(0.9), y(0.05)], [x(0.6), y(0.4)], [x(-0.1), y(0.45)], [x(-0.65), y(0.35)], [x(-0.85), y(-0.05)]], rnd, 2.5) + 'Z', w, 0.85),
                ...ripples([x(-0.45), y(-0.02)], [x(0.5), y(0)], [0, 9, -9], rnd, w),
            ];
        case 'lakeY': {
            const arm = (ax, ay, bx, by, k) => stroke(freehand([[x(ax), y(ay)], [x((ax + bx) / 2 + k), y((ay + by) / 2)], [x(bx), y(by)]], rnd, 2), w, 0.85);
            return [
                arm(0, -0.05, -0.7, 0.85, -0.12),
                arm(0.22, -0.05, -0.45, 0.95, -0.08),
                arm(0, -0.05, 0.75, 0.75, 0.12),
                arm(0.22, -0.05, 0.95, 0.6, 0.1),
                stroke(freehand([[x(0), y(-0.05)], [x(-0.05), y(-0.6)], [x(0.08), y(-1.05)]], rnd, 2), w, 0.85),
                stroke(freehand([[x(0.22), y(-0.05)], [x(0.2), y(-0.6)], [x(0.3), y(-1.05)]], rnd, 2), w, 0.85),
            ];
        }
        case 'island':
            return [
                stroke(freehand([[x(-0.5), y(0.1)], [x(-0.35), y(-0.4)], [x(0.2), y(-0.45)], [x(0.55), y(-0.05)], [x(0.3), y(0.45)], [x(-0.25), y(0.4)], [x(-0.5), y(0.1)]], rnd, 2.5) + 'Z', w, 0.85),
                ...ripples([x(-1), y(0.75)], [x(1), y(0.8)], [0, 8], rnd, w),
                ...ripples([x(-1), y(-0.8)], [x(1), y(-0.75)], [0, -8], rnd, w),
            ];
        case 'mountain':
            return [
                stroke(freehand([[x(-1.05), y(0.35)], [x(-0.7), y(-0.1)], [x(-0.45), y(0.15)], [x(-0.1), y(-0.5)], [x(0.2), y(-0.05)], [x(0.5), y(-0.35)], [x(0.8), y(0.1)], [x(1.05), y(0.3)]], rnd, 2), w, 0.85),
                stroke(freehand([[x(-1.05), y(0.6)], [x(1.05), y(0.6)]], rnd, 1.5), w * 0.5, 0.35),
            ];
        case 'hills':
            return [
                stroke(freehand([[x(-1.05), y(0.3)], [x(-0.75), y(0.28)], [x(-0.5), y(-0.2)], [x(-0.25), y(0.28)], [x(0), y(0.3)], [x(0.25), y(-0.28)], [x(0.55), y(0.28)], [x(1.05), y(0.3)]], rnd, 1.8), w, 0.85),
                stroke(freehand([[x(-1.05), y(0.55)], [x(1.05), y(0.55)]], rnd, 1.5), w * 0.5, 0.35),
            ];
        case 'crosshair':
            return [
                stroke(freehand([[x(-0.9), y(0)], [x(-0.35), y(0.01)]], rnd, 1), w * 0.6, 0.6),
                stroke(freehand([[x(0.35), y(0)], [x(0.9), y(-0.01)]], rnd, 1), w * 0.6, 0.6),
                stroke(freehand([[x(0), y(-0.9)], [x(0.01), y(-0.35)]], rnd, 1), w * 0.6, 0.6),
                stroke(freehand([[x(0), y(0.35)], [x(-0.01), y(0.9)]], rnd, 1), w * 0.6, 0.6),
                stroke(`M${num(x(-0.55))} ${num(y(0))}A${num(0.55 * r)} ${num(0.55 * r)} 0 1 1 ${num(x(0.55))} ${num(y(0))}A${num(0.55 * r)} ${num(0.55 * r)} 0 1 1 ${num(x(-0.55))} ${num(y(0))}`, w * 0.8, 0.5),
            ];
        case 'canal':
            return [
                stroke(freehand([[x(-1.05), y(0.25)], [x(1.05), y(0.15)]], rnd, 1.2), w, 0.85),
                stroke(freehand([[x(-0.65), y(-1.05)], [x(-0.45), y(1.05)]], rnd, 1.2), w * 0.7, 0.55),
                stroke(freehand([[x(-1.05), y(-0.35)], [x(1.05), y(-0.45)]], rnd, 1.2), w * 0.5, 0.35),
            ];
        case 'ring':
            return [
                stroke(freehand([[x(0), y(-0.75)], [x(0.55), y(-0.5)], [x(0.68), y(0.1)], [x(0.4), y(0.72)], [x(-0.3), y(0.75)], [x(-0.65), y(0.2)], [x(-0.5), y(-0.5)], [x(0), y(-0.75)]], rnd, 2.2) + 'Z', w, 0.85),
                stroke(freehand([[x(0.6), y(0.35)], [x(1.05), y(0.6)]], rnd, 1.2), w * 0.6, 0.45),
            ];
        case 'plain':
        default:
            return [
                stroke(freehand([[x(-1.05), y(0.05)], [x(-0.3), y(0.02)], [x(0.4), y(0.06)], [x(1.05), y(0)]], rnd, 1.5), w, 0.85),
                stroke(freehand([[x(-0.9), y(0.3)], [x(0.9), y(0.32)]], rnd, 1.5), w * 0.5, 0.35),
                stroke(freehand([[x(-0.9), y(-0.25)], [x(0.9), y(-0.22)]], rnd, 1.5), w * 0.5, 0.35),
            ];
    }
}
export function geographyDrawing(spec, cx, cy, r, size, idPrefix) {
    const feature = spec.geography?.feature ?? 'plain';
    const rnd = seeded(`${spec.slug}:back`);
    const w = atLeastPx(2.6, size, 1.2);
    const clipId = `${idPrefix}-geo`;
    const lines = featureLines(feature, cx, cy, r, rnd, w);
    const angle = spec.geography?.angle ?? 0;
    const place = spec.geography?.place;
    const px = cx + Math.max(-r * 0.7, Math.min(r * 0.7, place?.x ?? 0));
    const py = cy + Math.max(-r * 0.7, Math.min(r * 0.7, place?.y ?? 0));
    return [
        node('defs', undefined, [node('clipPath', { id: clipId }, [node('circle', { cx: num(cx), cy: num(cy), r: num(r) })])]),
        node('g', { clipPath: `url(#${clipId})` }, [node('g', { transform: angle ? `rotate(${num(angle)} ${num(cx)} ${num(cy)})` : undefined }, lines)]),
        node('circle', { cx: num(px), cy: num(py), r: num(atLeastPx(2.2, size, 1)), fill: COASTER.ink, fillOpacity: 0.85 }),
        node('circle', { cx: num(px), cy: num(py), r: num(atLeastPx(4.6, size, 2)), fill: 'none', stroke: COASTER.ink, strokeWidth: num(atLeastPx(0.8, size, 0.5)), strokeOpacity: 0.5 }),
    ];
}
export function badgeBackTree(spec, options) {
    const size = options.size;
    const tier = badgeTier(size);
    const surface = options.surface ?? 'night';
    const id = options.idPrefix ?? `back-${spec.slug}`;
    const rnd = seeded(`${spec.slug}:board`);
    const out = [...cardboard({ tier, size, surface, rnd, board: spec.neutral ? COASTER.board : COASTER.paper })];
    const ink = spec.neutral ? COASTER.paper : COASTER.ink;
    if (tier === 'large') {
        const grainId = `${id}-grain`;
        out.push(node('defs', undefined, [grainPattern(grainId, ink, 0.1, rnd)]), node('circle', { cx: C, cy: C, r: EDGE, fill: `url(#${grainId})` }));
        const city = (options.cityLabel ?? spec.city ?? '').toUpperCase();
        if (city)
            out.push(rimText(city, 'top', 77, 7, ink, 0.85, 90));
        if (!spec.neutral)
            out.push(...geographyDrawing(spec, C, 96, 46, size, id));
        if (spec.founded) {
            const year = layoutText(String(spec.founded), { cut: 'display', capHeight: 13, cx: C, cy: 150, tracking: 40 });
            out.push(node('path', { d: year.d, fill: ink, fillOpacity: 0.9 }));
        }
        if (spec.geography) {
            const coords = coordinatesLabel(spec.geography);
            const line = layoutText(coords, { cut: 'small', capHeight: 4.8, cx: C, cy: 163, tracking: 50 });
            out.push(node('path', { d: line.d, fill: ink, fillOpacity: 0.6 }));
        }
        if (options.since) {
            const text = options.since.toUpperCase();
            const radius = 82;
            const fits = measureText(text, 6, 'small', 50) < Math.PI * radius * 0.8;
            if (fits)
                out.push(rimText(text, 'bottom', radius, 6, ink, 0.8, 50));
            else
                out.push(node('path', { d: layoutText(text, { cut: 'small', capHeight: 5, cx: C, cy: 176, tracking: 40 }).d, fill: ink, fillOpacity: 0.8 }));
        }
        out.push(...innerShade(`${id}-shade`, surface));
    }
    else if (spec.founded) {
        const year = layoutText(String(spec.founded), { cut: 'small', capHeight: tier === 'small' ? 26 : 36, cx: C, cy: C, tracking: 30 });
        out.push(node('path', { d: year.d, fill: ink, fillOpacity: 0.9 }));
    }
    if (spec.neutral)
        out.push(node('path', { d: annulusPath(EDGE, EDGE - atLeastPx(2, size)), fill: withAlpha(COASTER.paper, 0.85), fillRule: 'evenodd' }));
    return badgeRoot(size, out);
}
export function badgeBackSvg(spec, options) {
    return svgString(badgeBackTree(spec, options));
}
