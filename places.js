// Les places de la page « Ce soir » (écrite par le générateur) : chaque phrase qui donne un nombre de places porte
// l’heure où elle cesse d’être vraie (data-jusqua : le passage qui l’a écrite, plus les trois heures de vie de la page)
// et la phrase sans nombre qui la remplace alors (data-sinon). Une page restée en ligne plus longtemps, parce qu’un
// passage n’a pas eu lieu, ne donne donc plus un nombre d’il y a des heures : elle dit que les places sont dans
// l’appli. Une ligne remplace une ligne, rien ne bouge autour. Rien n’est lu ailleurs que dans la page, rien n’est
// envoyé, rien n’est gardé ; sans ce fichier, la page dit sa phrase telle qu’écrite, avec son heure.
(() => {
  for (const phrase of document.querySelectorAll('.regarder-carte__places[data-jusqua][data-sinon]')) {
    const jusqua = Date.parse(phrase.dataset.jusqua);
    if (!Number.isNaN(jusqua) && Date.now() >= jusqua) phrase.textContent = phrase.dataset.sinon;
  }
})();
