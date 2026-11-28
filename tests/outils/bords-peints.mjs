// Le contraste d’un bord (WCAG 1.4.11 : 3:1 pour ce qui dessine un composant), mesuré sur ce que le navigateur PEINT :
// le pixel du bord contre le pixel qui le touche, dehors (la page, un halo, une ombre portée, ce qui défile sous le
// bandeau du bas) et dedans (le fond de l’élément). Les couleurs du style, posées l’une sur l’autre, ne voient ni une
// ombre, ni un halo, ni ce qui passe sous un élément fixe.
//
// mesurerLesBords(page, selecteur) : chaque élément visible du sélecteur, entièrement dans l’écran (il peut en toucher le
// bord, pas par un côté qui a un bord) ; chaque côté qui a un
// bord (1 px au moins) est lu sur sa partie droite (hors des arrondis), en une trentaine de points, le texte de la page
// caché le temps de la photo (un trait de lettre n’est pas un fond). Rend, par côté, le pire rapport contre le dehors et
// contre le dedans, et leurs couleurs. La page s’ouvre avec deviceScaleFactor: 3 (un iPhone) : un bord de 1 px y fait
// 3 pixels, et les pixels lus (le milieu du bord, celui qui le touche dehors, celui qui le touche dedans) restent les
// bons quel que soit l’arrondi de sa position, à un pixel près.
// La boîte est relue après la photo : une page qui a défilé entre-temps (la photo se cadre sur le document, la boîte sur
// l’écran) est mesurée de nouveau, une fois posée. Sans cela, sur « Pour les bars », la salle et le formulaire qui
// arrivent après le premier affichage faisaient défiler la page seule de quelques pixels (l’ancrage du défilement) entre
// la lecture et la photo : le bandeau du bas était lu à côté de son trait.
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

// Les éléments du sélecteur, tels qu’ils sont à cet instant, avec le défilement de la page : la photo de Playwright se
// cadre sur le document, la boîte d’un élément se lit dans l’écran ; les deux ne se répondent que si la page n’a pas
// défilé entre-temps.
const lireLesElements = (page, selecteur) => page.evaluate((s) => ({ defilement: [scrollX, scrollY], elements: [...document.querySelectorAll(s)]
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
        // Entier dans l’écran ; il peut en toucher le bord (le bandeau du bas, posé au bas de l’écran) : ce côté-là n’a pas
        // de dehors, et la photo s’arrête à l’écran.
        dansLEcran: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
        ecran: { largeur: innerWidth, hauteur: innerHeight },
      };
    }) }), selecteur);
const memePlace = (a, b) => a.defilement.join() === b.defilement.join() && a.elements.length === b.elements.length
  && a.elements.every((e, i) => ['gauche', 'haut', 'droite', 'bas'].every((c) => Math.abs(e[c] - b.elements[i][c]) < 0.01));
// Une page qui bouge encore (un script ou une police qui arrive tard, et l’ancrage du défilement qui compense : sur
// « Pour les bars », la page défile seule de quelques pixels) : la mesure est refaite, jusqu’à 10 fois, sur une page posée.
const ESSAIS_POUR_UNE_PAGE_POSEE = 10;

export const mesurerLesBords = async (page, selecteur) => {
  const { elements } = await lireLesElements(page, selecteur);
  const { dsf } = await page.evaluate(() => ({ dsf: window.devicePixelRatio }));
  if (dsf < 2.5) throw new Error(`mesurerLesBords : la page s’ouvre avec deviceScaleFactor: 3 (lu : ${dsf})`);
  const resultats = [];
  await page.evaluate((css) => {
    window.texteCacheDesBords = new CSSStyleSheet();
    window.texteCacheDesBords.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, window.texteCacheDesBords];
  }, TEXTE_CACHE);
  try {
    for (const [rang] of elements.entries()) {
      // La boîte lue, la photo prise, la boîte relue : si la page a bougé entre les deux lectures, la photo ne montre pas
      // l’élément là où sa boîte le dit ; on attend qu’elle se pose et on recommence.
      let e = null;
      let clip = null;
      let image = null;
      for (let essai = 1; ; essai += 1) {
        const avant = await lireLesElements(page, selecteur);
        e = avant.elements[rang];
        if (!e) throw new Error(`mesurerLesBords : ${selecteur}, l’élément ${rang + 1} a disparu`);
        if (!e.dansLEcran) throw new Error(`mesurerLesBords : ${e.quoi} n’est pas entier dans l’écran`);
        // La photo de l’élément et de 4 px autour, en pixels de l’écran (×3).
        clip = { x: Math.max(0, Math.floor(e.gauche) - 4), y: Math.max(0, Math.floor(e.haut) - 4) };
        clip.width = Math.min(e.ecran.largeur, Math.ceil(e.droite) + 4) - clip.x;
        clip.height = Math.min(e.ecran.hauteur, Math.ceil(e.bas) + 4) - clip.y;
        const photo = await page.screenshot({ clip });
        if (memePlace(avant, await lireLesElements(page, selecteur))) {
          image = lirePng(photo);
          break;
        }
        if (essai === ESSAIS_POUR_UNE_PAGE_POSEE) throw new Error(`mesurerLesBords : ${e.quoi}, la page bouge encore après ${essai} essais`);
        await page.waitForTimeout(150);
      }
      const pixel = (x, y) => {
        const d = (y * image.largeur + x) * 4;
        return [image.pixels[d], image.pixels[d + 1], image.pixels[d + 2]];
      };
      const cotes = [];
      for (const cote of ['haut', 'bas', 'gauche', 'droite']) {
        const largeur = e.bords[cote];
        if (largeur < 1) continue;
        // Un bord posé sur le bord de l’écran n’a rien dehors à quoi se mesurer.
        if ((cote === 'haut' && e.haut < 3) || (cote === 'gauche' && e.gauche < 3) || (cote === 'bas' && e.bas > e.ecran.hauteur - 3) || (cote === 'droite' && e.droite > e.ecran.largeur - 3)) throw new Error(`mesurerLesBords : ${e.quoi}, son bord ${cote} est sur le bord de l’écran`);
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
