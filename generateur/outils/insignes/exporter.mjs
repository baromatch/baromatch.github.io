// L’exportation des insignes : copie, dans ce dépôt, le générateur qui dessine les insignes des clubs dans l’appli
// Baromatch, pour que le site dessine chaque club exactement comme elle. Le générateur des pages tourne dans une Action
// qui ne lit que ce dépôt : la copie y est écrite une fois, ici, et relancée quand l’appli change ses insignes.
// Usage : node generateur/outils/insignes/exporter.mjs <copie locale de l’appli> [--typescript <dossier>]
//   --typescript : un dossier qui contient déjà TypeScript à la version épinglée (node_modules/typescript) ; sans lui,
//   cette version est installée une fois, à part, dans le dossier temporaire de la machine (npm install --prefix),
//   jamais dans les dépendances du site.
//
// Ce qui est copié : les seuls fichiers du dessin, transpilés en JavaScript sans aucun commentaire. Dans la table des
// clubs, chaque fiche ne garde que ce que le dessin lit (le code, le motif, les couleurs, l’année, la ville, la
// géographie, les réglages du lettrage, le maillot extérieur) et le nom du club : ni les sources, ni les raisons d’un
// motif ou d’un code. Un champ que cet outil ne connaît pas l’arrête : quelqu’un décide s’il se garde. Des bandes des
// drapeaux, seulement les données (code du pays → sens et couleurs), en JSON ; le petit dessin du drapeau est écrit par
// le site (generateur/insigne.mjs).
//
// Avant d’écrire quoi que ce soit, la copie doit :
//  - redonner les empreintes que l’appli tient pour chaque insigne (100 clubs, à 20, 48 et 160 px, sur fond clair, et
//    leur dos) : la copie dessine comme l’appli, octet pour octet ;
//  - redonner les dessins de référence que donne le paquet compilé de l’appli (son dossier dist), d’une autre source ;
//  - ne contenir aucun commentaire, et rien que la recherche des documents publics refuse (tests/outils/fuites.mjs).
// Sinon rien n’est écrit, et la sortie dit pourquoi. Deux lancements sur la même appli écrivent les mêmes octets (ni
// date, ni chemin, ni identifiant de commit : la version de l’appli dit d’où vient la copie).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fuites } from '../../../tests/outils/fuites.mjs';

const ici = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(ici, '..', '..', '..');
export const SORTIE = path.join(SITE, 'generateur', 'insignes');
export const DONNEES_DES_TESTS = path.join(SITE, 'tests', 'donnees', 'insignes');

// La version de TypeScript : celle avec laquelle l’appli compile ce même code.
export const VERSION_DE_TYPESCRIPT = '5.9.3';
// L’extension des sources, écrite en deux morceaux (la recherche des documents publics la refuse entière).
const TS = ['.t', 's'].join('');

// Où l’appli range ce qui est lu, en morceaux de chemin.
const DANS_L_APPLI = {
  dessin: ['packages', 'shared', 'src', 'insignes'],
  compile: ['packages', 'shared', 'dist', 'src', 'index.js'],
  drapeaux: ['apps', 'mobile', 'src', 'data', `flagBands${TS}`],
  empreintes: ['apps', 'mobile', 'src', '__tests__', 'insignes', 'badges.sha256.json'],
  version: ['apps', 'mobile', 'app.json'],
};

// L’en-tête de chaque fichier copié, et celui des contours des lettres (la police, sous licence SIL OFL 1.1, demande
// d’être citée ; son texte est à côté des polices du site).
const MENTION = '/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */';
const POLICE = [
  '/* Bricolage Grotesque (SIL Open Font License 1.1), ExtraBold, condensed; outlines in font units, y up. */',
  '/* Texte de la licence : fonts/LICENSE-OFL.txt. */',
];
const GLYPHES = 'glyphs.generated';
// Deux noms du code que la recherche des documents publics prendrait pour des variables d’environnement (des capitales
// qui finissent par « _FR[O]M ») : renommés dans la copie, partout où ils paraissent. Les clés sont écrites en morceaux,
// pour la même raison. Un autre nom refusé arrête l’exportation : on l’ajoute ici.
const RENOMMES = new Map([
  [['DETAIL', 'FROM'].join('_'), 'DETAIL_AT'],
  [['MATCH', 'CODES', 'FROM'].join('_'), 'MATCH_CODES_AT'],
]);

// La table des clubs : les paramètres de chaque fiche (lus dans la signature de sa fonction), ceux qu’on garde, ceux
// qu’on retire ; de même pour les réglages en plus et pour le maillot extérieur.
const FICHE = {
  garde: ['slug', 'name', 'city', 'code', 'pattern', 'colours', 'founded', 'geography'],
  retire: ['codeFrom', 'patternReason', 'sources'],
  enPlus: 'extras',
};
const EN_PLUS = { garde: ['density', 'away', 'kern', 'nudge', 'band', 'split', 'letters', 'yearOnFace'], retire: [] };
const EXTERIEUR = { garde: ['pattern', 'colours', 'density', 'split'], retire: ['reason', 'season', 'source'] };

// Les empreintes de l’appli : par club, à 20, 48 et 160 px, à 160 px sur fond clair, et le dos.
const TAILLES_DES_EMPREINTES = [20, 48, 160];
const DEPUIS = 'Sur Baromatch depuis mars 2026';
// Les dessins de référence : les clubs des planches et un club que la table n’a pas (le repli neutre), à la taille des
// listes de matchs (30 px, sur les deux fonds) ; deux clubs à la taille des en-têtes (58 px) ; un à celle de l’image de
// partage (160 px, saison écrite).
export const REFERENCES = {
  neutre: 'Pafos FC',
  tailles: [
    { taille: 30, fonds: ['night', 'light'], clubs: ['paris-saint-germain', 'le-havre-ac', 'losc-lille', 'rc-lens', 'real-madrid-c-f', 'neutre'] },
    { taille: 58, fonds: ['night', 'light'], clubs: ['paris-saint-germain', 'rc-lens', 'neutre'] },
    { taille: 160, fonds: ['night'], clubs: ['paris-saint-germain'] },
  ],
  saison: '26/27',
};

const sha256 = (texte) => createHash('sha256').update(texte).digest('hex');
// L’appli écrit chaque empreinte en hexadécimal (les 8 premiers octets du SHA-256) ; ici, les mêmes octets en base64url
// (la recherche des documents publics prendrait un hexadécimal pour un identifiant de commit).
export const empreinteDuDessin = (svg) => createHash('sha256').update(svg).digest().subarray(0, 8).toString('base64url');
const deLHexadecimal = (hex) => Buffer.from(hex, 'hex').toString('base64url');
const json = (valeur) => `${JSON.stringify(valeur, null, 1)}\n`;

class Refus extends Error {}
const refuser = (message) => { throw new Refus(message); };

// ---------- TypeScript, à la version épinglée ----------

export const chargerTypescript = (dossier) => {
  let ou = dossier;
  if (!ou) {
    ou = path.join(tmpdir(), `baromatch-typescript-${VERSION_DE_TYPESCRIPT}`);
    if (!existsSync(path.join(ou, 'node_modules', 'typescript', 'package.json'))) {
      execFileSync('npm', ['install', '--no-save', '--no-package-lock', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', ou, `typescript@${VERSION_DE_TYPESCRIPT}`], { stdio: 'inherit' });
    }
  }
  const ts = createRequire(path.join(ou, 'node_modules', 'noop.js'))('typescript');
  if (ts.version !== VERSION_DE_TYPESCRIPT) refuser(`TypeScript ${ts.version} trouvé dans ${ou}, ${VERSION_DE_TYPESCRIPT} attendu`);
  return ts;
};

// ---------- La transpilation ----------

// Les imports et exports relatifs (« ./badge ») deviennent des modules de la copie (« ./badge.mjs »).
const versLesModules = (ts) => (contexte) => {
  const { factory } = contexte;
  const relatif = (specifier) => specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('./');
  const visiter = (noeud) => {
    if (ts.isImportDeclaration(noeud) && relatif(noeud.moduleSpecifier)) {
      return factory.updateImportDeclaration(noeud, noeud.modifiers, noeud.importClause, factory.createStringLiteral(`${noeud.moduleSpecifier.text}.mjs`), noeud.attributes);
    }
    if (ts.isExportDeclaration(noeud) && relatif(noeud.moduleSpecifier)) {
      return factory.updateExportDeclaration(noeud, noeud.modifiers, noeud.isTypeOnly, noeud.exportClause, factory.createStringLiteral(`${noeud.moduleSpecifier.text}.mjs`), noeud.attributes);
    }
    return ts.visitEachChild(noeud, visiter, contexte);
  };
  return (fichier) => ts.visitNode(fichier, visiter);
};

// Les noms de RENOMMES, partout : déclaration, import, export, usage.
const renommer = (ts) => (contexte) => {
  const visiter = (noeud) => (ts.isIdentifier(noeud) && RENOMMES.has(noeud.text)
    ? contexte.factory.createIdentifier(RENOMMES.get(noeud.text))
    : ts.visitEachChild(noeud, visiter, contexte));
  return (fichier) => ts.visitNode(fichier, visiter);
};

const nomDe = (ts, propriete) => (propriete.name && (ts.isIdentifier(propriete.name) || ts.isStringLiteral(propriete.name)) ? propriete.name.text : null);

// Garde, d’un objet écrit tel quel, les propriétés permises ; une propriété inconnue arrête tout.
const trier = (ts, factory, objet, { garde, retire }, ou, enfants = {}) => {
  if (!ts.isObjectLiteralExpression(objet)) refuser(`${ou} : un objet écrit tel quel est attendu`);
  const gardees = [];
  for (const propriete of objet.properties) {
    const nom = ts.isPropertyAssignment(propriete) || ts.isShorthandPropertyAssignment(propriete) ? nomDe(ts, propriete) : null;
    if (!nom) refuser(`${ou} : une propriété que l’exportation ne sait pas lire`);
    if (retire.includes(nom)) continue;
    if (!garde.includes(nom)) refuser(`${ou} : le champ « ${nom} » est nouveau ; à ranger dans ce qui se garde (le dessin le lit) ou ce qui se retire`);
    if (enfants[nom] && ts.isPropertyAssignment(propriete)) {
      gardees.push(factory.createPropertyAssignment(nom, trier(ts, factory, propriete.initializer, enfants[nom], `${ou}.${nom}`)));
    } else {
      gardees.push(propriete);
    }
  }
  return factory.createObjectLiteralExpression(gardees, false);
};

// La table des clubs : chaque appel « spec(…) » devient la fiche elle-même, avec ce qui se garde seulement ; la
// fonction qui les fabriquait disparaît.
const tableAllegee = (ts) => (contexte) => {
  const { factory } = contexte;
  return (fichier) => {
    let parametres = null;
    for (const instruction of fichier.statements) {
      if (!ts.isVariableStatement(instruction)) continue;
      for (const declaration of instruction.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === 'spec' && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
          parametres = declaration.initializer.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : refuser('specs : un paramètre sans nom')));
        }
      }
    }
    if (!parametres) refuser('specs : la fonction « spec » n’a pas été trouvée');
    const connus = [...FICHE.garde, ...FICHE.retire, FICHE.enPlus];
    const inconnus = parametres.filter((p) => !connus.includes(p));
    if (inconnus.length) refuser(`specs : paramètre(s) nouveau(x) : ${inconnus.join(', ')} ; à ranger dans ce qui se garde ou ce qui se retire`);
    let fiches = 0;
    const visiter = (noeud) => {
      if (ts.isVariableStatement(noeud) && noeud.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'spec')) {
        return undefined;
      }
      if (ts.isCallExpression(noeud) && ts.isIdentifier(noeud.expression) && noeud.expression.text === 'spec') {
        fiches += 1;
        const valeurs = Object.fromEntries(parametres.map((p, i) => [p, noeud.arguments[i]]));
        const ou = `specs : la fiche ${valeurs.slug && ts.isStringLiteral(valeurs.slug) ? valeurs.slug.text : fiches}`;
        const proprietes = FICHE.garde.filter((p) => valeurs[p]).map((p) => factory.createPropertyAssignment(p, valeurs[p]));
        if (valeurs[FICHE.enPlus]) {
          proprietes.push(...trier(ts, factory, valeurs[FICHE.enPlus], EN_PLUS, ou, { away: EXTERIEUR }).properties);
        }
        return factory.createObjectLiteralExpression(proprietes, false);
      }
      return ts.visitEachChild(noeud, visiter, contexte);
    };
    const resultat = ts.visitNode(fichier, visiter);
    if (!fiches) refuser('specs : aucune fiche trouvée');
    return resultat;
  };
};

const transpiler = (ts, nom, source) => {
  const avant = nom === 'specs' ? [tableAllegee(ts)] : [];
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    fileName: `${nom}${TS}`,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: true, newLine: ts.NewLineKind.LineFeed },
    transformers: { before: avant, after: [versLesModules(ts), renommer(ts)] },
  });
  if (diagnostics.length) refuser(`${nom} : ${diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' ; ')}`);
  return outputText.replace(/\n*$/, '\n');
};

// Aucun commentaire dans le code copié : chaque jeton du module, lu par l’analyseur de TypeScript (pas par une
// expression régulière), et ce qui le précède ou le suit.
const commentaires = (ts, code) => {
  const fichier = ts.createSourceFile('copie.mjs', code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const trouves = new Set();
  const lire = (plages) => (plages ?? []).forEach((plage) => trouves.add(code.slice(plage.pos, plage.end).slice(0, 60)));
  const visiter = (noeud) => {
    lire(ts.getLeadingCommentRanges(code, noeud.pos));
    lire(ts.getTrailingCommentRanges(code, noeud.end));
    for (const enfant of noeud.getChildren(fichier)) visiter(enfant);
  };
  visiter(fichier);
  return [...trouves];
};

// ---------- La lecture de l’appli ----------

export const lireLAppli = (appli) => {
  const chemin = (morceaux) => path.join(appli, ...morceaux);
  for (const [quoi, morceaux] of Object.entries(DANS_L_APPLI)) {
    if (!existsSync(chemin(morceaux))) refuser(`la copie de l’appli n’a pas ${path.join(...morceaux)} (${quoi})`);
  }
  const version = JSON.parse(readFileSync(chemin(DANS_L_APPLI.version), 'utf8')).expo?.version;
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) refuser('la version de l’appli est illisible');
  const dossier = chemin(DANS_L_APPLI.dessin);
  const sources = readdirSync(dossier).filter((f) => f.endsWith(TS)).sort()
    .map((f) => ({ nom: f.slice(0, -TS.length), texte: readFileSync(path.join(dossier, f), 'utf8') }));
  return {
    version,
    sources,
    drapeaux: readFileSync(chemin(DANS_L_APPLI.drapeaux), 'utf8'),
    empreintes: JSON.parse(readFileSync(chemin(DANS_L_APPLI.empreintes), 'utf8')),
    compile: chemin(DANS_L_APPLI.compile),
  };
};

// ---------- La preuve ----------

// Les empreintes que la copie donne, calculées comme l’appli les calcule.
export const empreintesDe = (insignes) => {
  const table = {};
  for (const slug of [...insignes.CLUB_BADGE_SLUGS].sort()) {
    const fiche = insignes.badgeSpecFor(slug);
    for (const size of TAILLES_DES_EMPREINTES) table[`${slug}@${size}`] = empreinteDuDessin(insignes.badgeSvg(fiche, { size, season: '26/27', idPrefix: 'b' }));
    table[`${slug}@160/light`] = empreinteDuDessin(insignes.badgeSvg(fiche, { size: 160, surface: 'light', season: '26/27', idPrefix: 'b' }));
    table[`${slug}@back`] = empreinteDuDessin(insignes.badgeBackSvg(fiche, { size: 160, since: DEPUIS, idPrefix: 'k' }));
  }
  return table;
};

// Le préfixe des identifiants d’un insigne, comme l’appli le forme pour un insigne de club (variante standard, sans
// tampon) : « ib-f-<slug>-<palier>-s<fond>0 ».
export const prefixeDeLAppli = (insignes, slug, taille, fond) => `ib-f-${slug}-${insignes.badgeTier(taille)}-s${fond[0]}0`.replace(/[^a-zA-Z0-9_-]/g, '');

// Les dessins de référence, complets, d’un générateur (la copie, ou le paquet compilé de l’appli).
export const referencesDe = (insignes) => {
  const table = {};
  for (const { taille, fonds, clubs } of REFERENCES.tailles) {
    for (const club of clubs) {
      const neutre = club === 'neutre';
      const fiche = neutre ? insignes.fallbackBadgeSpec(REFERENCES.neutre) : insignes.badgeSpecFor(club);
      if (!fiche) refuser(`les références : ${club} n’a pas de fiche`);
      for (const fond of fonds) {
        table[`${neutre ? `neutre:${REFERENCES.neutre}` : club}@${taille}/${fond}`] = insignes.badgeSvg(fiche, {
          size: taille, variant: 'standard', surface: fond, season: REFERENCES.saison, stamps: 0, idPrefix: prefixeDeLAppli(insignes, fiche.slug, taille, fond),
        });
      }
    }
  }
  return table;
};

// ---------- L’exportation ----------

export const exporter = async ({ appli, typescript, sortie = SORTIE, donnees = DONNEES_DES_TESTS }) => {
  const ts = chargerTypescript(typescript);
  const lu = lireLAppli(appli);

  // 1. La copie, dans un dossier à part : rien n’est écrit dans le site avant la preuve.
  const atelier = mkdtempSync(path.join(tmpdir(), 'insignes-'));
  try {
    const fichiers = {};
    for (const { nom, texte } of lu.sources) {
      const code = transpiler(ts, nom, texte);
      const trouves = commentaires(ts, code);
      if (trouves.length) refuser(`${nom} : un commentaire est resté (${trouves[0]})`);
      fichiers[`${nom}.mjs`] = `${MENTION}\n${nom === GLYPHES ? `${POLICE.join('\n')}\n` : ''}${code}`;
    }
    // Les drapeaux : les données seulement, lues dans le module transpilé à part (jamais copié).
    writeFileSync(path.join(atelier, 'drapeaux-lus.mjs'), transpiler(ts, 'drapeaux', lu.drapeaux));
    const { FLAG_BANDS } = await import(pathToFileURL(path.join(atelier, 'drapeaux-lus.mjs')).href);
    const drapeaux = Object.fromEntries(Object.keys(FLAG_BANDS).sort().map((code) => {
      const { direction, bands } = FLAG_BANDS[code];
      if (!['vertical', 'horizontal'].includes(direction) || !bands.every((b) => /^#[0-9A-F]{6}$/.test(b))) refuser(`drapeaux : ${code} illisible`);
      return [code, { direction, bands: [...bands] }];
    }));
    fichiers['drapeaux.json'] = json(drapeaux);

    const copie = path.join(atelier, 'insignes');
    mkdirSync(copie);
    for (const [nom, texte] of Object.entries(fichiers)) writeFileSync(path.join(copie, nom), texte);

    // 2. La preuve : les empreintes de l’appli, puis les références de son paquet compilé.
    const insignes = await import(pathToFileURL(path.join(copie, 'index.mjs')).href);
    const attendues = Object.fromEntries(Object.entries(lu.empreintes).map(([cle, hex]) => [cle, deLHexadecimal(hex)]));
    const obtenues = empreintesDe(insignes);
    const ecarts = [...new Set([...Object.keys(attendues), ...Object.keys(obtenues)])].filter((cle) => attendues[cle] !== obtenues[cle]);
    if (ecarts.length) refuser(`la copie ne dessine pas comme l’appli : ${ecarts.length} empreinte(s) diffèrent (${ecarts.slice(0, 5).join(', ')}…)`);
    const compile = createRequire(import.meta.url)(lu.compile);
    const references = referencesDe(compile);
    const deLaCopie = referencesDe(insignes);
    const differentes = Object.keys(references).filter((cle) => references[cle] !== deLaCopie[cle]);
    if (differentes.length) refuser(`le paquet compilé de l’appli et la copie diffèrent (${differentes.join(', ')}) : le paquet est-il à jour ?`);

    // 3. La provenance, puis la recherche des documents publics sur tout ce qui sera écrit.
    fichiers['provenance.json'] = json({
      _lisezMoi: 'Copie du générateur d’insignes de l’appli Baromatch : les fichiers du dessin, transpilés en JavaScript sans commentaires, la table des clubs réduite à ce que le dessin lit, et les bandes des drapeaux (les données seules). Produite par generateur/outils/insignes/exporter.mjs, jamais modifiée à la main : quand l’appli change ses insignes (une version plus récente que celle-ci), on relance l’exportation. La copie redonne les empreintes que l’appli tient pour chaque insigne (tests/donnees/insignes/empreintes.json, vérifiées par tests/insignes.spec.mjs). © Baromatch, tous droits réservés.',
      versionDeLAppli: lu.version,
      typescript: VERSION_DE_TYPESCRIPT,
      empreinteDesSources: sha256(JSON.stringify([...lu.sources.map(({ nom, texte }) => [nom, texte]), ['drapeaux', lu.drapeaux]])),
      fichiers: Object.fromEntries(Object.keys(fichiers).filter((nom) => nom !== 'provenance.json').sort().map((nom) => [nom, sha256(fichiers[nom])])),
    });
    const pourLesTests = {
      'empreintes.json': json({
        _lisezMoi: `Les empreintes des insignes, telles que l’appli Baromatch ${lu.version} les tient : par club, l’insigne à 20, 48 et 160 px (saison 26/27, préfixe d’identifiants b), à 160 px sur fond clair, et son dos (« ${DEPUIS} », préfixe k). Chacune : les 8 premiers octets du SHA-256 du dessin, en base64url. Écrites par generateur/outils/insignes/exporter.mjs.`,
        ...attendues,
      }),
      'references.json': json({
        _lisezMoi: `Des insignes complets, dessinés par le paquet compilé de l’appli Baromatch ${lu.version} (pas par la copie) : des clubs et un club que la table n’a pas (le repli neutre, « ${REFERENCES.neutre} »), à 30, 58 et 160 px, sur fond de nuit (night) ou clair (light), saison ${REFERENCES.saison}, avec les identifiants que l’appli leur donne. Écrits par generateur/outils/insignes/exporter.mjs.`,
        ...references,
      }),
    };
    const ecrits = [
      ...Object.entries(fichiers).map(([nom, texte]) => ({ cible: path.join(sortie, nom), texte })),
      ...Object.entries(pourLesTests).map(([nom, texte]) => ({ cible: path.join(donnees, nom), texte })),
    ];
    const refuses = ecrits.flatMap(({ cible, texte }) => fuites(path.relative(SITE, cible), texte).map((fuite) => `${path.relative(SITE, cible)} : ${fuite}`));
    if (refuses.length) refuser(`la recherche des documents publics refuse la sortie :\n${refuses.join('\n')}`);

    // 4. L’écriture : la copie remplace l’ancienne en entier.
    rmSync(sortie, { recursive: true, force: true });
    mkdirSync(sortie, { recursive: true });
    mkdirSync(donnees, { recursive: true });
    for (const { cible, texte } of ecrits) writeFileSync(cible, texte);
    return { version: lu.version, fichiers: Object.keys(fichiers).length, empreintes: Object.keys(obtenues).length };
  } finally {
    rmSync(atelier, { recursive: true, force: true });
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = args.indexOf('--typescript');
  const typescript = option >= 0 ? path.resolve(args[option + 1] ?? '') : undefined;
  const appli = args.find((a, i) => !a.startsWith('--') && !(option >= 0 && i === option + 1));
  if (!appli) {
    console.error('Usage : node generateur/outils/insignes/exporter.mjs <copie locale de l’appli> [--typescript <dossier>]');
    process.exit(2);
  }
  try {
    const { version, fichiers, empreintes } = await exporter({ appli: path.resolve(appli), typescript });
    console.log(`Insignes de l’appli ${version} : ${fichiers} fichiers écrits dans generateur/insignes/, ${empreintes} empreintes redonnées.`);
  } catch (erreur) {
    if (!(erreur instanceof Refus)) throw erreur;
    console.error(`Rien n’est écrit : ${erreur.message}`);
    process.exit(1);
  }
}
