// Où en est l’appli, dit vrai partout. Décision du propriétaire (27 novembre 2026) : l’appli n’est pas encore sur les
// stores, elle tourne en test. « L’appli tourne déjà en test sur iPhone et Android » remplace « L’appli Baromatch existe »
// (sur iPhone et Android) (en anglais : « The app is already in testing on iPhone and Android »). Ce test vérifie :
//  - la nouvelle phrase, sur chaque page écrite à la main qui dit où en est l’appli, et dans les textes du générateur ;
//  - que l’ancienne n’existe plus nulle part : ni dans un fichier publié écrit à la main (pages, llms.txt, textes du
//    générateur, tests), ni dans une page que le générateur fabrique, sur le scénario inventé comme sur la copie
//    enregistrée des listes publiques.
// Les pages déjà écrites par le générateur (matchs/, regarder-le-match/, ce-soir/, agenda/, en/ sauf en/for-bars/) ne
// sont jamais retouchées à la main : l’Action des pages des matchs les réécrit toutes depuis ses textes à son passage
// suivant ; c’est le passage en mémoire, ci-dessous, qui prouve ce qu’elle écrira. Les documents (docs/) gardent
// l’histoire des décisions, où l’ancienne phrase est citée comme refusée : ils ne sont pas lus.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { CAPTURE, MAINTENANT_DE_LA_CAPTURE, MAINTENANT_DU_SCENARIO, SCENARIO, contenuDuScenario } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { texteVisible } from '../generateur/controle.mjs';
import { estPermis } from '../generateur/etat.mjs';
import { PAGES_A_LA_MAIN_DANS_LE_GENERATEUR } from '../generateur/mesure.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';

const lire = (fichier) => readFileSync(path.join(racine, fichier), 'utf8');
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const MARQUE = JSON.parse(lire('marque.json'));

const FR = 'L’appli tourne déjà en test sur iPhone et Android.';
const FR_COMPLETE = `${FR} Elle arrive bientôt sur l’App Store et Google Play, d’abord à Paris.`;
const EN = 'The app is already in testing on iPhone and Android';
// L’ancienne phrase et ses variantes : « existe » puis « sur iPhone » ou « sur Android » (avec ou sans « déjà »,
// « l’iPhone »), et en anglais « the app is on / is ready on / is available on » iPhone ou Android. Écrites avec des \s,
// pour que ce fichier ne se trouve pas lui-même. Les espaces insécables écrites « \u00a0 » dans les données
// structurées sont lues comme des espaces.
const ANCIENNES = [
  /existe\s+(?:d[ée]j[àa]\s+)?sur\s+(?:l[’']\s*)?(?:iPhone|Android)/iu,
  /\bapp\s+is\s+(?:already\s+)?(?:on|ready\s+on|available\s+on)\s+(?:the\s+)?(?:iPhone|Android)/iu,
];
const ancienne = (texte) => {
  const lu = normaliser(texte.replace(/\\u00a0|\\u202f/gi, ' '));
  return ANCIENNES.map((forme) => lu.match(forme)?.[0]).find(Boolean) ?? null;
};

// Les fichiers texte que git suit, ou suivrait : tout ce que GitHub Pages servirait.
const BINAIRE = /\.(?:png|jpe?g|webp|gif|ico|mp4|webm|woff2?|pdf|ttf|otf)$/i;
const ECRITES_PAR_LE_GENERATEUR = (fichier) => estPermis(fichier) && !PAGES_A_LA_MAIN_DANS_LE_GENERATEUR.includes(fichier);
const A_LA_MAIN = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: racine, encoding: 'utf8' }).split('\0'))]
  .filter((fichier) => fichier && !BINAIRE.test(fichier) && !fichier.endsWith('package-lock.json')
    && !fichier.startsWith('docs/') && !ECRITES_PAR_LE_GENERATEUR(fichier) && existsSync(path.join(racine, fichier)))
  .sort();

// Le jour où l’appli ouvre au public (marque.json), chacune de ces phrases change : les tests de la nouvelle phrase
// tombent, pour qu’on les relise toutes dans la même PR (l’ancienne, elle, reste refusée).
const OUVERTE = 'marque.json dit l’appli ouverte : relire chaque phrase « tourne déjà en test » (pages, textes du générateur)';

test.describe('où en est l’appli', () => {
  test('la nouvelle phrase, sur chaque page écrite à la main qui dit où en est l’appli', () => {
    expect(MARQUE.appli.ouverte, OUVERTE).toBe(false);
    for (const fichier of ['index.html', '404.html', 'a-propos.html', 'presse.html', 'llms.txt']) {
      expect(normaliser(lire(fichier)), fichier).toContain(FR_COMPLETE.replace(/\.$/, ''));
    }
    expect(normaliser(lire('pour-les-bars.html'))).toContain(`${FR} Elle arrive bientôt sur les stores, d’abord à Paris.`);
    expect(normaliser(lire('en/for-bars/index.html'))).toContain(`${EN} and will be on the App Store and Google Play soon, starting in Paris.`);
  });

  test('la nouvelle phrase, dans les textes du générateur', () => {
    expect(MARQUE.appli.ouverte, OUVERTE).toBe(false);
    const textes = JSON.parse(lire('generateur/contenu/textes.json'));
    expect(textes.attente.plateformes).toBe(FR_COMPLETE);
    expect(textes.appel.fermee.note).toMatch(/^L’appli tourne déjà en test sur iPhone et Android, et arrive bientôt sur l’App Store et Google Play\./);
    expect(textes.ville.appliFermee).toMatch(/^L’appli, elle, tourne déjà en test sur iPhone et Android, et arrive bientôt/);
    expect(JSON.parse(lire('generateur/contenu/feuille-du-patron.json')).feuille.ouEnEst.fermee).toContain('L’appli tourne déjà en test sur iPhone et Android, bientôt sur les stores');
    expect(JSON.parse(lire('generateur/contenu/en.json')).appli.fermee).toMatch(new RegExp(`^Good to know: the Baromatch app is already in testing on iPhone and Android, and arrives on the App Store and Google Play soon`));
  });

  test('l’ancienne phrase n’est dans aucun fichier publié écrit à la main', () => {
    expect(A_LA_MAIN.length).toBeGreaterThan(100);
    expect(A_LA_MAIN).toContain('index.html');
    expect(A_LA_MAIN).toContain('en/for-bars/index.html');
    expect(A_LA_MAIN).toContain('generateur/contenu/textes.json');
    expect(A_LA_MAIN.some((f) => f.startsWith('regarder-le-match/') || f.startsWith('matchs/'))).toBe(false);
    const trouvees = A_LA_MAIN.map((fichier) => [fichier, ancienne(lire(fichier))]).filter(([, phrase]) => phrase);
    expect(trouvees).toEqual([]);
  });

  for (const [nom, options] of [
    ['le scénario inventé', () => ({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, contenu: contenuDuScenario() })],
    ['la copie des listes publiques', () => ({ source: `capture:${CAPTURE}`, maintenant: MAINTENANT_DE_LA_CAPTURE, contenu: chargerLeContenu(racine) })],
  ]) {
    test(`le générateur n’écrit plus l’ancienne phrase, et écrit la nouvelle (${nom})`, async () => {
      const site = await construireEnMemoire({ racine, ...options() });
      expect(site.pages.length).toBeGreaterThan(20);
      const trouvees = site.pages.map((p) => [p.chemin, ancienne(p.contenu)]).filter(([, phrase]) => phrase);
      expect(trouvees).toEqual([]);
      expect(MARQUE.appli.ouverte, OUVERTE).toBe(false);
      // Les pages des villes : la liste d’attente et leur question « Baromatch est-il à … ? ».
      const villes = site.pages.filter((p) => /^\/regarder-le-match\/[a-z-]+\/$/.test(p.chemin));
      expect(villes.length).toBeGreaterThanOrEqual(4);
      for (const p of villes) {
        const texte = normaliser(texteVisible(p.contenu));
        expect(texte, p.chemin).toContain(FR_COMPLETE);
        expect(texte, p.chemin).toContain('L’appli, elle, tourne déjà en test sur iPhone et Android');
      }
      // Les pages en anglais qui parlent de l’appli.
      const anglaises = site.pages.filter((p) => p.chemin.startsWith('/en/') && p.contenu.includes('Good to know: the Baromatch app'));
      expect(anglaises.length).toBeGreaterThan(0);
      for (const p of anglaises) expect(normaliser(p.contenu), p.chemin).toContain('Good to know: the Baromatch app is already in testing on iPhone and Android');
    });
  }
});

// La description de marque.json, la carte d’identité, recopiée à la main dans les données de l’organisation et les
// chapôs (décision du propriétaire, 27 novembre 2026) : « En test sur iPhone et Android, bientôt sur les stores. »
// L’ancienne fin, « Sur iPhone et Android, bientôt sur les stores. », se lisait « disponible ».
const DESCRIPTION_FIN = 'En test sur iPhone et Android, bientôt sur les stores.';
const COPIES_DE_LA_DESCRIPTION = {
  'index.html': 1, 'a-propos.html': 2, 'presse.html': 3, 'comment-on-choisit-les-bars.html': 1,
  'trouver-un-bar-qui-diffuse-le-match.html': 2, 'testeurs-android.html': 1, 'llms.txt': 1,
};
const sansBalises = (texte) => normaliser(texte.replace(/&nbsp;/g, ' ').replace(/\\u00a0/gi, ' '));

test('la description de marque.json dit l’appli en test, et chaque copie écrite à la main la reprend mot pour mot', () => {
  expect(MARQUE.appli.ouverte, OUVERTE).toBe(false);
  expect(MARQUE.description.endsWith(` ${DESCRIPTION_FIN}`)).toBe(true);
  const description = normaliser(MARQUE.description);
  for (const [fichier, fois] of Object.entries(COPIES_DE_LA_DESCRIPTION)) {
    expect(sansBalises(lire(fichier)).split(description).length - 1, fichier).toBe(fois);
  }
  // L’ancienne fin n’est plus dans aucun fichier publié écrit à la main (les documents gardent l’histoire).
  const anciennes = A_LA_MAIN.filter((fichier) => /(?:^|[.:>"]\s*)Sur\s+iPhone\s+et\s+Android,\s+bientôt\s+sur\s+les\s+stores/u.test(sansBalises(lire(fichier))));
  expect(anciennes).toEqual([]);
});
