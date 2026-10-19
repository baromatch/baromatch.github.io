// Lighthouse sur des exemples de pages générées, mobile et ordinateur : le scénario inventé construit dans
// lighthouse/exemples-site/ (une copie du site autour, tests/outils/site-genere.mjs), servi comme GitHub Pages
// (max-age=600), puis une page de ville avec des bars, une page de match avec des bars, « Ce soir » avec un vrai bar,
// et l’accueil pour comparer.
// Usage : npm run lighthouse:exemples [-- <port>]   (4275 par défaut)
// Écrit un JSON par mesure et resume.md dans lighthouse/exemples/, que git ignore. La commande échoue (code 1) si une
// note est sous 95.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { CHROMIUM, racine } from './environnement.mjs';
import { demarrerServeur } from './serveur.mjs';
import { construireLeSiteDExemple } from './site-genere.mjs';

const executer = promisify(execFile);
const site = path.join(racine, 'lighthouse', 'exemples-site');
const sortie = path.join(racine, 'lighthouse', 'exemples');
const port = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) ?? 4275);
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const SEUIL = 95;
const APPAREILS = [{ nom: 'mobile', options: [] }, { nom: 'ordinateur', options: ['--preset=desktop'] }];
const PAGES = [
  { chemin: '/regarder-le-match/paris/', nom: 'ville-paris' },
  { chemin: '/matchs/psg-ol-2026-10-25/', nom: 'match-psg-ol' },
  { chemin: '/ce-soir/', nom: 'ce-soir' },
  { chemin: '/', nom: 'accueil' },
];
const binaire = path.join(racine, 'node_modules', 'lighthouse', 'cli', 'index.js');
const jsonDe = (page, appareil) => path.join(sortie, `${page.nom}.${appareil.nom}.json`);

const principal = async () => {
  mkdirSync(sortie, { recursive: true });
  await construireLeSiteDExemple(site);
  const { adresse, arreter } = await demarrerServeur(port, 600, { dossier: site });
  try {
    for (const page of PAGES) {
      for (const appareil of APPAREILS) {
        await executer(process.execPath, [
          binaire, `${adresse}${page.chemin}`, '--quiet', '--output=json', `--output-path=${jsonDe(page, appareil)}`,
          `--only-categories=${CATEGORIES.join(',')}`, '--chrome-flags=--headless=new --no-sandbox --disable-gpu', ...appareil.options,
        ], { env: { ...process.env, CHROME_PATH: CHROMIUM }, maxBuffer: 64 * 1024 * 1024 });
      }
    }
  } finally {
    arreter();
  }
  const resultats = PAGES.flatMap((page) => APPAREILS.map((appareil) => {
    const rapport = JSON.parse(readFileSync(jsonDe(page, appareil), 'utf8'));
    return { page: page.nom, appareil: appareil.nom, notes: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((rapport.categories[c]?.score ?? 0) * 100)])) };
  }));
  const lignes = ['| Page | Appareil | Performance | Accessibilité | Bonnes pratiques | SEO |', '|---|---|---|---|---|---|',
    ...resultats.map((r) => `| ${r.page} | ${r.appareil} | ${CATEGORIES.map((c) => r.notes[c]).join(' | ')} |`)];
  writeFileSync(path.join(sortie, 'resume.md'), `${lignes.join('\n')}\n`);
  for (const r of resultats) console.log(`${r.page} · ${r.appareil} · P ${r.notes.performance} · A ${r.notes.accessibility} · BP ${r.notes['best-practices']} · SEO ${r.notes.seo}`);
  const echecs = resultats.flatMap((r) => CATEGORIES.filter((c) => r.notes[c] < SEUIL).map((c) => `${r.page} · ${r.appareil} · ${c} ${r.notes[c]}`));
  if (echecs.length) {
    console.error(`Sous ${SEUIL} :\n${echecs.join('\n')}`);
    process.exitCode = 1;
  }
};

await principal();
