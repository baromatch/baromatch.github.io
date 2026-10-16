// Captures pleine page de chaque page à 360 et 1280 px, mouvement réduit (l'état final, sans animation), une fois la
// page finie (formulaire des bars et sa feuille arrivés) et chaque image paresseuse chargée.
// Usage : node tests/outils/captures.mjs <dossier de sortie> [port]
// capturer() se lance aussi depuis un test : `demarrer` et `lancer` y remplacent le serveur local et Chromium.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { attendreLaPageFinie, chargerLesImages } from './attente.mjs';
import { CHROMIUM } from './environnement.mjs';
import { couperLAPI } from './invitation.mjs';
import { fichierDe, PAGES } from './pages.mjs';
import { demarrerServeur } from './serveur.mjs';

const LARGEURS = [360, 1280];

export const capturer = async ({
  sortie,
  port,
  demarrer = demarrerServeur,
  lancer = (options) => chromium.launch(options),
}) => {
  mkdirSync(sortie, { recursive: true });
  const { adresse, arreter } = await demarrer(port);
  // Le navigateur se lance dans le try : s’il ne démarre pas (Chromium absent ou cassé), le finally arrête quand même le
  // serveur local, qui sinon resterait seul sur son port après la fin de la commande.
  let navigateur = null;
  try {
    navigateur = await lancer({ executablePath: CHROMIUM });
    for (const largeur of LARGEURS) {
      const contexte = await navigateur.newContext({ viewport: { width: largeur, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'fr-FR' });
      const onglet = await contexte.newPage();
      await couperLAPI(onglet);
      for (const page of PAGES) {
        if (!page.chemin.startsWith('/t/') && !existsSync(fichierDe(page.chemin))) throw new Error(`${page.chemin} : aucun fichier`);
        await onglet.goto(`${adresse}${page.chemin}`, { waitUntil: 'networkidle' });
        await attendreLaPageFinie(onglet);
        await chargerLesImages(onglet);
        await onglet.evaluate(() => document.fonts.ready);
        const fichier = path.join(sortie, `${page.nom}@${largeur}.png`);
        await onglet.screenshot({ path: fichier, fullPage: true });
        console.log(fichier);
      }
      await contexte.close();
    }
  } finally {
    await navigateur?.close();
    arreter();
  }
};

// Lancé en commande (et pas importé par un test).
if (path.basename(process.argv[1] ?? '') === 'captures.mjs') {
  await capturer({ sortie: path.resolve(process.argv[2] ?? 'captures'), port: Number(process.argv[3] ?? 4185) });
}
