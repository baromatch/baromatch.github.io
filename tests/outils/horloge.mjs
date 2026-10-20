// L’horloge simulée de la page, arrêtée à un instant donné, avant la navigation : seuls runFor et fastForward la font
// avancer ensuite. Elle s’installe une minute avant cet instant, puis s’arrête dessus. Installée une seconde avant
// seulement, elle avançait en temps réel sur la page vide d’avant la navigation : sur une machine chargée, plus d’une
// seconde passait entre install et pauseAt, et pauseAt échouait (« Cannot fast-forward to the past »). La page vide
// n’a aucun minuteur : cette minute d’avance ne déclenche rien, et la page ouverte ensuite part bien de l’instant donné.
const MARGE_MS = 60_000;

export const arreterLHorloge = async (page, instant) => {
  await page.clock.install({ time: instant - MARGE_MS });
  await page.clock.pauseAt(instant);
};
