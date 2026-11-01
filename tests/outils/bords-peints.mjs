// Le contraste d’un bord (WCAG 1.4.11 : 3:1 pour ce qui dessine un composant), mesuré sur ce que le navigateur PEINT :
// le pixel du bord contre le pixel qui le touche, dehors (la page, un halo, une ombre portée, ce qui défile sous le
// bandeau du bas) et dedans (le fond de l’élément). Les couleurs du style, posées l’une sur l’autre, ne voient ni une
// ombre, ni un halo, ni ce qui passe sous un élément fixe.
//
// mesurerLesBords(page, selecteur) : chaque élément visible du sélecteur, entièrement dans l’écran ; chaque côté qui a un
// bord (1 px au moins) est lu sur sa partie droite (hors des arrondis), en une trentaine de points, le texte de la page
// caché le temps de la photo (un trait de lettre n’est pas un fond). Rend, par côté, le pire rapport contre le dehors et
// contre le dedans, et leurs couleurs. La page s’ouvre avec deviceScaleFactor: 3 (un iPhone) : un bord de 1 px y fait
// 3 pixels, et les pixels lus (le milieu du bord, celui qui le touche dehors, celui qui le touche dedans) restent les
// bons quel que soit l’arrondi de sa position, à un pixel près.
import { lirePng } from './pixels-peints.mjs';

const TEXTE_CACHE = `*, *::before, *::after, *::placeholder, *::marker {
  color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important;
  text-shadow: none !important; caret-color: transparent !important;
}`;

const LINEAIRE = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const luminance = ([r, v, b]) => 0.2126 * LINEAIRE[r] + 0.7152 * LINEAIRE[v] + 0.0722 * LINEAIRE[b];
const rapport = (x, y) => {
  const [claire, sombre] = [luminance(x), luminance(y)].sort((m, n) => n - m);
  return (claire + 0.05) / (sombre + 0.05);
};
const hex = (p) => `#${p.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export const mesurerLesBords = async (page, selecteur) => {
  const elements = await page.evaluate((s) => [...document.querySelectorAll(s)]
    .filter((e) => e.checkVisibility({ visibilityProperty: true }))
    .map((e) => {
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      const rayon = (coin) => Math.min(parseFloat(st[`border${coin}Radius`]) || 0, r.width / 2, r.height / 2);
      return {
        quoi: `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')} « ${e.textContent.replace(/\s+/g, ' ').trim().slice(0, 24)} »`,
        gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom,
        bords: { haut: parseFloat(st.borderTopWidth), bas: parseFloat(st.borderBottomWidth), gauche: parseFloat(st.borderLeftWidth), droite: parseFloat(st.borderRightWidth) },
        rayons: { hautGauche: rayon('TopLeft'), hautDroite: rayon('TopRight'), basGauche: rayon('BottomLeft'), basDroite: rayon('BottomRight') },
        dansLEcran: r.top >= 1 && r.left >= 1 && r.bottom <= innerHeight - 1 && r.right <= innerWidth - 1,
      };
    }), selecteur);
  const { dsf } = await page.evaluate(() => ({ dsf: window.devicePixelRatio }));
  if (dsf < 2.5) throw new Error(`mesurerLesBords : la page s’ouvre avec deviceScaleFactor: 3 (lu : ${dsf})`);
  const resultats = [];
  await page.evaluate((css) => {
    window.texteCacheDesBords = new CSSStyleSheet();
    window.texteCacheDesBords.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, window.texteCacheDesBords];
  }, TEXTE_CACHE);
  try {
    for (const e of elements) {
      if (!e.dansLEcran) throw new Error(`mesurerLesBords : ${e.quoi} n’est pas entier dans l’écran`);
      // La photo de l’élément et de 4 px autour, en pixels de l’écran (×3).
      const clip = { x: Math.floor(e.gauche) - 4, y: Math.floor(e.haut) - 4 };
      clip.width = Math.ceil(e.droite) + 4 - clip.x;
      clip.height = Math.ceil(e.bas) + 4 - clip.y;
      const image = lirePng(await page.screenshot({ clip }));
      const pixel = (x, y) => {
        const d = (y * image.largeur + x) * 4;
        return [image.pixels[d], image.pixels[d + 1], image.pixels[d + 2]];
      };
      const cotes = [];
      for (const cote of ['haut', 'bas', 'gauche', 'droite']) {
        const largeur = e.bords[cote];
        if (largeur < 1) continue;
        const epaisseur = Math.round(largeur * dsf);
        const horizontal = cote === 'haut' || cote === 'bas';
        // Le long du côté, hors des arrondis (et 2 px de plus).
        const [debut, fin] = horizontal
          ? [e.gauche + Math.max(cote === 'haut' ? e.rayons.hautGauche : e.rayons.basGauche, 0) + 2, e.droite - Math.max(cote === 'haut' ? e.rayons.hautDroite : e.rayons.basDroite, 0) - 2]
          : [e.haut + Math.max(cote === 'gauche' ? e.rayons.hautGauche : e.rayons.hautDroite, 0) + 2, e.bas - Math.max(cote === 'gauche' ? e.rayons.basGauche : e.rayons.basDroite, 0) - 2];
        if (fin - debut < 4) continue;
        // Le bord extérieur, en pixels de la photo ; « vers l’intérieur » : +1 en haut et à gauche, -1 en bas et à droite.
        const exterieur = Math.round(((horizontal ? (cote === 'haut' ? e.haut : e.bas) : (cote === 'gauche' ? e.gauche : e.droite)) - (horizontal ? clip.y : clip.x)) * dsf);
        const dedansVers = cote === 'haut' || cote === 'gauche' ? 1 : -1;
        // Haut et gauche : le bord occupe [E, E + ép.) ; bas et droite : [E - ép., E). Un pixel d’écart dans l’arrondi de
        // E garde ces trois lectures justes : le milieu du bord, le 2e pixel dehors, le 2e pixel dedans.
        const premierDuBord = dedansVers > 0 ? exterieur : exterieur - 1;
        const milieu = premierDuBord + dedansVers * Math.floor(epaisseur / 2);
        const dehors = premierDuBord - dedansVers * 2;
        const dedans = premierDuBord + dedansVers * (epaisseur + 1);
        let pire = null;
        const pas = Math.max(1, Math.floor(((fin - debut) * dsf) / 30));
        for (let le = Math.ceil((debut - (horizontal ? clip.x : clip.y)) * dsf); le <= Math.floor((fin - (horizontal ? clip.x : clip.y)) * dsf); le += pas) {
          const lire = (a) => (horizontal ? pixel(le, a) : pixel(a, le));
          const bord = lire(milieu);
          const exterieurLu = lire(dehors);
          const interieurLu = lire(dedans);
          const lu = { dehors: rapport(bord, exterieurLu), dedans: rapport(bord, interieurLu), bord: hex(bord), fondDehors: hex(exterieurLu), fondDedans: hex(interieurLu), a: le / dsf + (horizontal ? clip.x : clip.y) };
          if (!pire || Math.min(lu.dehors, lu.dedans) < Math.min(pire.dehors, pire.dedans)) pire = lu;
        }
        cotes.push({ cote, ...pire, dehors: Math.round(pire.dehors * 100) / 100, dedans: Math.round(pire.dedans * 100) / 100 });
      }
      resultats.push({ quoi: e.quoi, cotes });
    }
  } finally {
    await page.evaluate(() => { document.adoptedStyleSheets = document.adoptedStyleSheets.filter((f) => f !== window.texteCacheDesBords); });
  }
  return resultats;
};

// Les côtés sous le seuil, une ligne chacun : contre le dehors (ce qui dessine la forme, WCAG 1.4.11), et contre le
// dedans sauf { dedans: false } (un reflet, une ombre intérieure : le bord y touche autre chose que le fond).
export const bordsTropFaibles = (mesures, seuil = 3, ou = '', { dedans = true } = {}) => mesures.flatMap((m) => m.cotes
  .filter((c) => c.dehors < seuil || (dedans && c.dedans < seuil))
  .map((c) => `${ou}${m.quoi}, côté ${c.cote} (à ${Math.round(c.a)} px) : ${c.dehors}:1 dehors (${c.bord} sur ${c.fondDehors}), ${c.dedans}:1 dedans (sur ${c.fondDedans})`));
