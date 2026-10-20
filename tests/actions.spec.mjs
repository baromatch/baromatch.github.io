// Les Actions du dépôt, éprouvées hors de GitHub.
// « Pages des matchs » : son étape d’envoi, la seule qui reçoit le jeton, est lancée telle quelle (le script lu dans le
// fichier de l’Action) dans des dépôts git jetables, avec un main qui change pendant le passage. Elle ne lance que git :
// un « node » piégé dans le PATH note chaque appel, et aucun n’est permis.
// « Vérifications » : les tests du site sur chaque demande de fusion vers main et chaque envoi sur une autre branche,
// sans secret ni droit d’écrire, avec le Chromium de Playwright.
import { test, expect } from '@playwright/test';
import { spawnSync, execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cheminDeChromium, CHROMIUM_INSTALLE, racine } from './outils/environnement.mjs';

const lireLAction = (nom) => readFileSync(path.join(racine, '.github', 'workflows', nom), 'utf8').replace(/\r\n/g, '\n');

// Le script d’une étape (son « run: | »), sans son retrait.
const scriptDeLEtape = (action, nom) => {
  const lignes = action.split(`\n      - name: ${nom}\n`)[1].split('\n');
  const debut = lignes.findIndex((l) => l === '        run: |');
  const corps = [];
  for (const ligne of lignes.slice(debut + 1)) {
    if (ligne.trim() && !ligne.startsWith('          ')) break;
    corps.push(ligne.slice(10));
  }
  return corps.join('\n').replace(/\n+$/, '\n');
};

test.describe('« Pages des matchs » : l’étape qui envoie les pages', () => {
  const ENVOI = 'Enregistrer et envoyer les pages qui ont changé';
  const script = scriptDeLEtape(lireLAction('pages-des-matchs.yml'), ENVOI);
  const PLAN = (date) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://baromatch.fr/</loc><lastmod>2026-10-19</lastmod></url>
  <url><loc>https://baromatch.fr/matchs/a/</loc><lastmod>${date}</lastmod></url>
</urlset>
`;

  // Un dépôt d’origine (le main de GitHub), le dépôt du passage (actions/checkout) et un autre envoi sur main.
  const preparer = () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'action-envoi-'));
    const vide = path.join(dossier, 'gitconfig');
    writeFileSync(vide, '');
    const bin = path.join(dossier, 'bin');
    mkdirSync(bin);
    const appels = path.join(dossier, 'appels-de-node.txt');
    // Un « node » piégé : s’il est lancé, il le note et échoue.
    writeFileSync(path.join(bin, 'node'), `#!/bin/sh\necho "node $*" >> "${appels}"\nexit 1\n`);
    chmodSync(path.join(bin, 'node'), 0o755);
    const env = {
      PATH: `${bin}${path.delimiter}${process.env.PATH}`, HOME: dossier, GIT_CONFIG_GLOBAL: vide, GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Essai', GIT_AUTHOR_EMAIL: 'essai@exemple.invalid', GIT_COMMITTER_NAME: 'Essai', GIT_COMMITTER_EMAIL: 'essai@exemple.invalid',
    };
    const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
    const ecrire = (depot, relatif, texte) => {
      mkdirSync(path.dirname(path.join(depot, relatif)), { recursive: true });
      writeFileSync(path.join(depot, relatif), texte);
    };
    const depart = path.join(dossier, 'depart');
    mkdirSync(depart);
    git(depart, 'init', '-q', '-b', 'main');
    ecrire(depart, 'sitemap.xml', PLAN('2026-10-20'));
    ecrire(depart, 'index.html', '<p>Accueil</p>\n');
    ecrire(depart, 'cgu.html', '<p>CGU</p>\n');
    ecrire(depart, 'confidentialite.html', '<p>Confidentialité</p>\n');
    ecrire(depart, 'matchs/a/index.html', '<p>A</p>\n');
    git(depart, 'add', '-A');
    git(depart, 'commit', '-q', '-m', 'Départ');
    const origine = path.join(dossier, 'origine.git');
    git(dossier, 'clone', '-q', '--bare', depart, origine);
    const passage = path.join(dossier, 'passage');
    git(dossier, 'clone', '-q', origine, passage);
    const autre = path.join(dossier, 'autre');
    git(dossier, 'clone', '-q', origine, autre);
    const temp = path.join(dossier, 'runner-temp');
    mkdirSync(temp);
    const sortie = path.join(dossier, 'github-output');
    writeFileSync(sortie, '');
    // Ce que le générateur et la mesure ont écrit dans le dépôt du passage : une page de match changée, une nouvelle,
    // le plan du site, une page réécrite par la mesure (dans sa liste) ; et deux fichiers hors de la liste blanche.
    const generer = () => {
      ecrire(passage, 'sitemap.xml', PLAN('2026-10-21'));
      ecrire(passage, 'matchs/a/index.html', '<p>A, mis à jour</p>\n');
      ecrire(passage, 'matchs/b/index.html', '<p>B</p>\n');
      ecrire(passage, 'confidentialite.html', '<p>Confidentialité, avec la mesure</p>\n');
      writeFileSync(path.join(temp, 'mesure.txt'), 'confidentialite.html\n');
      ecrire(passage, 'cgu.html', '<p>CGU changées ailleurs</p>\n');
      ecrire(passage, 'notes.txt', 'brouillon\n');
    };
    // Un envoi sur main pendant le passage.
    const envoiPendantLePassage = (relatif, texte) => {
      ecrire(autre, relatif, texte);
      git(autre, 'commit', '-q', '-am', 'Un autre envoi sur main');
      git(autre, 'push', '-q', 'origin', 'HEAD:main');
      return git(autre, 'rev-parse', 'HEAD');
    };
    const lancer = () => {
      const fin = spawnSync('bash', ['-c', script], {
        cwd: passage, encoding: 'utf8', env: { ...env, RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie, JETON_GITHUB: 'jeton-factice', ACCEPTER: 'false' },
      });
      return { code: fin.status, journal: `${fin.stdout}${fin.stderr}`, sortie: readFileSync(sortie, 'utf8') };
    };
    const fichiersDeMain = () => git(origine, 'ls-tree', '-r', '--name-only', 'main').split('\n');
    const lireSurMain = (relatif) => git(origine, 'show', `main:${relatif}`);
    return {
      dossier, git, origine, passage, generer, envoiPendantLePassage, lancer, fichiersDeMain, lireSurMain,
      nodeLance: () => (existsSync(appels) ? readFileSync(appels, 'utf8') : ''),
      ranger: () => rmSync(dossier, { recursive: true, force: true }),
    };
  };

  test('le script ne lance que git : ni node, ni npm, ni le générateur, ni la mesure', () => {
    const commandes = script.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    expect(commandes.filter((l) => /\b(?:node|npm|npx)\b|generateur\/|construire\.mjs|mesure\.mjs/.test(l))).toEqual([]);
    expect(script).not.toMatch(/reset -q --hard|git clean|env -u/);
  });

  test('main a changé ailleurs que dans les pages : les pages partent par-dessus, et seulement elles', () => {
    const d = preparer();
    try {
      d.generer();
      const sienne = d.envoiPendantLePassage('index.html', '<p>Accueil, changé pendant le passage</p>\n');
      const fin = d.lancer();
      expect(fin.code, fin.journal).toBe(0);
      expect(fin.sortie).toBe('envoye=oui\n');
      expect(fin.journal).toContain('main a changé pendant le passage (essai 1) : on repart de sa dernière version.');
      // Le commit des pages est posé sur celui de l’autre envoi, qui reste.
      expect(d.git(d.origine, 'rev-parse', 'main~1')).toBe(sienne);
      expect(d.git(d.origine, 'log', '-1', '--format=%s', 'main')).toMatch(/^Pages des matchs : mise à jour du \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}$/);
      expect(d.git(d.origine, 'diff', '--name-only', 'main~1', 'main').split('\n').sort())
        .toEqual(['confidentialite.html', 'matchs/a/index.html', 'matchs/b/index.html', 'sitemap.xml']);
      expect(d.lireSurMain('index.html')).toBe('<p>Accueil, changé pendant le passage</p>');
      expect(d.lireSurMain('cgu.html')).toBe('<p>CGU</p>');
      expect(d.fichiersDeMain()).not.toContain('notes.txt');
      expect(d.nodeLance()).toBe('');
    } finally {
      d.ranger();
    }
  });

  test('main a touché les mêmes lignes : le passage s’arrête sans erreur, sans rien refaire ni envoyer', () => {
    const d = preparer();
    try {
      d.generer();
      const sienne = d.envoiPendantLePassage('sitemap.xml', PLAN('2026-10-22'));
      const fin = d.lancer();
      expect(fin.code, fin.journal).toBe(0);
      expect(fin.sortie).toBe('envoye=non\n');
      expect(fin.journal).toContain('::notice::main a changé pendant le passage : le passage suivant refera les pages.');
      // main est celui de l’autre envoi, tel quel : aucune page de ce passage, aucun fichier orphelin.
      expect(d.git(d.origine, 'rev-parse', 'main')).toBe(sienne);
      expect(d.fichiersDeMain()).not.toContain('matchs/b/index.html');
      // Ni le générateur, ni la mesure, ni rien d’autre que git n’a tourné avec le jeton ; aucun rebase en suspens.
      expect(d.nodeLance()).toBe('');
      expect(existsSync(path.join(d.passage, '.git', 'rebase-merge'))).toBe(false);
      expect(existsSync(path.join(d.passage, '.git', 'rebase-apply'))).toBe(false);
    } finally {
      d.ranger();
    }
  });

  test('rien n’a changé : rien n’est enregistré ni envoyé', () => {
    const d = preparer();
    try {
      const avant = d.git(d.origine, 'rev-parse', 'main');
      const fin = d.lancer();
      expect(fin.code, fin.journal).toBe(0);
      expect(fin.sortie).toBe('envoye=non\n');
      expect(fin.journal).toContain('Rien n’a changé : aucune page à enregistrer.');
      expect(d.git(d.origine, 'rev-parse', 'main')).toBe(avant);
    } finally {
      d.ranger();
    }
  });
});

test.describe('« Vérifications » : les tests du site sur GitHub', () => {
  const action = lireLAction('verifications.yml');
  const lignes = action.split('\n').filter((l) => !l.trim().startsWith('#'));
  const sansCommentaires = lignes.join('\n');

  test('quand elle tourne : une demande de fusion vers main, un envoi sur une autre branche que main', () => {
    expect(sansCommentaires.split('\non:\n')[1].split('\n\n')[0]).toBe('  pull_request:\n    branches: [main]\n  push:\n    branches-ignore: [main]');
    expect(sansCommentaires).not.toMatch(/pull_request_target|workflow_run|schedule:|workflow_dispatch/);
  });

  test('ce qu’elle peut : lire le dépôt, rien d’autre ; aucun secret, aucun jeton', () => {
    expect(sansCommentaires).toMatch(/\npermissions:\n  contents: read\n\n/);
    expect(sansCommentaires.match(/permissions:/g)).toHaveLength(1);
    expect(sansCommentaires).not.toMatch(/secrets\.|github\.token|_TOKEN|JETON/);
    // La seule expression : le nom de la branche, pour arrêter les vérifications d’un envoi remplacé.
    expect([...sansCommentaires.matchAll(/\$\{\{([^}]*)\}\}/g)].map((m) => m[1].trim())).toEqual(['github.ref']);
    expect(sansCommentaires).toContain('\nconcurrency:\n  group: verifications-${{ github.ref }}\n  cancel-in-progress: true\n');
    expect(sansCommentaires).toMatch(/ {6}- uses: actions\/checkout@v7\n {8}with:\n {10}persist-credentials: false\n/);
  });

  test('ce qu’elle lance : les installations exactes sans script, Chromium de Playwright, puis tous les tests, en 30 minutes au plus', () => {
    const travaux = sansCommentaires.split('\njobs:\n')[1];
    expect([...travaux.matchAll(/^ {2}[a-z-]+:$/gm)].map((m) => m[0].trim())).toEqual(['verifier:']);
    expect(travaux).toContain('    runs-on: ubuntu-latest\n    timeout-minutes: 30\n');
    expect(travaux).toContain('node-version: 22');
    expect([...travaux.matchAll(/run: (.*)/g)].map((m) => m[1])).toEqual([
      'npm ci --ignore-scripts --no-audit --no-fund',
      'npm ci --ignore-scripts --no-audit --no-fund',
      'npx playwright install --with-deps chromium',
      'npx playwright test',
    ]);
    expect(travaux).toMatch(/\n {8}working-directory: generateur\/images\n {8}run: npm ci --ignore-scripts --no-audit --no-fund\n/);
  });

  test('les mêmes actions, à la même étiquette, que « Pages des matchs »', () => {
    const actions = (texte) => [...texte.matchAll(/uses: ([^\s]+)/g)].map((m) => m[1]);
    // Étiquettes vérifiées le 20 octobre 2026 : actions/checkout v7 (v7.0.1) et actions/setup-node v7 (v7.1.0).
    expect(actions(action)).toEqual(['actions/checkout@v7', 'actions/setup-node@v7']);
    expect(actions(lireLAction('pages-des-matchs.yml'))).toEqual(actions(action));
  });

  test('Chromium : CHROME_PATH, sinon celui déjà installé sur la machine, sinon celui de Playwright', () => {
    const dePlaywright = () => '/cache/ms-playwright/chromium/chrome';
    expect(cheminDeChromium({ env: { CHROME_PATH: '/autre/chrome' }, existe: () => true, dePlaywright })).toBe('/autre/chrome');
    expect(cheminDeChromium({ env: {}, existe: (chemin) => chemin === CHROMIUM_INSTALLE, dePlaywright })).toBe(CHROMIUM_INSTALLE);
    expect(cheminDeChromium({ env: {}, existe: () => false, dePlaywright })).toBe('/cache/ms-playwright/chromium/chrome');
    // Par défaut, celui que Playwright attend : un vrai chemin, celui que « npx playwright install chromium » remplit.
    expect(cheminDeChromium({ env: {}, existe: () => false })).toMatch(/chrom/i);
  });
});
