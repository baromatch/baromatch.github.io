/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
import { contrastRatio, deepenUntil, lightenUntil, luminance, toHsl, withAlpha } from "./colour.mjs";
import { BADGE_BOX, C, COASTER, DETAIL_AT, EDGE, annulusPath, atLeastPx, badgeTier, cardboard, discClip, fieldRadius, foilRim, grainPattern, innerShade, rimText, roughDisc, seeded } from "./coaster.mjs";
import { kitShapes, needsClipPath, rectInDisc } from "./patterns.mjs";
import { node, num, svgString } from "./svg.mjs";
import { layoutText } from "./type.mjs";
export { BADGE_BOX, COASTER, badgeTier } from "./coaster.mjs";
export const BADGE_CONTRAST = { letters: 4.5, shape: 3 };
export const STAMP_ROWS = { perArc: 11, rows: 2, from: 30, to: 158 };
export const MAX_STAMPS = STAMP_ROWS.perArc * 2 * STAMP_ROWS.rows;
export function seasonMark(date) {
    const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
    return `${String(year).slice(-2)}/${String(year + 1).slice(-2)}`;
}
const LIGHT_FIELD = 0.6;
export const KEYLINE_BELOW = 3;
const darkestFirst = (colours) => [colours.primary, colours.secondary, ...(colours.tertiary ? [colours.tertiary] : [])].sort((a, b) => luminance(a) - luminance(b));
function lettersOnPaper(band, colours) {
    return darkestFirst(colours).find((c) => contrastRatio(c, band) >= BADGE_CONTRAST.letters) ?? COASTER.ink;
}
function trimBand(trim) {
    const white = COASTER.white;
    if (toHsl(trim).l >= 0.45 && contrastRatio(COASTER.ink, trim) >= BADGE_CONTRAST.letters)
        return { band: trim, letters: COASTER.ink };
    if (contrastRatio(white, trim) >= BADGE_CONTRAST.letters)
        return { band: trim, letters: white };
    const deeper = deepenUntil(trim, white, BADGE_CONTRAST.letters);
    const drop = toHsl(trim).l - toHsl(deeper).l;
    if (drop <= 0.16)
        return { band: deeper, letters: white };
    if (contrastRatio(COASTER.ink, trim) >= BADGE_CONTRAST.letters)
        return { band: trim, letters: COASTER.ink };
    return { band: lightenUntil(trim, COASTER.ink, BADGE_CONTRAST.letters), letters: COASTER.ink };
}
function trimOnPaper(colours) {
    const darkest = darkestFirst(colours).find((c) => c.toUpperCase() !== COASTER.white) ?? colours.secondary;
    return contrastRatio(darkest, COASTER.band) >= BADGE_CONTRAST.letters ? darkest : deepenUntil(darkest, COASTER.band, BADGE_CONTRAST.letters);
}
export function badgePalette(spec) {
    const parted = spec.pattern === 'band' && Boolean(spec.colours.tertiary);
    const keyline = !parted && contrastRatio(spec.colours.primary, spec.colours.secondary) < KEYLINE_BELOW ? COASTER.band : null;
    if (spec.pattern === 'bar') {
        const band = COASTER.band;
        const letters = trimOnPaper(spec.colours);
        return { band, letters, keyline, edges: null, lettersContrast: contrastRatio(letters, band) };
    }
    if (spec.pattern === 'solid') {
        const edges = spec.colours.tertiary ?? null;
        const whiteShirt = toHsl(spec.colours.primary).l >= LIGHT_FIELD && contrastRatio(COASTER.white, spec.colours.secondary) < BADGE_CONTRAST.letters && contrastRatio(COASTER.ink, spec.colours.secondary) < BADGE_CONTRAST.letters;
        if (spec.band === 'paper' || whiteShirt) {
            const band = COASTER.band;
            const letters = trimOnPaper(spec.colours);
            return { band, letters, keyline, edges, lettersContrast: contrastRatio(letters, band) };
        }
        const trimmed = trimBand(spec.colours.secondary);
        const own = spec.letters === 'field' && contrastRatio(spec.colours.primary, trimmed.band) >= BADGE_CONTRAST.letters ? spec.colours.primary : trimmed.letters;
        return { band: trimmed.band, letters: own, keyline, edges, lettersContrast: contrastRatio(own, trimmed.band) };
    }
    const band = COASTER.band;
    const letters = lettersOnPaper(band, spec.colours);
    return { band, letters, keyline, edges: null, lettersContrast: contrastRatio(letters, band) };
}
export const BAND_HEIGHT = { large: 46, small: 50, tiny: 62 };
export const CODE_CAP = { large: 28, small: 34, tiny: 48 };
export const BAND_SCALE = { narrow: 0.82, wide: 1.18 };
const SHIFT = { x: 0.6, y: 0.4 };
export function bandHeight(spec, tier) {
    const h = BAND_HEIGHT[tier];
    if (tier !== 'large' || !spec.band || spec.band === 'paper')
        return h;
    return h * BAND_SCALE[spec.band];
}
export const DARK_FIELD_BELOW = 0.05;
function chestBand(ctx, palette, field, fieldClip) {
    const { tier, size, id, spec } = ctx;
    const h = bandHeight(spec, tier);
    const top = C - h / 2;
    const large = tier === 'large';
    const clipId = `${id}-band`;
    const shade = atLeastPx(1.4, size, 0.75);
    const line = atLeastPx(1, size, 0.5);
    const out = large ? [node('defs', undefined, [discClip(clipId, field - 3)])] : [];
    const slab = (y, height) => (large ? null : rectInDisc(C, C, field - 1, 0, y, BADGE_BOX, height));
    const piece = (y, height, attrs) => {
        const d = slab(y, height);
        return d ? node('path', { d, ...attrs }) : node('rect', { x: 0, y: num(y), width: BADGE_BOX, height: num(height), ...attrs });
    };
    const pieces = [
        piece(top + h, shade, { fill: COASTER.ink, fillOpacity: 0.28 }),
        piece(top, h, { fill: palette.band }),
    ];
    if (large)
        pieces.push(node('rect', { x: 0, y: num(top), width: BADGE_BOX, height: num(line), fill: COASTER.white, fillOpacity: 0.45 }));
    if (palette.edges) {
        const e = atLeastPx(2.4, size, 1.2);
        pieces.push(piece(top, e, { fill: palette.edges }));
        pieces.push(piece(top + h - e, e, { fill: palette.edges }));
    }
    if (tier === 'large') {
        const grainId = `${id}-band-grain`;
        out.push(node('defs', undefined, [grainPattern(grainId, COASTER.ink, 0.09, ctx.rnd)]));
        pieces.push(node('rect', { x: 0, y: num(top), width: BADGE_BOX, height: num(h), fill: `url(#${grainId})` }));
    }
    out.push(large ? node('g', { clipPath: `url(#${clipId})` }, pieces) : node('g', undefined, pieces));
    return out;
}
function lettering(ctx, palette) {
    const { spec, tier, size } = ctx;
    const year = tier === 'large' && size >= DETAIL_AT.year && spec.yearOnFace !== false && spec.founded;
    const fill = tier === 'tiny' && palette.band === COASTER.band ? COASTER.ink : palette.letters;
    const code = layoutText(spec.code, {
        cut: tier === 'large' ? 'display' : 'small',
        capHeight: CODE_CAP[tier],
        cx: C,
        cy: year ? C - 4.5 : C,
        tracking: tier === 'large' ? 14 : tier === 'small' ? 22 : 30,
        kern: spec.kern,
        nudge: spec.nudge,
    });
    const out = [node('path', { d: code.d, fill })];
    if (year) {
        const line = layoutText(String(spec.founded), { cut: 'small', capHeight: 7, cx: C, cy: C + 15.5, tracking: 70 });
        out.push(node('path', { d: line.d, fill: palette.letters, fillOpacity: 0.95 }));
    }
    return out;
}
export function stampAngle(index) {
    const perRow = STAMP_ROWS.perArc * 2;
    const row = Math.floor(index / perRow);
    const i = index % perRow;
    const span = STAMP_ROWS.to - STAMP_ROWS.from;
    const step = span / (STAMP_ROWS.perArc - 1);
    const arc = Math.floor(i / STAMP_ROWS.perArc);
    const k = i % STAMP_ROWS.perArc;
    const angle = arc === 0 ? STAMP_ROWS.from + k * step : 360 - STAMP_ROWS.from - k * step;
    return { angle, row };
}
function stamps(ctx) {
    const count = Math.min(MAX_STAMPS, Math.max(0, Math.floor(ctx.stamps)));
    if (!count || ctx.tier !== 'large')
        return [];
    const { size, spec } = ctx;
    const rnd = seeded(`${spec.slug}:stamps`);
    const ink = spec.neutral ? COASTER.paper : COASTER.ink;
    const out = [];
    for (let i = 0; i < count; i += 1) {
        const { angle, row } = stampAngle(i);
        const radius = row === 0 ? 92.6 : 86.4;
        const r = atLeastPx(row === 0 ? 2.5 : 2.1, size, 1.6);
        const a = (angle * Math.PI) / 180;
        const x = C + radius * Math.sin(a) + (rnd() - 0.5) * 0.9;
        const y = C - radius * Math.cos(a) + (rnd() - 0.5) * 0.9;
        const squash = 0.82 + rnd() * 0.12;
        const turn = (rnd() - 0.5) * 40;
        const press = 0.62 + rnd() * 0.2;
        out.push(node('g', { transform: `translate(${num(x)} ${num(y)}) rotate(${num(turn)}) scale(1 ${num(squash)})` }, [
            node('circle', { cx: 0, cy: 0, r: num(r), fill: 'none', stroke: ink, strokeWidth: num(atLeastPx(1.1, size, 0.6)), strokeOpacity: press }),
            node('circle', { cx: num(r * 0.12), cy: num(-r * 0.1), r: num(r * 0.4), fill: ink, fillOpacity: press * 0.85 }),
        ]));
    }
    return out;
}
function face(ctx) {
    const { spec, tier, size, id } = ctx;
    const palette = badgePalette(spec);
    const dark = tier !== 'large' && luminance(spec.colours.primary) < DARK_FIELD_BELOW;
    const field = fieldRadius(tier, size) - (dark ? 3 : 0);
    const fieldClip = `${id}-field`;
    const out = [...cardboard(ctx)];
    const clip = needsClipPath(spec.pattern, true);
    if (clip || tier === 'large')
        out.push(node('defs', undefined, [discClip(fieldClip, field)]));
    const shapes = kitShapes({
        cx: C,
        cy: C,
        r: field,
        tier,
        colours: spec.colours,
        pattern: spec.pattern,
        density: spec.density,
        split: spec.split,
        shift: tier === 'large' ? SHIFT : undefined,
        keyline: palette.keyline ? { colour: palette.keyline, width: atLeastPx(1.2, size, 1) } : undefined,
        inDisc: true,
    });
    out.push(clip ? node('g', { clipPath: `url(#${fieldClip})` }, shapes) : node('g', undefined, shapes));
    out.push(...chestBand(ctx, palette, field, fieldClip));
    out.push(...lettering(ctx, palette));
    if (tier === 'large') {
        const grainId = `${id}-rim-grain`;
        const rimClip = `${id}-rim`;
        out.push(node('defs', undefined, [grainPattern(grainId, COASTER.ink, 0.1, ctx.rnd), node('clipPath', { id: rimClip }, [node('path', { d: annulusPath(EDGE, field), clipRule: 'evenodd' })])]));
        out.push(node('g', { clipPath: `url(#${rimClip})` }, [node('circle', { cx: C, cy: C, r: EDGE, fill: `url(#${grainId})` })]));
        if (size >= DETAIL_AT.rim) {
            if (spec.geography)
                out.push(rimText(coordinatesLabel(spec.geography), 'bottom', 95.4, 6, COASTER.ink, 0.75));
            if (ctx.season)
                out.push(rimText(ctx.season, 'top', 89.6, 6, COASTER.ink, 0.75, 60));
        }
    }
    out.push(...stamps(ctx));
    if (ctx.variant === 'european' && tier !== 'tiny')
        out.push(...foilRim(id, size, tier));
    if (tier === 'large')
        out.push(...innerShade(`${id}-shade`, ctx.surface));
    return out;
}
function neutralFace(ctx) {
    const { spec, tier, size } = ctx;
    const out = [];
    const edgeD = tier === 'large' ? roughDisc(EDGE, 0.55, ctx.rnd) : undefined;
    if (ctx.surface === 'night' && tier !== 'tiny')
        out.push(node('circle', { cx: C, cy: C + 1.5, r: num(EDGE + 0.5), fill: withAlpha('#000000', 0.35) }));
    out.push(edgeD ? node('path', { d: edgeD, fill: COASTER.board }) : node('circle', { cx: C, cy: C, r: EDGE, fill: COASTER.board }));
    const edge = atLeastPx(tier === 'tiny' ? 2.5 : 2, size);
    out.push(node('circle', { cx: C, cy: C, r: num(EDGE - edge / 2 - 0.5), fill: 'none', stroke: ctx.surface === 'night' ? COASTER.paper : COASTER.ink, strokeWidth: num(edge), strokeOpacity: 0.85 }));
    if (tier !== 'tiny')
        out.push(node('circle', { cx: C, cy: C, r: num(EDGE - 6), fill: 'none', stroke: COASTER.paper, strokeWidth: 1, strokeOpacity: 0.35 }));
    if (spec.code) {
        const cap = tier === 'large' ? 36 : tier === 'small' ? 44 : 50;
        const code = layoutText(spec.code, { cut: tier === 'large' ? 'display' : 'small', capHeight: cap, cx: C, cy: C, tracking: tier === 'large' ? 16 : 26 });
        out.push(node('path', { d: code.d, fill: COASTER.paper }));
    }
    out.push(...stamps(ctx));
    return out;
}
export function coordinatesLabel({ lat, lon }) {
    const dm = (value, pos, neg) => {
        const abs = Math.abs(value);
        let deg = Math.floor(abs);
        let min = Math.round((abs - deg) * 60);
        if (min === 60) {
            deg += 1;
            min = 0;
        }
        return `${deg}°${String(min).padStart(2, '0')}′${value >= 0 ? pos : neg}`;
    };
    return `${dm(lat, 'N', 'S')} · ${dm(lon, 'E', 'O')}`;
}
export function badgeContext(spec, options) {
    return {
        spec,
        tier: badgeTier(options.size),
        size: options.size,
        surface: options.surface ?? 'night',
        variant: options.variant ?? 'standard',
        id: options.idPrefix ?? `badge-${spec.slug}`,
        rnd: seeded(spec.slug),
        season: options.season ?? null,
        stamps: options.stamps ?? 0,
    };
}
export function badgeRoot(size, children) {
    return node('svg', { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: `0 0 ${BADGE_BOX} ${BADGE_BOX}` }, children);
}
export function badgeTree(spec, options) {
    const ctx = badgeContext(spec, options);
    return badgeRoot(options.size, spec.neutral ? neutralFace(ctx) : face(ctx));
}
export function badgeSvg(spec, options) {
    return svgString(badgeTree(spec, options));
}
export function shapeContrast(surface = 'night') {
    return surface === 'night' ? contrastRatio(COASTER.paper, COASTER.night) : contrastRatio(COASTER.ink, '#FFFFFF');
}
