// Un site d’exemple pour mesurer les pages générées comme les autres : une copie des fichiers servis du dépôt (pages,
// styles, scripts, police, images ; ni les tests, ni le générateur, ni le film, ni les pages déjà générées), puis le
// scénario inventé (tests/donnees/scenario.json) construit par-dessus, à l’heure du vendredi 23 octobre 2026.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { construire } from '../../generateur/construire.mjs';
import { racine } from './environnement.mjs';

export const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
export const MAINTENANT_DU_SCENARIO = Date.parse('2026-10-23T08:00:00Z');

// Les fichiers du dépôt que le site sert à ses visiteurs, et dont les pages générées ont besoin.
const SERVI = /^(?:[^/]+\.(?:html|css|js|svg|ico|png|txt|xml|webp)|marque\.json|(?:fonts|img|\.well-known)\/.+)$/;
const ECARTE = /^(?:matchs|regarder-le-match|bar|tests|generateur|node_modules)\//;

export const construireLeSiteDExemple = async (dossier) => {
  rmSync(dossier, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });
  const fichiers = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: racine, encoding: 'utf8' })
    .split('\0').filter((f) => f && SERVI.test(f) && !ECARTE.test(f));
  for (const fichier of fichiers) {
    mkdirSync(path.dirname(path.join(dossier, fichier)), { recursive: true });
    copyFileSync(path.join(racine, fichier), path.join(dossier, fichier));
  }
  return construire({ source: `scenario:${SCENARIO}`, sortie: dossier, maintenant: MAINTENANT_DU_SCENARIO, racine });
};
