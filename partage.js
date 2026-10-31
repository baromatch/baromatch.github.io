// Le bloc « Partager » des pages des matchs, des villes et des bars (écrit par le générateur), toujours sur deux rangées,
// de la même hauteur avant et après ce fichier (rien ne bouge en dessous quand il arrive après le premier affichage) :
// - la première : le bouton « Partager » du téléphone (navigator.share) quand il existe, sinon « Envoyer sur
//   WhatsApp » (sans ce fichier aussi) ;
// - la seconde : « Copier le lien » quand le navigateur sait copier, sinon l’adresse de la page en lien (sans ce
//   fichier aussi) ; une copie refusée ramène le lien, et la réponse est lue par les lecteurs d’écran.
// L’adresse partagée est l’adresse canonique de la page, telle quelle, sans aucun paramètre ; rien n’est envoyé
// ailleurs, rien n’est gardé.
(() => {
  const bloc = document.querySelector('.partage');
  if (!bloc) return;
  const { titre, adresse, copie, echec } = bloc.dataset;
  const natif = bloc.querySelector('.partage__natif');
  const whatsapp = bloc.querySelector('.partage__whatsapp');
  const copier = bloc.querySelector('.partage__copier');
  const lien = bloc.querySelector('.partage__lien');
  const statut = bloc.querySelector('.partage__statut');
  const dire = (texte) => { statut.textContent = texte; };

  // La seconde rangée : « Copier le lien » quand le navigateur sait copier, sinon le lien.
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    copier.hidden = false;
    lien.hidden = true;
  }

  // La première rangée, sans le bouton du téléphone : WhatsApp.
  const sansLeBoutonDuTelephone = () => {
    natif.hidden = true;
    whatsapp.hidden = false;
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
  natif.addEventListener('click', async () => {
    try {
      await navigator.share({ title: titre, url: adresse });
    } catch (erreur) {
      // Fermé sans partager : rien à dire. Refusé par le navigateur : WhatsApp à sa place.
      if (!erreur || erreur.name !== 'AbortError') sansLeBoutonDuTelephone();
    }
  });
})();
