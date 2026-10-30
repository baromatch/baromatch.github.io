// Le bloc « Partager » quand partage.js arrive après le premier affichage (un réseau lent) : la page se peint sans lui,
// puis il choisit ses boutons. On compte les décalages (layout-shift, hors réponse à un geste) ; on mesure de combien
// la hauteur du bloc et le haut de ce qui le suit ont changé (le décalage ne voit que l’écran, et à 200 % le bloc peut
// être plus bas) ; on lit ce qui se montre, avant et après lui. partage.js est retenu jusqu’à ce que la page ait peint
// son bloc (deux images) : la mesure ne dépend pas de la vitesse de la machine. La police est refusée (son remplacement
// a son propre test, tests/police.spec.mjs) ; le texte agrandi l’est dès la première image (styles.css servi avec la
// taille de la racine, comme un réglage du navigateur). Pour tests/partage.spec.mjs et pages-generees-jour.spec.mjs.

// Les quatre cas : le navigateur a, ou non, le bouton « Partager » du téléphone (navigator.share), et sait, ou non,
// copier (navigator.clipboard.writeText).
export const CAS_DU_PARTAGE = [
  { nom: 'le bouton du téléphone et le presse-papiers', partager: true, copier: true },
  { nom: 'le bouton du téléphone sans presse-papiers', partager: true, copier: false },
  { nom: 'sans le bouton du téléphone', partager: false, copier: true },
  { nom: 'sans le bouton du téléphone ni presse-papiers', partager: false, copier: false },
];

// Ce qui se montre : avant partage.js (et sans JavaScript), WhatsApp et l’adresse en lien ; après lui, « Partager » ou
// WhatsApp, puis « Copier le lien » ou l’adresse.
export const SANS_LE_SCRIPT = { natif: false, whatsapp: true, copier: false, lien: true };
export const montresAttendus = ({ partager, copier }) => ({ natif: partager, whatsapp: !partager, copier, lien: !copier });

const lireCeQuiSeMontre = (onglet) => onglet.evaluate(() => Object.fromEntries(['natif', 'whatsapp', 'copier', 'lien']
  .map((nom) => [nom, document.querySelector(`.partage__${nom}`).checkVisibility({ visibilityProperty: true, opacityProperty: true })])));
// La hauteur du bloc et le haut de ce qui le suit, dans la page.
const lireLaPlace = (onglet) => onglet.evaluate(() => {
  const bloc = document.querySelector('.partage');
  const suivant = bloc.nextElementSibling;
  const { height, bottom } = bloc.getBoundingClientRect();
  return { hauteur: height, dessous: (suivant ? suivant.getBoundingClientRect().top : bottom) + window.scrollY };
});
const deuxImages = (onglet) => onglet.evaluate(() => new Promise((resoudre) => { requestAnimationFrame(() => requestAnimationFrame(resoudre)); }));

// Rend { decalages, bouge, avant, apres } : la somme des décalages ; de combien (en px) la hauteur du bloc et le haut de
// ce qui le suit ont changé ; ce qui se montrait avant et après partage.js.
export const partageArriveTard = async (browser, adresse, { largeur, texte = 100, cas }) => {
  const contexte = await browser.newContext({ viewport: { width: largeur, height: 800 } });
  try {
    const onglet = await contexte.newPage();
    await onglet.addInitScript(({ partager, copier }) => {
      if (partager) Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async () => {} });
      else delete Navigator.prototype.share;
      Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => (copier ? { writeText: async () => {} } : undefined) });
      window.decalagesDuPartage = 0;
      new PerformanceObserver((liste) => {
        for (const entree of liste.getEntries()) if (!entree.hadRecentInput) window.decalagesDuPartage += entree.value;
      }).observe({ type: 'layout-shift', buffered: true });
    }, cas);
    await onglet.route('**/fonts/*.woff2', (route) => route.abort());
    if (texte !== 100) {
      await onglet.route('**/styles.css', async (route) => {
        const reponse = await route.fetch();
        await route.fulfill({ response: reponse, body: `${await reponse.text()}\n:root { font-size: ${texte}%; }\n` });
      });
    }
    let lacher;
    const lache = new Promise((resoudre) => { lacher = resoudre; });
    await onglet.route('**/partage.js', async (route) => {
      await lache;
      await route.continue();
    });
    await onglet.goto(adresse, { waitUntil: 'commit' });
    await onglet.waitForFunction(() => document.querySelector('.partage .partage__statut'));
    await deuxImages(onglet);
    const avant = await lireCeQuiSeMontre(onglet);
    const placeAvant = await lireLaPlace(onglet);
    lacher();
    await onglet.waitForLoadState('load');
    await deuxImages(onglet);
    const apres = await lireCeQuiSeMontre(onglet);
    const placeApres = await lireLaPlace(onglet);
    const ecart = (cle) => Math.round((placeApres[cle] - placeAvant[cle]) * 100) / 100;
    const decalages = await onglet.evaluate(() => window.decalagesDuPartage);
    return { decalages, bouge: { hauteur: ecart('hauteur'), dessous: ecart('dessous') }, avant, apres };
  } finally {
    await contexte.close();
  }
};
