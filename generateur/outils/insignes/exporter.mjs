// L’exportation des insignes : copie, dans ce dépôt, le générateur qui dessine les insignes des clubs dans l’appli
// Baromatch, pour que le site dessine chaque club exactement comme elle. Le générateur des pages tourne dans une Action
// qui ne lit que ce dépôt : la copie y est écrite une fois, ici, et refaite quand les insignes de l’appli changent
// (provenance.json : empreinteDesSources).
//
// Ce qui est copié : les modules du dessin que le site importe (de proche en proche, depuis generateur/insigne.mjs),
// transpilés en JavaScript sans aucun commentaire, et rien d’autre. Dans la table des clubs (la fiche de chaque club et
// l’insigne neutre), seulement les champs que lisent les modules copiés, à chaque niveau (CHAMPS ci-dessous). Des bandes
// des drapeaux, seulement les données (code du pays → sens et couleurs, sans retouche, dans l’ordre de la table), en
// JSON ; le petit dessin du drapeau est écrit par le site (generateur/insigne.mjs).
//
// Avant d’écrire quoi que ce soit, la copie doit :
//  - n’avoir dans sa table que des champs de CHAMPS, chacun de sa forme ; un autre champ dans les sources, à n’importe
//    quel niveau, ou une autre forme (une chaîne là où un nombre est attendu…), et rien n’est écrit ;
//  - dessiner exactement comme le paquet compilé de l’appli : chaque club, à chaque taille, sur chaque fond, dans
//    chaque variante, avec le même code ;
//  - si le fichier des empreintes des insignes est donné, redonner celles des insignes ;
//  - donner les bandes des drapeaux exactement comme la table d’où elles viennent, dans le même ordre ;
//  - ne contenir aucun commentaire, et passer le contrôle des documents publics (tests/outils/fuites.mjs).
// Sinon rien n’est écrit, et la sortie dit pourquoi. Deux lancements sur les mêmes sources écrivent les mêmes octets.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fuites } from '../../../tests/outils/fuites.mjs';

const ici = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(ici, '..', '..', '..');
export const SORTIE = path.join(SITE, 'generateur', 'insignes');
export const DONNEES_DES_TESTS = path.join(SITE, 'tests', 'donnees', 'insignes');

// TypeScript, à une version fixée.
export const VERSION_DE_TYPESCRIPT = '5.9.3';

export const USAGE = `Usage : node generateur/outils/insignes/exporter.mjs --dessin <dossier> --drapeaux <fichier> --compile <fichier> --version <fichier> [--empreintes <fichier>] [--typescript <dossier>]
  --dessin      le dossier des sources du dessin des insignes (ceux de ses modules que le site importe sont copiés)
  --drapeaux    le fichier source des bandes des drapeaux (seules ses données sont copiées)
  --compile     le module d’entrée du paquet compilé qui contient ce même dessin
  --version     le fichier de configuration de l’appli, qui porte sa version
  --empreintes  (facultatif) le fichier des empreintes des insignes, vérifiées sans être copiées
  --typescript  (facultatif) un dossier qui contient déjà TypeScript ${VERSION_DE_TYPESCRIPT} (node_modules/typescript) ; sans lui,
                cette version est installée une fois, à part, dans le dossier temporaire de la machine`;

// L’en-tête de chaque fichier copié. Les contours des lettres sont une partie de la police Bricolage Grotesque, changée
// de format : ce fichier reste sous sa licence (SIL OFL 1.1, dont le texte est à côté des polices du site), avec la
// ligne de copyright de fonts/LICENSE-OFL.txt, mot pour mot.
const MENTION = '/* © Baromatch, tous droits réservés. Copie produite par generateur/outils/insignes/exporter.mjs (voir provenance.json) : ne pas modifier à la main. */';
const LICENCE_DE_LA_POLICE = path.join(SITE, 'fonts', 'LICENSE-OFL.txt');
const COPYRIGHT_DE_LA_POLICE = 'Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)';
const MENTION_DE_LA_POLICE = `/* Contours des lettres de Bricolage Grotesque, ${COPYRIGHT_DE_LA_POLICE}, sous licence SIL OFL 1.1 (texte : fonts/LICENSE-OFL.txt). Copie produite par generateur/outils/insignes/exporter.mjs : ne pas modifier à la main. */`;
const GLYPHES = 'glyphs.generated';

// Le renommage, une règle générale : un nom en capitales qui finit par « _FROM » finit par « _AT » dans la copie.
const RENOMMAGE = 'Dans la copie, un nom écrit en capitales qui finit par « _FROM » finit par « _AT » ; rien d’autre n’est renommé.';
const renommage = (nom) => (/^[A-Z][A-Z0-9_]*_FROM$/.test(nom) ? nom.replace(/_FROM$/, '_AT') : nom);

// Les champs de la table des clubs, à chaque niveau : exactement ceux que lisent les modules copiés, chacun avec sa
// forme (une expression : une chaîne qui la suit ; « nombre » ; « oui-non » ; un objet : ses propres champs ; « * » :
// des clés en chiffres, le crénage lettre par lettre). fiche : la fiche d’un club ; neutre : l’insigne neutre.
const MOT = /^[a-z]+$/;
const COULEUR = /^#[0-9A-Fa-f]{6}$/;
const COULEURS = { primary: COULEUR, secondary: COULEUR, tertiary: COULEUR };
export const CHAMPS = {
  fiche: {
    slug: /^[a-z0-9-]+$/, code: /^[A-Z]{3}$/, pattern: MOT, colours: COULEURS, founded: 'nombre', geography: { lat: 'nombre', lon: 'nombre' },
    density: MOT, kern: { '*': 'nombre' }, nudge: { x: 'nombre', y: 'nombre' }, band: MOT, split: 'oui-non', letters: MOT, yearOnFace: 'oui-non',
  },
  neutre: { slug: MOT, code: /^$/, colours: COULEURS, pattern: MOT, neutral: 'oui-non' },
};
// Dans les sources, une fiche est un appel « spec(…) » : ses paramètres sont lus dans la signature de la fonction, et
// seuls ceux de CHAMPS.fiche sont pris (les autres, ce que l’appli sait en plus du club, sont laissés). Ses réglages en
// plus (EN_PLUS, un objet) et sa géographie ont aussi des champs que le dessin ne lit pas, laissés de côté (LAISSES) :
// tout autre champ, et rien n’est écrit.
const EN_PLUS = 'extras';
const REGLAGES = ['density', 'kern', 'nudge', 'band', 'split', 'letters', 'yearOnFace'];
const LAISSES = { [EN_PLUS]: ['away'], geography: ['feature', 'angle', 'place'] };

// Le module du site qui importe la copie : le départ de l’ensemble des modules copiés.
const IMPORTATEUR = path.join(SITE, 'generateur', 'insigne.mjs');
const DOSSIER_DE_LA_COPIE = './insignes/';
// La comparaison avec le paquet compilé : ces tailles, les deux fonds, les deux variantes, une saison et des tampons.
const COMPARAISON = { tailles: [16, 20, 24, 30, 34, 48, 58, 96, 128, 160], fonds: ['night', 'light'], variantes: ['standard', 'european'], saison: '26/27', tampons: [0, 7], neutres: ['Pafos FC', 'Шахтар', '', 'Nordsjælland'] };
// Les empreintes des insignes : par club, à 20, 48 et 160 px, et à 160 px sur fond clair.
const EMPREINTE_D_UN_INSIGNE = /@(?:20|48|160|160\/light)$/;
const TAILLES_DES_EMPREINTES = [20, 48, 160];
// Les dessins de référence : des clubs et un club que la table n’a pas (le repli neutre), à la taille des listes de
// matchs (30 px, sur les deux fonds) ; deux clubs à la taille des en-têtes (58 px) ; un à celle de l’image de partage
// (160 px, saison écrite).
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
const empreinteDuDessin = (svg) => sha256(svg).slice(0, 16);
const json = (valeur) => `${JSON.stringify(valeur, null, 1)}\n`;
const sansExtension = (fichier) => fichier.replace(/\.[^.]+$/, '');

class Refus extends Error {}
const refuser = (message) => { throw new Refus(message); };

// ---------- TypeScript, à la version fixée ----------

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

// Le renommage, partout : déclaration, import, export, usage.
const renommer = (ts) => (contexte) => {
  const visiter = (noeud) => (ts.isIdentifier(noeud) && renommage(noeud.text) !== noeud.text
    ? contexte.factory.createIdentifier(renommage(noeud.text))
    : ts.visitEachChild(noeud, visiter, contexte));
  return (fichier) => ts.visitNode(fichier, visiter);
};

const nomDe = (ts, propriete) => (propriete.name && (ts.isIdentifier(propriete.name) || ts.isStringLiteral(propriete.name) || ts.isNumericLiteral(propriete.name)) ? propriete.name.text : null);

// La forme d’un champ, dans CHAMPS : la sienne, ou celle des clés en chiffres (« * »).
const formeDe = (forme, cle) => (Object.hasOwn(forme, cle) ? forme[cle] : Object.hasOwn(forme, '*') && /^\d+$/.test(cle) ? forme['*'] : undefined);

// Une valeur écrite dans les sources, vérifiée contre sa forme : une chaîne, un nombre, oui ou non, écrits tels quels ;
// un objet écrit tel quel, dont chaque champ est permis (ou laissé de côté, s’il est dans « laisses ») et de sa forme.
// L’objet est récrit avec ses seuls champs permis ; tout le reste est refusé.
const verifierLeNoeud = (ts, factory, noeud, forme, ou, laisses = []) => {
  if (forme instanceof RegExp) {
    if (!ts.isStringLiteral(noeud) || !forme.test(noeud.text)) refuser(`${ou} : une chaîne de la forme ${forme} est attendue`);
    return noeud;
  }
  if (forme === 'nombre') {
    const chiffres = ts.isPrefixUnaryExpression(noeud) && noeud.operator === ts.SyntaxKind.MinusToken ? noeud.operand : noeud;
    if (!ts.isNumericLiteral(chiffres)) refuser(`${ou} : un nombre est attendu`);
    return noeud;
  }
  if (forme === 'oui-non') {
    if (noeud.kind !== ts.SyntaxKind.TrueKeyword && noeud.kind !== ts.SyntaxKind.FalseKeyword) refuser(`${ou} : true ou false est attendu`);
    return noeud;
  }
  if (!ts.isObjectLiteralExpression(noeud)) refuser(`${ou} : un objet écrit tel quel est attendu`);
  const gardees = [];
  for (const propriete of noeud.properties) {
    const nom = ts.isPropertyAssignment(propriete) ? nomDe(ts, propriete) : null;
    if (nom === null) refuser(`${ou} : seulement des champs écrits tels quels`);
    const sienne = formeDe(forme, nom);
    if (sienne === undefined) {
      if (laisses.includes(nom)) continue;
      refuser(`${ou} : le champ « ${nom} » n’est pas permis`);
    }
    gardees.push(factory.createPropertyAssignment(propriete.name, verifierLeNoeud(ts, factory, propriete.initializer, sienne, `${ou}.${nom}`, LAISSES[nom])));
  }
  return factory.createObjectLiteralExpression(gardees, false);
};

// La table des clubs : chaque appel « spec(…) » devient la fiche elle-même, avec ses seuls champs permis ; la fonction
// qui les fabriquait disparaît. L’insigne neutre est vérifié de même.
const tableAllegee = (ts) => (contexte) => {
  const { factory } = contexte;
  const reglages = Object.fromEntries(REGLAGES.map((nom) => [nom, CHAMPS.fiche[nom]]));
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
    if (!parametres.includes(EN_PLUS)) refuser(`specs : la fonction « spec » n’a pas de paramètre « ${EN_PLUS} »`);
    let fiches = 0;
    let neutre = false;
    const visiter = (noeud) => {
      if (ts.isVariableStatement(noeud) && noeud.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'spec')) {
        return undefined;
      }
      if (ts.isVariableDeclaration(noeud) && ts.isIdentifier(noeud.name) && noeud.name.text === 'NEUTRAL_BADGE' && noeud.initializer) {
        neutre = true;
        return factory.updateVariableDeclaration(noeud, noeud.name, noeud.exclamationToken, noeud.type, verifierLeNoeud(ts, factory, noeud.initializer, CHAMPS.neutre, 'specs : l’insigne neutre'));
      }
      if (ts.isCallExpression(noeud) && ts.isIdentifier(noeud.expression) && noeud.expression.text === 'spec') {
        fiches += 1;
        const valeurs = Object.fromEntries(parametres.map((p, i) => [p, noeud.arguments[i]]));
        const ou = `specs : la fiche ${valeurs.slug && ts.isStringLiteral(valeurs.slug) ? valeurs.slug.text : fiches}`;
        const proprietes = parametres.filter((p) => valeurs[p] && Object.hasOwn(CHAMPS.fiche, p))
          .map((p) => factory.createPropertyAssignment(p, verifierLeNoeud(ts, factory, valeurs[p], CHAMPS.fiche[p], `${ou}.${p}`, LAISSES[p])));
        if (valeurs[EN_PLUS]) proprietes.push(...verifierLeNoeud(ts, factory, valeurs[EN_PLUS], reglages, `${ou}.${EN_PLUS}`, LAISSES[EN_PLUS]).properties);
        return factory.createObjectLiteralExpression(proprietes, false);
      }
      return ts.visitEachChild(noeud, visiter, contexte);
    };
    const resultat = ts.visitNode(fichier, visiter);
    if (!fiches) refuser('specs : aucune fiche trouvée');
    if (!neutre) refuser('specs : l’insigne neutre (NEUTRAL_BADGE) n’a pas été trouvé');
    return resultat;
  };
};

const transpiler = (ts, fichier, source) => {
  const nom = sansExtension(fichier);
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    fileName: fichier,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: true, newLine: ts.NewLineKind.LineFeed },
    transformers: { before: nom === 'specs' ? [tableAllegee(ts)] : [], after: [versLesModules(ts), renommer(ts)] },
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

// ---------- Ce qui est lu ----------

export const lireLesSources = ({ dessin, drapeaux, compile, version, empreintes }) => {
  for (const [quoi, chemin] of Object.entries({ dessin, drapeaux, compile, version })) {
    if (!chemin || !existsSync(chemin)) refuser(`--${quoi} : ${chemin ? `${chemin} n’existe pas` : 'manquant'}`);
  }
  if (!statSync(dessin).isDirectory()) refuser('--dessin : un dossier est attendu');
  if (empreintes && !existsSync(empreintes)) refuser(`--empreintes : ${empreintes} n’existe pas`);
  const config = JSON.parse(readFileSync(version, 'utf8'));
  const laVersion = config.expo?.version ?? config.version;
  if (!/^\d+\.\d+\.\d+$/.test(laVersion ?? '')) refuser('--version : la version de l’appli est illisible');
  const sources = readdirSync(dessin).filter((f) => statSync(path.join(dessin, f)).isFile()).sort()
    .map((fichier) => ({ fichier, nom: sansExtension(fichier), texte: readFileSync(path.join(dessin, fichier), 'utf8') }));
  return {
    version: laVersion,
    sources,
    drapeaux: { fichier: path.basename(drapeaux), texte: readFileSync(drapeaux, 'utf8') },
    compile,
    empreintes: empreintes ? JSON.parse(readFileSync(empreintes, 'utf8')) : null,
  };
};

// ---------- La preuve ----------

// Une valeur de la table, telle que la copie la donne, contre sa forme : la liste des champs qui n’y sont pas permis ou
// pas de leur forme, vide sinon.
const ecartsDe = (valeur, forme, ou) => {
  if (forme instanceof RegExp) return typeof valeur === 'string' && forme.test(valeur) ? [] : [ou];
  if (forme === 'nombre') return typeof valeur === 'number' && Number.isFinite(valeur) ? [] : [ou];
  if (forme === 'oui-non') return typeof valeur === 'boolean' ? [] : [ou];
  if (!valeur || typeof valeur !== 'object' || Object.getPrototypeOf(valeur) !== Object.prototype) return [ou];
  return Reflect.ownKeys(valeur).flatMap((cle) => {
    const sienne = typeof cle === 'string' ? formeDe(forme, cle) : undefined;
    return sienne === undefined ? [`${ou}.${String(cle)}`] : ecartsDe(valeur[cle], sienne, `${ou}.${cle}`);
  });
};

// La table de la copie (module specs) : chaque fiche, et l’insigne neutre, n’ont que des champs de CHAMPS, chacun de sa
// forme ; une fiche est rangée sous son slug. La liste des écarts, vide sinon.
export const ecartsDeLaTable = ({ CLUB_BADGE_SPECS, NEUTRAL_BADGE }) => {
  if (!CLUB_BADGE_SPECS || typeof CLUB_BADGE_SPECS !== 'object' || !Object.keys(CLUB_BADGE_SPECS).length) return ['CLUB_BADGE_SPECS'];
  return [
    ...ecartsDe(NEUTRAL_BADGE, CHAMPS.neutre, 'NEUTRAL_BADGE'),
    ...Object.entries(CLUB_BADGE_SPECS).flatMap(([slug, fiche]) => [...(fiche?.slug === slug ? [] : [`${slug}.slug`]), ...ecartsDe(fiche, CHAMPS.fiche, slug)]),
  ];
};

// La copie et le paquet compilé dessinent-ils pareil ? La liste des écarts, vide sinon.
export const comparerLesDessins = (copie, compile) => {
  const ecarts = [];
  const comparer = (cle, a, b) => { if (a !== b) ecarts.push(cle); };
  const slugs = [...compile.CLUB_BADGE_SLUGS].sort();
  comparer('les clubs', JSON.stringify([...copie.CLUB_BADGE_SLUGS].sort()), JSON.stringify(slugs));
  const { tailles, fonds, variantes, saison, tampons, neutres } = COMPARAISON;
  const fiches = [
    ...slugs.map((slug) => [slug, copie.badgeSpecFor(slug), compile.badgeSpecFor(slug)]),
    ...neutres.map((nom) => [`neutre:${nom}`, copie.fallbackBadgeSpec(nom), compile.fallbackBadgeSpec(nom)]),
  ];
  for (const [cle, a, b] of fiches) {
    if (!a || !b) { ecarts.push(cle); continue; }
    comparer(`${cle} : slug et code`, JSON.stringify([a.slug, a.code]), JSON.stringify([b.slug, b.code]));
    for (const size of tailles) {
      for (const surface of fonds) {
        for (const variant of variantes) {
          for (const stamps of tampons) {
            const options = { size, surface, variant, season: saison, stamps, idPrefix: 'c' };
            comparer(`${cle}@${size}/${surface}/${variant}/${stamps}`, copie.badgeSvg(a, options), compile.badgeSvg(b, options));
          }
        }
      }
    }
  }
  return ecarts;
};

// Les empreintes des insignes que la copie donne, calculées comme dans le fichier des empreintes.
const empreintesDe = (insignes) => {
  const table = {};
  for (const slug of [...insignes.CLUB_BADGE_SLUGS].sort()) {
    const fiche = insignes.badgeSpecFor(slug);
    for (const size of TAILLES_DES_EMPREINTES) table[`${slug}@${size}`] = empreinteDuDessin(insignes.badgeSvg(fiche, { size, season: '26/27', idPrefix: 'b' }));
    table[`${slug}@160/light`] = empreinteDuDessin(insignes.badgeSvg(fiche, { size: 160, surface: 'light', season: '26/27', idPrefix: 'b' }));
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

// Les modules d’un dossier qu’un module importe (ou réexporte), par leur nom sans extension.
const importsDe = (ts, code, dossier) => ts.createSourceFile('module.mjs', code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS).statements
  .filter((i) => (ts.isImportDeclaration(i) || ts.isExportDeclaration(i)) && i.moduleSpecifier && ts.isStringLiteral(i.moduleSpecifier))
  .map((i) => i.moduleSpecifier.text)
  .filter((chemin) => chemin.startsWith(dossier) && !chemin.slice(dossier.length).includes('/') && chemin.endsWith('.mjs'))
  .map((chemin) => chemin.slice(dossier.length, -'.mjs'.length));

// Les bandes des drapeaux : l’objet exporté dont chaque valeur a un sens et des bandes.
const tableDesDrapeaux = (module) => Object.values(module).find((valeur) => valeur && typeof valeur === 'object' && Object.keys(valeur).length
  && Object.values(valeur).every((b) => b && typeof b.direction === 'string' && Array.isArray(b.bands)));

// ---------- L’exportation ----------

export const exporter = async ({ sources, typescript, sortie = SORTIE, donnees = DONNEES_DES_TESTS }) => {
  const ts = chargerTypescript(typescript);
  const lu = lireLesSources(sources);

  // 1. La copie, dans un dossier à part : rien n’est écrit dans le site avant la preuve. Chaque module transpilé, puis
  // seulement ceux que le site importe, de proche en proche.
  const atelier = mkdtempSync(path.join(tmpdir(), 'insignes-'));
  try {
    const transpiles = new Map();
    for (const { fichier, nom, texte } of lu.sources) {
      const code = transpiler(ts, fichier, texte);
      const trouves = commentaires(ts, code);
      if (trouves.length) refuser(`${nom} : un commentaire est resté (${trouves[0]})`);
      transpiles.set(nom, { code, texte });
    }
    const copies = [];
    const aLire = importsDe(ts, readFileSync(IMPORTATEUR, 'utf8'), DOSSIER_DE_LA_COPIE);
    if (!aLire.length) refuser('generateur/insigne.mjs n’importe aucun module de la copie');
    while (aLire.length) {
      const nom = aLire.shift();
      if (copies.includes(nom)) continue;
      if (!transpiles.has(nom)) refuser(`le module « ${nom} », importé par le site, n’est pas dans le dossier du dessin`);
      copies.push(nom);
      aLire.push(...importsDe(ts, transpiles.get(nom).code, './'));
    }
    copies.sort();
    const fichiers = {};
    if (copies.includes(GLYPHES) && !readFileSync(LICENCE_DE_LA_POLICE, 'utf8').split('\n').includes(COPYRIGHT_DE_LA_POLICE)) {
      refuser('fonts/LICENSE-OFL.txt n’a plus la ligne de copyright citée par les contours des lettres');
    }
    for (const nom of copies) fichiers[`${nom}.mjs`] = `${nom === GLYPHES ? MENTION_DE_LA_POLICE : MENTION}\n${transpiles.get(nom).code}`;

    // Les drapeaux : les données seulement, dans l’ordre de leur table, lues dans le module transpilé à part (jamais
    // copié), puis comparées à leur table, ordre des clés compris.
    writeFileSync(path.join(atelier, 'drapeaux-lus.mjs'), transpiler(ts, lu.drapeaux.fichier, lu.drapeaux.texte));
    const bandes = tableDesDrapeaux(await import(pathToFileURL(path.join(atelier, 'drapeaux-lus.mjs')).href));
    if (!bandes) refuser('--drapeaux : aucune table de bandes trouvée');
    const drapeaux = Object.fromEntries(Object.keys(bandes).map((code) => {
      const { direction, bands } = bandes[code];
      if (!['vertical', 'horizontal'].includes(direction) || !bands.every((b) => /^#[0-9A-F]{6}$/.test(b))) refuser(`drapeaux : ${code} illisible`);
      return [code, { direction, bands: [...bands] }];
    }));
    fichiers['drapeaux.json'] = json(drapeaux);
    const relus = JSON.parse(fichiers['drapeaux.json']);
    const memesDrapeaux = Object.keys(relus).join() === Object.keys(bandes).join() && Object.keys(bandes).every((code) => relus[code]
      && Object.keys(relus[code]).join() === 'direction,bands' && relus[code].direction === bandes[code].direction
      && relus[code].bands.length === bandes[code].bands.length && relus[code].bands.every((b, i) => b === bandes[code].bands[i]));
    if (!memesDrapeaux) refuser('drapeaux.json ne redonne pas la table des bandes à l’identique');

    const copie = path.join(atelier, 'insignes');
    mkdirSync(copie);
    for (const [nom, texte] of Object.entries(fichiers)) writeFileSync(path.join(copie, nom), texte);

    // 2. La preuve : le même dessin que le paquet compilé, partout ; puis les empreintes des insignes, si elles sont
    // données.
    const modules = await Promise.all(copies.map((nom) => import(pathToFileURL(path.join(copie, `${nom}.mjs`)).href)));
    const insignes = Object.assign({}, ...modules);
    const horsDeLaTable = ecartsDeLaTable(insignes);
    if (horsDeLaTable.length) refuser(`la table copiée a des champs hors de CHAMPS : ${horsDeLaTable.slice(0, 5).join(', ')}`);
    const compile = createRequire(import.meta.url)(path.resolve(lu.compile));
    const ecarts = comparerLesDessins(insignes, compile);
    if (ecarts.length) refuser(`la copie ne dessine pas comme le paquet compilé : ${ecarts.length} écart(s) (${ecarts.slice(0, 5).join(', ')}…)`);
    let empreintes = 0;
    if (lu.empreintes) {
      const attendues = Object.fromEntries(Object.entries(lu.empreintes).filter(([cle]) => EMPREINTE_D_UN_INSIGNE.test(cle)));
      const obtenues = empreintesDe(insignes);
      const differentes = [...new Set([...Object.keys(attendues), ...Object.keys(obtenues)])].filter((cle) => attendues[cle] !== obtenues[cle]);
      if (differentes.length) refuser(`la copie ne redonne pas ${differentes.length} empreinte(s) (${differentes.slice(0, 5).join(', ')}…)`);
      empreintes = Object.keys(obtenues).length;
    }
    const references = referencesDe(compile);

    // 3. La provenance, puis le contrôle des documents publics sur tout ce qui sera écrit.
    fichiers['provenance.json'] = json({
      _lisezMoi: 'Copie du générateur d’insignes de l’appli Baromatch, écrite par generateur/outils/insignes/exporter.mjs : ne pas la modifier à la main. Elle est à jour tant que empreinteDesSources et empreinteDesDrapeaux sont celles des sources du dessin et des drapeaux de l’appli ; quand l’une ne correspond plus, on refait l’export. © Baromatch, tous droits réservés.',
      versionDeLAppli: lu.version,
      typescript: VERSION_DE_TYPESCRIPT,
      renommage: RENOMMAGE,
      empreinteDesSources: sha256(JSON.stringify(copies.map((nom) => [nom, transpiles.get(nom).texte]))),
      empreinteDesDrapeaux: sha256(lu.drapeaux.texte),
      fichiers: Object.fromEntries(Object.keys(fichiers).filter((nom) => nom !== 'provenance.json').sort().map((nom) => [nom, sha256(fichiers[nom])])),
    });
    const pourLesTests = {
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
    if (refuses.length) refuser(`le contrôle des documents publics refuse la sortie :\n${refuses.join('\n')}`);

    // 4. L’écriture : la copie remplace l’ancienne en entier.
    rmSync(sortie, { recursive: true, force: true });
    mkdirSync(sortie, { recursive: true });
    mkdirSync(donnees, { recursive: true });
    for (const { cible, texte } of ecrits) writeFileSync(cible, texte);
    return { version: lu.version, fichiers: Object.keys(fichiers).length, empreintes };
  } finally {
    rmSync(atelier, { recursive: true, force: true });
  }
};

const OPTIONS = ['dessin', 'drapeaux', 'compile', 'version', 'empreintes', 'typescript'];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const cle = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !OPTIONS.includes(cle) || args[i + 1] === undefined) {
      console.error(USAGE);
      process.exit(2);
    }
    options[cle] = path.resolve(args[i + 1]);
  }
  const { typescript, ...sources } = options;
  try {
    const { version, fichiers, empreintes } = await exporter({ sources, typescript });
    console.log(`Insignes de l’appli ${version} : ${fichiers} fichiers écrits dans generateur/insignes/, le même dessin que le paquet compilé${empreintes ? `, ${empreintes} empreintes redonnées` : ''}.`);
  } catch (erreur) {
    if (!(erreur instanceof Refus)) throw erreur;
    console.error(`Rien n’est écrit : ${erreur.message}`);
    process.exit(1);
  }
}
