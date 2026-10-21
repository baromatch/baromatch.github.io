// Tous les liens internes de chaque page mènent à un fichier qui existe, et chaque ancre à un id de la page visée ; de
// même chaque image d’un srcset (sur <img> et <source>), y compris les grandes que seuls les écrans denses chargent.
// Les liens externes ne sont pas suivis (réseau) : on vérifie seulement leur forme. Une page de la liste qui n’a pas de
// fichier fait échouer le test (elle n’est pas sautée) ; les liens de tablée (/t/…), servis par 404.html, ne sont pas
// lus ici. Puis, sur un écran de téléphone dense (×2,625), chaque image que le navigateur choisit se charge.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { attendreLaPageFinie, chargerLesImages } from './outils/attente.mjs';
import { couperLAPI } from './outils/invitation.mjs';
import { fichierDe, PAGES } from './outils/pages.mjs';

const ORIGINE = 'https://baromatch.fr';
const idsDe = (fichier) => new Set([...readFileSync(fichier, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

// Les adresses d’un srcset, lues comme le navigateur les lit (une adresse va jusqu’au premier blanc, une virgule
// sépare les candidats) : « a.webp 300w, b.webp 600w » → [a.webp, b.webp]. Une source data: (qui a sa propre virgule)
// n’est pas un fichier.
const adressesDuSrcset = (srcset) => {
  const adresses = [];
  let i = 0;
  while (i < srcset.length) {
    while (i < srcset.length && /[\s,]/.test(srcset[i])) i += 1;
    let fin = i;
    while (fin < srcset.length && !/\s/.test(srcset[fin])) fin += 1;
    const brute = srcset.slice(i, fin);
    i = fin;
    if (!brute.endsWith(',')) while (i < srcset.length && srcset[i] !== ',') i += 1; // ses descripteurs (300w, 2x)
    const adresse = brute.replace(/,+$/, '');
    if (adresse && !adresse.startsWith('data:')) adresses.push(adresse);
  }
  return adresses;
};

// Les pages écrites par le générateur et déjà dans le dépôt (l’Action les refait) : leurs liens aussi, les liens
// d’abonnement webcal:// compris (ils mènent à un agenda du dépôt). Elles sont écrites ensemble, depuis la copie des
// listes publiques, à l’heure du dernier passage des pages des matchs du dépôt : chaque match qu’elles citent y a sa page.
const GENEREES = [{ chemin: '/agenda/', nom: 'agenda' }, { chemin: '/ce-soir/', nom: 'ce soir' }, { chemin: '/matchs/affiche/', nom: 'affiche de la semaine' },
  { chemin: '/matchs/club/psg/', nom: 'club (PSG)' }, { chemin: '/matchs/competition/ligue-1/', nom: 'compétition (Ligue 1)' }];

for (const page of [...PAGES.filter((p) => !p.chemin.startsWith('/t/')), ...GENEREES]) {
  test(`${page.nom} : chaque lien interne et chaque image d’un srcset mènent quelque part`, async ({ page: onglet }) => {
    expect(existsSync(fichierDe(page.chemin)), `${page.chemin} : aucun fichier ${fichierDe(page.chemin)}`).toBe(true);
    await onglet.goto(page.chemin);
    const { liens, srcsets } = await onglet.evaluate(() => ({
      liens: [...document.querySelectorAll('a[href], link[rel="canonical"], link[rel="icon"], link[rel="apple-touch-icon"], link[rel="stylesheet"], link[rel="preload"], script[src], img[src], source[src], video[poster]')]
        .map((e) => e.getAttribute('href') ?? e.getAttribute('src') ?? e.getAttribute('poster')),
      srcsets: [...document.querySelectorAll('img[srcset], source[srcset]')].map((e) => e.getAttribute('srcset')),
    }));
    const casses = [];
    for (const lien of [...liens, ...srcsets.flatMap(adressesDuSrcset)]) {
      if (lien.startsWith('mailto:')) {
        if (!/^mailto:[^@\s]+@[^@\s]+/.test(lien)) casses.push(lien);
        continue;
      }
      if (/^(?:https?|webcal):\/\//.test(lien) && !lien.replace(/^webcal:/, 'https:').startsWith(ORIGINE)) continue;
      if (lien.startsWith('data:')) continue;
      const url = new URL(lien, `${ORIGINE}${page.chemin}`);
      const fichier = fichierDe(url.pathname);
      if (!existsSync(fichier)) {
        casses.push(lien);
        continue;
      }
      if (url.hash && fichier.endsWith('.html') && !idsDe(fichier).has(url.hash.slice(1))) casses.push(lien);
    }
    expect(casses).toEqual([]);
  });
}

test('sur un téléphone dense (×2,625), chaque image que les pages choisissent se charge', async ({ browser, baseURL }) => {
  const contexte = await browser.newContext({ baseURL, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const onglet = await contexte.newPage();
  await couperLAPI(onglet);
  const ratees = [];
  onglet.on('response', (reponse) => { if (reponse.request().resourceType() === 'image' && reponse.status() >= 400) ratees.push(`${reponse.status()} ${reponse.url()}`); });
  onglet.on('requestfailed', (requete) => { if (requete.resourceType() === 'image') ratees.push(`échec ${requete.url()}`); });
  for (const page of PAGES.filter((p) => !p.chemin.startsWith('/t/'))) {
    await onglet.goto(page.chemin);
    await attendreLaPageFinie(onglet);
    await chargerLesImages(onglet);
    const vides = await onglet.evaluate(() => [...document.images].filter((i) => i.getClientRects().length && i.currentSrc && !i.currentSrc.startsWith('data:') && i.naturalWidth === 0).map((i) => i.currentSrc));
    ratees.push(...vides.map((src) => `vide ${src}`));
  }
  await contexte.close();
  expect(ratees).toEqual([]);
});
