// L’horloge simulée de la page, arrêtée à un instant donné, avant la navigation : seuls runFor et fastForward la font
// avancer ensuite. Elle s’installe une minute avant cet instant, puis s’arrête dessus. Installée une seconde avant
// seulement, elle avançait en temps réel sur la page vide d’avant la navigation : sur une machine chargée, plus d’une
// seconde passait entre install et pauseAt, et pauseAt échouait (« Cannot fast-forward to the past »). La page vide
// n’a aucun minuteur : cette minute d’avance ne déclenche rien, et la page ouverte ensuite part bien de l’instant donné.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './environnement.mjs';

const MARGE_MS = 60_000;

export const arreterLHorloge = async (page, instant) => {
  await page.clock.install({ time: instant - MARGE_MS });
  await page.clock.pauseAt(instant);
};

// Le jour du bloc « Les matchs de la semaine » enregistré dans index.html (data-aujourdhui), que le générateur réécrit
// à chaque passage. Un test qui lit l’accueil tel qu’il est se place ce jour-là (11 h UTC), avant d’ouvrir la page :
// lue plus tard, main.js efface les jours passés, puis, une semaine après, la barre et ses cartes ; le test ne lirait
// plus ce qu’il vise, et tomberait seul un jour, sans que rien n’ait changé. Les minuteurs tournent comme d’habitude
// (setFixedTime). Un accueil sans semaine (aucun match annoncé) n’a pas de jour : l’horloge reste.
export const JOUR_DE_L_ACCUEIL = readFileSync(path.join(racine, 'index.html'), 'utf8').match(/data-aujourdhui="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null;
export const auJourDeLAccueil = async (page) => {
  if (JOUR_DE_L_ACCUEIL) await page.clock.setFixedTime(new Date(`${JOUR_DE_L_ACCUEIL}T11:00:00Z`));
};
