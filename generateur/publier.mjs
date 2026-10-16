// Ce que l’Action « Pages des matchs » fait après avoir envoyé de nouvelles pages sur main.
//   node generateur/publier.mjs pages
//     Demande à GitHub Pages de publier main. Un envoi fait avec le jeton par défaut de l’Action ne lance pas la
//     publication (la documentation de GitHub le dit en toutes lettres, page « GitHub Pages » des Actions) ; la
//     demande, elle, est permise à ce jeton avec « pages: write ». Attend ensuite
//     la fin de la publication (10 minutes au plus). Lit DEPOT (propriétaire/dépôt) et JETON_GITHUB.
//   node generateur/publier.mjs indexnow <fichier>
//     Envoie à IndexNow (Bing, et les moteurs qui partagent ses envois) les adresses indexables qui ont changé, une
//     par ligne dans le fichier (construire.mjs --changees). Une erreur est dite, mais n’arrête rien : les moteurs
//     liront le plan du site.
import { existsSync, readFileSync } from 'node:fs';
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

const demanderLaPublication = async () => {
  const depot = process.env.DEPOT;
  const jeton = process.env.JETON_GITHUB;
  if (!depot || !jeton) throw new Error('DEPOT et JETON_GITHUB sont nécessaires pour demander la publication');
  const entetes = { authorization: `Bearer ${jeton}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  const demande = await fetch(`${GITHUB}/repos/${depot}/pages/builds`, { method: 'POST', headers: entetes });
  if (!demande.ok) throw new Error(`GitHub Pages refuse la demande de publication (${demande.status}) : ${await demande.text()}`);
  console.log('Publication demandée à GitHub Pages.');
  const debut = Date.now();
  while (Date.now() - debut < ATTENTE_MAX_MS) {
    await new Promise((resoudre) => setTimeout(resoudre, PAUSE_MS));
    const reponse = await fetch(`${GITHUB}/repos/${depot}/pages/builds/latest`, { headers: entetes });
    if (!reponse.ok) continue;
    const { status: etat, error: erreur } = await reponse.json();
    if (etat === 'built') {
      console.log('Les pages sont en ligne.');
      return;
    }
    if (etat === 'errored') throw new Error(`La publication a échoué : ${erreur?.message ?? 'sans détail'}`);
  }
  console.log('La publication n’est pas finie après 10 minutes : elle continue sans nous.');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [commande, fichier] = process.argv.slice(2);
  if (commande === 'pages') {
    try {
      await demanderLaPublication();
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
