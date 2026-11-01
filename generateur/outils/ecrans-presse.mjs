// Les écrans de l’appli à télécharger depuis la page Presse : chaque capture de 600 px (img/appli/<écran>-600.webp),
// avec, sous l’écran et jamais dessus, une bande qui dit « Écran de démonstration » et que les bars, les clubs, les
// pseudos et les chiffres sont inventés. Un fichier téléchargé quitte la page qui l’explique : c’est lui qui le dit.
// Écrit presse/ecran-<écran>-demonstration.png (PNG, le format que tout le monde ouvre), à refaire quand une capture
// change.
// Usage : node generateur/outils/ecrans-presse.mjs
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { CHROMIUM, racine } from '../../tests/outils/environnement.mjs';

export const ECRANS_DE_LA_PRESSE = ['ce-soir', 'carte-recherche', 'bar', 'ta-soiree', 'tu-y-es'];
export const LARGEUR = 600;
export const HAUTEUR_DE_L_ECRAN = 1298;
export const HAUTEUR_DE_LA_BANDE = 96;
export const ETIQUETTE = 'Écran de démonstration';
export const PRECISION = 'Les bars, les clubs, les pseudos et les chiffres sont inventés.';
export const fichierDeLaPresse = (ecran) => `presse/ecran-${ecran}-demonstration.png`;

const fichier = (relatif) => pathToFileURL(path.join(racine, relatif)).href;

const page = (ecran) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
@font-face { font-family: "Bricolage Grotesque"; src: url("${fichier('fonts/bricolage-grotesque.woff2')}") format("woff2"); font-weight: 200 800; }
html, body { margin: 0; background: #0A0B10; }
img { display: block; width: ${LARGEUR}px; height: ${HAUTEUR_DE_L_ECRAN}px; }
.bande { box-sizing: border-box; height: ${HAUTEUR_DE_LA_BANDE}px; padding: 18px 28px 0; color: #FAF7F1;
  font-family: "Bricolage Grotesque", sans-serif; border-top: 2px solid #FAF7F1; }
.bande strong { display: block; font-size: 26px; line-height: 32px; font-weight: 750; }
.bande span { display: block; font-size: 19px; line-height: 26px; font-weight: 450; }
</style></head><body><img src="${fichier(`img/appli/${ecran}-600.webp`)}" alt=""><div class="bande"><strong>${ETIQUETTE}</strong><span>${PRECISION}</span></div></body></html>`;

export const fabriquer = async ({ lancer = (options) => chromium.launch(options) } = {}) => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'ecrans-presse-'));
  const navigateur = await lancer({ executablePath: CHROMIUM });
  try {
    const onglet = await navigateur.newPage({ viewport: { width: LARGEUR, height: HAUTEUR_DE_L_ECRAN + HAUTEUR_DE_LA_BANDE }, deviceScaleFactor: 1 });
    for (const ecran of ECRANS_DE_LA_PRESSE) {
      const html = path.join(dossier, `${ecran}.html`);
      writeFileSync(html, page(ecran));
      await onglet.goto(pathToFileURL(html).href);
      await onglet.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
        if (![...document.fonts].some((police) => police.family === 'Bricolage Grotesque' && police.status === 'loaded')) {
          throw new Error('La police Bricolage Grotesque ne s’est pas chargée : la bande serait écrite dans une autre police.');
        }
      });
      await onglet.screenshot({ path: path.join(racine, fichierDeLaPresse(ecran)), clip: { x: 0, y: 0, width: LARGEUR, height: HAUTEUR_DE_L_ECRAN + HAUTEUR_DE_LA_BANDE } });
      console.log(`écrit : ${fichierDeLaPresse(ecran)}`);
    }
  } finally {
    await navigateur.close();
    rmSync(dossier, { recursive: true, force: true });
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await fabriquer();
