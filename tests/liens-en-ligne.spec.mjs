// Les liens pris dans une phrase restent dans la phrase (À propos, Presse et partenariats, Comment on choisit les bars).
// Un lien passé en boîte (inline-flex de 44 px) se coupait de la ponctuation qui le suit : une virgule ou un point
// partait seul en début de ligne, et la ligne du lien prenait 44 px, l’interligne doublait autour de lui. Mesuré de
// 320 à 480 px toutes les 8 px, puis toutes les 16 px jusqu’à 1 440 px, avec le texte à 100 % et à 200 % (agrandi par
// le style de la racine, comme tests/texte-agrandi.spec.mjs) :
// - la ponctuation qui suit un lien ( , . ; : ! ? » ) … ) est sur la ligne où le lien finit : le premier caractère
//   visible après le lien (une Range sur lui) est à la hauteur du dernier rectangle du lien (getClientRects) ;
// - dans un paragraphe qui contient un lien, l’écart entre deux lignes reste l’interligne du paragraphe, à 1 px près.
// Une page chargée par largeur, mesurée aux deux tailles de texte.
import { test, expect } from '@playwright/test';

const PAGES = [
  { chemin: '/a-propos.html', nom: 'À propos' },
  { chemin: '/presse.html', nom: 'Presse' },
  { chemin: '/comment-on-choisit-les-bars.html', nom: 'Comment on choisit les bars' },
];
const de = (debut, fin, pas) => Array.from({ length: Math.floor((fin - debut) / pas) + 1 }, (_, i) => debut + i * pas);
const TRANCHES = [de(320, 480, 8), de(496, 960, 16), de(976, 1440, 16)];

// Dans la page : chaque lien d’une ligne de texte de <main>, la ponctuation qui le suit, et les lignes de son paragraphe.
const mesurer = () => {
  const PONCTUATION = ',.;:!?»)…';
  const normaliser = (t) => t.replace(/\s+/g, ' ').trim();
  const nomDe = (e) => `« ${normaliser(e.textContent).slice(0, 48)} »`;
  const centre = (r) => (r.top + r.bottom) / 2;
  const textesDe = (bloc) => {
    const textes = [];
    const parcours = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
    while (parcours.nextNode()) if (!parcours.currentNode.parentElement.closest('.visuellement-cache')) textes.push(parcours.currentNode);
    return textes;
  };
  // Le bloc qui porte la ligne : le premier parent qui n’est pas en ligne.
  const blocDe = (e) => {
    let bloc = e.parentElement;
    while (bloc.parentElement && /^(inline|contents)/.test(getComputedStyle(bloc).display)) bloc = bloc.parentElement;
    return bloc;
  };
  const suivis = [];
  const seules = [];
  const blocs = new Set();
  for (const lien of document.querySelectorAll('main a[href]')) {
    if (!lien.getClientRects().length || lien.closest('.visuellement-cache')) continue;
    // Un lien posé dans une ligne de texte : ni un élément de grille ou de flex (seul sur sa ligne), ni seul dans son bloc.
    if (!getComputedStyle(lien).display.startsWith('inline') || /flex|grid/.test(getComputedStyle(lien.parentElement).display)) continue;
    const bloc = blocDe(lien);
    if (normaliser(bloc.textContent) === normaliser(lien.textContent)) continue;
    blocs.add(bloc);
    // Le premier caractère visible après le lien, dans son bloc (les espaces, insécables comprises, sautées).
    let suivant = null;
    for (const noeud of textesDe(bloc)) {
      if (lien.contains(noeud) || !(lien.compareDocumentPosition(noeud) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const trouve = noeud.nodeValue.match(/\S/);
      if (trouve) { suivant = { noeud, index: trouve.index, caractere: trouve[0] }; break; }
    }
    if (!suivant || !PONCTUATION.includes(suivant.caractere)) continue;
    const plage = document.createRange();
    plage.setStart(suivant.noeud, suivant.index);
    plage.setEnd(suivant.noeud, suivant.index + 1);
    const signe = [...plage.getClientRects()].find((r) => r.width > 0) ?? plage.getBoundingClientRect();
    const fin = [...lien.getClientRects()].filter((r) => r.width > 0).at(-1);
    suivis.push(nomDe(lien));
    // Sur la même ligne, le signe et la fin du lien ont le même milieu (même police, même ligne de base) ; à la ligne
    // suivante, il descend d’un interligne entier.
    if (Math.abs(centre(signe) - centre(fin)) > signe.height / 2) {
      seules.push(`« ${suivant.caractere} » après ${nomDe(lien)} : seul en début de ligne (${Math.round(centre(signe) - centre(fin))} px plus bas que la fin du lien)`);
    }
  }
  // Les lignes d’un paragraphe qui contient un lien : leurs milieux, regroupés, et l’écart entre deux lignes qui se suivent.
  const interlignes = [];
  for (const bloc of blocs) {
    const rects = [];
    for (const noeud of textesDe(bloc)) {
      if (!noeud.nodeValue.trim()) continue;
      const plage = document.createRange();
      plage.selectNodeContents(noeud);
      rects.push(...[...plage.getClientRects()].filter((r) => r.width > 0.5));
    }
    const lignes = [];
    for (const r of rects.sort((x, y) => centre(x) - centre(y))) {
      if (!lignes.some((m) => Math.abs(m - centre(r)) < r.height / 3)) lignes.push(centre(r));
    }
    const ecarts = lignes.slice(1).map((m, i) => m - lignes[i]);
    const attendu = parseFloat(getComputedStyle(bloc).lineHeight);
    const reference = Number.isFinite(attendu) ? attendu : Math.min(...ecarts);
    const ecartes = ecarts.filter((e) => Math.abs(e - reference) > 1);
    if (ecartes.length) interlignes.push(`${nomDe(bloc)} : ${ecartes.map((e) => `${e.toFixed(1)} px`).join(', ')} entre deux lignes, pour un interligne de ${reference.toFixed(1)} px`);
  }
  return { suivis, seules, interlignes, paragraphes: blocs.size };
};

for (const { chemin, nom } of PAGES) {
  for (const largeurs of TRANCHES) {
    test(`${nom}, de ${largeurs[0]} à ${largeurs.at(-1)} px, texte à 100 et 200 % : aucune ponctuation seule en début de ligne, l’interligne ne double pas autour d’un lien`, async ({ page }) => {
      test.setTimeout(120_000);
      const seules = [];
      const interlignes = [];
      for (const largeur of largeurs) {
        await page.setViewportSize({ width: largeur, height: 800 });
        await page.goto(chemin);
        await page.evaluate(() => document.fonts.ready);
        for (const pourcent of [100, 200]) {
          await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
          const lu = await page.evaluate(mesurer);
          // Chaque page a des liens suivis d’une ponctuation, et des paragraphes avec un lien : sinon on ne mesure rien.
          expect(lu.suivis.length, `${largeur} px, ${pourcent} %`).toBeGreaterThanOrEqual(3);
          expect(lu.paragraphes, `${largeur} px, ${pourcent} %`).toBeGreaterThanOrEqual(3);
          seules.push(...lu.seules.map((s) => `${largeur} px, ${pourcent} % : ${s}`));
          interlignes.push(...lu.interlignes.map((s) => `${largeur} px, ${pourcent} % : ${s}`));
        }
      }
      expect.soft(seules, 'une ponctuation seule en début de ligne').toEqual([]);
      expect.soft(interlignes, 'un interligne qui double autour d’un lien').toEqual([]);
    });
  }
}
