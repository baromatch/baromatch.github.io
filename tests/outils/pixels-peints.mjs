// Le contraste des petits textes, mesuré sur ce que le navigateur PEINT, pixel par pixel : ce que tests/outils/textes-peints.mjs
// ne voit pas, lui qui n’empile que des couleurs de fond. Une ombre portée (celle d’un cadre d’écran, sous sa légende), un halo
// de lumière, un dégradé : aucun n’est une couleur de fond d’un ancêtre, et chacun peut grignoter le contraste d’un texte.
//
// mesurerAuPixel(page, nuit) : le texte de la page est caché (couleur transparente, soulignements et ombres de texte retirés), la
// page est photographiée de haut en bas, un écran à la fois (ce qui est fixe ou collant se peint donc là où le visiteur le
// voit), et derrière chaque ligne de texte (les rectangles que le navigateur donne pour ses caractères) chaque pixel est
// comparé à la couleur du texte posée dessus. Le pire pixel de chaque ligne en est le contraste. `nuit` : les moments de nuit
// de la page (un sélecteur CSS), que la mesure laisse de côté. Le texte caché l’est par une feuille construite (adoptedStyleSheets) :
// la politique de sécurité de la page, qui n’admet pas de style en ligne, n’a pas à être contournée.
import { inflateSync } from 'node:zlib';
import { TOUJOURS_HORS_JEU } from './textes-peints.mjs';

// Une capture du navigateur (PNG, 8 bits, RGB ou RGBA, sans entrelacement) lue en pixels RGBA : rien d’autre que Node.
export const lirePng = (png) => {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('lirePng : ce n’est pas un PNG');
  let place = 8;
  let entete = null;
  const morceaux = [];
  while (place < png.length) {
    const taille = png.readUInt32BE(place);
    const type = png.toString('latin1', place + 4, place + 8);
    const donnees = png.subarray(place + 8, place + 8 + taille);
    if (type === 'IHDR') entete = { largeur: donnees.readUInt32BE(0), hauteur: donnees.readUInt32BE(4), profondeur: donnees[8], couleur: donnees[9], entrelace: donnees[12] };
    if (type === 'IDAT') morceaux.push(donnees);
    if (type === 'IEND') break;
    place += 12 + taille;
  }
  if (!entete || entete.profondeur !== 8 || ![2, 6].includes(entete.couleur) || entete.entrelace !== 0) {
    throw new Error(`lirePng : un PNG de 8 bits, RGB ou RGBA, sans entrelacement est attendu (lu : ${JSON.stringify(entete)})`);
  }
  const canaux = entete.couleur === 6 ? 4 : 3;
  const { largeur, hauteur } = entete;
  const ligne = largeur * canaux;
  const brut = inflateSync(Buffer.concat(morceaux));
  const pixels = new Uint8Array(largeur * hauteur * 4);
  let precedente = new Uint8Array(ligne);
  for (let y = 0; y < hauteur; y += 1) {
    const filtre = brut[y * (ligne + 1)];
    const courante = new Uint8Array(brut.buffer, brut.byteOffset + y * (ligne + 1) + 1, ligne).slice();
    for (let i = 0; i < ligne; i += 1) {
      const gauche = i >= canaux ? courante[i - canaux] : 0;
      const haut = precedente[i];
      const hautGauche = i >= canaux ? precedente[i - canaux] : 0;
      let predit = 0;
      if (filtre === 1) predit = gauche;
      else if (filtre === 2) predit = haut;
      else if (filtre === 3) predit = (gauche + haut) >> 1;
      else if (filtre === 4) {
        const p = gauche + haut - hautGauche;
        const pg = Math.abs(p - gauche);
        const ph = Math.abs(p - haut);
        const pgh = Math.abs(p - hautGauche);
        predit = pg <= ph && pg <= pgh ? gauche : ph <= pgh ? haut : hautGauche;
      } else if (filtre !== 0) throw new Error(`lirePng : filtre inconnu (${filtre})`);
      courante[i] = (courante[i] + predit) & 255;
    }
    for (let x = 0; x < largeur; x += 1) {
      const d = (y * largeur + x) * 4;
      pixels[d] = courante[x * canaux];
      pixels[d + 1] = courante[x * canaux + 1];
      pixels[d + 2] = courante[x * canaux + 2];
      pixels[d + 3] = canaux === 4 ? courante[x * canaux + 3] : 255;
    }
    precedente = courante;
  }
  return { largeur, hauteur, pixels };
};

// Le texte caché : sa couleur, son remplissage, son souligné et son ombre disparaissent ; la mise en page ne bouge pas d’un pixel.
const TEXTE_CACHE = `*, *::before, *::after, *::placeholder, *::marker {
  color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration: none !important;
  text-shadow: none !important; caret-color: transparent !important;
}`;

// Chaque ligne de texte visible tout entière à l’écran, là où elle est : son rectangle (en pixels de l’écran), la couleur de son
// texte (avec l’opacité de ses ancêtres), et de quoi la nommer. L’ordre d’un passage à l’autre est le même (la page n’a pas bougé
// de place) : `cle` retrouve la même ligne à une autre position de défilement.
const lireLesLignes = (nuit) => {
  const lignes = [];
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let rang = 0;
  for (let texte = marcheur.nextNode(); texte; texte = marcheur.nextNode()) {
    rang += 1;
    if (!texte.textContent.trim()) continue;
    const element = texte.parentElement;
    if (!element || element.closest(`${nuit}, script, style, svg, noscript, [hidden]`)) continue;
    if (!element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const [r, v, b, a = 1] = getComputedStyle(element).color.match(/[\d.]+/g).map(Number);
    let opacite = 1;
    for (let e = element; e; e = e.parentElement) opacite *= Number(getComputedStyle(e).opacity);
    const plage = document.createRange();
    plage.selectNodeContents(texte);
    [...plage.getClientRects()].forEach((rect, i) => {
      if (rect.width < 2 || rect.height < 2) return;
      // Une ligne coupée par le bord de l’écran se mesure à une autre position de défilement, où elle est entière.
      if (rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) return;
      lignes.push({
        cle: `${rang}:${i}`,
        quoi: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.split(' ')[0]}` : ''} « ${texte.textContent.trim().slice(0, 28)} »`,
        couleur: { r, v, b, a: a * opacite },
        gauche: rect.left, haut: rect.top, droite: rect.right, bas: rect.bottom,
      });
    });
  }
  return lignes;
};

// La luminance relative de WCAG pour chaque valeur de canal, une fois pour toutes.
const LINEAIRE = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const luminance = (r, v, b) => 0.2126 * LINEAIRE[Math.round(r)] + 0.7152 * LINEAIRE[Math.round(v)] + 0.0722 * LINEAIRE[Math.round(b)];
const hex = (r, v, b) => `#${[r, v, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

// Le pire pixel derrière une ligne : le texte (sa couleur et son opacité) posé sur lui, comme l’œil le voit.
const pireDerriere = (image, ligne) => {
  const { r, v, b, a } = ligne.couleur;
  const x0 = Math.max(0, Math.floor(ligne.gauche));
  const x1 = Math.min(image.largeur, Math.ceil(ligne.droite));
  const y0 = Math.max(0, Math.floor(ligne.haut));
  const y1 = Math.min(image.hauteur, Math.ceil(ligne.bas));
  let pire = { rapport: Infinity, fond: null, texte: null, x: 0, y: 0 };
  let pixels = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const d = (y * image.largeur + x) * 4;
      const [fr, fv, fb] = [image.pixels[d], image.pixels[d + 1], image.pixels[d + 2]];
      const tr = r * a + fr * (1 - a);
      const tv = v * a + fv * (1 - a);
      const tb = b * a + fb * (1 - a);
      const lt = luminance(tr, tv, tb);
      const lf = luminance(fr, fv, fb);
      const rapport = (Math.max(lt, lf) + 0.05) / (Math.min(lt, lf) + 0.05);
      pixels += 1;
      if (rapport < pire.rapport) pire = { rapport, fond: hex(fr, fv, fb), texte: hex(tr, tv, tb), x, y };
    }
  }
  return pixels === 0 ? null : { ...pire, pixels };
};

// Toutes les lignes de texte du jour de la page : [{ quoi, rapport (le pire pixel), texte, fond, ou (x, y de la page), taille }]
// — une par ligne de texte, la plus faible de ses mesures si elle a été vue à plus d’une position.
export const mesurerAuPixel = async (page, nuit) => {
  await page.evaluate(() => document.fonts.ready);
  // La feuille qui cache le texte est construite une fois et posée, ou retirée, à chaque passage : les couleurs se lisent
  // texte visible, la photo se prend texte caché.
  await page.evaluate((css) => {
    window.texteCache = new CSSStyleSheet();
    window.texteCache.replaceSync(css);
  }, TEXTE_CACHE);
  const cacher = (oui) => page.evaluate((cache) => {
    const autres = document.adoptedStyleSheets.filter((feuille) => feuille !== window.texteCache);
    document.adoptedStyleSheets = cache ? [...autres, window.texteCache] : autres;
  }, oui);
  const { total, hauteur, largeur } = await page.evaluate(() => ({ total: document.documentElement.scrollHeight, hauteur: window.innerHeight, largeur: window.innerWidth }));
  // Un pas d’un demi-écran : une ligne (moins d’un quart d’écran de haut) est entière à l’écran à deux passages au moins, à deux
  // hauteurs différentes (ce que la lumière du match, fixe dans l’écran, lui fait varie avec la hauteur).
  const pas = Math.floor(hauteur * 0.5);
  const lignes = new Map();
  for (let y = 0; ; y += pas) {
    const defilement = Math.min(y, Math.max(0, total - hauteur));
    await page.evaluate((haut) => window.scrollTo({ top: haut, behavior: 'instant' }), defilement);
    // Deux images, pour que ce qui suit le défilement (la lumière du match, ses halos) ait fini de se poser, et la fin des
    // transitions et des animations qui ne tournent pas sans fin (une couleur lue à mi-chemin du texte qui reparaît serait un gris).
    await page.evaluate(() => new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); }));
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
      .map((animation) => animation.finished.catch(() => {}))));
    const vues = await page.evaluate(lireLesLignes, `${nuit}, ${TOUJOURS_HORS_JEU}`);
    await cacher(true);
    const image = lirePng(await page.screenshot({ animations: 'disabled' }));
    await cacher(false);
    if (image.largeur !== largeur) throw new Error(`mesurerAuPixel : la capture fait ${image.largeur} px de large, la page ${largeur}`);
    for (const ligne of vues) {
      const pire = pireDerriere(image, ligne);
      if (!pire) continue;
      const lue = { quoi: ligne.quoi, rapport: Math.round(pire.rapport * 100) / 100, texte: pire.texte, fond: pire.fond, ou: `${pire.x},${pire.y + defilement}` };
      const vue = lignes.get(ligne.cle);
      if (!vue || vue.rapport > lue.rapport) lignes.set(ligne.cle, lue);
    }
    if (defilement + hauteur >= total) break;
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  return [...lignes.values()];
};

// Les lignes sous le seuil, une ligne de texte chacune.
export const lignesTropFaibles = (mesures, seuil = 4.5) => mesures.filter((m) => m.rapport < seuil)
  .sort((a, b) => a.rapport - b.rapport)
  .map((m) => `${m.quoi} : ${m.rapport}:1 (${m.texte} sur ${m.fond}, au pixel ${m.ou})`);

// Les plus faibles, pour l’annotation d’un test (infos.annotations.push({ type: 'contraste peint', description })).
export const decrireLesPlusFaibles = (mesures, combien = 12) => [...mesures].sort((a, b) => a.rapport - b.rapport).slice(0, combien)
  .map((m) => `${m.rapport}:1 ${m.texte} sur ${m.fond} (${m.quoi}, au pixel ${m.ou})`).join(' | ');
