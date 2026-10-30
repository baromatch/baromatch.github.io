/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */
export const node = (tag, attrs, children) => ({ tag, attrs, children });
const ATTR_NAMES = {
    clipPath: 'clip-path',
    fillOpacity: 'fill-opacity',
    strokeOpacity: 'stroke-opacity',
    strokeWidth: 'stroke-width',
    strokeLinecap: 'stroke-linecap',
    strokeLinejoin: 'stroke-linejoin',
    strokeDasharray: 'stroke-dasharray',
    fillRule: 'fill-rule',
    clipRule: 'clip-rule',
    stopColor: 'stop-color',
    stopOpacity: 'stop-opacity',
    gradientUnits: 'gradientUnits',
    patternUnits: 'patternUnits',
    viewBox: 'viewBox',
    gradientTransform: 'gradientTransform',
    patternTransform: 'patternTransform',
};
function attrName(name) {
    return ATTR_NAMES[name] ?? name;
}
function escapeText(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function svgString(n) {
    const attrs = Object.entries(n.attrs ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ` ${attrName(key)}="${escapeText(String(value))}"`)
        .join('');
    const inner = (n.children ?? []).map(svgString).join('') + (n.text ? escapeText(n.text) : '');
    if (!inner)
        return `<${n.tag}${attrs}/>`;
    return `<${n.tag}${attrs}>${inner}</${n.tag}>`;
}
export function num(value, precision = 2) {
    return Number(value.toFixed(precision));
}
