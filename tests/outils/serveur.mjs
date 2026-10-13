// Sert ce dépôt comme GitHub Pages (commandeServeur, environnement.mjs), et seulement lui : un port déjà pris fait
// échouer le démarrage (un autre serveur, d’un autre dossier, y répondrait à notre place), un serveur qui s’arrête le
// dit avec son code et ce qu’il a écrit, et le serveur n’est prêt que lorsqu’il sert l’index.html de ce dépôt.
// options.commande remplace la commande (tests/outillage.spec.mjs y met un serveur qui s’arrête).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { commandeServeur, racine } from './environnement.mjs';

const ESSAIS = 50;
const PAUSE_MS = 100;

const verifierQueLePortEstLibre = (port) => new Promise((resoudre, rejeter) => {
  const sonde = createServer();
  sonde.once('error', (erreur) => rejeter(erreur.code === 'EADDRINUSE'
    ? new Error(`Le port ${port} est déjà pris : un autre serveur y répond, et c’est lui qu’on mesurerait. Arrête-le ou choisis un autre port.`)
    : erreur));
  sonde.listen(port, '127.0.0.1', () => sonde.close(resoudre));
});

export const demarrerServeur = async (port, cacheSecondes = -1, { commande = commandeServeur(port, cacheSecondes) } = {}) => {
  await verifierQueLePortEstLibre(port);
  const [binaire, ...arguments_] = commande;
  const serveur = spawn(binaire, arguments_, { stdio: ['ignore', 'ignore', 'pipe'] });
  let ecrit = '';
  let arret = null;
  serveur.stderr.on('data', (morceau) => { ecrit += morceau; });
  // « close » plutôt que « exit » : il vient après la fin de ce que le serveur a écrit.
  serveur.once('close', (code, signal) => { arret = `code ${code ?? signal}`; });
  serveur.once('error', (erreur) => { arret = erreur.message; });

  const adresse = `http://127.0.0.1:${port}`;
  const accueil = readFileSync(path.join(racine, 'index.html'), 'utf8');
  let derniereErreur = 'aucune réponse';
  for (let essai = 0; essai < ESSAIS; essai += 1) {
    if (arret) throw new Error(`Le serveur local s’est arrêté (${arret}) : ${ecrit.trim()}`);
    try {
      const reponse = await fetch(`${adresse}/index.html`);
      const texte = await reponse.text();
      if (reponse.ok && texte === accueil) return { adresse, arreter: () => serveur.kill() };
      derniereErreur = reponse.ok ? 'index.html n’est pas celui de ce dépôt' : `index.html répond ${reponse.status}`;
    } catch (erreur) {
      derniereErreur = erreur.cause?.code ?? erreur.message; // le serveur démarre encore
    }
    await new Promise((resoudre) => setTimeout(resoudre, PAUSE_MS));
  }
  serveur.kill();
  throw new Error(`Le serveur local n’a pas démarré sur le port ${port} (${derniereErreur}). ${ecrit.trim()}`);
};
