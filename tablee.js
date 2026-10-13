/* Baromatch — la page d’un lien de tablée : https://baromatch.fr/t/‹code›
   GitHub Pages n’a pas de routes : toutes les adresses inconnues reçoivent 404.html, dont le script de tête marque la
   page « est-tablee » quand l’adresse commence par /t/ (et, depuis www ou http, renvoie d’abord vers
   https://baromatch.fr, même chemin : la page est alors marquée « data-renvoi » et ce script ne demande rien).
   Ce script lit alors le code, demande l’invitation publique à l’API Baromatch (GET /api/tablee/‹code›, que le serveur
   ne permet que depuis l’origine exacte https://baromatch.fr) et l’affiche.
   Sur Android avec l’appli, le lien s’ouvre dans l’appli et cette page n’apparaît pas : qui la voit n’a pas l’appli.
   Elle lui dit donc ce qu’est une tablée, l’invitation, qu’il peut venir sans l’appli, puis où en est l’appli.

   Les états : en attente, ouverte, pleine, fermée (lien inconnu ou invitation terminée) et panne (serveur injoignable,
   muet au-delà de DELAI_MS, ou réponse incomplète : « Réessayer »). */

(function () {
  if (!document.documentElement.classList.contains("est-tablee")) return;
  if (document.documentElement.hasAttribute("data-renvoi")) return;

  // L’adresse publique de l’API, avec /api à la fin : la même que celle de l’appli, et le même hôte que connect-src
  // dans la politique de sécurité de 404.html (sans lui, le navigateur bloque la demande) : change-les ensemble.
  // Vide, la page ne montre pas le détail de l’invitation et dit de demander le bar et l’heure.
  var API = "https://api-production-8ce4.up.railway.app/api";
  // Le code d’une tablée : douze caractères, sans lettres ni chiffres qui se ressemblent.
  var CODE = /^[abcdefghjkmnpqrstuvwxyz2345678]{12}$/;
  var DELAI_MS = 8000;
  // Dès cette heure (de Paris), un match du jour se dit « Ce soir » plutôt que « Aujourd’hui ».
  var HEURE_DU_SOIR = 18;
  var CARTE = "https://www.google.com/maps/search/?api=1&query=";

  var titre = document.getElementById("tablee-titre");
  var etat = document.getElementById("tablee-etat");
  var definition = document.getElementById("tablee-definition");
  var reessayer = document.getElementById("tablee-reessayer");
  var carte = document.getElementById("tablee-carte");
  var venir = document.getElementById("tablee-venir");
  var venirTexte = document.getElementById("tablee-venir-texte");
  var appli = document.getElementById("tablee-appli");
  var appliDetail = document.getElementById("tablee-appli-detail");

  // Ce que chaque état montre. Un lien mort : le titre, la phrase d’état et « Me prévenir au lancement ». Une panne :
  // les mêmes, plus la définition d’une tablée et « Réessayer ». Ni l’un ni l’autre ne dit rien sur l’appli ni sur la
  // façon de venir. En attente, le bloc de l’appli (visible dans le HTML, pour qui n’a pas ce script) sort de la page :
  // rien n’est dessous dans le premier écran (styles.css garde le pied de page plus bas), il ne pousse donc rien en
  // partant, et revient sous la carte comme un bloc neuf, sans rien déplacer de ce qu’on voyait. L’état est aussi posé
  // sur la page (data-tablee) : styles.css ne garde la ligne de la phrase d’état que tant que ce script n’a pas tourné.
  // Le titre de l’onglet dit la même chose que celui de la page, sans son point (WCAG 2.4.2) : « Ce lien ne mène à aucune
  // tablée — Baromatch », « La table est pleine — Baromatch »… Sauf l’invitation ouverte : « Une tablée t’attend —
  // Baromatch », sans le pseudo de l’hôte, qui n’a rien à faire dans l’onglet ni dans l’historique du navigateur.
  function aller(nom, texteTitre, texteEtat) {
    var vivante = nom === "ouverte" || nom === "pleine";
    document.documentElement.setAttribute("data-tablee", nom);
    titre.textContent = texteTitre;
    document.title = (nom === "ouverte" ? "Une tablée t’attend" : texteTitre.replace(/\.$/, "")) + " — Baromatch";
    etat.textContent = texteEtat || "";
    definition.hidden = nom === "fermee";
    reessayer.hidden = !(nom === "panne" && typeof fetch === "function" && API);
    carte.hidden = !vivante;
    venir.hidden = nom !== "ouverte";
    appli.hidden = nom === "attente";
    appliDetail.hidden = !vivante;
  }

  function attendre() {
    aller("attente", "Une tablée t’attend.", "On regarde l’invitation…");
  }

  function inconnu() {
    aller("fermee", "Ce lien ne mène à aucune tablée.", "Il a peut-être changé : demande le nouveau lien à la personne qui t’invite.");
  }

  function termine() {
    aller("fermee", "Cette invitation est terminée.", "Le match a commencé, ou la tablée n’existe plus.");
  }

  function indisponible() {
    aller("panne", "Une tablée t’attend.", "L’invitation ne s’affiche pas pour l’instant. Réessaie dans un moment, ou demande le bar et l’heure à la personne qui t’invite.");
  }

  function lireCode() {
    var trouve = location.pathname.match(/^\/t\/([^\/]*)/);
    if (!trouve) return null;
    var brut;
    try { brut = decodeURIComponent(trouve[1]); } catch (e) { return null; }
    var code = brut.trim().toLowerCase();
    return CODE.test(code) ? code : null;
  }

  function texte(valeur) {
    return typeof valeur === "string" ? valeur.trim() : "";
  }

  // ---------- Les dates, à l’heure de Paris ----------

  var PARIS = "Europe/Paris";
  var jour = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, weekday: "long", day: "numeric", month: "long" });
  var jourCourt = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit" });
  var heureMinute = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  function date(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // « 21 h », « 20 h 30 » : l’heure à la française, insécable.
  function heures(d) {
    var morceaux = heureMinute.format(d).match(/(\d+)\D+(\d+)/);
    if (!morceaux) return heureMinute.format(d);
    var h = Number(morceaux[1]);
    return h + " h" + (morceaux[2] === "00" ? "" : " " + morceaux[2]);
  }

  // La date du calendrier de Paris, en nombres : [année, mois, jour].
  function dateAParis(d) {
    var morceaux = jourCourt.format(d).match(/\d+/g); // « 13/10/2026 »
    return [Number(morceaux[2]), Number(morceaux[1]), Number(morceaux[0])];
  }

  // Le même jour du calendrier, et le lendemain, comparés comme des dates (pas « maintenant + 24 h », qui se trompe
  // la veille d’un changement d’heure).
  function memeJour(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  function lendemain(jourParis) {
    var d = new Date(Date.UTC(jourParis[0], jourParis[1] - 1, jourParis[2] + 1));
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  }

  // « Ce soir » (le jour même, à partir de HEURE_DU_SOIR), « Aujourd’hui », « Demain », sinon « Samedi 17 octobre ».
  function quand(coup) {
    var aujourdhui = dateAParis(new Date());
    var jourDuMatch = dateAParis(coup);
    if (memeJour(jourDuMatch, aujourdhui)) {
      return Number(heureMinute.format(coup).match(/\d+/)[0]) >= HEURE_DU_SOIR ? "Ce soir" : "Aujourd’hui";
    }
    if (memeJour(jourDuMatch, lendemain(aujourdhui))) return "Demain";
    var jourLong = jour.format(coup);
    return jourLong.charAt(0).toUpperCase() + jourLong.slice(1);
  }

  // ---------- L’invitation ----------

  // Le nom du match tel que le serveur le présente : son titre ; à défaut, les deux équipes (homeTeam, awayTeam) ; à
  // défaut, le nom des deux clubs (homeClub.canonicalName).
  function nomDuMatch(match) {
    if (!match || typeof match !== "object") return "";
    var titreMatch = texte(match.title);
    if (titreMatch) return titreMatch;
    var dom = texte(match.homeTeam) || (match.homeClub && texte(match.homeClub.canonicalName));
    var ext = texte(match.awayTeam) || (match.awayClub && texte(match.awayClub.canonicalName));
    return dom && ext ? dom + " – " + ext : "";
  }

  // Une valeur et, dessous, une précision plus discrète. Jamais d’innerHTML : tout vient du serveur.
  function remplir(id, principal, detail) {
    var dd = document.getElementById(id);
    dd.textContent = principal;
    if (detail) {
      var span = document.createElement("span");
      span.textContent = detail;
      dd.appendChild(span);
    }
    return dd;
  }

  function lienVersLaCarte(nomBar, adresse) {
    var lien = document.createElement("a");
    lien.className = "tablee__plan";
    lien.href = CARTE + encodeURIComponent(nomBar + ", " + adresse);
    lien.rel = "noopener";
    lien.textContent = "Voir sur la carte";
    return lien;
  }

  function remplirLaCarte(invitation, nomBar, match, coup) {
    var adresse = texte(invitation.bar.address);
    var arrivee = invitation.arrivalTime ? date(invitation.arrivalTime) : null;
    var ddBar = remplir("tablee-bar", nomBar, adresse);
    if (adresse) ddBar.appendChild(lienVersLaCarte(nomBar, adresse));
    remplir("tablee-match", match);
    remplir("tablee-heure", quand(coup) + ", coup d’envoi à " + heures(coup), arrivee ? "Arrivée prévue à " + heures(arrivee) : "");
  }

  function afficher(invitation) {
    var bar = invitation && invitation.bar;
    var nomBar = bar && texte(bar.name);
    var match = nomDuMatch(invitation && invitation.match);
    var coup = date(invitation && invitation.kickoffAt);
    if (!nomBar || !match || !coup) return indisponible();

    remplirLaCarte(invitation, nomBar, match, coup);
    var hote = invitation.host && texte(invitation.host.pseudo);
    var qui = hote || "la personne qui t’invite";
    var libres = typeof invitation.open === "number" ? invitation.open : null;
    if (invitation.full || libres === 0) {
      return aller("pleine", "La table est pleine.", "Le bar a peut-être encore de la place : demande à " + qui + ".");
    }
    var table = hote ? "sa table" : "la table";
    venirTexte.textContent = "Tu peux venir quand même : arrive avec " + qui + ". À l’entrée, son pass compte aussi pour toi.";
    aller("ouverte", hote ? hote + " t’a gardé une place." : "Une place t’attend.",
      libres === 1 ? "Il reste 1 place à " + table + "." : libres ? "Il reste " + libres + " places à " + table + "." : "");
  }

  // GET /api/tablee/‹code› répond lui-même « Cache-Control: no-store » : pas besoin de le redemander ici (un mode de
  // cache ajouterait des en-têtes que la règle CORS du serveur refuse). La demande se règle une seule fois : à la
  // réponse, ou au bout de DELAI_MS, même sans AbortController (le minuteur conclut seul). Une erreur du script en
  // affichant laisse la panne à l’écran (jamais « On regarde l’invitation… » sans fin) et reste visible en console.
  function charger(code) {
    if (!API || typeof fetch !== "function") return indisponible();
    var regle = false;
    var controle = typeof AbortController === "function" ? new AbortController() : null;
    var minuteur = setTimeout(function () {
      if (controle) controle.abort();
      une(indisponible)();
    }, DELAI_MS);
    function une(suite) {
      return function (valeur) {
        if (regle) return;
        regle = true;
        clearTimeout(minuteur);
        try {
          suite(valeur);
        } catch (erreur) {
          indisponible();
          throw erreur;
        }
      };
    }

    fetch(API.replace(/\/+$/, "") + "/tablee/" + encodeURIComponent(code), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controle ? controle.signal : undefined
    }).then(function (reponse) {
      if (reponse.status === 404) return une(inconnu)();
      if (reponse.status === 410) return une(termine)();
      if (!reponse.ok) return une(indisponible)();
      return reponse.json().then(une(afficher), une(indisponible));
    }, une(indisponible));
  }

  var code = lireCode();
  if (!code) return inconnu();
  // Sans ce script, la page montre le titre, la définition et l’appli : elle ne dit pas qu’elle cherche l’invitation.
  attendre();

  reessayer.addEventListener("click", function () {
    attendre();
    titre.focus();
    charger(code);
  });

  charger(code);
})();
