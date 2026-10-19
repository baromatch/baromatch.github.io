// Baromatch — la mesure d’audience du site, sans cookie ni identifiant (GoatCounter). Ce fichier n’est chargé que si
// marque.json donne le code d’un compte GoatCounter : generateur/mesure.mjs écrit alors sa balise sur chaque page,
// avec l’adresse du compte dans data-mesure, et la politique de sécurité de la page admet cette adresse.
// Ce qui part, et rien d’autre :
// - pour une page vue, son adresse : celle de son lien canonique, donc sans « ? » ni « # » (la page 404 compte « /404 »,
//   le lien d’une tablée « /t/ », jamais son code), et le site d’où l’on vient, réduit à son nom ;
// - pour un geste, son nom suivi de l’adresse de la page : « appli-android », « appli-iphone » (un lien vers un
//   magasin), « lien-liste-attente » (un lien vers la liste d’attente), « liste-attente » (une inscription envoyée),
//   « proposer-mon-bar » (une demande de bar envoyée), ou le nom écrit dans data-compter sur un élément.
// Ni titre, ni taille d’écran, ni ce qu’on écrit dans un formulaire. La demande part sans cookie ni référent.
// Rien n’est compté hors de https://baromatch.fr (une copie du site, les tests en local), si le navigateur envoie Do
// Not Track ou Global Privacy Control, dans un cadre, ou si la personne a refusé la mesure sur la page Confidentialité :
// c’est le seul cas où quelque chose est gardé, la clé « baromatch:mesure » du stockage local.
(() => {
  const script = document.currentScript;
  const adresse = script ? script.getAttribute('data-mesure') : null;
  if (!adresse || !/^https:\/\/[a-z0-9-]+\.goatcounter\.com\/count$/.test(adresse)) return;
  const SITE = 'https://baromatch.fr';
  const CLE = 'baromatch:mesure';
  const signal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const refusee = () => {
    try {
      return window.localStorage.getItem(CLE) === 'refus';
    } catch {
      return false;
    }
  };

  // Le bouton de la page Confidentialité : refuser la mesure sur ce navigateur, ou l’accepter de nouveau.
  const bloc = document.getElementById('mesure-refus');
  const bouton = document.getElementById('mesure-refus-bouton');
  const statut = document.getElementById('mesure-refus-statut');
  if (bloc && bouton && statut) {
    const textes = bloc.dataset;
    bloc.hidden = false;
    if (signal) {
      bouton.remove();
      statut.textContent = textes.signal;
    } else {
      const libeller = () => { bouton.textContent = refusee() ? textes.accepter : textes.refuser; };
      libeller();
      bouton.addEventListener('click', () => {
        const refuser = !refusee();
        try {
          if (refuser) window.localStorage.setItem(CLE, 'refus');
          else window.localStorage.removeItem(CLE);
        } catch {
          statut.textContent = textes.echec;
          return;
        }
        libeller();
        statut.textContent = refuser ? textes.refuse : textes.accepte;
      });
    }
  }

  if (location.origin !== SITE || signal) return;
  try {
    if (window.top !== window.self) return;
  } catch {
    return;
  }

  // L’adresse de la page : son lien canonique ; sans lui, la page 404 (ou celle d’un lien de tablée).
  const chemin = (() => {
    if (document.documentElement.classList.contains('est-tablee')) return '/t/';
    const canonique = document.querySelector('link[rel="canonical"][href]');
    if (canonique) {
      try {
        const url = new URL(canonique.href);
        if (url.origin === SITE) return url.pathname;
      } catch {
        // Une adresse canonique illisible : la page compte comme une page introuvable.
      }
    }
    return '/404';
  })();

  // Le site d’où l’on vient, réduit à son nom ; rien depuis une page du site.
  const provenance = () => {
    try {
      const url = new URL(document.referrer);
      return url.host && url.origin !== SITE ? `${url.protocol}//${url.host}` : '';
    } catch {
      return '';
    }
  };

  const envoyer = (parametres) => {
    if (refusee() || typeof fetch !== 'function') return;
    const requete = new URLSearchParams(parametres);
    // Un navigateur piloté par un programme (tests, robots) : GoatCounter le compte à part, comme un robot.
    if (navigator.webdriver) requete.set('b', '153');
    fetch(`${adresse}?${requete}`, {
      method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, cache: 'no-store',
    }).catch(() => {});
  };

  const compter = (nom) => {
    if (typeof nom === 'string' && /^[a-z0-9-]{1,40}$/.test(nom)) envoyer({ p: `${nom} ${chemin}`, e: 'true' });
  };

  // Les gestes : un lien vers un magasin ou vers la liste d’attente, un élément marqué data-compter.
  const nomDuGeste = (cible) => {
    const marque = cible.closest('[data-compter]');
    if (marque) return marque.getAttribute('data-compter');
    const lien = cible.closest('a[href]');
    if (!lien) return '';
    let url = null;
    try {
      url = new URL(lien.href);
    } catch {
      return '';
    }
    if (url.host === 'play.google.com') return 'appli-android';
    if (url.host === 'apps.apple.com') return 'appli-iphone';
    if (url.origin === location.origin && url.hash === '#attente') return 'lien-liste-attente';
    return '';
  };
  const surUnGeste = (evenement) => {
    if (evenement.type === 'auxclick' && evenement.button !== 1) return;
    if (evenement.target instanceof Element) compter(nomDuGeste(evenement.target));
  };
  document.addEventListener('click', surUnGeste);
  document.addEventListener('auxclick', surUnGeste);
  // La liste d’attente d’une page de ville part sans script : le navigateur n’envoie l’évènement « submit » qu’une fois
  // l’adresse vérifiée. Celle de l’accueil (novalidate) est envoyée par main.js, qui dit seulement son succès.
  document.addEventListener('submit', (evenement) => {
    const formulaire = evenement.target;
    if (formulaire instanceof HTMLFormElement && formulaire.classList.contains('attente') && !formulaire.noValidate) compter('liste-attente');
  });
  // Un succès dit par un autre script du site (main.js, pour-les-bars.js).
  document.addEventListener('baromatch:compter', (evenement) => compter(evenement.detail));

  // La page vue : une seule fois, quand elle est vraiment montrée (pas pendant un préchargement, pas dans un onglet
  // ouvert en arrière-plan avant qu’on le regarde).
  let comptee = false;
  const compterLaPage = () => {
    if (comptee || document.prerendering || document.visibilityState !== 'visible') return;
    comptee = true;
    const r = provenance();
    envoyer(r ? { p: chemin, r } : { p: chemin });
  };
  document.addEventListener('visibilitychange', compterLaPage);
  document.addEventListener('prerenderingchange', compterLaPage);
  compterLaPage();
})();
