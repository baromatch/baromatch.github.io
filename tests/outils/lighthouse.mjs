// Lighthouse sur chaque page, mobile et ordinateur, contre le site servi en local.
// Usage : node tests/outils/lighthouse.mjs <dossier de sortie> [port] [--resume-seul]
// Écrit un JSON par mesure et resume.md / resume.json (Performance, Accessibilité, Bonnes pratiques, SEO). Sans dossier
// de sortie, dans lighthouse/ (à la racine avec npm run lighthouse), que git ignore : les mesures restent hors du dépôt.
// --resume-seul refait le résumé à partir des JSON déjà présents.
// La barre : la commande échoue (code 1) si une note est sous 95, sauf le SEO de la page 404, noindex exprès ; elle
// échoue aussi si une page n’a pas de mesure, au lieu de la laisser hors du résumé, et avant toute mesure si une page de
// la liste n’a pas de fichier.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { CHROMIUM, racine } from './environnement.mjs';
import { pagesLighthouse } from './pages.mjs';
import { demarrerServeur } from './serveur.mjs';

const executer = promisify(execFile);
const sortie = path.resolve(process.argv[2] ?? 'lighthouse');
const port = Number(process.argv.find((a, i) => i > 2 && /^\d+$/.test(a)) ?? 4180);
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const SEUIL = 95;
// Un audit compte comme raté sous 0,9 (le vert de Lighthouse).
const AUDIT_REUSSI = 0.9;
const APPAREILS = [
  { nom: 'mobile', options: [] },
  { nom: 'ordinateur', options: ['--preset=desktop'] },
];
// Lighthouse se lance par Node et son script (comme le serveur local) : la même commande sous Windows.
const binaire = path.join(racine, 'node_modules', 'lighthouse', 'cli', 'index.js');

const jsonDe = (page, appareil) => path.join(sortie, `${page.nom}.${appareil.nom}.json`);

const lancer = async (adresse, page, appareil) => {
  await executer(process.execPath, [
    binaire,
    `${adresse}${page.chemin}`,
    '--quiet',
    '--output=json',
    `--output-path=${jsonDe(page, appareil)}`,
    `--only-categories=${CATEGORIES.join(',')}`,
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
    ...appareil.options,
  ], { env: { ...process.env, CHROME_PATH: CHROMIUM }, maxBuffer: 64 * 1024 * 1024 });
};

const lire = (page, appareil) => {
  const rapport = JSON.parse(readFileSync(jsonDe(page, appareil), 'utf8'));
  const notes = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((rapport.categories[c]?.score ?? 0) * 100)]));
  const echecs = Object.values(rapport.audits)
    .filter((audit) => audit.score !== null && audit.score < AUDIT_REUSSI && !['informative', 'notApplicable', 'manual'].includes(audit.scoreDisplayMode))
    .map((audit) => audit.id);
  const valeur = (id) => rapport.audits[id]?.displayValue ?? '';
  return {
    page: page.nom,
    appareil: appareil.nom,
    indexable: page.indexable !== false,
    notes,
    lcp: valeur('largest-contentful-paint'),
    cls: valeur('cumulative-layout-shift'),
    tbt: valeur('total-blocking-time'),
    echecs,
  };
};

// Les notes sous le seuil ; une page noindex (404.html) n’est pas jugée sur son SEO.
const sousLeSeuil = (resultats) => resultats.flatMap((r) => CATEGORIES
  .filter((c) => r.notes[c] < SEUIL && !(c === 'seo' && !r.indexable))
  .map((c) => `${r.page} · ${r.appareil} · ${c} ${r.notes[c]}`));

// Chaque page mesurée a son fichier : une page de la liste dont le fichier manque fait échouer la commande tout de
// suite (pagesLighthouse), au lieu d’être retirée en silence de la mesure et du résumé.
const PAGES_MESUREES = pagesLighthouse();

const mesurerTout = async () => {
  const { adresse, arreter } = await demarrerServeur(port, 600);
  try {
    for (const page of PAGES_MESUREES) {
      for (const appareil of APPAREILS) await lancer(adresse, page, appareil);
    }
  } finally {
    arreter();
  }
};

const ecrireLeResume = (resultats) => {
  const lignes = [
    '| Page | Appareil | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | CLS | TBT | Audits sous 90 |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...resultats.map((r) => `| ${r.page} | ${r.appareil} | ${r.notes.performance} | ${r.notes.accessibility} | ${r.notes['best-practices']} | ${r.notes.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} | ${r.echecs.join(', ') || '—'} |`),
  ];
  writeFileSync(path.join(sortie, 'resume.md'), `${lignes.join('\n')}\n`);
  writeFileSync(path.join(sortie, 'resume.json'), `${JSON.stringify(resultats, null, 2)}\n`);
};

const principal = async () => {
  mkdirSync(sortie, { recursive: true });
  if (!process.argv.includes('--resume-seul')) await mesurerTout();
  const manquantes = PAGES_MESUREES.flatMap((page) => APPAREILS.filter((appareil) => !existsSync(jsonDe(page, appareil)))
    .map((appareil) => `${page.nom}.${appareil.nom}`));
  if (manquantes.length) throw new Error(`Mesures absentes de ${sortie} : ${manquantes.join(', ')}`);

  const resultats = PAGES_MESUREES.flatMap((page) => APPAREILS.map((appareil) => lire(page, appareil)));
  for (const r of resultats) {
    console.log(`${r.page} · ${r.appareil} · P ${r.notes.performance} · A ${r.notes.accessibility} · BP ${r.notes['best-practices']} · SEO ${r.notes.seo}`);
  }
  ecrireLeResume(resultats);
  const echecs = sousLeSeuil(resultats);
  if (echecs.length) {
    console.error(`Sous ${SEUIL} :\n${echecs.join('\n')}`);
    process.exitCode = 1;
  }
};

await principal();
