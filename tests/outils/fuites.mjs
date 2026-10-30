// La recherche du test des documents publics (tests/documents-publics.spec.mjs), à part pour servir aussi ailleurs :
// l’exportation des insignes (generateur/outils/insignes/exporter.mjs) refuse sa sortie si cette recherche y trouve
// quelque chose. Les motifs, empreintes et noms sont ceux du test, inchangés ; les exceptions restent dans le test
// (ici, aucune par défaut). Ce fichier se lit lui-même comme les autres : ce qu’il cherche y est écrit avec une lettre
// entre crochets (F[A]CTS) ou un caractère échappé, pour qu’il ne se trouve pas dans sa propre source.
import { createHash } from 'node:crypto';

// ---------- (a) Les formes d’un renvoi au dépôt privé ----------

export const FORMES = [
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
  // L’état de sa mise en production : son service de construction mobile (par son sigle, son adresse, ou ce qu’il garde :
  // la clé de signature et ses réglages de construction), ce qui est en production ou pas encore.
  {
    cle: 'production',
    motif: /\bE[A]S\b|\b[Ee]xp[o]\.dev\b|\b[Kk]e[y]store\b|\b[Pp]rofils? de buil[d]\b|\b[Dd][ée]plo(?:ie|ient|yée?s?|iement)\b|\b[Dd]eplo(?:y|ys|yed|yment)\b/,
  },
];

// ---------- (b) Ce que le serveur fait pour se protéger ----------

export const PROTECTIONS = [
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
export const empreinte = (texte) => createHash('sha256').update(texte).digest().subarray(0, 8).toString('base64url');

// Des formulations retirées, par groupes de mots (en minuscules, lettres et chiffres seulement, séparés par une
// espace, d’une ligne à l’autre) : des détails des protections du serveur, et les noms du dépôt, de ses branches et de
// ses réglages écrits en mots. [nombre de mots, empreinte].
export const EMPREINTES = [
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
export const NOMS = [
  'c7tk8Q_HpCQ', 'hYrY1GZQFpw', 'RsTcvx6rDXQ', 'n10UtGbcG_A', '5U3IwHIB0U4', 'o-dEef7EEzs', 'Uh7IMv4Afhk',
  'hdFeQ2wIbxc', '8w5GflPsFjc', 'Yp6o91zlLcg', 'aDXHOhc4HuU', '2XARA69gp_Y', '2VXOwGz5Xts', 'YHGQ_hLrzZ8',
  'hX3Beu5_Q8Q', '6OWG-dvmaIY', '68o7enjVUFQ', 'DfCe6Z-85_M', '0tloJ1bsw_s', 'MzvBUjPJKJU', 'ceWhc6Ah1OU',
  'CdqaUdJwZsk', 'D8J-KhOmn8A', 'A4zuwvd0C-Y', 'Q9Ze7gCNb7M', 'bbCelMLRs0E', 'eS2Fi_z4niw', 'MRQTVjJsVpg',
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
export const fuites = (fichier, brut, garde = {}) => {
  const texte = brut.normalize('NFC');
  const { motifs = [...FORMES, ...PROTECTIONS], empreintes = EMPREINTES, noms = NOMS, exceptions = [] } = garde;
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
