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
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';

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

// ---------- (a) Les formes d’un renvoi au dépôt privé ----------

const FORMES = [
  // Un chemin de l’appli : ses dossiers de code, de réglages, d’outils ou de documents.
  { cle: 'chemin', motif: /\b(?:apps|packages|docs|src|config|prisma|scripts)\/[\w.@-]/ },
  // L’extension d’un fichier de son code (TypeScript) ou de sa base (schéma).
  { cle: 'extension', motif: /\.(?:tsx?|prisma)\b/ },
  // Une branche, ou une référence à une branche distante.
  { cle: 'branche', motif: /\b(?:feat|feature|fix|hotfix|release|chore|refactor|review|design|ci|tmp|origin)\/[\w.-]/ },
  // Un identifiant de commit : 7 à 40 caractères hexadécimaux, lettres et chiffres mêlés, seuls (pas une couleur).
  { cle: 'commit', motif: /(?<![#\w-])(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w-])/ },
  // Une variable d’environnement : des capitales et des « _ », avec une fin d’usage (adresse, clé, secret, réglage,
  // fenêtre, limite…) ou une partie publique au milieu.
  {
    cle: 'variable',
    motif: /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:URL|URI|DSN|ID|ENABLED|ENFORCED|DISABLED|SECRETS?|KEYS?|TOKENS?|PASSWORD|FROM|PROX[Y]|ORIGINS|SALT|PEPPER|TTL|WINDOW(?:_MS)?|LIMIT|PER_[A-Z]+)\b|\b[A-Z][A-Z0-9]*_P[U]BLIC_[A-Z0-9_]+\b/,
  },
  // Un document de conception : son nom (seul quand il ne peut être que lui ; sinon suivi de l’extension Markdown,
  // d’une section ou d’une étiquette comme « M2 »), un fichier Markdown nommé en capitales ou en mots liés, une section
  // (le signe paragraphe), une décision lettrée, un numéro de ligne, la formule anglaise qui fixe la fin d’un plan.
  {
    cle: 'document',
    motif: /\b(?:F[A]CTS|M[O]CKUP_NOTES|S[E]O_AUDIT|A[D]N|B[A]ROMATCH_[A-Z_]+)\b|\b(?:C[O]NTRACT|S[P]EC|P[L]AN|R[E]VIEW|C[R]ITIQUE|P[A]RCOURS|C[A]PTURES|D[E]CISIONS)(?=\.m[d]\b|\s*\u00a7|\s+[A-Z]\d)|\b(?:[A-Z][A-Z0-9_]*|[a-z0-9]+(?:-[a-z0-9]+)+)\.m[d]\b|\u00a7|D[o]ne means|\b[Dd]écision [A-Z]\b|\bl\.\s?\d/,
  },
  // Une mission de l’appli, par son numéro.
  { cle: 'mission', motif: /\bmissio[n][\s_-]*\d/i },
  // Le dépôt où vit l’appli, cité comme tel.
  { cle: 'depot', motif: /d[ée]p[ôo]t\s+de\s+l[’']appl[i]/i },
  // L’état de sa mise en production : son service de construction mobile, ce qui est en production ou pas encore.
  { cle: 'production', motif: /\bE[A]S\b|\b[Dd][ée]plo(?:ie|ient|yée?s?|iement)\b|\b[Dd]eplo(?:y|ys|yed|yment)\b/ },
];

// ---------- (b) Ce que le serveur fait pour se protéger ----------

const PROTECTIONS = [
  // Un seuil anti-abus : « N … par heure », « N … par jour ».
  { cle: 'seuil', motif: /\b\d+\s+(?:(?!heure|jour)[a-zà-ÿ’'-]+\s+){0,2}?(?:per|par|an?|each|chaque)\s+(?:hour|heure|day|jour|24\s?h)\b/i },
  // Le réseau d’un visiteur : comment le serveur le lit ou le compte.
  { cle: 'reseau', motif: /I[P]v6|\/6[4]\s+(?:prefix|block|network)|préfixe\s+\/6[4]|X-Forwarde[d]|trust\s?prox[y]|\bprox(?:y|ies)\b/i },
  // Le rejeu d’une demande : sa clé et sa durée.
  { cle: 'rejeu', motif: /same e-mai[l] and s[a]me bar|même adresse et (?:le )?même bar|within 10\s+min|moins de 10 minutes apr[è]s/i },
  // Deux demandes réunies en une par le serveur.
  { cle: 'fusion', motif: /mer[g]e identical|server may mer[g]e|le serveur (?:peut )?fusio[n]n/i },
  // Ce que le serveur fait des robots du formulaire.
  {
    cle: 'robots',
    motif: /hidde[n] field filled|champ caché rempl[i]|under 3 [s]|same success and nothing is store[d]|fake succes[s]|faux succè[s]|succès silencieu[x]/i,
  },
  // Un délai minimal avant d’accepter un envoi.
  { cle: 'delai', motif: /\b\d+(?:[.,]\d+)?\s?s(?:econdes?)?\s+au\s+plus\s+tôt/i },
  // La porte : la façon dont son code se fait, change ou se partage.
  { cle: 'porte', motif: /code (?:du bar|de (?:la )?porte)[^.\n]{0,60}(?:chang|tourn|partag|fixe|rotat|expir|devin|génér)/i },
  // Un effacement programmé, et s’il tourne.
  { cle: 'effacement', motif: /\bpurg[e]/i },
  // Ce que le serveur ou l’appli laisse sans contrôle.
  {
    cle: 'controle',
    motif: /\b(?:ne|n’|n')\s*(?:vérifie|contrôle|valide|teste)\s+(?:pas|jamais|rien)\b|does(?:n[’']t| not) (?:check|verify|validate)/i,
  },
  // Les outils d’exploitation de l’appli, et les chemins de la machine.
  { cle: 'machine', motif: /bootstra[p]\w*\.(?:t[s]|m[d])|\/home\/user\// },
];

// ---------- Les empreintes ----------
// Une empreinte : les 8 premiers octets du SHA-256, en base64url. Seule l’empreinte est écrite ici.
const empreinte = (texte) => createHash('sha256').update(texte).digest().subarray(0, 8).toString('base64url');

// Des formulations retirées, par groupes de mots (en minuscules, lettres et chiffres seulement, séparés par une
// espace, d’une ligne à l’autre) : des détails des protections du serveur, et les noms du dépôt, de ses branches et de
// ses réglages écrits en mots. [nombre de mots, empreinte].
const EMPREINTES = [
  [4, 'c5zsDYcRHOQ'], [2, 'ZcFEfUDSlb8'], [3, '-pWjVi7E9fI'], [4, '53k5T-jfjDE'], [2, 'qRPDJaHTUMw'],
  [4, 'JZkyjmaxHcw'], [4, 'bIbHy13N540'], [2, 'xEXC1lE5-yM'], [4, 'zHZyvliBzpA'], [2, 'xFaaSMHegyg'],
  [2, 'z3Yjxhw0rvo'], [4, 'Ffwz_WoYyb4'], [4, 'JWc8UO6OhEw'], [3, 'AAu9j2kyDuQ'], [3, 'OlWyF6_H2oU'],
  [5, '8ReN6H1e2Jg'], [3, 't7843QJFSUo'], [4, 'qTWtPB0CLiI'], [4, 'm2r-UW3qZBM'], [3, 'Tn4huJkmJrg'],
  [4, 'sgDAu-3PdO0'], [6, 't28bozfVaJQ'], [6, 'OUeUEi7fjCw'], [3, 'rSiGT4yUB2c'], [3, 'ojxyeAEkAGE'],
  [3, 'MdhuxSPGwoQ'], [3, 'wzlvZdFDtQc'], [3, 'dNRcfC0ePc0'],
  [2, 'wICj1a4uoXw'], [4, 'DMSkHbU2zpY'], [4, 'fMveSEbh_Ak'], [6, '-nqtIn0Agow'],
];

// Des noms retirés, chacun d’un seul tenant (lettres, chiffres, « _ » et « - », en minuscules) : le dépôt où vit l’appli
// et son propriétaire, ses branches, les fonctions, modules, constantes et champs de son serveur, ses variables
// d’environnement, ses documents.
const NOMS = [
  'c7tk8Q_HpCQ', 'hYrY1GZQFpw', 'RsTcvx6rDXQ', 'n10UtGbcG_A', '5U3IwHIB0U4', 'o-dEef7EEzs', 'Uh7IMv4Afhk',
  'hdFeQ2wIbxc', '8w5GflPsFjc', 'Yp6o91zlLcg', 'aDXHOhc4HuU', '2XARA69gp_Y', '2VXOwGz5Xts', 'YHGQ_hLrzZ8',
  'hX3Beu5_Q8Q', '6OWG-dvmaIY', '68o7enjVUFQ', 'DfCe6Z-85_M', '0tloJ1bsw_s', 'MzvBUjPJKJU', 'ceWhc6Ah1OU',
  'CdqaUdJwZsk', 'D8J-KhOmn8A', 'A4zuwvd0C-Y', 'Q9Ze7gCNb7M', 'bbCelMLRs0E', 'eS2Fi_z4niw', 'MRQTVjJsVpg',
];

// ---------- Les exceptions ----------
// Les seuls documents du dossier des documents : ceux du site lui-même (son référencement, et le fichier qui ouvre
// l’appli Android depuis un lien du site, /.well-known/assetlinks.json), écrits pour Skander, hors
// de l’index (robots.txt). Seul leur chemin est permis ; leur texte est lu comme celui de tout autre fichier, avec une
// exception : l’audit cite les pages de la documentation de Google, dont l’adresse a la forme d’un chemin de
// documents (chacune comptée). Leurs noms sont écrits en morceaux, pour que ce fichier ne les contienne pas.
const AUDIT_SEO = ['d', 'ocs/SEO-AUDIT-2026-10.m', 'd'].join('');
const A_FAIRE_SEO = ['d', 'ocs/SEO-A-FAIRE-PAR-SKANDER.m', 'd'].join('');
const LIENS_ANDROID = ['d', 'ocs/ANDROID-OUVRIR-L-APPLI.m', 'd'].join('');
const DOCUMENTS_DU_SITE = [AUDIT_SEO, A_FAIRE_SEO, LIENS_ANDROID];

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
  // L’audit SEO : les adresses des pages de Google Search Central qu’il cite (developers.google.com/search/…).
  [AUDIT_SEO, 'chemin', 20],
];

// ---------- La recherche ----------

const ligneDe = (texte, index) => texte.slice(0, index).split('\n').length;
const toutes = (motif, texte) => [...texte.matchAll(new RegExp(motif.source, `${motif.flags.replace('g', '')}g`))];
// Les mots et les noms du texte, chacun avec sa place.
const morceaux = (texte, forme) => [...texte.matchAll(forme)]
  .map((trouve) => ({ mot: trouve[0].toLowerCase().replace(/^[-_]+|[-_]+$/g, ''), index: trouve.index }))
  .filter(({ mot }) => mot);

// Ce que le texte d’un fichier laisse fuir, une ligne par motif, empreinte ou nom trouvé plus souvent (ou moins
// souvent) que son exception ne le permet : « clé : n trouvé(s), m permis (lignes …) ». `garde` remplace les listes
// de ce fichier, pour éprouver la recherche elle-même.
const fuites = (fichier, brut, garde = {}) => {
  const texte = brut.normalize('NFC');
  const { motifs = [...FORMES, ...PROTECTIONS], empreintes = EMPREINTES, noms = NOMS, exceptions = EXCEPTIONS } = garde;
  const trouvees = motifs.flatMap(({ cle, motif }) => toutes(motif, texte).map((trouve) => ({ cle, index: trouve.index })));

  const mots = morceaux(texte, /[\p{L}\p{N}]+/gu);
  const groupes = new Set(empreintes.map(([n, cherchee]) => `${n}:${cherchee}`));
  const tailles = [...new Set(empreintes.map(([n]) => n))];
  mots.forEach(({ index }, debut) => {
    for (const n of tailles) {
      if (debut + n > mots.length) continue;
      const cle = `${n}:${empreinte(mots.slice(debut, debut + n).map(({ mot }) => mot).join(' '))}`;
      if (groupes.has(cle)) trouvees.push({ cle: `empreinte ${cle}`, index });
    }
  });

  const retires = new Set(noms);
  for (const { mot, index } of morceaux(texte, /[\p{L}\p{N}_-]+/gu)) {
    const cle = empreinte(mot);
    if (retires.has(cle)) trouvees.push({ cle: `nom ${cle}`, index });
  }

  const permis = new Map(exceptions.filter(([nom]) => nom === fichier).map(([, cle, nombre]) => [cle, nombre]));
  const cles = [...new Set([...trouvees.map(({ cle }) => cle), ...permis.keys()])];
  return cles.flatMap((cle) => {
    const lignes = trouvees.filter((trouvee) => trouvee.cle === cle).map(({ index }) => ligneDe(texte, index));
    const nombre = permis.get(cle) ?? 0;
    return lignes.length === nombre ? [] : [`${cle} : ${lignes.length} trouvé(s), ${nombre} permis (lignes ${lignes.join(', ') || '—'})`];
  });
};

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
