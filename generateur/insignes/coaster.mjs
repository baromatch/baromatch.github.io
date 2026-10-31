/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
import { withAlpha } from "./colour.mjs";
import { node, num } from "./svg.mjs";
import { layoutArcText } from "./type.mjs";
export const COASTER = {
    paper: '#E9DFC8',
    band: '#E2D6B8',
    ink: '#14151F',
    rimLight: '#F3EBD9',
    rimDark: '#D2C5A8',
    night: '#0A0B10',
    board: '#1B1D27',
    white: '#FEFDFC',
    amberLight: '#FFD58A',
    amber: '#FFB13D',
    amberDeep: '#D97A0C',
    goldLight: '#E8CF7A',
    gold: '#C9A24A',
    goldDeep: '#9C7A2E',
};
export const BADGE_BOX = 200;
export const C = 100;
export const EDGE = 96;
export function badgeTier(size) {
    if (size <= 20)
        return 'tiny';
    if (size <= 48)
        return 'small';
    return 'large';
}
export const DETAIL_AT = { year: 96, rim: 128 };
export function atLeastPx(units, size, minPx = 1) {
    return Math.max(units, (BADGE_BOX / size) * minPx);
}
export function seeded(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i += 1) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function roughDisc(r, jitter, rnd) {
    const points = 72;
    const parts = [];
    for (let i = 0; i < points; i += 1) {
        const a = (i / points) * 2 * Math.PI;
        const rr = r + (rnd() * 2 - 1) * jitter;
        parts.push(`${num(C + rr * Math.sin(a))} ${num(C - rr * Math.cos(a))}`);
    }
    return `M${parts.join('L')}Z`;
}
export function grainPattern(id, colour, opacity, rnd) {
    const tile = 16;
    const specks = [];
    for (let i = 0; i < 14; i += 1) {
        specks.push(node('circle', { cx: num(rnd() * tile), cy: num(rnd() * tile), r: num(0.35 + rnd() * 0.45), fill: colour, fillOpacity: opacity }));
    }
    return node('pattern', { id, width: tile, height: tile, patternUnits: 'userSpaceOnUse' }, specks);
}
export const discClip = (id, r, cx = C, cy = C) => node('clipPath', { id }, [node('circle', { cx: num(cx), cy: num(cy), r: num(r) })]);
export function annulusPath(outer, inner) {
    return `M${C} ${num(C - outer)}A${outer} ${outer} 0 1 0 ${C} ${num(C + outer)}A${outer} ${outer} 0 1 0 ${C} ${num(C - outer)}ZM${C} ${num(C - inner)}A${inner} ${inner} 0 1 1 ${C} ${num(C + inner)}A${inner} ${inner} 0 1 1 ${C} ${num(C - inner)}Z`;
}
export function cardboard({ tier, size, surface, rnd, board = COASTER.paper }) {
    const out = [];
    if (surface === 'night' && tier === 'large')
        out.push(node('circle', { cx: C, cy: C + 1.5, r: num(EDGE + 0.5), fill: withAlpha('#000000', 0.35) }));
    const edgeD = tier === 'large' ? roughDisc(EDGE, 0.55, rnd) : undefined;
    out.push(edgeD ? node('path', { d: edgeD, fill: board }) : node('circle', { cx: C, cy: C, r: EDGE, fill: board }));
    if (surface === 'light') {
        const w = atLeastPx(1, size);
        out.push(node('circle', { cx: C, cy: C, r: num(EDGE - w / 2), fill: 'none', stroke: withAlpha(COASTER.ink, 0.6), strokeWidth: num(w) }));
    }
    if (tier === 'large') {
        out.push(node('circle', { cx: C, cy: C, r: 92.5, fill: 'none', stroke: COASTER.rimLight, strokeWidth: 3 }));
        out.push(node('circle', { cx: C, cy: C, r: 90.5, fill: 'none', stroke: COASTER.rimDark, strokeWidth: 1 }));
    }
    else if (tier === 'small') {
        const w = atLeastPx(2, size);
        out.push(node('circle', { cx: C, cy: C, r: num(92 - (w - 2) / 2), fill: 'none', stroke: COASTER.rimDark, strokeWidth: num(w) }));
    }
    return out;
}
export function fieldRadius(tier, size) {
    if (tier === 'large')
        return 89;
    if (tier === 'small')
        return 90 - (atLeastPx(2, size) - 2);
    return EDGE - atLeastPx(2.5, size);
}
export function innerShade(id, surface) {
    return [
        node('defs', undefined, [
            node('radialGradient', { id, cx: C, cy: C, r: EDGE, gradientUnits: 'userSpaceOnUse' }, [
                node('stop', { offset: '0.82', stopColor: COASTER.ink, stopOpacity: 0 }),
                node('stop', { offset: '1', stopColor: COASTER.ink, stopOpacity: surface === 'night' ? 0.26 : 0.1 }),
            ]),
        ]),
        node('circle', { cx: C, cy: C, r: EDGE, fill: `url(#${id})` }),
    ];
}
export function foilRim(idPrefix, size, tier) {
    const id = `${idPrefix}-foil`;
    const width = tier === 'large' ? 4.2 : atLeastPx(4, size, 2.5);
    const r = tier === 'large' ? 93.4 : 93;
    return [
        node('defs', undefined, [
            node('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' }, [
                node('stop', { offset: '0', stopColor: COASTER.goldLight }),
                node('stop', { offset: '0.45', stopColor: COASTER.gold }),
                node('stop', { offset: '0.7', stopColor: COASTER.goldDeep }),
                node('stop', { offset: '1', stopColor: COASTER.goldLight }),
            ]),
        ]),
        node('circle', { cx: C, cy: C, r: num(r), fill: 'none', stroke: `url(#${id})`, strokeWidth: num(width) }),
        node('circle', { cx: C, cy: C, r: num(r - width / 2 - 0.5), fill: 'none', stroke: COASTER.ink, strokeWidth: num(atLeastPx(0.7, size, 0.5)), strokeOpacity: 0.6 }),
    ];
}
export function rimText(text, where, radius, capHeight, fill, opacity, tracking = 40) {
    const d = layoutArcText(text, { cut: 'small', capHeight, cx: C, cy: C, radius, angle: where === 'top' ? 0 : 180, side: where === 'top' ? 'outside' : 'inside', tracking });
    return node('path', { d, fill, fillOpacity: opacity });
}
