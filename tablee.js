/* Baromatch — la page d’un lien de tablée : https://baromatch.fr/t/‹code›
   GitHub Pages n’a pas de routes : toutes les adresses inconnues reçoivent 404.html,
   qui marque la page « est-tablee » quand l’adresse commence par /t/.
   Ce script lit alors le code, demande l’invitation publique à l’API Baromatch
   (GET /api/tablee/‹code›, permise depuis https://baromatch.fr) et l’affiche.
   Sur Android avec l’appli, le lien s’ouvre dans l’appli et cette page n’apparaît pas.

   À REMPLIR : l’adresse publique de l’API, avec /api à la fin, la même que
   EXPO_PUBLIC_API_URL dans EAS (par exemple "https://ton-api.exemple/api").
   Tant qu’elle est vide, la page ne montre pas le détail de l’invitation,
   mais dit quand même d’ouvrir le lien avec l’appli. */
var API = "";

(function () {
  if (!document.documentElement.classList.contains("est-tablee")) return;

  // Le code d’une tablée : douze caractères, sans lettres ni chiffres qui se ressemblent.
  var CODE = /^[abcdefghjkmnpqrstuvwxyz2345678]{12}$/;
  var DELAI_MS = 8000;

  var titre = document.getElementById("tablee-titre");
  var etat = document.getElementById("tablee-etat");
  var carte = document.getElementById("tablee-carte");

  document.title = "Une tablée t’attend — Baromatch";

  function dire(texteTitre, texteEtat) {
    titre.textContent = texteTitre;
    etat.textContent = texteEtat || "";
  }

  function inconnu() {
    dire("Ce lien ne mène à aucune tablée.", "Il a peut-être changé : demande le nouveau lien à la personne qui t’invite.");
  }

  function termine() {
    dire("Cette invitation est terminée.", "Le match a commencé, ou la tablée n’existe plus.");
  }

  function indisponible() {
    dire("Une tablée t’attend.", "L’invitation ne s’affiche pas ici pour l’instant. Ouvre ce lien sur ton téléphone avec Baromatch : tout y est.");
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

  var jour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });
  var heure = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

  function date(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function nomDuMatch(match) {
    if (!match || typeof match !== "object") return "";
    var titreMatch = texte(match.title);
    if (titreMatch) return titreMatch;
    var dom = match.homeClub && texte(match.homeClub.name);
    var ext = match.awayClub && texte(match.awayClub.name);
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
  }

  function afficher(invitation) {
    var bar = invitation && invitation.bar;
    var nomBar = bar && texte(bar.name);
    var match = nomDuMatch(invitation && invitation.match);
    var coup = date(invitation && invitation.kickoffAt);
    if (!nomBar || !match || !coup) return indisponible();

    var arrivee = invitation.arrivalTime ? date(invitation.arrivalTime) : null;
    remplir("tablee-bar", nomBar, texte(bar.address));
    remplir("tablee-match", match);
    remplir("tablee-heure",
      jour.format(coup) + ", coup d’envoi à " + heure.format(coup),
      arrivee ? "Arrivée prévue à " + heure.format(arrivee) : "");
    carte.hidden = false;

    var hote = invitation.host && texte(invitation.host.pseudo);
    var libres = typeof invitation.open === "number" ? invitation.open : null;
    if (invitation.full || libres === 0) {
      dire("La table est pleine.", "Il reste peut-être de la place au bar : regarde dans l’appli.");
    } else {
      dire(hote ? hote + " t’a gardé une place." : "Une place t’attend.",
        libres === 1 ? "Il reste 1 place à la tablée." : libres ? "Il reste " + libres + " places à la tablée." : "");
    }
  }

  var code = lireCode();
  if (!code) return inconnu();
  if (!API || typeof fetch !== "function") return indisponible();

  var controle = typeof AbortController === "function" ? new AbortController() : null;
  var minuteur = setTimeout(function () { if (controle) controle.abort(); }, DELAI_MS);

  fetch(API.replace(/\/+$/, "") + "/tablee/" + encodeURIComponent(code), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    cache: "no-store",
    signal: controle ? controle.signal : undefined
  })
    .then(function (reponse) {
      if (reponse.status === 404) return inconnu();
      if (reponse.status === 410) return termine();
      if (!reponse.ok) return indisponible();
      return reponse.json().then(afficher, indisponible);
    })
    .catch(indisponible)
    .then(function () { clearTimeout(minuteur); });
})();
