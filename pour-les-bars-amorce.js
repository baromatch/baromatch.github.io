/* Baromatch — « Pour les bars » : ce qui part tout de suite, et ce qui attend le premier écran.

   Le premier écran (l’ouverture) n’attend que le HTML, styles.css et la police : ses règles sont dans le <style> de la
   page. Le reste, pour-les-bars.css (ce qu’on ne voit qu’en descendant) et le script du formulaire,
   pour-les-bars.js, ne sont demandés qu’une fois ce premier écran affiché : sur un téléphone en 4G lente, ils ne
   prennent plus la bande passante de la police et de la page, et la phrase d’ouverture s’affiche plus tôt. La feuille
   et le script partent ensemble, et le script n’attend pas la feuille : le formulaire au repos a toutes ses règles
   dans le style de la page (sa grille, ses marges, le bord de ses champs), il s’affiche donc tel quel.

   Arrivé sur une ancre (#proposer depuis une affiche, ou un lien partagé), on n’attend pas le premier affichage : la
   feuille et le script partent aussitôt. Un navigateur qui ne dit pas quand il affiche (sans PerformanceObserver
   « paint », ou qui le refuse) fait pareil ; s’il le promet sans jamais le dire, la suite part au bout de
   SANS_AFFICHAGE_MS.

   Le formulaire prend sa place tout de suite, invisible (l’attribut data-attente, que le style de la page rend
   invisible ; pour-les-bars.js le retire en l’affichant), et le chemin e-mail de secours (#demande-secours, visible
   dans le HTML) s’efface : quand le script affiche le formulaire, rien ne bouge autour. Si le formulaire n’est pas
   là ATTENTE_MS après (le script n’arrive pas, s’arrête sur une erreur, ou n’a même pas été demandé), sa place est
   rendue et le chemin e-mail revient en haut de la carte ; un script arrivé en retard affiche quand même le
   formulaire, et efface le secours. Sans JavaScript, le <noscript> de la tête charge la feuille, le formulaire reste
   caché et le secours reste là ; si ce script-ci ne se charge pas, de même.

   Ce que pour-les-bars.html doit avoir : ce script en defer, seul ; pour-les-bars.css dans un <noscript> de la tête,
   nulle part ailleurs (tests/pour-les-bars.spec.mjs le vérifie). */

(function () {
  "use strict";

  // Le serveur refuse toute autre origine que celle-ci (403 ORIGINE_REFUSEE, et le navigateur bloque la réponse) :
  // une adresse du site en www ou en http renvoie ici, même chemin, avant que rien ne soit tapé. Ailleurs (le
  // serveur local des tests), rien ne change.
  var ORIGINE = "https://baromatch.fr";
  // Sans le point final d’un nom de domaine absolu (« baromatch.fr. »), qui sinon échapperait au renvoi.
  var hote = window.location.hostname.replace(/\.$/, "").toLowerCase();
  if ((hote === "baromatch.fr" || /\.baromatch\.fr$/.test(hote)) && window.location.origin !== ORIGINE) {
    window.location.replace(ORIGINE + window.location.pathname + window.location.search + window.location.hash);
    return;
  }

  var FEUILLE = "/pour-les-bars.css";
  var SCRIPT = "/pour-les-bars.js";
  // Le formulaire s’affiche en 3 s environ sur une 4G lente (2,95 s mesurés) : au-delà de 12 s après que l’amorce lui a
  // pris sa place, on ne fait plus attendre une carte vide.
  var ATTENTE_MS = 12000;
  // Le premier affichage arrive bien avant sur la page normale : ce délai ne joue que s’il n’est jamais signalé.
  var SANS_AFFICHAGE_MS = 3000;
  var demandee = false;

  var formulaire = document.getElementById("demande");
  var secours = document.getElementById("demande-secours");

  // Le formulaire n’est pas venu : sa place revient au chemin e-mail. Rien à faire s’il est déjà affiché.
  function rendreLaPlace() {
    if (!formulaire || !formulaire.hasAttribute("data-attente")) return;
    formulaire.hidden = true;
    formulaire.removeAttribute("data-attente");
    if (secours) secours.hidden = false;
  }

  if (formulaire) {
    formulaire.setAttribute("data-attente", "");
    formulaire.hidden = false;
    if (secours) secours.hidden = true;
    window.setTimeout(rendreLaPlace, ATTENTE_MS);
  }

  function chargerLaSuite() {
    if (demandee) return;
    demandee = true;
    var feuille = document.createElement("link");
    feuille.rel = "stylesheet";
    feuille.href = FEUILLE;
    document.head.appendChild(feuille);
    // « load » vient après l’exécution du script : si le formulaire est encore invisible, le script s’est arrêté.
    var script = document.createElement("script");
    script.src = SCRIPT;
    script.addEventListener("error", rendreLaPlace);
    script.addEventListener("load", rendreLaPlace);
    document.body.appendChild(script);
  }

  if (window.location.hash) return chargerLaSuite();

  var Observateur = window.PerformanceObserver;
  var types = Observateur && Observateur.supportedEntryTypes;
  if (!types || types.indexOf("paint") === -1) return chargerLaSuite();

  window.setTimeout(chargerLaSuite, SANS_AFFICHAGE_MS);
  try {
    var observateur = new Observateur(function (liste) {
      if (!liste.getEntriesByName("first-contentful-paint").length) return;
      observateur.disconnect();
      chargerLaSuite();
    });
    observateur.observe({ type: "paint", buffered: true });
  } catch (erreur) {
    chargerLaSuite();
  }
})();
