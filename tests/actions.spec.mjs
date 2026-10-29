// Les Actions du dépôt, éprouvées hors de GitHub.
// « Pages des matchs » : son étape d’envoi, la seule qui reçoit le jeton, est lancée telle quelle (le script lu dans le
// fichier de l’Action) dans des dépôts git jetables, avec un main qui change pendant le passage. Elle ne lance que git :
// un « node » piégé dans le PATH note chaque appel, et aucun n’est permis.
// « Vérifications » : les tests du site sur chaque demande de fusion vers main et chaque envoi sur une autre branche,
// sans secret ni droit d’écrire, avec le Chromium de Playwright et ffmpeg.
import { test, expect } from '@playwright/test';
import { spawnSync, execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cheminDeChromium, CHROMIUM_INSTALLE, racine } from './outils/environnement.mjs';

const lireLAction = (nom) => readFileSync(path.join(racine, '.github', 'workflows', nom), 'utf8').replace(/\r\n/g, '\n');
// Les actions qu’une Action utilise, dans l’ordre ; le texte d’une de ses étapes (jusqu’à la suivante) ; le dossier et la
// clé d’une étape de cache.
const actionsDe = (texte) => [...texte.matchAll(/uses: ([^\s]+)/g)].map((m) => m[1]);
const etapeDe = (texte, nom) => texte.split(`\n      - name: ${nom}\n`)[1].split(/\n\n|\n {6}(?:- |# )/)[0];
const cacheDe = (etape) => ({
  dossier: etape.match(/\n {10}path: ~\/(\S+)/)?.[1], cle: etape.match(/\n {10}key: (.+)/)?.[1], prefixe: etape.match(/\n {10}restore-keys: (\S+)/)?.[1],
});
// La version d’Ubuntu d’une Action (« runs-on: ubuntu-24.04 » : « 24.04 »).
const ubuntuDe = (texte) => texte.match(/\n {4}runs-on: ubuntu-(\d{2}\.\d{2})\n/)?.[1];

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
  // L’accueil : écrit à la main, sauf le bloc des matchs de la semaine, entre ses deux repères.
  const ACCUEIL = (bloc, pied = '<p>Pied</p>') => `<p>Accueil</p>\n<!-- semaine:debut -->\n${bloc}\n<!-- semaine:fin -->\n${pied}\n`;

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
    ecrire(depart, 'index.html', ACCUEIL('<p>Semaine</p>'));
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
      dossier, git, origine, passage, temp, generer, ecrire, envoiPendantLePassage, lancer, fichiersDeMain, lireSurMain,
      nodeLance: () => (existsSync(appels) ? readFileSync(appels, 'utf8') : ''),
      ranger: () => rmSync(dossier, { recursive: true, force: true }),
    };
  };

  test('le script ne lance que git : ni node, ni npm, ni le générateur, ni la mesure', () => {
    const commandes = script.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    expect(commandes.filter((l) => /\b(?:node|npm|npx)\b|generateur\/|construire\.mjs|mesure\.mjs/.test(l))).toEqual([]);
    expect(script).not.toMatch(/reset -q --hard|git clean|env -u/);
  });

  test('un générateur arrêté n’enregistre rien, pas même les pages que la mesure a réécrites', () => {
    // L’étape d’envoi suit celle qui construit, sans condition : un passage raté (les données ne répondent pas) ne
    // l’atteint jamais. La mesure d’audience démarre ou s’arrête donc avec un passage réussi, toutes pages ensemble,
    // et l’en-tête de l’Action le dit.
    const action = lireLAction('pages-des-matchs.yml');
    const etapes = action.split('\n      - ').map((e) => e.split('\n')[0]);
    expect(etapes.indexOf(`name: ${ENVOI}`)).toBe(etapes.indexOf('name: Construire et contrôler les pages') + 1);
    const envoi = action.split(`\n      - name: ${ENVOI}\n`)[1].split('\n        run: |')[0];
    expect(envoi).not.toMatch(/^ {8}if:/m);
    expect(action.split('\nname:')[0]).toContain('Elle ne change qu’avec un passage réussi du générateur, qu’on la démarre ou qu’on l’arrête');
  });

  test('main a changé ailleurs que dans les pages : les pages partent par-dessus, et seulement elles', () => {
    const d = preparer();
    try {
      d.generer();
      const sienne = d.envoiPendantLePassage('index.html', ACCUEIL('<p>Semaine</p>', '<p>Pied, changé pendant le passage</p>'));
      const fin = d.lancer();
      expect(fin.code, fin.journal).toBe(0);
      expect(fin.sortie).toBe('envoye=oui\n');
      expect(fin.journal).toContain('main a changé pendant le passage (essai 1) : on repart de sa dernière version.');
      // Le commit des pages est posé sur celui de l’autre envoi, qui reste.
      expect(d.git(d.origine, 'rev-parse', 'main~1')).toBe(sienne);
      expect(d.git(d.origine, 'log', '-1', '--format=%s', 'main')).toMatch(/^Pages des matchs : mise à jour du \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}$/);
      expect(d.git(d.origine, 'diff', '--name-only', 'main~1', 'main').split('\n').sort())
        .toEqual(['confidentialite.html', 'matchs/a/index.html', 'matchs/b/index.html', 'sitemap.xml']);
      expect(d.lireSurMain('index.html')).toBe(ACCUEIL('<p>Semaine</p>', '<p>Pied, changé pendant le passage</p>').trim());
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

  test('l’accueil, dont le générateur a réécrit le bloc des matchs de la semaine, part avec les pages', () => {
    const d = preparer();
    try {
      d.generer();
      d.ecrire(d.passage, 'index.html', ACCUEIL('<p>Les matchs de la semaine</p>'));
      const fin = d.lancer();
      expect(fin.code, fin.journal).toBe(0);
      expect(fin.sortie).toBe('envoye=oui\n');
      expect(d.git(d.origine, 'diff', '--name-only', 'main~1', 'main').split('\n').sort())
        .toEqual(['confidentialite.html', 'index.html', 'matchs/a/index.html', 'matchs/b/index.html', 'sitemap.xml']);
      expect(d.lireSurMain('index.html')).toBe(ACCUEIL('<p>Les matchs de la semaine</p>').trim());
      expect(d.lireSurMain('cgu.html')).toBe('<p>CGU</p>');
      expect(d.fichiersDeMain()).not.toContain('notes.txt');
    } finally {
      d.ranger();
    }
  });

  test('l’accueil changé hors de son bloc (ou sans ses repères) : rien n’est enregistré ni envoyé, et l’Action le dit', () => {
    for (const accueil of [
      ACCUEIL('<p>Les matchs de la semaine</p>', '<p>Pied changé</p>'),
      `<p>Accueil changé</p>\n${ACCUEIL('<p>Semaine</p>')}`,
      '<p>Accueil</p>\n<p>Les matchs de la semaine</p>\n<p>Pied</p>\n',
      ACCUEIL('<p>Semaine</p>').replace('<!-- semaine:fin -->\n', ''),
      `${ACCUEIL('<p>Semaine</p>')}<!-- semaine:debut -->\n<p>Encore</p>\n<!-- semaine:fin -->\n`,
    ]) {
      const d = preparer();
      try {
        const avant = d.git(d.origine, 'rev-parse', 'main');
        d.generer();
        d.ecrire(d.passage, 'index.html', accueil);
        const fin = d.lancer();
        expect(fin.code, accueil).toBe(1);
        expect(fin.journal).toContain('::error::index.html a changé hors du bloc des matchs de la semaine : rien n’est enregistré ni envoyé.');
        expect(fin.sortie).toBe('');
        expect(d.git(d.origine, 'rev-parse', 'main')).toBe(avant);
        expect(d.git(d.passage, 'rev-parse', 'HEAD')).toBe(avant);
        expect(d.nodeLance()).toBe('');
      } finally {
        d.ranger();
      }
    }
  });

  test('l’accueil réécrit par la mesure (dans sa liste) part avec les pages, même hors de son bloc', () => {
    const d = preparer();
    try {
      d.generer();
      writeFileSync(path.join(d.temp, 'mesure.txt'), 'confidentialite.html\nindex.html\n');
      d.ecrire(d.passage, 'index.html', ACCUEIL('<p>Les matchs de la semaine</p>', '<p>Pied, avec la mesure</p>'));
      const fin = d.lancer();
      expect(fin.code, fin.journal).toBe(0);
      expect(fin.sortie).toBe('envoye=oui\n');
      expect(d.lireSurMain('index.html')).toBe(ACCUEIL('<p>Les matchs de la semaine</p>', '<p>Pied, avec la mesure</p>').trim());
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

  test('ce qu’elle lance : les installations exactes sans script, Chromium de Playwright, ffmpeg, puis tous les tests, en 30 minutes au plus', () => {
    const travaux = sansCommentaires.split('\njobs:\n')[1];
    expect([...travaux.matchAll(/^ {2}[a-z-]+:$/gm)].map((m) => m[0].trim())).toEqual(['verifier:']);
    expect(travaux).toContain('    runs-on: ubuntu-24.04\n    timeout-minutes: 30\n');
    expect(travaux).toContain('node-version: 22');
    expect([...travaux.matchAll(/run: (.*)/g)].map((m) => m[1])).toEqual([
      'npm ci --ignore-scripts --no-audit --no-fund',
      'npm ci --ignore-scripts --no-audit --no-fund',
      'npx playwright install --with-deps chromium',
      'mkdir -p ~/paquets-ffmpeg/partial && sudo apt-get install -y --no-install-recommends -o Dir::Cache::Archives="$HOME/paquets-ffmpeg" ffmpeg',
      'npx playwright test',
    ]);
    // Aucun test sauté faute d’outil : chaque « test.skip » des vérifications attend un outil que l’Action installe.
    const sautes = readdirSync(path.join(racine, 'tests')).filter((f) => f.endsWith('.spec.mjs'))
      .flatMap((f) => [...readFileSync(path.join(racine, 'tests', f), 'utf8').matchAll(/test\.skip\(([^,]+),/g)].map((m) => `${f} ${m[1].trim()}`));
    expect(sautes).toEqual(['seo.spec.mjs !ffmpeg']);
    expect(travaux).toMatch(/\n {8}working-directory: generateur\/images\n {8}run: npm ci --ignore-scripts --no-audit --no-fund\n/);
  });

  test('les mêmes actions, à la même étiquette, que « Pages des matchs », et la reprise du cache de ffmpeg', () => {
    // Étiquettes vérifiées le 20 octobre 2026 : actions/checkout v7 (v7.0.1) et actions/setup-node v7 (v7.1.0) ; le
    // 26 octobre 2026 : actions/cache v6 (v6.1.0).
    expect(actionsDe(action)).toEqual(['actions/checkout@v7', 'actions/setup-node@v7', 'actions/cache/restore@v6']);
    expect(actionsDe(lireLAction('pages-des-matchs.yml'))).toEqual(['actions/checkout@v7', 'actions/setup-node@v7']);
  });

  test('ffmpeg : ses paquets repris du cache que « Cache de ffmpeg » remplit, avant l’installation qui les lit', () => {
    // Reprendre seulement (cache/restore) : une branche n’écrit pas de cache que les autres ne pourraient pas lire.
    const reprise = etapeDe(action, 'Reprendre les paquets de ffmpeg');
    expect(reprise).toContain('uses: actions/cache/restore@v6\n');
    // Le cache le plus récent que « Cache de ffmpeg » a rempli : même dossier, même préfixe de clé, même version
    // d’Ubuntu, écrite dans la clé (des paquets d’une autre version ne serviraient à rien).
    const remplissage = lireLAction('cache-ffmpeg.yml');
    const garde = cacheDe(etapeDe(remplissage, 'Garder les paquets de ffmpeg'));
    const ubuntu = ubuntuDe(action);
    expect(ubuntu).toMatch(/^\d{2}\.\d{2}$/);
    expect(ubuntuDe(remplissage)).toBe(ubuntu);
    expect(cacheDe(reprise)).toEqual({ dossier: garde.dossier, cle: `paquets-ffmpeg-ubuntu-${ubuntu}`, prefixe: `paquets-ffmpeg-ubuntu-${ubuntu}-` });
    expect(garde.prefixe).toBe(cacheDe(reprise).prefixe);
    expect(action.indexOf('- name: Reprendre les paquets de ffmpeg')).toBeLessThan(action.indexOf('- name: Installer ffmpeg'));
    // apt lit les paquets dans le dossier du cache, et ne télécharge que ceux qui y manquent.
    expect(etapeDe(action, 'Installer ffmpeg')).toContain(`-o Dir::Cache::Archives="$HOME/${cacheDe(reprise).dossier}" ffmpeg`);
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

test.describe('« Cache de ffmpeg » : les paquets de ffmpeg gardés dans le cache de GitHub', () => {
  const action = lireLAction('cache-ffmpeg.yml');
  const sansCommentaires = action.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

  test('quand elle tourne : sur main quand une des deux Actions change (le cache de main, seul lisible par toutes les branches), chaque lundi, ou à la main', () => {
    expect(sansCommentaires.split('\non:\n')[1].split('\n\n')[0]).toBe([
      '  push:', '    branches: [main]', '    paths:', '      - .github/workflows/cache-ffmpeg.yml', '      - .github/workflows/verifications.yml',
      '  schedule:', "    - cron: '41 4 * * 1'", '  workflow_dispatch:',
    ].join('\n'));
    expect(sansCommentaires).not.toMatch(/pull_request|workflow_run/);
  });

  test('ce qu’elle peut : lire le dépôt, rien d’autre ; aucun secret, aucun jeton ; une seule action, le cache officiel', () => {
    expect(sansCommentaires).toMatch(/\npermissions:\n  contents: read\n\n/);
    expect(sansCommentaires.match(/permissions:/g)).toHaveLength(1);
    expect(sansCommentaires).not.toMatch(/secrets\.|github\.token|_TOKEN|JETON/);
    // La seule expression : le numéro du passage, pour une clé neuve à chaque passage.
    expect(sansCommentaires.split('${{').length - 1).toBe(1);
    expect([...sansCommentaires.matchAll(/\$\{\{([^}]*)\}\}/g)].map((m) => m[1].trim())).toEqual(['github.run_id']);
    expect(actionsDe(action)).toEqual(['actions/cache@v6']);
  });

  test('ce qu’elle fait : refaire le cache à partir du plus récent, télécharger ffmpeg sans l’installer, retirer ce qu’on ne peut plus télécharger, et laisser des paquets lisibles', () => {
    const travaux = sansCommentaires.split('\njobs:\n')[1];
    expect([...travaux.matchAll(/^ {2}[a-z-]+:$/gm)].map((m) => m[0].trim())).toEqual(['remplir:']);
    expect(travaux).toContain('    runs-on: ubuntu-24.04\n    timeout-minutes: 45\n');
    expect(cacheDe(etapeDe(action, 'Garder les paquets de ffmpeg'))).toEqual({
      dossier: 'paquets-ffmpeg', cle: 'paquets-ffmpeg-ubuntu-24.04-${{ github.run_id }}', prefixe: 'paquets-ffmpeg-ubuntu-24.04-',
    });
    // À chaque passage, sans condition : le cache repris ne garde que des paquets encore téléchargeables.
    expect(etapeDe(action, 'Télécharger les paquets de ffmpeg')).not.toMatch(/^ {8}if:/m);
    expect(etapeDe(action, 'Télécharger les paquets de ffmpeg')).toMatch(/^ {8}run: \|\n/);
    expect(scriptDeLEtape(action, 'Télécharger les paquets de ffmpeg')).toBe([
      'mkdir -p ~/paquets-ffmpeg/partial',
      'sudo apt-get update',
      'sudo apt-get install -y --no-install-recommends --download-only -o Dir::Cache::Archives="$HOME/paquets-ffmpeg" ffmpeg',
      'sudo apt-get autoclean -o Dir::Cache::Archives="$HOME/paquets-ffmpeg"',
      'sudo rm -rf ~/paquets-ffmpeg/partial ~/paquets-ffmpeg/lock',
      'sudo chown -R "$USER" ~/paquets-ffmpeg',
      '',
    ].join('\n'));
  });
});
