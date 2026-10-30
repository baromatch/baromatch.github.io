// Le dépôt est public et GitHub Pages sert chacun de ses fichiers : aucun fichier publié ne dit un détail interne de
// l’appli, qui est privée. Ni son dépôt, ni ses branches, ni son code, ni ses réglages, ni ses documents de conception
// (restés avec elle), ni la façon dont son serveur se protège. Ce test lit chaque fichier texte que git suit, ou
// suivrait (un fichier nouveau, pas encore ajouté, compte aussi), sauf les binaires et package-lock.json, et cherche :
//  (a) les formes générales d’un renvoi au dépôt privé (FORMES) ;
//  (b) les formulations des protections du serveur (PROTECTIONS), et des noms précis déjà retirés, retrouvés par leur
//      seule empreinte (EMPREINTES, NOMS) : ce fichier ne les redit pas.
// Les exceptions sont une liste écrite (EXCEPTIONS) : le texte montré au visiteur exprès, et ses copies dans les tests.
// Ce fichier se lit lui-même comme les autres : ce qu’il cherche y est écrit avec une lettre entre crochets (F[A]CTS)
// ou un caractère échappé, pour qu’il ne se trouve pas dans sa propre source.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { EMPREINTES, FORMES, NOMS, PROTECTIONS, empreinte, fuites as chercherLesFuites } from './outils/fuites.mjs';

// ---------- Les fichiers publiés ----------

// Les binaires (images, film, police) ne se lisent pas comme du texte ; package-lock.json n’a que des paquets publics.
const BINAIRE = /\.(?:png|jpe?g|webp|gif|ico|mp4|webm|woff2?|pdf)$/i;
const ECARTES = new Set(['package-lock.json']);
const CE_FICHIER = 'tests/documents-publics.spec.mjs';

// Ce que git suit, et ce qu’il ajouterait (hors de .gitignore) : un fichier nouveau est lu avant d’être publié.
const FICHIERS = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: racine, encoding: 'utf8' }).split('\0'))]
  .filter((fichier) => fichier && !BINAIRE.test(fichier) && !ECARTES.has(fichier) && existsSync(path.join(racine, fichier)))
  .sort();

// ---------- Les exceptions ----------
// Les seuls documents du dossier des documents : ceux du site lui-même (son référencement, les plans qui classent ses
// prochains changements, et le fichier qui ouvre l’appli Android depuis un lien du site, /.well-known/assetlinks.json),
// écrits pour Skander, hors de l’index (robots.txt). Seul leur chemin est permis ; leur texte est lu comme celui de
// tout autre fichier, avec une exception : l’audit cite les pages de la documentation de Google, dont l’adresse a la
// forme d’un chemin de documents (chacune comptée). Leurs noms sont écrits en morceaux, pour que ce fichier ne les
// contienne pas.
const AUDIT_SEO = ['d', 'ocs/SEO-AUDIT-2026-10.m', 'd'].join('');
const A_FAIRE_SEO = ['d', 'ocs/SEO-A-FAIRE-PAR-SKANDER.m', 'd'].join('');
const PLAN_DU_SITE = ['d', 'ocs/NIVEAU_SUPERIEUR_SITE_2026-10.m', 'd'].join('');
const LIENS_ANDROID = ['d', 'ocs/ANDROID-OUVRIR-L-APPLI.m', 'd'].join('');
const PLAN_SITE_V2 = ['d', 'ocs/SITE_V2_2026-10.m', 'd'].join('');
const DOCUMENTS_DU_SITE = [AUDIT_SEO, A_FAIRE_SEO, PLAN_DU_SITE, LIENS_ANDROID, PLAN_SITE_V2];

// Le texte que le visiteur lit exprès, et ses copies mot pour mot dans les tests. [fichier, motif, nombre] : le motif y
// est permis exactement ce nombre de fois. Une occurrence de plus est une fuite ; une de moins, une exception à retirer.
const EXCEPTIONS = [
  // La page de confidentialité, telle que le propriétaire l’a validée : la cadence des demandes des bars depuis un
  // même réseau, et la façon dont le serveur compte ce réseau, le temps de la limite.
  ['confidentialite.html', 'seuil', 1],
  ['confidentialite.html', 'reseau', 1],
  // Sa copie, point par point, dans le test de la section des bars.
  ['tests/confidentialite-bars.spec.mjs', 'seuil', 1],
  ['tests/confidentialite-bars.spec.mjs', 'reseau', 1],
  // Le formulaire des bars : le message après trop d’envois (la même cadence), et celui d’une correction qui ne part
  // pas d’ici (la règle que la page applique elle-même, REJEU_MS).
  ['pour-les-bars.js', 'seuil', 1],
  ['pour-les-bars.js', 'rejeu', 1],
  // Leurs copies dans le test du formulaire.
  ['tests/pour-les-bars-formulaire.spec.mjs', 'seuil', 1],
  ['tests/pour-les-bars-formulaire.spec.mjs', 'rejeu', 2],
  // Le numéro de pass, tel que les règles de l’appli et la page de confidentialité le décrivent au fan : une
  // formulation retenue par empreinte, permise là où le visiteur la lit.
  ['cgu.html', 'empreinte 4:JZkyjmaxHcw', 1],
  ['confidentialite.html', 'empreinte 4:JZkyjmaxHcw', 1],
  // Le générateur des pages des matchs lit, dans la liste publique des matchs, le renseignement qui dit qu’une heure
  // de coup d’envoi n’est que provisoire, pour ne jamais l’afficher comme sûre : une fois là où il le lit, une fois là
  // où la copie des tests le traduit (heureProvisoire). Les copies et le scénario des tests ne l’écrivent pas.
  ['generateur/donnees.mjs', 'nom eS2Fi_z4niw', 1],
  ['generateur/outils/reduire-capture.mjs', 'nom eS2Fi_z4niw', 1],
  // Le drapeau de Chromium qui le fait passer à côté de l’intermédiaire réseau de la machine de test, pour joindre le
  // serveur local à la place de baromatch.fr (Lighthouse avec la mesure d’audience) : rien sur le serveur de l’appli.
  ['tests/outils/lighthouse-mesure.mjs', 'reseau', 1],
  // La page de confidentialité renvoie aux conditions d’Expo, le prestataire des mises à jour de l’appli, par leur
  // adresse publique (le lien et son texte).
  ['confidentialite.html', 'production', 2],
  // L’audit SEO : les adresses des pages de Google Search Central qu’il cite (developers.google.com/search/…).
  [AUDIT_SEO, 'chemin', 20],
];

// ---------- La recherche ----------

// tests/outils/fuites.mjs : les formes, les protections, les empreintes, les noms et la recherche elle-même, partagés
// avec l’exportation des insignes. Ici, avec les exceptions de ce fichier.
const fuites = (fichier, brut, garde = {}) => chercherLesFuites(fichier, brut, { exceptions: EXCEPTIONS, ...garde });

// ---------- Les tests ----------

test('la liste des fichiers publiés vient de git, et ce fichier en fait partie', () => {
  for (const attendu of ['index.html', 'pour-les-bars.js', 'confidentialite.html', 'robots.txt', CE_FICHIER]) {
    expect(FICHIERS).toContain(attendu);
  }
  expect(FICHIERS.filter((fichier) => BINAIRE.test(fichier) || ECARTES.has(fichier))).toEqual([]);
});

test('chaque exception vise un fichier publié, et un motif ou une empreinte de ce fichier', () => {
  const cles = [...FORMES, ...PROTECTIONS].map(({ cle }) => cle).concat(EMPREINTES.map(([n, e]) => `empreinte ${n}:${e}`), NOMS.map((nom) => `nom ${nom}`));
  for (const [fichier, cle, nombre] of EXCEPTIONS) {
    expect(FICHIERS, fichier).toContain(fichier);
    expect(cles, `${fichier} : ${cle}`).toContain(cle);
    expect(nombre).toBeGreaterThan(0);
  }
});

test('aucun chemin de fichier publié n’a la forme d’un renvoi au dépôt privé', () => {
  expect(FICHIERS.filter((fichier) => fichier.split('/')[0] === AUDIT_SEO.split('/')[0] && !DOCUMENTS_DU_SITE.includes(fichier))).toEqual([]);
  expect(FICHIERS.filter((fichier) => !DOCUMENTS_DU_SITE.includes(fichier)).flatMap((fichier) => fuites(fichier, fichier, { motifs: FORMES, exceptions: [] })
    .map((fuite) => `${fichier} : ${fuite}`))).toEqual([]);
});

// La recherche elle-même : un exemple de chaque motif, écrit en morceaux pour que ce fichier ne le contienne pas, est
// trouvé ; une empreinte et un nom d’essai (pas ceux des listes) aussi, même à cheval sur deux lignes.
test('la recherche trouve chaque forme, chaque protection, une empreinte et un nom', () => {
  const morceau = (...parties) => parties.join('');
  const EXEMPLES = {
    chemin: morceau('ap', 'ps/api/', 'main'),
    extension: morceau('serveur.t', 's'),
    branche: morceau('fe', 'at/', 'exemple'),
    commit: morceau('abc', '1234'),
    variable: morceau('EXEMPLE_API', '_URL'),
    document: morceau('PL', 'AN.m', 'd'),
    mission: morceau('mission', ' 7'),
    depot: morceau('le dépôt ', 'de l’appli'),
    production: morceau('pas encore dé', 'ployée'),
    seuil: morceau('7 demandes ', 'par heure'),
    reseau: morceau('X-Forward', 'ed-For'),
    rejeu: morceau('within 10', ' min'),
    fusion: morceau('mer', 'ge identical'),
    robots: morceau('fake ', 'success'),
    delai: morceau('3 s au plus', ' tôt'),
    porte: morceau('le code du ', 'bar change chaque soir'),
    effacement: morceau('pur', 'ge'),
    controle: morceau('ne vérifie ', 'pas'),
    machine: morceau('/home/', 'user/'),
  };
  expect(Object.keys(EXEMPLES)).toEqual([...FORMES, ...PROTECTIONS].map(({ cle }) => cle));
  for (const [cle, exemple] of Object.entries(EXEMPLES)) {
    expect(fuites('essai.txt', `Avant.\n${exemple}\nAprès.`).filter((fuite) => fuite.startsWith(`${cle} :`)), cle).toHaveLength(1);
    expect(fuites('essai.txt', 'Rien à signaler ici.').filter((fuite) => fuite.startsWith(`${cle} :`)), cle).toEqual([]);
  }

  const garde = { motifs: [], empreintes: [[3, empreinte('mot de garde')]], noms: [empreinte('nom-de-garde')] };
  expect(fuites('essai.txt', 'Un Mot\n// de Garde, ici.', garde))
    .toEqual([`empreinte 3:${empreinte('mot de garde')} : 1 trouvé(s), 0 permis (lignes 1)`]);
  expect(fuites('essai.txt', 'Le module\n(Nom-de-Garde).', garde))
    .toEqual([`nom ${empreinte('nom-de-garde')} : 1 trouvé(s), 0 permis (lignes 2)`]);
  expect(fuites('essai.txt', 'Un mot de plus, nom de garde.', garde)).toEqual([]);

  // Une exception permet son nombre exact : ni une occurrence de plus, ni une de moins.
  const exceptions = [['essai.txt', 'seuil', 1]];
  const seuil = morceau('5 demandes ', 'par heure');
  expect(fuites('essai.txt', seuil, { exceptions })).toEqual([]);
  expect(fuites('essai.txt', `${seuil}\n${seuil}`, { exceptions })).toEqual(['seuil : 2 trouvé(s), 1 permis (lignes 1, 2)']);
  expect(fuites('essai.txt', 'Rien.', { exceptions })).toEqual(['seuil : 0 trouvé(s), 1 permis (lignes —)']);
});

for (const fichier of FICHIERS) {
  test(`${fichier} ne dit rien d’interne à l’appli`, () => {
    expect(fuites(fichier, readFileSync(path.join(racine, fichier), 'utf8'))).toEqual([]);
  });
}
