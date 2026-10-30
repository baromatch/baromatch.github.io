// Les insignes des clubs (generateur/insigne.mjs) sont décoratifs (aria-hidden) : un test qui lit le texte ou la
// structure d’une page les retire d’abord (sansInsignes), et lit le reste tel quel. tests/insignes.spec.mjs vérifie,
// lui, qu’ils sont là, où et lesquels.
const DESSIN = String.raw`<svg class="insignes?"[\s\S]*?<\/svg>`;
export const sansInsignes = (html) => html
  .replace(new RegExp(String.raw`  <div class="regarder-insignes">(?:${DESSIN})+<\/div>\n`, 'g'), '')
  .replace(new RegExp(String.raw`<span class="insignes insignes--drapeau" aria-hidden="true">(?:${DESSIN}){2}<\/span>`, 'g'), '')
  .replace(new RegExp(DESSIN, 'g'), '');
