// Ce que l’Action « Pages des matchs » fait après avoir envoyé de nouvelles pages sur main.
//   node generateur/publier.mjs pages
//     Demande à GitHub Pages de publier main. Un envoi fait avec le jeton par défaut de l’Action ne lance pas la
//     publication (la documentation de GitHub le dit en toutes lettres, page « GitHub Pages » des Actions) ; la
//     demande, elle, est permise à ce jeton avec « pages: write ». Demandée aussi quand rien n’a été envoyé mais que
//     la dernière publication n’est pas celle du dernier commit de main. Suit ensuite la publication demandée
//     (10 minutes au plus). Lit DEPOT (propriétaire/dépôt), JETON_GITHUB, COMMIT (le dernier commit de main) et
//     ENVOYE (« oui » si ce passage a envoyé des pages) ; écrit « publie=oui » pour l’étape d’IndexNow.
//   node generateur/publier.mjs indexnow <fichier>
//     Envoie à IndexNow (Bing, et les moteurs qui partagent ses envois) les adresses indexables qui ont changé, une
//     par ligne dans le fichier (construire.mjs --changees). Une erreur est dite, mais n’arrête rien : les moteurs
//     liront le plan du site.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOSSIER_GENERATEUR } from './contenu.mjs';

const GITHUB = 'https://api.github.com';
const ATTENTE_MAX_MS = 10 * 60_000;
const PAUSE_MS = 15_000;
const LIMITE_INDEXNOW = 10_000;

export const reglagesIndexNow = () => JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'indexnow.json'), 'utf8'));

// La demande à IndexNow (protocole d’indexnow.org) : l’hôte, la clé, l’adresse du fichier de la clé et les adresses,
// seulement celles du site, 10 000 au plus.
export const requeteIndexNow = (adresses, { cle, hote }) => ({
  host: hote,
  key: cle,
  keyLocation: `https://${hote}/${cle}.txt`,
  urlList: [...new Set(adresses)].filter((a) => a.startsWith(`https://${hote}/`)).slice(0, LIMITE_INDEXNOW),
});

export const prevenirIndexNow = async (adresses, { reglages = reglagesIndexNow(), envoyer = fetch, journal = console.log } = {}) => {
  const corps = requeteIndexNow(adresses, reglages);
  if (corps.urlList.length === 0) {
    journal('IndexNow : aucune adresse indexable n’a changé, rien à envoyer.');
    return 'rien';
  }
  try {
    const reponse = await envoyer(reglages.adresse, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(30_000),
    });
    // 200 : reçu ; 202 : reçu, la clé sera vérifiée ; le reste (400, 403, 422, 429) est dit sans rien arrêter.
    journal(`IndexNow : ${corps.urlList.length} adresses envoyées, réponse ${reponse.status}.`);
    return reponse.ok ? 'envoye' : 'refuse';
  } catch (erreur) {
    journal(`IndexNow : envoi impossible (${erreur.message}). Les moteurs liront le plan du site.`);
    return 'erreur';
  }
};

// La publication de main sur GitHub Pages. commit : le dernier commit de main ; envoye : si ce passage vient d’y
// envoyer des pages. Rien n’a été envoyé et la dernière publication est déjà celle de ce commit : rien à faire
// (« deja »). Sinon (une publication précédente ratée, par exemple), la publication est demandée, puis suivie à
// l’adresse que la demande renvoie (pas « latest », qui peut être l’ancienne) jusqu’à celle de ce commit : « publie »,
// ou « en cours » après 10 minutes. Une publication en erreur est une erreur.
export const publierLesPages = async ({
  depot, jeton, commit, envoye, appeler = fetch, attendre = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms)),
  attenteMax = ATTENTE_MAX_MS, journal = console.log,
}) => {
  if (!depot || !jeton) throw new Error('DEPOT et JETON_GITHUB sont nécessaires pour demander la publication');
  const entetes = { authorization: `Bearer ${jeton}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  const lire = async (adresse) => {
    const reponse = await appeler(adresse, { headers: entetes });
    return reponse.ok ? reponse.json() : null;
  };
  if (!envoye && commit) {
    const derniere = await lire(`${GITHUB}/repos/${depot}/pages/builds/latest`);
    if (derniere?.status === 'built' && derniere.commit === commit) {
      journal('Rien de nouveau : la dernière publication est déjà celle du dernier commit de main.');
      return 'deja';
    }
  }
  const demande = await appeler(`${GITHUB}/repos/${depot}/pages/builds`, { method: 'POST', headers: entetes });
  if (!demande.ok) throw new Error(`GitHub Pages refuse la demande de publication (${demande.status}) : ${await demande.text()}`);
  const { url: suivie } = await demande.json();
  journal('Publication demandée à GitHub Pages.');
  const debut = Date.now();
  let attendu = 0;
  while (Date.now() - debut < attenteMax && attendu < attenteMax) {
    await attendre(PAUSE_MS);
    attendu += PAUSE_MS;
    const publication = await lire(suivie);
    // Une publication d’un autre commit (l’ancienne, si l’adresse suivie est « latest ») ne compte pas.
    if (!publication || (commit && publication.commit !== commit)) continue;
    if (publication.status === 'built') {
      journal('Les pages sont en ligne.');
      return 'publie';
    }
    if (publication.status === 'errored') throw new Error(`La publication a échoué : ${publication.error?.message ?? 'sans détail'}`);
  }
  journal('La publication n’est pas finie après 10 minutes : elle continue sans nous, IndexNow attendra le prochain passage.');
  return 'en cours';
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [commande, fichier] = process.argv.slice(2);
  if (commande === 'pages') {
    try {
      const resultat = await publierLesPages({
        depot: process.env.DEPOT, jeton: process.env.JETON_GITHUB, commit: process.env.COMMIT, envoye: process.env.ENVOYE === 'oui',
      });
      // Pour l’étape suivante de l’Action : IndexNow seulement après une publication réussie.
      if (resultat === 'publie' && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'publie=oui\n');
    } catch (erreur) {
      console.error(erreur.message);
      process.exitCode = 1;
    }
  } else if (commande === 'indexnow') {
    const adresses = fichier && existsSync(fichier) ? readFileSync(fichier, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean) : [];
    await prevenirIndexNow(adresses);
  } else {
    console.error('Usage : node generateur/publier.mjs pages | indexnow <fichier des adresses>');
    process.exitCode = 1;
  }
}
