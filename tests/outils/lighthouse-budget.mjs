// Le budget Lighthouse sur mobile : la note de chaque page, la meilleure de 3 essais au plus, doit tenir 95 dans les
// quatre catégories. Lighthouse varie avec la charge de la machine (77 à 99 sur l’accueil quand d’autres travaux
// tournent) : une page n’échoue que si aucun de ses 3 essais n’atteint 95. Les mesures exactes, qui ne varient pas,
// sont dans tests/budget-vitesse.spec.mjs (lancé avec les autres tests) ; cette commande, plus lente, se lance à part.
// Les pages : l’accueil, deux pages fixes, et les pages générées du scénario inventé (tests/outils/site-genere.mjs ; les
// pages en anglais, agenda/ et l’affiche de la semaine comprises), construit dans lighthouse/budget-site/ et servi comme
// GitHub Pages (max-age=600).
// Usage : npm run lighthouse:budget [-- <port>]   (4276 par défaut)
// Écrit chaque mesure et resume.md dans lighthouse/budget/, que git ignore. Code 1 si une page reste sous 95.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CHROMIUM, racine } from './environnement.mjs';

export const SEUIL = 95;
export const ESSAIS = 3;
export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
export const PAGES = [
  { nom: 'accueil', chemin: '/' },
  { nom: 'pour-les-bars', chemin: '/pour-les-bars.html' },
  { nom: 'cgu', chemin: '/cgu.html' },
  { nom: 'ce-soir', chemin: '/ce-soir/' },
  { nom: 'match', chemin: '/matchs/psg-ol-2026-10-25/' },
  { nom: 'ville', chemin: '/regarder-le-match/paris/' },
  { nom: 'bar', chemin: '/bar/le-zinc-des-amis-paris-11/' },
  { nom: 'anglais', chemin: '/en/' },
  { nom: 'agenda', chemin: '/agenda/' },
  { nom: 'affiche', chemin: '/matchs/affiche/' },
];

// Les notes d’un rapport Lighthouse, sur 100.
export const notesDu = (rapport) => Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((rapport.categories[c]?.score ?? 0) * 100)]));

// La meilleure note de chaque catégorie, sur tous les essais d’une page.
export const meilleuresNotes = (essais) => Object.fromEntries(CATEGORIES.map((c) => [c, Math.max(...essais.map((n) => n[c] ?? 0))]));

export const tientLeSeuil = (notes, seuil = SEUIL) => CATEGORIES.every((c) => notes[c] >= seuil);

// Les pages sous le seuil, nommées avec la catégorie, la meilleure note et tous les essais.
export const sousLeSeuil = (resultats, seuil = SEUIL) => resultats.flatMap((r) => CATEGORIES
  .filter((c) => r.meilleures[c] < seuil)
  .map((c) => `${r.page} · mobile · ${c} ${r.meilleures[c]} (essais : ${r.essais.map((n) => n[c]).join(', ')})`));

// Mesure une page jusqu’à ESSAIS fois, et s’arrête dès qu’un essai tient le seuil partout.
export const mesurerUnePage = async (mesurer, page, { essais = ESSAIS, seuil = SEUIL } = {}) => {
  const faits = [];
  for (let i = 1; i <= essais; i += 1) {
    faits.push(await mesurer(page, i));
    if (tientLeSeuil(meilleuresNotes(faits), seuil)) break;
  }
  return { page: page.nom, essais: faits, meilleures: meilleuresNotes(faits) };
};

const principal = async () => {
  const { demarrerServeur } = await import('./serveur.mjs');
  const { construireLeSiteDExemple } = await import('./site-genere.mjs');
  const executer = promisify(execFile);
  const site = path.join(racine, 'lighthouse', 'budget-site');
  const sortie = path.join(racine, 'lighthouse', 'budget');
  const port = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) ?? 4276);
  const binaire = path.join(racine, 'node_modules', 'lighthouse', 'cli', 'index.js');
  mkdirSync(sortie, { recursive: true });
  await construireLeSiteDExemple(site, { rendu: null });
  const { adresse, arreter } = await demarrerServeur(port, 600, { dossier: site });
  const resultats = [];
  try {
    const mesurer = async (page, essai) => {
      const fichier = path.join(sortie, `${page.nom}.mobile.${essai}.json`);
      await executer(process.execPath, [
        binaire, `${adresse}${page.chemin}`, '--quiet', '--output=json', `--output-path=${fichier}`,
        `--only-categories=${CATEGORIES.join(',')}`, '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      ], { env: { ...process.env, CHROME_PATH: CHROMIUM }, maxBuffer: 64 * 1024 * 1024 });
      const notes = notesDu(JSON.parse(readFileSync(fichier, 'utf8')));
      console.log(`${page.nom} · essai ${essai} · P ${notes.performance} · A ${notes.accessibility} · BP ${notes['best-practices']} · SEO ${notes.seo}`);
      return notes;
    };
    for (const page of PAGES) resultats.push(await mesurerUnePage(mesurer, page));
  } finally {
    arreter();
  }
  const lignes = ['| Page | Essais | Performance | Accessibilité | Bonnes pratiques | SEO |', '|---|---|---|---|---|---|',
    ...resultats.map((r) => `| ${r.page} | ${r.essais.length} | ${CATEGORIES.map((c) => `${r.meilleures[c]} (${r.essais.map((n) => n[c]).join(', ')})`).join(' | ')} |`)];
  writeFileSync(path.join(sortie, 'resume.md'), `${lignes.join('\n')}\n`);
  console.log(lignes.join('\n'));
  const echecs = sousLeSeuil(resultats);
  if (echecs.length) {
    console.error(`Sous ${SEUIL} après ${ESSAIS} essais :\n${echecs.join('\n')}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal();
