/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
import { contrastRatio, toHsl } from "./colour.mjs";
import { BADGE_BOX, C, COASTER, DETAIL_AT, EDGE, annulusPath, atLeastPx, badgeTier, cardboard, discClip, fieldRadius, foilRim, grainPattern, innerShade, rimText, seeded } from "./coaster.mjs";
import { BAND_HEIGHT, badgePalette, badgeRoot } from "./badge.mjs";
import { kitShapes } from "./patterns.mjs";
import { node, num, svgString } from "./svg.mjs";
import { layoutText } from "./type.mjs";
export function hueFamily(hex) {
    const { h, s, l } = toHsl(hex);
    if (s < 0.18)
        return l > 0.5 ? 'light' : 'dark';
    const deg = h * 360;
    if (deg < 18 || deg >= 340)
        return 'red';
    if (deg < 48)
        return 'orange';
    if (deg < 72)
        return 'yellow';
    if (deg < 170)
        return 'green';
    if (deg < 200)
        return 'cyan';
    if (deg < 262)
        return 'blue';
    if (deg < 300)
        return 'purple';
    return 'red';
}
const FIELD_PATTERNS = ['solid', 'band', 'bar', 'chevron', 'pinstripes', 'sleeves'];
export function dominant(kit) {
    const { primary, secondary } = kit.colours;
    if (hueFamily(primary) === 'light' && !FIELD_PATTERNS.includes(kit.pattern))
        return secondary;
    return primary;
}
export function patternClass(pattern) {
    if (pattern === 'stripes' || pattern === 'hoops')
        return 'striped';
    if (pattern === 'halves' || pattern === 'quarters' || pattern === 'sash' || pattern === 'diagonal')
        return 'split';
    return 'plain';
}
export function kitsClash(home, away) {
    const a = dominant(home);
    const b = dominant(away);
    if (hueFamily(a) !== hueFamily(b) || contrastRatio(a, b) >= 1.8)
        return false;
    const ca = patternClass(home.pattern);
    const cb = patternClass(away.pattern);
    return ca === cb || ca === 'plain' || cb === 'plain';
}
export function matchKits(home, away) {
    const homeKit = { pattern: home.pattern, colours: home.colours, density: home.density, split: home.split };
    const awayHome = { pattern: away.pattern, colours: away.colours, density: away.density, split: away.split };
    if (away.away && kitsClash(homeKit, awayHome)) {
        const changed = { pattern: away.away.pattern, colours: away.away.colours, density: away.away.density, split: away.away.split };
        return { home: homeKit, away: changed, awayChanged: true };
    }
    return { home: homeKit, away: awayHome, awayChanged: false };
}
export const RIVALRIES = [
    ['rc-lens', 'losc-lille'],
    ['fc-nantes', 'stade-rennais-fc'],
    ['as-saint-etienne', 'olympique-lyonnais'],
    ['stade-brestois-29', 'fc-lorient'],
    ['fc-metz', 'as-nancy-lorraine'],
    ['ogc-nice', 'as-monaco'],
    ['girondins-de-bordeaux', 'toulouse-fc'],
];
export function isDerby(home, away) {
    if (home.city && away.city && home.city.trim().toLowerCase() === away.city.trim().toLowerCase())
        return true;
    return RIVALRIES.some(([a, b]) => (a === home.slug && b === away.slug) || (a === away.slug && b === home.slug));
}
export function tornEdge(rnd, jitter, from = -2, to = BADGE_BOX + 2) {
    const steps = 22;
    const parts = [];
    for (let i = 0; i <= steps; i += 1) {
        const y = from + ((to - from) * i) / steps;
        const x = C + (rnd() * 2 - 1) * jitter;
        parts.push(`${num(x)} ${num(y)}`);
    }
    return `M${parts.join('L')}`;
}
function halfPath(edge, side) {
    const far = side === 'left' ? -4 : BADGE_BOX + 4;
    return `${edge}L${far} ${BADGE_BOX + 2}L${far} -2Z`;
}
function tear(ctx, edge, edge2, clipTo) {
    const { size, id } = ctx;
    const fibre = atLeastPx(2.2, size, 1);
    const shade = atLeastPx(3, size, 1.2);
    const clipId = `${id}-tear`;
    const out = [node('defs', undefined, [discClip(clipId, clipTo)])];
    const pieces = [];
    if (edge2) {
        pieces.push(node('path', { d: `${edge}L${edge2.slice(1).split('L').reverse().join('L')}Z`, fill: COASTER.board, fillOpacity: 0.9 }));
        pieces.push(node('path', { d: edge2, fill: 'none', stroke: COASTER.paper, strokeWidth: num(fibre), strokeOpacity: 0.95, strokeLinejoin: 'round' }));
    }
    else {
        pieces.push(node('path', { d: edge, fill: 'none', stroke: COASTER.ink, strokeWidth: num(shade), strokeOpacity: 0.45, transform: `translate(${num(shade / 2)} 0)` }));
    }
    pieces.push(node('path', { d: edge, fill: 'none', stroke: COASTER.paper, strokeWidth: num(fibre), strokeOpacity: 0.95, strokeLinejoin: 'round' }));
    pieces.push(node('path', { d: edge, fill: 'none', stroke: COASTER.ink, strokeWidth: num(atLeastPx(0.9, size, 1)), strokeOpacity: 0.85, strokeLinejoin: 'round', transform: `translate(${num(-fibre / 2 - 0.2)} 0)` }));
    out.push(node('g', { clipPath: `url(#${clipId})` }, pieces));
    return out;
}
export const MATCH_CODES_AT = 40;
function halfShirt(kit, side, field, tier, size, keyline) {
    const shapes = kitShapes({ cx: C, cy: C, r: field + 1, tier, colours: kit.colours, pattern: kit.pattern, density: kit.density, split: kit.split, keyline: keyline ? { colour: keyline, width: atLeastPx(1.2, size, 0.8) } : undefined });
    if (patternClass(kit.pattern) !== 'split')
        return shapes;
    const [fieldDisc, ...overlays] = shapes;
    const transform = side === 'left' ? 'scale(0.5 1)' : `translate(${C} 0) scale(0.5 1)`;
    return [fieldDisc, node('g', { transform }, overlays)];
}
export function matchCoasterTree(home, away, options) {
    const size = options.size;
    const tier = badgeTier(size);
    const ctx = {
        tier,
        size,
        surface: options.surface ?? 'night',
        variant: options.variant ?? 'standard',
        id: options.idPrefix ?? `match-${home.slug}-${away.slug}`,
        rnd: seeded(`${home.slug}|${away.slug}`),
        derby: options.derby ?? isDerby(home, away),
    };
    const { id } = ctx;
    const kits = matchKits(home, away);
    const field = fieldRadius(tier, size);
    const out = [...cardboard({ tier, size, surface: ctx.surface, rnd: ctx.rnd })];
    const edge = tornEdge(ctx.rnd, tier === 'large' ? 2.4 : 1.8);
    const sliver = tier === 'large' ? 9 : 7;
    const edge2 = ctx.derby ? tornEdge(ctx.rnd, tier === 'large' ? 2.4 : 1.8).replace(/M([\d.]+) /, (_m, x) => `M${num(Number(x) + sliver)} `).replace(/L([\d.]+) /g, (_m, x) => `L${num(Number(x) + sliver)} `) : null;
    const fieldClip = `${id}-field`;
    const leftClip = `${id}-left`;
    const rightClip = `${id}-right`;
    out.push(node('defs', undefined, [
        discClip(fieldClip, field),
        node('clipPath', { id: leftClip }, [node('path', { d: halfPath(edge, 'left') })]),
        node('clipPath', { id: rightClip }, [node('path', { d: halfPath(edge2 ?? edge, 'right') })]),
    ]));
    const palette = { home: badgePalette({ pattern: kits.home.pattern, colours: kits.home.colours }), away: badgePalette({ pattern: kits.away.pattern, colours: kits.away.colours }) };
    out.push(node('g', { clipPath: `url(#${fieldClip})` }, [
        node('g', { clipPath: `url(#${leftClip})` }, halfShirt(kits.home, 'left', field, tier, size, palette.home.keyline)),
        node('g', { clipPath: `url(#${rightClip})` }, halfShirt(kits.away, 'right', field, tier, size, palette.away.keyline)),
    ]));
    const h = BAND_HEIGHT[tier];
    const top = C - h / 2;
    const bandClip = `${id}-band`;
    const shade = atLeastPx(1.4, size, 0.75);
    out.push(node('defs', undefined, [discClip(bandClip, field - 3)]));
    const bandPieces = [
        node('rect', { x: 0, y: num(top + h), width: BADGE_BOX, height: num(shade), fill: COASTER.ink, fillOpacity: 0.28 }),
        node('rect', { x: 0, y: num(top), width: BADGE_BOX, height: num(h), fill: COASTER.band }),
        node('rect', { x: 0, y: num(top), width: BADGE_BOX, height: num(atLeastPx(1, size, 0.5)), fill: COASTER.white, fillOpacity: 0.45 }),
    ];
    if (tier === 'large') {
        const grainId = `${id}-grain`;
        out.push(node('defs', undefined, [grainPattern(grainId, COASTER.ink, 0.09, ctx.rnd)]));
        bandPieces.push(node('rect', { x: 0, y: num(top), width: BADGE_BOX, height: num(h), fill: `url(#${grainId})` }));
    }
    out.push(node('g', { clipPath: `url(#${bandClip})` }, bandPieces));
    if (size >= MATCH_CODES_AT) {
        const cap = tier === 'large' ? 22 : 28;
        const letters = (spec, kit, cx) => {
            const colour = badgePalette({ pattern: kit.pattern, colours: kit.colours });
            const fill = kit.pattern === 'solid' ? badgePalette({ pattern: 'stripes', colours: kit.colours }).letters : colour.letters;
            return node('path', { d: layoutText(spec.code, { cut: tier === 'large' ? 'display' : 'small', capHeight: cap, cx, cy: C, tracking: tier === 'large' ? 12 : 20, kern: spec.kern }).d, fill });
        };
        out.push(letters(home, kits.home, C - 44), letters(away, kits.away, C + 44));
    }
    out.push(...tear(ctx, edge, edge2, field));
    if (tier === 'large') {
        const grainId = `${id}-rim-grain`;
        const rimClip = `${id}-rim`;
        out.push(node('defs', undefined, [grainPattern(grainId, COASTER.ink, 0.1, ctx.rnd), node('clipPath', { id: rimClip }, [node('path', { d: annulusPath(EDGE, field), clipRule: 'evenodd' })])]));
        out.push(node('g', { clipPath: `url(#${rimClip})` }, [node('circle', { cx: C, cy: C, r: EDGE, fill: `url(#${grainId})` })]));
        if (ctx.derby && size >= DETAIL_AT.year)
            out.push(rimText('DERBY', 'top', 88.6, 7, COASTER.ink, 0.7, 90));
    }
    if (ctx.variant === 'european' && tier !== 'tiny')
        out.push(...foilRim(id, size, tier));
    if (tier === 'large')
        out.push(...innerShade(`${id}-shade`, ctx.surface));
    return badgeRoot(size, out);
}
export function matchCoasterSvg(home, away, options) {
    return svgString(matchCoasterTree(home, away, options));
}
export function kitRingTree(home, away, options) {
    const { size, width } = options;
    const id = options.idPrefix ?? `ring-${home.slug}-${away.slug}`;
    const rnd = seeded(`${home.slug}|${away.slug}:ring`);
    const kits = matchKits(home, away);
    const outer = BADGE_BOX / 2;
    const inner = outer - (width / size) * BADGE_BOX;
    const tier = size >= 160 ? 'large' : size >= 60 ? 'small' : 'tiny';
    const edgeTop = tornEdge(rnd, 2, -2, C);
    const edgeBottom = tornEdge(rnd, 2, C, BADGE_BOX + 2);
    const ringClip = `${id}-ring`;
    const leftClip = `${id}-left`;
    const rightClip = `${id}-right`;
    const leftHalf = `${edgeTop}${edgeBottom.replace(/^M/, 'L')}L-4 ${BADGE_BOX + 2}L-4 -2Z`;
    const rightHalf = `${edgeTop}${edgeBottom.replace(/^M/, 'L')}L${BADGE_BOX + 4} ${BADGE_BOX + 2}L${BADGE_BOX + 4} -2Z`;
    const shapesOf = (kit) => kitShapes({ cx: C, cy: C, r: outer + 1, tier, colours: kit.colours, pattern: kit.pattern, density: kit.density, split: kit.split });
    const fibre = Math.max(1.6, (BADGE_BOX / size) * 1);
    return node('svg', { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: `0 0 ${BADGE_BOX} ${BADGE_BOX}` }, [
        node('defs', undefined, [
            node('clipPath', { id: ringClip }, [node('path', { d: annulusPath(outer, inner), clipRule: 'evenodd' })]),
            node('clipPath', { id: leftClip }, [node('path', { d: leftHalf })]),
            node('clipPath', { id: rightClip }, [node('path', { d: rightHalf })]),
        ]),
        node('g', { clipPath: `url(#${ringClip})` }, [
            node('g', { clipPath: `url(#${rightClip})` }, shapesOf(kits.home)),
            node('g', { clipPath: `url(#${leftClip})` }, shapesOf(kits.away)),
            node('path', { d: edgeTop, fill: 'none', stroke: COASTER.paper, strokeWidth: num(fibre), strokeLinejoin: 'round' }),
            node('path', { d: edgeBottom, fill: 'none', stroke: COASTER.paper, strokeWidth: num(fibre), strokeLinejoin: 'round' }),
        ]),
    ]);
}
export function kitRingSvg(home, away, options) {
    return svgString(kitRingTree(home, away, options));
}
