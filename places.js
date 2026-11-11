// Les places de la page « Ce soir » (écrite par le générateur) : chaque phrase qui donne un nombre de places porte
// l’heure où elle cesse d’être vraie (data-jusqua : le passage qui l’a écrite, plus les trois heures de vie de la page)
// et la phrase sans nombre qui la remplace alors (data-sinon). Une page restée en ligne plus longtemps, parce qu’un
// passage n’a pas eu lieu, ne donne donc plus un nombre d’il y a des heures : elle dit que les places sont dans
// l’appli. Une ligne remplace une ligne, rien ne bouge autour. Rien n’est lu ailleurs que dans la page, rien n’est
// envoyé, rien n’est gardé ; sans ce fichier, la page dit sa phrase telle qu’écrite, avec son heure. Une page restée
// ouverte change à l’heure dite ; une page rouverte par « Précédent » ou revenue au premier plan (onglet retrouvé,
// téléphone déverrouillé : un minuteur peut s’y être tu) est relue.
(() => {
  let attente;
  const relire = () => {
    clearTimeout(attente);
    let prochaine = Infinity;
    for (const phrase of document.querySelectorAll('.regarder-carte__places[data-jusqua][data-sinon]')) {
      const jusqua = Date.parse(phrase.dataset.jusqua);
      if (Number.isNaN(jusqua)) continue;
      if (Date.now() >= jusqua) {
        phrase.textContent = phrase.dataset.sinon;
        phrase.removeAttribute('data-jusqua');
      } else prochaine = Math.min(prochaine, jusqua);
    }
    // Un minuteur n’attend pas plus de 2^31 - 1 ms (24,8 jours) : au-delà, il sonnerait tout de suite, en boucle.
  if (prochaine !== Infinity) attente = setTimeout(relire, Math.min(prochaine - Date.now(), 2 ** 31 - 1));
  };
  relire();
  addEventListener('pageshow', (e) => { if (e.persisted) relire(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) relire(); });
})();
