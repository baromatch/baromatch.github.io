// Le bloc « Partager » des pages des matchs, des villes et des bars (écrit par le générateur). Sans ce fichier, il
// propose « Envoyer sur WhatsApp » et l’adresse de la page en lien. Avec lui : le bouton « Partager » du téléphone
// (navigator.share) quand il existe ; sinon WhatsApp et « Copier le lien », avec une réponse lue par les lecteurs
// d’écran. L’adresse partagée est l’adresse canonique de la page, telle quelle, sans aucun paramètre ; rien n’est
// envoyé ailleurs, rien n’est gardé.
(() => {
  const bloc = document.querySelector('.partage');
  if (!bloc) return;
  // Les boutons ont leur place dès la première image (regarder.css) : ce script ne fait que les montrer. L’adresse en
  // lien, elle, n’a de place que s’il la montre.
  bloc.dataset.pret = '';
  const { titre, adresse, copie, echec } = bloc.dataset;
  const natif = bloc.querySelector('.partage__natif');
  const whatsapp = bloc.querySelector('.partage__whatsapp');
  const copier = bloc.querySelector('.partage__copier');
  const lien = bloc.querySelector('.partage__lien');
  const statut = bloc.querySelector('.partage__statut');
  const dire = (texte) => { statut.textContent = texte; };

  // Sans le bouton du téléphone : WhatsApp, et « Copier le lien » quand le navigateur sait copier.
  const sansLeBoutonDuTelephone = () => {
    natif.hidden = true;
    whatsapp.hidden = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      copier.hidden = false;
      lien.hidden = true;
    } else {
      lien.hidden = false;
    }
  };

  copier.addEventListener('click', async () => {
    dire('');
    try {
      await navigator.clipboard.writeText(adresse);
      dire(copie);
    } catch {
      // Le navigateur refuse (permission, page en arrière-plan) : le lien revient, à copier à la main.
      lien.hidden = false;
      dire(echec);
    }
  });

  if (typeof navigator.share !== 'function') {
    sansLeBoutonDuTelephone();
    return;
  }
  natif.hidden = false;
  whatsapp.hidden = true;
  lien.hidden = true;
  natif.addEventListener('click', async () => {
    try {
      await navigator.share({ title: titre, url: adresse });
    } catch (erreur) {
      // Fermé sans partager : rien à dire. Refusé par le navigateur : les autres façons de partager.
      if (!erreur || erreur.name !== 'AbortError') sansLeBoutonDuTelephone();
    }
  });
})();
