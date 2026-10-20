// La mesure d’audience du site, réglée par marque.json (« mesure » : { outil, code }). Code vide : rien ne se charge, et
// aucune page ne change. Rempli avec le code d’un compte GoatCounter : chaque page charge /mesure.js (un fichier du
// site, écrit pour Baromatch, sans le script de GoatCounter), avec l’adresse de ce compte dans data-mesure, et sa
// politique de sécurité admet cette adresse, et elle seule, pour l’envoi (connect-src).
// - Les pages des matchs le font d’elles-mêmes à chaque passage du générateur (gabarits.mjs), et leur contrôle
//   (controle.mjs) l’exige exactement.
// - Les pages écrites à la main (index.html, cgu.html…) sont réécrites ici, à chaque passage de l’Action
//   (node generateur/mesure.mjs) : leur politique de sécurité, la ligne de /mesure.js juste avant </head> et, dans
//   confidentialite.html, le bloc qui dit si le site compte ses visites (generateur/contenu/mesure.json). Quand ce bloc
//   change (la mesure démarre ou s’arrête), la page prend la date du jour à Paris (« Mise à jour le … ») et le plan du
//   site aussi (sitemap.xml, sa ligne). Rien d’autre : une page réécrite, une fois sa mesure et sa date retirées,
//   redevient exactement ce qu’elle était, sinon rien n’est écrit.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOSSIER_GENERATEUR, RACINE } from './contenu.mjs';
import { dateCourte, jourDeParis } from './heure.mjs';

export const TEXTES_DE_LA_MESURE = JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', 'mesure.json'), 'utf8'));

// La mesure arrêtée : le code est vide.
export const MESURE_ARRETEE = Object.freeze({ active: false });

// Un code de compte GoatCounter : son nom dans l’adresse https://‹code›.goatcounter.com (2 à 50 lettres minuscules,
// chiffres ou tirets, sans tiret au bout).
const CODE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])$/;
// Ce qu’on peut coller : le code seul, ou l’adresse du compte, avec ou sans https:// et /count.
const COLLE = /^(?:https?:)?(?:\/\/)?([^/.\s]+)\.goatcounter\.com(?:\/(?:count)?)?$/;
// L’adresse d’un compte GoatCounter, quel qu’il soit : ce qu’une page perd quand la mesure s’arrête ou change de compte.
const ORIGINE_GOATCOUNTER = /^https:\/\/[a-z0-9-]+\.goatcounter\.com$/;

const refuser = (raison) => {
  throw new Error(`marque.json : ${raison} Rien n’est écrit, les pages en ligne restent comme elles sont.`);
};

// La mesure que dit marque.json : { active: false }, ou { active, outil, code, origine, adresse }.
export const lireLaMesure = (marque) => {
  const reglage = marque?.mesure ?? {};
  const brut = typeof reglage.code === 'string' ? reglage.code.trim().toLowerCase() : '';
  if (!brut) return MESURE_ARRETEE;
  const outil = reglage.outil ?? 'goatcounter';
  if (outil !== 'goatcounter') refuser(`« mesure » → « outil » vaut « ${outil} » : seul « goatcounter » est prévu.`);
  const code = brut.match(COLLE)?.[1] ?? brut;
  if (!CODE.test(code)) {
    refuser(`« mesure » → « code » vaut « ${reglage.code} », qui n’est pas un code GoatCounter. Colle seulement le code de ton compte (ce qui est avant « .goatcounter.com », par exemple « baromatch »), ou vide-le pour arrêter la mesure.`);
  }
  const origine = `https://${code}.goatcounter.com`;
  return Object.freeze({ active: true, outil, code, origine, adresse: `${origine}/count` });
};

// La mesure de marque.json, à la racine du dépôt, lue une fois : celle du contrôle d’une page quand on ne lui en donne
// pas d’autre (controle.mjs).
let duSite = null;
export const mesureDuSite = () => {
  duSite ??= lireLaMesure(JSON.parse(readFileSync(path.join(RACINE, 'marque.json'), 'utf8')));
  return duSite;
};

// La balise de /mesure.js, la même sur chaque page ; rien quand la mesure est arrêtée.
export const baliseDeLaMesure = (mesure) => (mesure.active ? `<script src="/mesure.js" data-mesure="${mesure.adresse}" defer></script>` : '');
const UNE_BALISE = /<script src="\/mesure\.js"[^>]*><\/script>\n?/g;

// ---------- La politique de sécurité ----------

const directives = (politique) => politique.split(';').map((d) => d.trim()).filter(Boolean).map((d) => d.split(/\s+/));
const texteDe = (liste) => liste.map((d) => d.join(' ')).join('; ');

// La politique sans la mesure : sans aucune adresse GoatCounter ; « connect-src 'self' » seul, que la mesure ajoute à
// une page qui n’en avait pas, disparaît ; et 'self' quitte script-src d’une page qui n’a aucun autre script
// (autresScripts faux), qui retrouve 'none'.
export const politiqueSansLaMesure = (politique, { autresScripts = true } = {}) => texteDe(directives(politique).map(([nom, ...valeurs]) => {
  if (nom === 'connect-src') {
    const restent = valeurs.filter((v) => !ORIGINE_GOATCOUNTER.test(v));
    return restent.length === 1 && restent[0] === "'self'" && valeurs.length > restent.length ? null : [nom, ...restent];
  }
  if (nom === 'script-src' && !autresScripts) {
    const restent = valeurs.filter((v) => v !== "'self'");
    return [nom, ...(restent.length ? restent : ["'none'"])];
  }
  return [nom, ...valeurs];
}).filter(Boolean));

// La politique avec la mesure : script-src admet les fichiers du site ('self', à la place de 'none'), et connect-src
// l’adresse du compte (connect-src est ajouté avant base-uri s’il manquait). Arrêtée : la politique sans la mesure.
export const politiqueAvecLaMesure = (politique, mesure, options) => {
  const base = politiqueSansLaMesure(politique, options);
  if (!mesure.active) return base;
  const liste = directives(base).map(([nom, ...valeurs]) => {
    if (nom === 'script-src') return [nom, "'self'", ...valeurs.filter((v) => v !== "'none'" && v !== "'self'")];
    if (nom === 'connect-src') return [nom, ...valeurs, mesure.origine];
    return [nom, ...valeurs];
  });
  if (!liste.some(([nom]) => nom === 'script-src')) liste.splice(1, 0, ['script-src', "'self'"]);
  if (!liste.some(([nom]) => nom === 'connect-src')) {
    const ou = liste.findIndex(([nom]) => nom === 'base-uri');
    liste.splice(ou === -1 ? liste.length : ou, 0, ['connect-src', "'self'", mesure.origine]);
  }
  return texteDe(liste);
};

// ---------- Les pages écrites à la main ----------

const META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g;
// Le bloc de confidentialite.html qui dit si le site compte ses visites, entre ses deux commentaires.
const BLOC = /(<!-- mesure : début[\s\S]*?-->\n)([\s\S]*?)(\n[ \t]*<!-- mesure : fin -->)/;
export const texteDuBloc = (mesure) => TEXTES_DE_LA_MESURE.confidentialite[mesure.active ? 'active' : 'arretee'].join('\n');
const blocDe = (html) => html.match(BLOC)?.[2] ?? null;

// La date affichée d’une page (« Mise à jour le 1er novembre 2026 »), à Paris, et la même sans elle.
const DATE_AFFICHEE = /(<p class="document__date">)[^<]*(<\/p>)/;
export const dateDeMiseAJour = (maintenant) => `Mise à jour le ${dateCourte(maintenant)} ${jourDeParis(maintenant).slice(0, 4)}`;
const sansLaDate = (html) => html.replace(DATE_AFFICHEE, '$1$2');
// La ligne d’une page dans le plan du site, d’après son adresse canonique : sa date devient celle du jour à Paris.
const daterDansLePlan = (plan, html, maintenant) => {
  const adresse = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!adresse) return plan;
  return plan.split('\n').map((ligne) => (ligne.includes(`<url><loc>${adresse}</loc><lastmod>`)
    ? ligne.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${jourDeParis(maintenant)}</lastmod>`) : ligne)).join('\n');
};

// Les scripts d’une page autres que /mesure.js et les données structurées : un fichier, ou un script écrit dans la page.
const aDAutresScripts = (html) => [...html.replace(UNE_BALISE, '').matchAll(/<script\b([^>]*)>/g)]
  .some(([, attributs]) => !/type="application\/ld\+json"/.test(attributs));

// Une page écrite à la main, avec la mesure (active ou arrêtée).
export const appliquerAUnePage = (html, mesure) => {
  const metas = html.match(META) ?? [];
  if (metas.length > 1) throw new Error('plusieurs politiques de sécurité dans la page');
  let page = html.replace(UNE_BALISE, '');
  const autresScripts = aDAutresScripts(page);
  page = page.replace(META, (_, politique) => `<meta http-equiv="Content-Security-Policy" content="${politiqueAvecLaMesure(politique, mesure, { autresScripts })}">`);
  if (mesure.active) {
    if (!page.includes('\n</head>')) throw new Error('</head> introuvable');
    page = page.replace('\n</head>', `\n${baliseDeLaMesure(mesure)}\n</head>`);
  }
  return page.replace(BLOC, (_, debut, __, fin) => `${debut}${texteDuBloc(mesure)}${fin}`);
};

// Les pages écrites à la main que le site sert : chaque fichier .html du dépôt, hors des pages que le générateur écrit
// (matchs/, regarder-le-match/, bar/, ce-soir/, en/, agenda/), des outils et de ce qui n’est pas servi.
const ECARTES = new Set(['matchs', 'regarder-le-match', 'bar', 'ce-soir', 'en', 'agenda', 'tests', 'generateur', 'node_modules', 'lighthouse', 'apercu', 'test-results', 'playwright-report']);
export const pagesEcritesALaMain = (racine = RACINE, dossier = '') => readdirSync(path.join(racine, dossier), { withFileTypes: true })
  .filter((entree) => !entree.name.startsWith('.') && !(dossier === '' && ECARTES.has(entree.name)))
  .flatMap((entree) => {
    const relatif = dossier ? `${dossier}/${entree.name}` : entree.name;
    if (entree.isDirectory()) return pagesEcritesALaMain(racine, relatif);
    return entree.isFile() && entree.name.endsWith('.html') ? [relatif] : [];
  })
  .sort();

// Chaque page écrite à la main, avec la mesure de marque.json : toutes contrôlées avant d’en écrire une seule. Une page
// dont le bloc de la mesure change (Confidentialité, quand la mesure démarre ou s’arrête) prend la date du jour à Paris,
// et sa ligne du plan du site aussi. Rend les fichiers changés (leur chemin relatif ; sitemap.xml compris).
export const appliquerLaMesure = ({ racine = RACINE, marque = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8')), maintenant = Date.now() } = {}) => {
  const mesure = lireLaMesure(marque);
  const arretee = (html) => sansLaDate(appliquerAUnePage(html, MESURE_ARRETEE));
  const fichierDuPlan = path.join(racine, 'sitemap.xml');
  const planAvant = existsSync(fichierDuPlan) ? readFileSync(fichierDuPlan, 'utf8') : null;
  let plan = planAvant;
  const changees = [];
  const erreurs = [];
  for (const relatif of pagesEcritesALaMain(racine)) {
    const avant = readFileSync(path.join(racine, relatif), 'utf8');
    try {
      let apres = appliquerAUnePage(avant, mesure);
      if (blocDe(apres) !== blocDe(avant) && DATE_AFFICHEE.test(apres)) {
        apres = apres.replace(DATE_AFFICHEE, `$1${dateDeMiseAJour(maintenant)}$2`);
        if (plan !== null) plan = daterDansLePlan(plan, apres, maintenant);
      }
      if (arretee(apres) !== arretee(avant)) throw new Error('la page changerait ailleurs que dans sa mesure');
      if (apres !== avant) changees.push({ relatif, apres });
    } catch (erreur) {
      erreurs.push(`${relatif} : ${erreur.message}`);
    }
  }
  if (erreurs.length) throw new Error(`Mesure d’audience : rien n’est écrit.\n${erreurs.join('\n')}`);
  if (plan !== planAvant) changees.push({ relatif: 'sitemap.xml', apres: plan });
  for (const { relatif, apres } of changees) writeFileSync(path.join(racine, relatif), apres);
  return { mesure, changees: changees.map((c) => c.relatif) };
};

// ---------- La ligne de commande ----------
// node generateur/mesure.mjs [--racine=<dossier>] [--ecrites=<fichier>] : --ecrites reçoit, une par ligne, les pages
// réécrites (l’Action n’enregistre qu’elles, en plus des pages des matchs).

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
  try {
    const { mesure, changees } = appliquerLaMesure({ racine: path.resolve(options.racine ?? RACINE) });
    console.log(mesure.active ? `Mesure d’audience active (GoatCounter, ${mesure.code}).` : 'Mesure d’audience arrêtée (marque.json : code vide).');
    console.log(changees.length ? `Pages réécrites : ${changees.join(', ')}` : 'Aucune page à réécrire.');
    if (options.ecrites) writeFileSync(options.ecrites, changees.map((c) => `${c}\n`).join(''));
  } catch (erreur) {
    console.error(erreur.message);
    process.exitCode = 1;
  }
}
