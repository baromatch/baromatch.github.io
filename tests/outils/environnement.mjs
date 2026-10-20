// Ce que les outils de vérification partagent : la racine du dépôt (chaque fichier se lit par rapport à elle, jamais par
// rapport au dossier d’où l’on lance la commande), le Chromium de la machine et la commande du serveur local.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Le Chromium de la machine, sans rien télécharger : CHROME_PATH s’il est donné ; sinon celui déjà installé dans
// /opt/pw-browsers ; sinon celui que Playwright a installé lui-même (npx playwright install chromium : c’est ce que fait
// l’Action des vérifications, .github/workflows/verifications.yml, sur une machine de GitHub).
export const CHROMIUM_INSTALLE = '/opt/pw-browsers/chromium';
export const cheminDeChromium = ({ env = process.env, existe = existsSync, dePlaywright = () => chromium.executablePath() } = {}) => {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  if (existe(CHROMIUM_INSTALLE)) return CHROMIUM_INSTALLE;
  return dePlaywright();
};
export const CHROMIUM = cheminDeChromium();

// Le site servi comme GitHub Pages : les fichiers tels quels, et 404.html pour une adresse inconnue ; seulement sur
// 127.0.0.1 (personne d’autre sur le réseau ne lit le dépôt), sans journal (-s). cacheSecondes : 600 comme GitHub
// Pages (max-age=600) pour les mesures, -1 (aucun cache) pour les tests. Le serveur se lance par Node et son script,
// pas par le raccourci de node_modules/.bin, qui ne se lance pas seul sous Windows : la même commande partout.
// dossier : un autre dossier que ce dépôt (les pages générées d’un scénario, construites à part).
export const commandeServeur = (port, cacheSecondes = -1, dossier = racine) => [
  process.execPath, path.join(racine, 'node_modules', 'http-server', 'bin', 'http-server'), dossier, '-p', String(port), '-a', '127.0.0.1', `-c${cacheSecondes}`, '-s',
];
