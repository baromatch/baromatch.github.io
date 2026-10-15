// Ce que les outils de vérification partagent : la racine du dépôt (chaque fichier se lit par rapport à elle, jamais par
// rapport au dossier d’où l’on lance la commande), le Chromium de la machine et la commande du serveur local.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Le Chromium de la machine (aucun téléchargement) ; CHROME_PATH le remplace ailleurs.
export const CHROMIUM = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

// Le site servi comme GitHub Pages : les fichiers tels quels, et 404.html pour une adresse inconnue ; seulement sur
// 127.0.0.1 (personne d’autre sur le réseau ne lit le dépôt), sans journal (-s). cacheSecondes : 600 comme GitHub
// Pages (max-age=600) pour les mesures, -1 (aucun cache) pour les tests. Le serveur se lance par Node et son script,
// pas par le raccourci de node_modules/.bin, qui ne se lance pas seul sous Windows : la même commande partout.
export const commandeServeur = (port, cacheSecondes = -1) => [
  process.execPath, path.join(racine, 'node_modules', 'http-server', 'bin', 'http-server'), racine, '-p', String(port), '-a', '127.0.0.1', `-c${cacheSecondes}`, '-s',
];
