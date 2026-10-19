// Un site d’exemple pour mesurer les pages générées comme les autres : une copie des fichiers servis du dépôt (pages,
// styles, scripts, police, images ; ni les tests, ni le générateur, ni le film, ni les pages déjà générées), puis le
// scénario inventé (tests/donnees/scenario.json) construit par-dessus, à l’heure du vendredi 23 octobre 2026.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chargerLeContenu } from '../../generateur/contenu.mjs';
import { construire } from '../../generateur/construire.mjs';
import { appliquerLaMesure } from '../../generateur/mesure.mjs';
import { racine } from './environnement.mjs';

export const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
export const MAINTENANT_DU_SCENARIO = Date.parse('2026-10-23T08:00:00Z');
// Les bars du scénario qui ont « accepté » d’être publiés (generateur/bars-publies.json est vide aujourd’hui) : les
// vrais bars inventés, et aussi le bar de démo et un bar d’essai, pour montrer qu’être dans la liste ne les publie pas.
export const PUBLIES_DU_SCENARIO = ['b-zinc', 'b-comptoir', 'b-gones', 'b-coin', 'b-rennes', 'b-t1', 'b-demo', 'b-x7'];
export const contenuDuScenario = (racineDuSite = racine) => ({ ...chargerLeContenu(racineDuSite), publies: PUBLIES_DU_SCENARIO });

// Les fichiers du dépôt que le site sert à ses visiteurs, et dont les pages ont besoin (les images du badge et de la
// presse comprises : « Pour les bars » et « Presse » les montrent).
const SERVI = /^(?:[^/]+\.(?:html|css|js|svg|ico|png|txt|xml|webp)|marque\.json|(?:fonts|img|badge|presse|\.well-known)\/.+)$/;
const ECARTE = /^(?:matchs|regarder-le-match|bar|ce-soir|en|tests|generateur|node_modules)\//;

// options : une autre source et une autre heure (la capture enregistrée, tests/donnees/capture), un autre contenu,
// ou rendu: null pour se passer des images de partage.
// marque : une autre carte d’identité que marque.json (la mesure d’audience active, par exemple) : écrite dans le site
// d’exemple, ses pages écrites à la main réécrites comme l’Action le ferait (generateur/mesure.mjs), et les pages
// générées construites avec elle.
export const CAPTURE = path.join(racine, 'tests', 'donnees', 'capture');
export const MAINTENANT_DE_LA_CAPTURE = Date.parse('2026-10-15T19:44:29Z');
export const construireLeSiteDExemple = async (dossier, {
  source = `scenario:${SCENARIO}`, maintenant = MAINTENANT_DU_SCENARIO, contenu = contenuDuScenario(), marque, ...options
} = {}) => {
  rmSync(dossier, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });
  const fichiers = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: racine, encoding: 'utf8' })
    .split('\0').filter((f) => f && SERVI.test(f) && !ECARTE.test(f));
  for (const fichier of fichiers) {
    mkdirSync(path.dirname(path.join(dossier, fichier)), { recursive: true });
    copyFileSync(path.join(racine, fichier), path.join(dossier, fichier));
  }
  if (marque) {
    writeFileSync(path.join(dossier, 'marque.json'), `${JSON.stringify(marque, null, 2)}\n`);
    appliquerLaMesure({ racine: dossier, marque });
  }
  return construire({ source, sortie: dossier, maintenant, racine, contenu: { ...contenu, ...(marque ? { marque } : {}) }, ...options });
};
