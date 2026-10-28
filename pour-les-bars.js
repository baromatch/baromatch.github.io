/* Baromatch — le formulaire des bars (« Pour les bars », section #proposer, formulaire #demande).

   La demande part en JSON vers le serveur Baromatch, POST /api/public/bar-contact, sans cookie ni référent. Ses
   champs et leurs limites (CHAMPS), et chacune des réponses que la page sait lire (lireReponse, refus), sont ceux
   du serveur : si l’un change, change l’autre avec lui.

   Le serveur n’accepte que l’origine exacte https://baromatch.fr : ouverte depuis www.baromatch.fr ou en http, la
   page renvoie d’abord vers cette adresse (pour-les-bars-amorce.js, qui demande ensuite pour-les-bars.css et ce
   script en même temps, une fois le premier écran affiché : ce script n’attend pas la feuille). Si le serveur ne
   répond pas (le navigateur voit un échec réseau ; un 404, 405 ou 501 compte de même), ou s’il répond ce que la
   page ne sait pas corriger (403, 5xx après un nouvel essai, 429, REQUETE_INVALIDE), la page propose d’envoyer la
   même demande depuis la messagerie du visiteur, déjà écrite (lireReponse et refus, cas par cas).

   Ce que la page ne fait jamais : écrire à un autre service que le serveur Baromatch ; garder quoi que ce soit
   hors de cet onglet (le brouillon est dans sessionStorage, effacé quand la demande part d’ici ou quand l’onglet
   se ferme ; après un envoi, l’adresse et le nom du bar de la demande partie y restent 10 minutes, rien d’autre) ;
   réessayer d’elle-même plus d’une fois de suite (un seul nouvel essai, 2 s après l’échec de la première
   tentative). Seule exception voulue : hors ligne, la demande repart quand le réseau revient, avec, à son tour, un
   seul nouvel essai.

   Le balisage que ce script attend : les éléments qu’il lit par leur id (demande-…), dont les deux zones de
   message, présentes et vides dès le HTML (tests/pour-les-bars-formulaire.spec.mjs le vérifie). À savoir pour lire
   ce script : le formulaire n’a qu’un état à la fois (`etat`, « Les états du formulaire »), que seul `rendre`
   affiche ; le libellé d’un bouton est dans son élément [data-libelle] ; pour-les-bars-amorce.js garde la place du
   formulaire (l’attribut data-attente) et ce script la lui rend en l’affichant.

   À part, en fin de fichier : ta salle, ce soir (l’ouverture), ici pour ne pas ajouter une requête à la page. */

(function () {
  "use strict";

  var form = document.getElementById("demande");
  if (!form) return;

  // L’adresse publique de l’API Baromatch. Le même hôte est dans connect-src de pour-les-bars.html (sans lui, le
  // navigateur bloque la demande) et dans tablee.js : change-les ensemble.
  var ADRESSE = "https://api-production-8ce4.up.railway.app/api/public/bar-contact";
  var CONTACT = "contact@baromatch.fr";
  var CLE_BROUILLON = "baromatch-demande-bar";
  var CLE_PARTIE = "baromatch-demande-bar-partie"; // la dernière demande partie (correctionPerdue)
  var REMPLISSAGE_MIN_MS = 3000;            // la page attend quelques secondes avant son premier envoi
  var PAGE_MAX_MS = 24 * 60 * 60 * 1000;    // le serveur refuse une page ouverte depuis plus de 24 h
  var DELAI_MS = 10000;                     // sans réponse après 10 s, la demande est abandonnée…
  var NOUVEL_ESSAI_MS = 2000;               // …et renvoyée une seule fois, 2 s plus tard
  var REJEU_MS = 10 * 60 * 1000;            // le temps où le serveur ne garderait pas une correction (correctionPerdue)
  var COPIE_MS = 2000;                      // « Texte copié » le temps de le lire
  var LENT_MS = 4000;                       // 4 s après le départ de la demande, la page dit que le réseau est lent

  // Tout ce que ce script écrit (les chaînes de référence sont ici, et tests/pour-les-bars-formulaire.spec.mjs les
  // reprend ; les limites sont celles du serveur). Sur la page, l’espace avant « : », « ; », « ? », « ! » et « » »,
  // et après « « », est insécable (\u00a0, écrit ainsi pour qu’un éditeur ne l’efface pas) ; dans l’e-mail tout
  // prêt (sujet, objet, lignes), les espaces sont ordinaires : du texte pour une messagerie.
  var TEXTES = {
    envoi: "Envoi…",
    resumeUn: "1 information à corriger",
    resumePlusieurs: "{n} informations à corriger",
    requis: {
      barName: "Écris le nom de ton bar.",
      city: "Écris ta ville.",
      contactName: "Écris ton nom.",
      email: "Écris ton adresse e-mail."
    },
    tropCourt: {
      barName: "Écris au moins {min} caractères pour le nom de ton bar.",
      city: "Écris au moins {min} caractères pour ta ville.",
      contactName: "Écris au moins {min} caractères pour ton nom."
    },
    // Les maxlength du HTML empêchent d’en arriver en tapant ; ces phrases couvrent un texte collé ou restauré.
    tropLong: {
      barName: "Raccourcis le nom de ton bar\u00a0: {max} caractères au plus.",
      city: "Raccourcis le nom de ta ville\u00a0: {max} caractères au plus.",
      contactName: "Raccourcis ton nom\u00a0: {max} caractères au plus.",
      email: "Cette adresse e-mail est trop longue\u00a0: {max} caractères au plus.",
      phone: "Raccourcis ton numéro\u00a0: {max} caractères au plus.",
      message: "Raccourcis ton message\u00a0: {max} caractères au plus."
    },
    emailIncomplet: "Cette adresse e-mail n’est pas complète.",
    emailArobase: "Il manque le @ dans ton adresse e-mail.",
    emailFin: "Il manque la fin de ton adresse e-mail, par exemple .fr ou .com.",
    emailCaractere: "Cette adresse e-mail a un caractère qui ne passe pas\u00a0: vérifie les accents, les espaces et les points.",
    // Un émoji composé (une famille, un drapeau régional) hors du message, ou un signe qui porte un nombre : ce qui se
    // voit n’est jamais retiré en silence.
    signe: {
      barName: "Le nom de ton bar a un émoji ou un signe qui ne passe pas chez nous\u00a0: retire-le.",
      city: "Le nom de ta ville a un émoji ou un signe qui ne passe pas chez nous\u00a0: retire-le.",
      contactName: "Ton nom a un émoji ou un signe qui ne passe pas chez nous\u00a0: retire-le.",
      message: "Ton message a un signe qui ne passe pas chez nous\u00a0: retire-le."
    },
    telephone: "Écris ton numéro avec des chiffres, ou laisse ce champ vide.",
    telephoneCourt: "Ton numéro est trop court\u00a0: écris au moins {min} chiffres.",
    accord: "Coche la case pour envoyer ta demande.",
    brouillon: { titre: "Ce que tu avais écrit est là.", texte: "Termine, coche la case, puis envoie ta demande." },
    lent: { titre: "Le réseau est lent.", texte: "Ta demande est toujours en route\u00a0: garde cette page ouverte." },
    horsLigne: {
      titre: "Pas de réseau.",
      texte: "Garde cette page ouverte\u00a0: ta demande part dès que le réseau revient. Tu peux aussi l’envoyer par e-mail, juste en dessous."
    },
    reseauRevenu: { titre: "Le réseau est revenu.", texte: "Ta demande n’est pas partie\u00a0: vérifie-la, puis appuie sur «\u00a0Envoyer ma demande\u00a0»." },
    // L’étape de l’e-mail dit en clair que rien n’est parti, et ce qui reste à faire.
    courriel: {
      titre: "Ta demande n’est pas encore partie.",
      texte: "Appuie sur «\u00a0Ouvrir ma messagerie\u00a0» et envoie le mail préparé\u00a0: tout ce que tu as écrit y est déjà. " +
        "On te répond par e-mail ou par téléphone."
    },
    messagerie: {
      titre: "Ta messagerie s’est ouverte\u00a0?",
      texte: "Envoie le mail, et c’est fait. Ce que tu as écrit reste ici jusqu’à ce que tu fermes l’onglet."
    },
    // Sans stockage dans l’onglet (bloqué, ou absent d’une vue web d’appli), la page ne promet pas que le texte survit.
    messagerieSansBrouillon: { titre: "Ta messagerie s’est ouverte\u00a0?", texte: "Envoie le mail, et c’est fait." },
    // Le wifi d’un bar est partagé : la règle, sans accuser.
    tropDEnvois: {
      titre: "Beaucoup d’envois depuis cette connexion.",
      texte: "On en accepte 5 par heure depuis un même réseau. Envoie ta demande par e-mail, ou réessaie dans une heure."
    },
    // La page vérifie ce que le serveur vérifie (longueurs, formes, caractères) ; un refus vient d’une règle ajoutée au
    // serveur depuis, et il ne dit pas quel champ : rien à corriger ici.
    invalide: {
      titre: "Une information ne passe pas chez nous.",
      texte: "Envoie ta demande par e-mail\u00a0: tout ce que tu as écrit y est déjà."
    },
    expiree: {
      titre: "Cette page est ouverte depuis plus d’un jour.",
      texte: "Recharge-la pour envoyer ta demande\u00a0: ce que tu as écrit reste là."
    },
    expireeSansBrouillon: {
      titre: "Cette page est ouverte depuis plus d’un jour.",
      texte: "Envoie ta demande par e-mail\u00a0: tout ce que tu as écrit y est déjà. Si tu recharges la page, ce que tu as écrit peut s’effacer."
    },
    // Le presse-papiers refusé (une vue web d’appli) ou absent : le visiteur copie lui-même, le texte est sélectionné.
    copieImpossible: {
      titre: "Copie le texte toi-même.",
      texte: "Ton navigateur ne nous laisse pas le copier\u00a0: il est sélectionné, prêt à copier. Colle-le dans un mail à contact@baromatch.fr."
    },
    // Une correction que le serveur ne garderait pas (correctionPerdue) : elle part par l’e-mail.
    correction: {
      titre: "Ta première demande est déjà partie.",
      texte: "Envoie cette correction par e-mail\u00a0: moins de 10\u00a0minutes après la première, avec la même adresse et le même bar, notre serveur ne garde que la première."
    },
    recharger: "Recharger la page",
    copie: "Texte copié",
    sujet: "Demande d’un bar — {bar}",
    objet: "Objet : ",
    lignes: {
      barName: "Bar : ",
      city: "Ville : ",
      contactName: "Nom : ",
      email: "E-mail : ",
      phone: "Téléphone : ",
      message: "Message : "
    }
  };

  // Les icônes des messages et des erreurs, celles de la maquette (24 × 24, au trait).
  var ICONES = {
    erreur: [["circle", { cx: "12", cy: "12", r: "9" }], ["path", { d: "M12 7.5v5.5M12 16.5v.01" }]],
    brouillon: [["path", { d: "M4 20h4L19 9l-4-4L4 16v4Z" }], ["path", { d: "M13.5 6.5l4 4" }]],
    horsLigne: [["path", { d: "M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.8M16.8 11.1A10 10 0 0 1 19 12.9M8.5 16.4a5 5 0 0 1 7 0M12 20h.01" }], ["path", { d: "M2 2l20 20" }]],
    courriel: [["rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }], ["path", { d: "m3 7 9 6 9-6" }]],
    attente: [["circle", { cx: "12", cy: "12", r: "9" }], ["path", { d: "M12 7v5l3 2" }]],
    recharger: [["path", { d: "M21 12a9 9 0 1 1-2.6-6.4L21 8" }], ["path", { d: "M21 3v5h-5" }]]
  };

  // Les champs dans l’ordre de la page, avec les limites du serveur, comptées comme lui : sur le texte nettoyé
  // (nettoyer) puis débarrassé de ses espaces du bout, en unités UTF-16 (String.length).
  var CHAMPS = [
    { nom: "barName", id: "demande-bar", min: 2, max: 80, requis: true },
    { nom: "city", id: "demande-ville", min: 2, max: 60, requis: true },
    { nom: "contactName", id: "demande-nom", min: 2, max: 80, requis: true },
    { nom: "email", id: "demande-email", max: 254, requis: true, forme: "email" },
    { nom: "phone", id: "demande-telephone", max: 20, forme: "telephone" },
    { nom: "message", id: "demande-message", max: 1000, lignes: true }
  ];
  // L’adresse que le serveur accepte, ni plus ni moins : un e-mail que la page laisse passer n’est jamais refusé
  // là-bas. La forme seule (quelque chose @ un domaine . une fin) sépare « pas complète » d’« un caractère ».
  var EMAIL = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+\-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  var FORME_EMAIL = /^[^@]+@[^@]+\.[^@.]{2,}$/;
  var TELEPHONE = /^[0-9+.()\- ]+$/;
  var CHIFFRES_MIN = 6;

  var resume = document.getElementById("demande-resume");
  var resumeTitre = document.getElementById("demande-resume-titre");
  var resumeListe = resume.querySelector("ul");
  var accord = document.getElementById("demande-accord");
  var piege = document.getElementById("demande-piege");
  var bouton = document.getElementById("demande-envoyer");
  var statut = document.getElementById("demande-statut");
  var alerte = document.getElementById("demande-alerte");
  var courriel = document.getElementById("demande-courriel");
  var courrielLien = document.getElementById("demande-courriel-lien");
  var courrielTexte = document.getElementById("demande-courriel-texte");
  var copier = document.getElementById("demande-courriel-copier");
  var modifier = document.getElementById("demande-modifier");
  var secours = document.getElementById("demande-secours");
  var envoyee = document.getElementById("demande-envoyee");
  var envoyeeEmail = document.getElementById("demande-envoyee-email");
  var nouvelle = document.getElementById("demande-nouvelle");
  var texteBouton = lireLibelle(bouton);
  var texteCopier = lireLibelle(copier);

  // Chaque champ de CHAMPS avec ses éléments : le champ, son erreur, ses indices (aria-describedby du HTML).
  function relier(description) {
    var c = {};
    Object.keys(description).forEach(function (cle) { c[cle] = description[cle]; });
    c.champ = document.getElementById(c.id);
    c.erreur = document.getElementById(c.id + "-erreur");
    c.indices = c.champ.getAttribute("aria-describedby") || "";
    return c;
  }
  var champs = CHAMPS.map(relier);
  var premierChamp = champs[0];
  var laCase = relier({ nom: "consent", id: "demande-accord" });
  var verifies = champs.concat([laCase]);

  var derniereDemande = null;
  var derniereReussite = null;
  var minuteurCopie = null;
  var minuteurLent = null;

  // ---------- Outils ----------

  // Un modèle « … {cle} … » rempli sans que la valeur soit interprétée ($& et compagnie).
  function remplir(modele, cle, valeur) {
    return modele.replace(cle, function () { return String(valeur); });
  }

  // « 1 000 » : le nombre écrit en français ; un navigateur sans les données de langue l’écrit tel quel.
  function nombre(n) {
    try { return n.toLocaleString("fr-FR"); } catch (e) { return String(n); }
  }

  function aCle(objet, cle) {
    return Object.prototype.hasOwnProperty.call(objet, cle);
  }

  // Le libellé d’un bouton est dans son élément [data-libelle] : seul lui change, l’icône posée à côté reste.
  function lireLibelle(element) {
    return element.querySelector("[data-libelle]").textContent.trim();
  }

  function ecrireLibelle(element, texte) {
    element.querySelector("[data-libelle]").textContent = texte;
  }

  function icone(nom) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    var attributs = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
      "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" };
    Object.keys(attributs).forEach(function (a) { svg.setAttribute(a, attributs[a]); });
    ICONES[nom].forEach(function (forme) {
      var element = document.createElementNS(ns, forme[0]);
      Object.keys(forme[1]).forEach(function (a) { element.setAttribute(a, forme[1][a]); });
      svg.appendChild(element);
    });
    return svg;
  }

  function paragraphe(classe, texte) {
    var p = document.createElement("p");
    p.className = classe;
    p.textContent = texte;
    return p;
  }

  // Une boîte .message dans une zone annoncée qui existe vide dès le HTML. Jamais d’innerHTML : tout est texte.
  // `message` : { zone, icone, contenu: { titre, texte }, erreur, action: { icone, texte, quand } } ; `bloque` dit que
  // la page ne peut plus envoyer elle-même. Rend le bouton d’action, s’il y en a un.
  function dire(message, bloque) {
    var boite = document.createElement("div");
    boite.className = "message" + (message.erreur ? " message--erreur" : "") + (bloque ? " message--bloque" : "");
    boite.appendChild(icone(message.icone));
    var textes = document.createElement("div");
    textes.appendChild(paragraphe("message__titre", message.contenu.titre));
    textes.appendChild(paragraphe("message__texte", message.contenu.texte));
    boite.appendChild(textes);
    var boutonAction = null;
    if (message.action) {
      var actions = document.createElement("div");
      actions.className = "message__actions";
      boutonAction = document.createElement("button");
      boutonAction.type = "button";
      boutonAction.className = "capsule";
      boutonAction.appendChild(icone(message.action.icone));
      boutonAction.appendChild(document.createTextNode(message.action.texte));
      boutonAction.addEventListener("click", message.action.quand);
      actions.appendChild(boutonAction);
      boite.appendChild(actions);
    }
    message.zone.appendChild(boite);
    return boutonAction;
  }

  // ---------- L’horloge du formulaire ----------
  // Le temps de remplissage envoyé au serveur est mesuré ici, sur l’horloge de la page (performance.now(), monotone ;
  // à défaut Date) : l’heure du serveur n’y entre jamais. Mais cette horloge peut s’arrêter quand l’appareil dort
  // (selon la plateforme) : pour la seule règle des 24 h, l’heure de l’appareil compte aussi, si elle a avancé.

  var horloge = window.performance && typeof window.performance.now === "function" ? window.performance : Date;
  var affiche = 0;
  var afficheMur = 0;

  function remplissageMs() {
    return Math.max(0, Math.round(horloge.now() - affiche));
  }

  function ouverteDepuisMs() {
    var mur = Date.now() - afficheMur;
    return Math.max(remplissageMs(), mur > 0 ? mur : 0);
  }

  // ---------- Le brouillon, gardé dans l’onglet ----------

  function lireBrouillon() {
    try { return JSON.parse(window.sessionStorage.getItem(CLE_BROUILLON)); } catch (e) { return null; }
  }

  function garderBrouillon() {
    var brouillon = {};
    champs.forEach(function (c) { brouillon[c.nom] = c.champ.value; });
    try { window.sessionStorage.setItem(CLE_BROUILLON, JSON.stringify(brouillon)); } catch (e) { /* stockage indisponible : le texte reste à l’écran */ }
  }

  function effacerBrouillon() {
    try { window.sessionStorage.removeItem(CLE_BROUILLON); } catch (e) { return; }
  }

  // Le brouillon tient-il dans l’onglet ? Non quand le stockage est bloqué (les données des sites refusées) ou absent
  // (certaines vues web d’applis) : la page ne promet alors pas que le texte survit à un rechargement.
  function stockageDisponible() {
    try {
      window.sessionStorage.setItem(CLE_BROUILLON + "-essai", "1");
      window.sessionStorage.removeItem(CLE_BROUILLON + "-essai");
      return true;
    } catch (e) {
      return false;
    }
  }
  var brouillonGarde = stockageDisponible();

  // Remet des valeurs dans les champs ; dit si au moins un champ en a reçu une.
  function remettre(valeurs) {
    if (!valeurs || typeof valeurs !== "object") return false;
    var rempli = false;
    champs.forEach(function (c) {
      if (typeof valeurs[c.nom] !== "string") return;
      c.champ.value = valeurs[c.nom].slice(0, c.max);
      if (c.champ.value.trim()) rempli = true;
    });
    return rempli;
  }

  // ---------- La dernière demande partie, gardée dans l’onglet ----------
  // Pour qu’une correction ne parte pas d’ici quand le serveur ne la garderait pas (correctionPerdue), même après un
  // rechargement : l’adresse et le nom du bar de la dernière demande partie, en minuscules, et son heure (celle de
  // l’appareil, la seule qui survit à un rechargement). Rien d’autre de la demande ; effacé 10 minutes après, et quand
  // l’onglet se ferme. Sans stockage, la page s’en souvient jusqu’au rechargement.

  function garderPartie(partie) {
    var gardee = { email: partie.email, bar: partie.bar, quand: partie.quand };
    try { window.sessionStorage.setItem(CLE_PARTIE, JSON.stringify(gardee)); } catch (e) { return; }
    setTimeout(oublierPartie, REJEU_MS);
  }

  function oublierPartie() {
    try { window.sessionStorage.removeItem(CLE_PARTIE); } catch (e) { return; }
  }

  // La dernière demande partie d’un chargement précédent, si ses 10 minutes ne sont pas passées ; sinon, rien, et
  // l’onglet l’oublie. Après un rechargement, la page ne sait plus ce qui était parti : `corps` est vide.
  function lirePartie() {
    var partie;
    try { partie = JSON.parse(window.sessionStorage.getItem(CLE_PARTIE)); } catch (e) { return null; }
    var valide = partie && typeof partie.email === "string" && typeof partie.bar === "string" &&
      typeof partie.quand === "number";
    var ecoule = valide ? Date.now() - partie.quand : REJEU_MS;
    if (ecoule >= REJEU_MS) {
      oublierPartie();
      return null;
    }
    setTimeout(oublierPartie, Math.min(REJEU_MS, REJEU_MS - ecoule));
    return { email: partie.email, bar: partie.bar, quand: partie.quand, moment: null, corps: null };
  }

  // ---------- Vérifier ----------

  // Les caractères de mise en forme invisibles (catégorie Unicode Cf, Unicode 16 : trait d’union conditionnel,
  // espaces sans largeur, marques de sens d’écriture, U+FEFF, étiquettes…), que le serveur refuse : [premier,
  // dernier]. Les scripts du site sont en ES5, sans \p{Cf} : la liste est écrite.
  var FORMAT = [[0xAD, 0xAD], [0x600, 0x605], [0x61C, 0x61C], [0x6DD, 0x6DD], [0x70F, 0x70F], [0x890, 0x891],
    [0x8E2, 0x8E2], [0x180E, 0x180E], [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F],
    [0xFEFF, 0xFEFF], [0xFFF9, 0xFFFB], [0x110BD, 0x110BD], [0x110CD, 0x110CD], [0x13430, 0x1343F],
    [0x1BCA0, 0x1BCA3], [0x1D173, 0x1D17A], [0xE0001, 0xE0001], [0xE0020, 0xE007F]];
  // Ceux de la liste qui se voient : les signes qui portent un nombre (arabe, syriaque, kaithi).
  var SIGNES = [[0x600, 0x605], [0x6DD, 0x6DD], [0x70F, 0x70F], [0x890, 0x891], [0x8E2, 0x8E2], [0x110BD, 0x110BD],
    [0x110CD, 0x110CD]];
  var JOINTURES = [[0x200C, 0x200D]];     // ce qui lie les émojis d’un émoji composé (une famille)
  var ETIQUETTES = [[0xE0020, 0xE007F]];  // les lettres d’un drapeau régional, puis sa fin
  var SEPARATEURS = [[0x2028, 0x2029]];   // le séparateur de ligne et celui de paragraphe (Zl, Zp)
  var DRAPEAU_NOIR = 0x1F3F4;
  var FIN_DES_ETIQUETTES = 0xE007F;
  var REMPLACEMENT = 0xFFFD;              // « � »

  function dans(plages, code) {
    for (var i = 0; i < plages.length; i++) if (code >= plages[i][0] && code <= plages[i][1]) return true;
    return false;
  }

  // Le texte en points de code ; une moitié d’émoji perdue (une demi-paire UTF-16 seule) devient « � ».
  function pointsDe(texte) {
    var points = [];
    for (var i = 0; i < texte.length; i++) {
      var code = texte.charCodeAt(i);
      var suivant = texte.charCodeAt(i + 1);
      if (code >= 0xD800 && code <= 0xDBFF && suivant >= 0xDC00 && suivant <= 0xDFFF) {
        points.push((code - 0xD800) * 0x400 + (suivant - 0xDC00) + 0x10000);
        i++;
      } else {
        points.push(code >= 0xD800 && code <= 0xDFFF ? REMPLACEMENT : code);
      }
    }
    return points;
  }

  function texteDe(code) {
    if (code < 0x10000) return String.fromCharCode(code);
    var reste = code - 0x10000;
    return String.fromCharCode(0xD800 + Math.floor(reste / 0x400), 0xDC00 + (reste % 0x400));
  }

  // La fin d’un drapeau régional qui commence à `debut` (le drapeau noir, des lettres-étiquettes, puis la fin des
  // étiquettes : le drapeau de l’Angleterre, de l’Écosse, du pays de Galles), ou -1. La même règle que le serveur.
  function finDuDrapeau(points, debut) {
    var i = debut + 1;
    while (i < points.length && points[i] >= 0xE0020 && points[i] < FIN_DES_ETIQUETTES) i++;
    return i > debut + 1 && points[i] === FIN_DES_ETIQUETTES ? i : -1;
  }

  // Un émoji, ou ce qui en fait partie : hors du plan de base, le sélecteur « en émoji » (U+FE0F), les flèches et
  // les symboles divers (❤, ♀, ⚕…). Une jointure à côté d’un émoji le compose : la retirer défait ce qui se voit.
  function emoji(code) {
    return code >= 0x10000 || code === 0xFE0F || (code >= 0x2190 && code <= 0x2BFF);
  }

  // Ce que le serveur refuse et qu’on ne voit pas, avant de vérifier et d’envoyer : un caractère de contrôle (une
  // tabulation collée…) devient une espace, une moitié d’émoji perdue « � », un séparateur de ligne ou de
  // paragraphe un retour à la ligne dans le message et une espace ailleurs, et un caractère de mise en forme
  // invisible disparaît. Ce qui se voit reste, même si le serveur le refuse : resteRefuse le trouve, et la page le
  // dit sous le champ. Le message garde ses retours à la ligne, ses émojis composés et ses drapeaux régionaux.
  function nettoyer(texte, lignes) {
    var points = pointsDe(texte);
    var propre = "";
    for (var i = 0; i < points.length; i++) {
      var code = points[i];
      var fin = code === DRAPEAU_NOIR ? finDuDrapeau(points, i) : -1;
      if (fin > 0) {
        propre += points.slice(i, fin + 1).map(texteDe).join("");
        i = fin;
      } else if (code === 0x0A && lignes) propre += "\n";
      else if (code <= 0x1F || (code >= 0x7F && code <= 0x9F)) propre += " ";
      else if (dans(SEPARATEURS, code)) propre += lignes ? "\n" : " ";
      else if (dans(JOINTURES, code)) propre += lignes || emoji(points[i - 1]) || emoji(points[i + 1]) ? texteDe(code) : "";
      else if (!dans(FORMAT, code) || dans(SIGNES, code)) propre += texteDe(code);
    }
    return propre;
  }

  // Ce que nettoyer laisse et que le serveur refuse : un signe qui porte un nombre et, hors du message, un émoji
  // composé (ses jointures, ou les lettres d’un drapeau régional).
  function resteRefuse(valeur, lignes) {
    return pointsDe(valeur).some(function (code) {
      return dans(SIGNES, code) || (!lignes && (dans(JOINTURES, code) || dans(ETIQUETTES, code)));
    });
  }

  function valeurDe(c) {
    var valeur = nettoyer(c.champ.value, c.lignes).trim();
    return c.forme === "telephone" ? valeur.replace(/\s+/g, " ") : valeur;
  }

  function erreurTelephone(valeur, c) {
    if (!TELEPHONE.test(valeur)) return TEXTES.telephone;
    if (valeur.length > c.max) return remplir(TEXTES.tropLong.phone, "{max}", nombre(c.max));
    if ((valeur.match(/[0-9]/g) || []).length < CHIFFRES_MIN) return remplir(TEXTES.telephoneCourt, "{min}", nombre(CHIFFRES_MIN));
    return "";
  }

  // Ce qui manque, dit en clair : le @, ou la fin de l’adresse (« .fr »). Une adresse qui a la forme mais pas les
  // caractères du serveur a son propre message.
  function erreurEmail(valeur) {
    if (EMAIL.test(valeur)) return "";
    if (FORME_EMAIL.test(valeur)) return TEXTES.emailCaractere;
    var arobase = valeur.indexOf("@");
    if (arobase === -1) return TEXTES.emailArobase;
    if (arobase !== valeur.lastIndexOf("@")) return TEXTES.emailCaractere;
    if (arobase === 0 || arobase === valeur.length - 1) return TEXTES.emailIncomplet;
    return TEXTES.emailFin;
  }

  function erreurDe(c) {
    if (c === laCase) return accord.checked ? "" : TEXTES.accord;
    var valeur = valeurDe(c);
    if (!valeur) return c.requis ? TEXTES.requis[c.nom] : "";
    if (c.forme === "telephone") return erreurTelephone(valeur, c);
    if (TEXTES.signe[c.nom] && resteRefuse(valeur, c.lignes)) return TEXTES.signe[c.nom];
    if (valeur.length > c.max) return remplir(TEXTES.tropLong[c.nom], "{max}", nombre(c.max));
    if (c.min && valeur.length < c.min) return remplir(TEXTES.tropCourt[c.nom], "{min}", nombre(c.min));
    if (c.forme === "email") return erreurEmail(valeur);
    return "";
  }

  // L’erreur sous le champ, et dans sa description avant l’indice : l’ordre où on les voit.
  function montrerErreur(c, message) {
    c.erreur.textContent = "";
    c.erreur.appendChild(icone("erreur"));
    c.erreur.appendChild(document.createTextNode(message));
    c.erreur.hidden = false;
    c.champ.setAttribute("aria-invalid", "true");
    c.champ.setAttribute("aria-describedby", c.erreur.id + (c.indices ? " " + c.indices : ""));
  }

  function effacerErreur(c) {
    c.erreur.textContent = "";
    c.erreur.hidden = true;
    c.champ.removeAttribute("aria-invalid");
    if (c.indices) c.champ.setAttribute("aria-describedby", c.indices);
    else c.champ.removeAttribute("aria-describedby");
  }

  function titrerResume() {
    var n = resumeListe.children.length;
    resumeTitre.textContent = n === 1 ? TEXTES.resumeUn : remplir(TEXTES.resumePlusieurs, "{n}", n);
  }

  // Le résumé en haut du formulaire : un lien par erreur, et le focus pour qu’il soit lu d’abord.
  function montrerResume(erreurs) {
    resumeListe.textContent = "";
    erreurs.forEach(function (e) {
      var li = document.createElement("li");
      var lien = document.createElement("a");
      lien.href = "#" + e.champ.id;
      lien.textContent = e.message;
      li.appendChild(lien);
      resumeListe.appendChild(li);
    });
    titrerResume();
    resume.hidden = false;
    resume.focus();
  }

  function cacherResume() {
    resume.hidden = true;
    resumeTitre.textContent = "";
    resumeListe.textContent = "";
  }

  function retirerDuResume(c) {
    var lien = resumeListe.querySelector('a[href="#' + c.id + '"]');
    if (lien) resumeListe.removeChild(lien.parentNode);
    if (resumeListe.children.length) titrerResume();
    else cacherResume();
  }

  function verifier() {
    var erreurs = [];
    verifies.forEach(function (c) {
      var message = erreurDe(c);
      if (message) {
        montrerErreur(c, message);
        erreurs.push({ champ: c, message: message });
      } else {
        effacerErreur(c);
      }
    });
    if (erreurs.length === 1 && erreurs[0].champ === laCase) montrerLaCase();
    else if (erreurs.length) montrerResume(erreurs);
    else cacherResume();
    return erreurs.length === 0;
  }

  // La case est la seule erreur : le focus va sur elle, pas sur le résumé en haut du formulaire, et son message
  // reste à l’écran, juste dessous. Le bouton d’envoi est à côté.
  function montrerLaCase() {
    cacherResume();
    accord.focus();
    if (laCase.erreur.scrollIntoView) laCase.erreur.scrollIntoView({ block: "nearest" });
  }

  resumeListe.addEventListener("click", function (event) {
    var lien = event.target.closest ? event.target.closest("a") : null;
    if (!lien) return;
    var champ = document.getElementById(lien.getAttribute("href").slice(1));
    if (!champ) return;
    event.preventDefault();
    champ.focus();
  });

  // ---------- La demande ----------

  // Les champs nettoyés, dans l’ordre du contrat ; un téléphone ou un message vide n’y est pas.
  function lireDemande() {
    var demande = {};
    champs.forEach(function (c) {
      var valeur = valeurDe(c);
      if (valeur || c.requis) demande[c.nom] = valeur;
    });
    return demande;
  }

  // Exactement les clés que le serveur lit (il refuse toute autre clé) : les champs, la case, le piège vide et le
  // temps de remplissage, un nombre entier de millisecondes.
  function corpsDe(demande) {
    var corps = {};
    for (var cle in demande) if (aCle(demande, cle)) corps[cle] = demande[cle];
    corps.consent = true;
    corps.website = "";
    corps.fillMs = remplissageMs();
    return JSON.stringify(corps);
  }

  // ---------- L’e-mail tout prêt ----------

  // L’objet à part, puis une ligne par champ rempli, rien d’autre (ni le piège, ni la case). Le texte à copier
  // commence par l’objet et une ligne vide, pour qui l’écrit lui-même dans sa messagerie.
  function preparerCourriel() {
    var demande = lireDemande();
    var lignes = [];
    champs.forEach(function (c) {
      if (aCle(demande, c.nom)) lignes.push(TEXTES.lignes[c.nom] + demande[c.nom]);
    });
    var texte = lignes.join("\n").replace(/\r\n?/g, "\n");
    var sujet = remplir(TEXTES.sujet, "{bar}", demande.barName);
    courrielTexte.value = TEXTES.objet + sujet + "\n\n" + texte;
    courrielLien.href = "mailto:" + CONTACT + "?subject=" + encodeURIComponent(sujet) +
      "&body=" + encodeURIComponent(texte.replace(/\n/g, "\r\n"));
    remettreCopier();
    ajusterTexte();
  }

  // Le texte à copier se lit en entier, sans défiler dans sa boîte : sa hauteur suit ce qu’il contient.
  function ajusterTexte() {
    if (courriel.hidden) return;
    courrielTexte.style.height = "auto";
    courrielTexte.style.height = (courrielTexte.scrollHeight + courrielTexte.offsetHeight - courrielTexte.clientHeight) + "px";
  }

  function remettreCopier() {
    clearTimeout(minuteurCopie);
    minuteurCopie = null;
    ecrireLibelle(copier, texteCopier);
  }

  // ---------- Les états du formulaire ----------
  // Le formulaire n’a qu’un état à la fois, `etat`. Seul `aller` le change, et seul `rendre` l’affiche : le bouton
  // d’envoi, le chemin e-mail, les deux zones de message et le focus. La page n’envoie que depuis un état de
  // ENVOI_PERMIS, quel que soit le geste (le bouton, ou Entrée dans un champ).
  //
  //   état            bouton d’envoi    chemin e-mail       message
  //   repos           ambre             —                   —
  //   envoi           « Envoi… »        —                   « Envoi… », caché ; 4 s après le départ, le réseau lent
  //   attente-reseau  ambre             en second (verre)   Pas de réseau (statut)
  //   courriel        effacé            ambre               Ta demande n’est pas encore partie (statut)
  //   invalide        effacé            ambre               Une information ne passe pas chez nous (alerte)
  //   limite          en second (verre) ambre               Beaucoup d’envois depuis cette connexion (alerte)
  //   messagerie      en second (verre) ambre               Ta messagerie s’est ouverte ? (statut)
  //   expire          effacé            — ; ambre sans      Cette page est ouverte depuis plus d’un jour (statut)
  //                                     brouillon possible
  //   envoye          le formulaire laisse la place à « C’est envoyé. »
  //
  // Le bouton d’envoi passe de lui-même en verre quand le chemin e-mail est le geste principal (pour-les-bars.css).

  var ENVOI_PERMIS = { repos: true, "attente-reseau": true, limite: true, messagerie: true };
  var etat = "repos";

  function vueDe(nom) {
    var recharger = { icone: "recharger", texte: TEXTES.recharger, quand: function () { window.location.reload(); } };
    var vues = {
      repos: { bouton: true },
      envoi: { bouton: true, occupe: true },
      "attente-reseau": { bouton: true, courriel: "second", message: { zone: statut, icone: "horsLigne", contenu: TEXTES.horsLigne } },
      courriel: { courriel: "principal", message: { zone: statut, icone: "courriel", contenu: TEXTES.courriel } },
      invalide: { courriel: "principal", message: { zone: alerte, icone: "erreur", contenu: TEXTES.invalide, erreur: true } },
      limite: { bouton: true, courriel: "principal", message: { zone: alerte, icone: "attente", contenu: TEXTES.tropDEnvois, erreur: true } },
      messagerie: { bouton: true, courriel: "principal", message: { zone: statut, icone: "courriel", contenu: messagerieOuverte() } },
      // Sans stockage, un rechargement peut tout effacer : l’e-mail mène, le rechargement reste possible.
      expire: brouillonGarde
        ? { message: { zone: statut, icone: "recharger", contenu: TEXTES.expiree, action: recharger } }
        : { courriel: "principal", message: { zone: statut, icone: "recharger", contenu: TEXTES.expireeSansBrouillon, action: recharger } },
      envoye: {}
    };
    return vues[nom];
  }

  function messagerieOuverte() {
    return brouillonGarde ? TEXTES.messagerie : TEXTES.messagerieSansBrouillon;
  }

  // Change d’état et l’affiche. `note` ({ icone, contenu }) remplace le message de l’état, dans la zone de statut : la
  // messagerie ouverte, le réseau lent, le brouillon retrouvé, le réseau revenu. Une seule zone parle à la fois.
  function aller(nouvel, note) {
    if (nouvel !== "envoi") {
      clearTimeout(minuteurLent);
      minuteurLent = null;
    }
    etat = nouvel;
    rendre(note);
  }

  function noter(note) {
    rendre(note);
  }

  function rendre(note) {
    var vue = vueDe(etat);
    var focusAvant = document.activeElement;
    form.hidden = etat === "envoye";
    envoyee.hidden = etat !== "envoye";

    // Le bouton reste focalisable pendant l’envoi (aria-disabled, pas disabled) : le focus ne se perd pas. Il
    // s’efface (hidden, sa règle est dans le style de la page) quand la page ne peut plus envoyer elle-même.
    if (vue.occupe) bouton.setAttribute("aria-disabled", "true");
    else bouton.removeAttribute("aria-disabled");
    ecrireLibelle(bouton, vue.occupe ? TEXTES.envoi : texteBouton);
    bouton.hidden = !vue.bouton;

    courriel.classList.toggle("courriel--second", vue.courriel === "second");
    courriel.hidden = !vue.courriel;
    if (vue.courriel) preparerCourriel();

    statut.textContent = "";
    alerte.textContent = "";
    var message = note ? { zone: statut, icone: note.icone, contenu: note.contenu } : vue.message;
    var action = message ? dire(message, !vue.bouton) : null;
    // « Envoi… » est aussi écrit, caché, dans la zone de statut : un lecteur d’écran entend l’attente.
    if (vue.occupe && !message) statut.appendChild(paragraphe("visuellement-cache", TEXTES.envoi));

    garderLeFocus(focusAvant, vue, action);
  }

  // Le focus ne tombe jamais sur la page : s’il était sur le bouton d’envoi, dans le chemin e-mail ou sur l’action
  // d’un message, et que cet élément s’efface, il passe à ce qui le remplace (le lien qui ouvre la messagerie quand il
  // mène, sinon l’action du message, sinon le bouton d’envoi). Sans focus (un navigateur qui ne le donne pas au
  // bouton cliqué), il y passe aussi quand le bouton d’envoi s’efface. Un focus ailleurs (un champ, Entrée tapée
  // dedans) reste où il est.
  function garderLeFocus(avant, vue, action) {
    if (etat === "envoye") return;
    var surLaPage = !avant || avant === document.body;
    var ici = !surLaPage && (avant === bouton || courriel.contains(avant) || statut.contains(avant) || alerte.contains(avant));
    if (surLaPage ? vue.bouton : !ici) return;
    if (!surLaPage && document.contains(avant) && avant.getClientRects().length > 0) return;
    var remplacant = (vue.courriel === "principal" ? courrielLien : null) || action || (vue.bouton ? bouton : premierChamp.champ);
    remplacant.focus();
  }

  // ---------- Envoyer ----------

  function soumettre() {
    if (!ENVOI_PERMIS[etat]) return;
    aller("repos");
    if (!verifier()) return;
    var demande = lireDemande();
    // Le piège rempli : un robot, qui croit que c’est parti, et rien ne part. Une espace seule n’en est pas un. Le
    // brouillon reste : une personne peut être là (un remplissage automatique quand même).
    if (piege.value.trim() !== "") return reussite(demande, false);
    if (ouverteDepuisMs() > PAGE_MAX_MS) return aller("expire");
    if (correctionPerdue(demande)) return aller("courriel", { icone: "courriel", contenu: TEXTES.correction });
    aller("envoi");
    apresRemplissageMin(function () { essayer(demande, 1); });
  }

  // La règle que la page annonce (TEXTES.correction) : une telle correction part par l’e-mail. La page compare
  // l’adresse et le nom du bar en minuscules, pendant REJEU_MS. Le délai se compte depuis la réponse, venue après
  // l’arrivée de la première au serveur, donc jamais plus court que le sien : sur l’horloge de la page dans le même
  // chargement, sur l’heure de l’appareil après un rechargement (une heure qui recule le prolonge). La même demande,
  // sans rien de changé, peut repartir d’ici dans le même chargement : le serveur a déjà la première.
  function correctionPerdue(demande) {
    var partie = derniereReussite;
    if (!partie) return false;
    var ecoule = partie.moment !== null ? horloge.now() - partie.moment : Date.now() - partie.quand;
    if (ecoule >= REJEU_MS) return false;
    if (demande.email.toLowerCase() !== partie.email || demande.barName.toLowerCase() !== partie.bar) return false;
    return partie.corps === null || JSON.stringify(demande) !== partie.corps;
  }

  // La page attend quelques secondes (REMPLISSAGE_MIN_MS) après l’affichage du formulaire avant son premier envoi.
  function apresRemplissageMin(suite) {
    var reste = REMPLISSAGE_MIN_MS - remplissageMs();
    if (reste <= 0) return suite();
    setTimeout(function () { apresRemplissageMin(suite); }, reste);
  }

  function raisonDe(corps) {
    return corps && typeof corps === "object" && typeof corps.reason === "string" ? corps.reason : "";
  }

  function essayer(demande, essai) {
    if (ouverteDepuisMs() > PAGE_MAX_MS) return aller("expire");
    if (navigator.onLine === false) return aller("attente-reseau");
    if (typeof window.fetch !== "function") return aller("courriel");
    if (essai === 1) minuteurLent = setTimeout(function () { noter({ icone: "attente", contenu: TEXTES.lent }); }, LENT_MS);

    var controle = typeof AbortController === "function" ? new AbortController() : null;
    var regle = false;
    var minuteur;
    // La réponse lue, l’échec ou les 10 s : seul le premier des trois compte. Les 10 s couvrent aussi la lecture
    // du corps d’un 400. Une panne de la page dans ce qui suit finit à l’étape de l’e-mail, jamais sur un « Envoi… »
    // sans fin, et reste visible dans la console.
    function une(suite) {
      return function (valeur) {
        if (regle) return;
        regle = true;
        clearTimeout(minuteur);
        try {
          suite(valeur);
        } catch (panne) {
          aller("courriel");
          throw panne;
        }
      };
    }
    var echec = une(function () { echecReseau(demande, essai); });
    minuteur = setTimeout(function () {
      if (controle) controle.abort();
      echec();
    }, DELAI_MS);

    try {
      window.fetch(ADRESSE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: corpsDe(demande),
        // Pas de mode de cache : un POST n’est jamais servi du cache, et un mode comme no-store peut faire ajouter
        // Pragma et Cache-Control, des en-têtes que le pré-vol CORS peut refuser : la page n’envoie que Content-Type.
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controle ? controle.signal : undefined
      }).then(function (reponse) {
        if (reponse.status !== 400) return une(function () { lireReponse(reponse, demande, essai); })();
        // Un refus se lit dans son corps ; un corps illisible est une panne, pas un refus.
        reponse.json().then(une(function (corps) { refus(raisonDe(corps)); }), echec);
      }, echec);
    } catch (e) {
      echec();
    }
  }

  function nouvelEssai(demande, essai) {
    if (essai > 1) return false;
    setTimeout(function () { essayer(demande, essai + 1); }, NOUVEL_ESSAI_MS);
    return true;
  }

  function echecReseau(demande, essai) {
    if (navigator.onLine === false) return aller("attente-reseau");
    if (nouvelEssai(demande, essai)) return;
    aller("courriel");
  }

  function lireReponse(reponse, demande, essai) {
    var code = reponse.status;
    if (code >= 200 && code < 300) return reussite(demande, true);
    if (code >= 500 && code !== 501 && nouvelEssai(demande, essai)) return;
    // 429 : l’e-mail passe tout de suite ; « Envoyer ma demande » reste, en second, pour réessayer dans une heure.
    if (code === 429) return aller("limite");
    // 403 (ORIGINE_REFUSEE), 404, 405, 501, un 5xx après le nouvel essai, ou tout autre code : l’e-mail.
    aller("courriel");
  }

  function refus(raison) {
    if (raison === "CONSENTEMENT_REQUIS") return consentementRefuse();
    if (raison === "FORMULAIRE_EXPIRE") return aller("expire");
    // REQUETE_INVALIDE (ou une raison inconnue) : le serveur ne dit pas quel champ, et la page, qui vérifie déjà ce
    // qu’il vérifiait quand elle a été écrite, ne peut pas le savoir ; elle ne répète rien de ce qui est tapé. Le
    // même bouton échouerait encore : il s’efface, et la messagerie prend la main.
    aller("invalide");
  }

  function consentementRefuse() {
    aller("repos");
    accord.checked = false;
    montrerErreur(laCase, TEXTES.accord);
    montrerLaCase();
  }

  // `partie` : la demande est partie d’ici, son brouillon s’efface, et la mesure d’audience (mesure.js, si elle est
  // active) apprend seulement qu’une demande est partie ; sinon (le piège), il reste dans l’onglet.
  function reussite(demande, partie) {
    derniereDemande = demande;
    if (partie) {
      derniereReussite = { email: demande.email.toLowerCase(), bar: demande.barName.toLowerCase(), quand: Date.now(),
        moment: horloge.now(), corps: JSON.stringify(demande) };
      garderPartie(derniereReussite);
      effacerBrouillon();
      document.dispatchEvent(new CustomEvent("baromatch:compter", { detail: "proposer-mon-bar" }));
    }
    form.reset();
    cacherResume();
    verifies.forEach(effacerErreur);
    envoyeeEmail.textContent = demande.email;
    aller("envoye");
    envoyee.focus();
  }

  // ---------- Les gestes ----------

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    soumettre();
  });

  function champDe(element) {
    for (var i = 0; i < verifies.length; i++) if (verifies[i].champ === element) return verifies[i];
    return null;
  }

  function surSaisie(event) {
    var c = champDe(event.target);
    if (!c) return; // le piège n’est jamais gardé
    if (c !== laCase) garderBrouillon();
    if (c.champ.getAttribute("aria-invalid") === "true" && !erreurDe(c)) {
      effacerErreur(c);
      retirerDuResume(c);
    }
    if (!courriel.hidden) preparerCourriel();
  }
  form.addEventListener("input", surSaisie);
  form.addEventListener("change", surSaisie);

  // Hors ligne au moment d’envoyer : la demande part une fois, quand le réseau revient. Pendant un envoi (ou
  // l’attente de son nouvel essai), le retour du réseau ne lance rien de plus. Si un champ a changé entre-temps et
  // ne passe plus, la page n’ouvre pas d’elle-même le résumé et ne déplace pas le focus : elle dit seulement que la
  // demande attend le bouton.
  window.addEventListener("online", function () {
    if (etat !== "attente-reseau") return;
    var pret = verifies.every(function (c) { return !erreurDe(c); });
    if (pret) return soumettre();
    aller("repos", { icone: "attente", contenu: TEXTES.reseauRevenu });
  });

  function selectionner() {
    courrielTexte.focus();
    courrielTexte.select();
    courrielTexte.setSelectionRange(0, courrielTexte.value.length);
  }

  // Après « Ouvrir ma messagerie » : une ligne calme, seule, dans la zone de statut. Là où la page ne peut plus
  // envoyer (l’étape de l’e-mail, un REQUETE_INVALIDE), elle reste à l’étape de l’e-mail ; ailleurs (hors ligne,
  // après un 429), le bouton d’envoi reste, en second, et la demande ne repart plus d’elle-même au retour du réseau :
  // elle part par le mail. Le brouillon reste dans l’onglet jusqu’à ce qu’il se ferme (confidentialite.html#bars).
  courrielLien.addEventListener("click", function () {
    if (ENVOI_PERMIS[etat]) return aller("messagerie");
    aller("courriel", { icone: "courriel", contenu: messagerieOuverte() });
  });

  modifier.addEventListener("click", function () {
    premierChamp.champ.focus();
  });

  window.addEventListener("resize", ajusterTexte);

  // Le presse-papiers refusé (une vue web d’appli, la page qui n’a pas le focus) ou absent : la page le dit, et le
  // texte reste sélectionné, prêt à copier.
  function copieImpossible() {
    noter({ icone: "courriel", contenu: TEXTES.copieImpossible });
    selectionner();
  }

  copier.addEventListener("click", function () {
    var presse = navigator.clipboard;
    if (!presse || typeof presse.writeText !== "function") return copieImpossible();
    presse.writeText(courrielTexte.value).then(function () {
      ecrireLibelle(copier, TEXTES.copie);
      clearTimeout(minuteurCopie);
      minuteurCopie = setTimeout(remettreCopier, COPIE_MS);
    }, copieImpossible);
  });

  // Une nouvelle demande, ou l’adresse à corriger : le formulaire revient avec ce qui vient de partir.
  nouvelle.addEventListener("click", function () {
    remettre(derniereDemande);
    garderBrouillon();
    aller("repos");
    premierChamp.champ.focus();
  });

  // ---------- Au chargement ----------
  // La case est décochée à chaque chargement (il faut la cocher pour chaque demande) et le piège part vide, même si
  // le navigateur les a restaurés.
  accord.checked = false;
  piege.value = "";
  derniereReussite = lirePartie();
  aller("repos", remettre(lireBrouillon()) ? { icone: "brouillon", contenu: TEXTES.brouillon } : null);
  // pour-les-bars-amorce.js lui a gardé sa place, invisible : il apparaît là, sans rien pousser (sauf si l’amorce
  // avait rendu la place parce que ce script tardait : il pousse alors ce qui suit). Le chemin e-mail de secours
  // s’efface (l’amorce l’a déjà fait, sauf dans ce cas).
  form.removeAttribute("data-attente");
  if (secours) secours.hidden = true;
  affiche = horloge.now();
  afficheMur = Date.now();
})();

/* Ta salle, ce soir (l’ouverture de la page) : 80 places qui se remplissent de 17:00 au coup d’envoi, puis les places
   gardées libérées à 21:30. Les sièges sont dans le HTML, dans leur état de 21:00 ; avec ce script et sans « réduire
   les animations », la page montre d’abord 17:00 (son style, @media (scripting: enabled)), et ce script joue la soirée
   en 8 s quand la scène est à l’écran : en pause quand elle en sort, reprise quand elle revient, une seule fois. Il
   branche aussi les boutons, présents et inactifs dès le HTML : les places sur Baromatch (− et +), l’heure (le curseur)
   et lecture ou pause ; dès qu’on y touche, la soirée ne se joue plus d’elle-même. Avec « réduire les animations », la
   salle reste à 21:00, et « Rejouer » avance d’un moment à l’autre, d’un coup, toutes les 1,6 s. Un navigateur qui ne
   connaît pas @media (scripting) a montré 21:00 : la salle y reste jusqu’à ce que la soirée se joue, depuis 17:00.
   Les chiffres sont ceux de la page Ce soir de la Console de démonstration : à 21:00, 80 places, 35 sur Baromatch,
   30 gardées, 23 arrivés, 7 encore attendus, 18 sans réservation, 5 encore en ligne. Après le coup d’envoi, plus
   personne ne réserve, mais la Console compte toujours les places en ligne pas prises : la page aussi. Trois
   retardataires arrivent avant 21:20 ; à 21:30, une place gardée dont l’arrivée n’est pas validée est libérée et
   comptée absente, et ne repart pas en ligne. Comme la Console, les mots des chiffres passent au singulier à 0 et 1.
   Et la lumière du match (.lumiere) : sa force (--h) monte à mesure qu’on descend dans la page. */
(function () {
  "use strict";

  var lumiere = document.querySelector(".lumiere");
  if (lumiere) {
    var prevu = false;
    var eclairer = function () {
      prevu = false;
      var course = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      lumiere.style.setProperty("--h", (0.45 + 0.55 * Math.min(1, window.scrollY / course)).toFixed(3));
    };
    window.addEventListener("scroll", function () {
      if (prevu) return;
      prevu = true;
      window.requestAnimationFrame(eclairer);
    }, { passive: true });
    eclairer();
  }

  var figure = document.querySelector(".salle-soir");
  if (!figure) return;
  var sieges = figure.querySelectorAll(".salle__tables i");
  if (sieges.length !== 80) return;
  var calme = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // L’ordre de la soirée : un tirage fixe (Park-Miller, graine 11), le même qui a écrit les sièges du HTML.
  var graine = 11;
  var tirage = [];
  for (var n = 0; n < 80; n += 1) {
    graine = (graine * 16807) % 2147483647;
    tirage.push([graine, n]);
  }
  tirage.sort(function (a, b) { return a[0] - b[0]; });
  var ordre = tirage.map(function (t) { return sieges[t[1]]; });

  var CAPACITE = 80;
  var ENVOI = 240; // les minutes depuis 17:00 : 21:00
  var FIN = 270;   // 21:30, l’heure où les places gardées sont libérées
  var DUREE_MS = 8000;
  var PAUSE = "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z";
  var LECTURE = "M7 4.5v15l12-7.5z";
  var quota = 35;
  // 17:00 d’abord, si la page l’a montré (son style, @media (scripting: enabled)) et ne l’a pas déjà remplacé par
  // 21:00 (l’amorce le fait quand ce script tarde plus de 12 s) ; sinon 21:00, jusqu’à la lecture.
  var a17h = !calme && !figure.hasAttribute("data-vivant")
    && Boolean(window.matchMedia && window.matchMedia("(scripting: enabled)").matches);
  var minute = a17h ? 0 : ENVOI;
  var seule = !calme;          // la soirée se joue d’elle-même, tant qu’on ne touche à rien
  var depuisLeDebut = !a17h;   // le premier « Rejouer » (ou la première lecture) repart de 17:00

  var lisse = function (t, a, b) {
    var u = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  var heure = function (m) {
    var total = 17 * 60 + m;
    var h = Math.floor(total / 60);
    var mn = total % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mn < 10 ? "0" : "") + mn;
  };
  var RECITS = [
    [0, function (q) { return "17:00 · Tu ouvres " + q + " places sur Baromatch. Les " + (CAPACITE - q) + " autres restent à toi."; }],
    [60, function () { return "18:00 · Les fans gardent leur place. Tu vois qui vient, et à combien."; }],
    [120, function () { return "19:00 · La porte valide les arrivées d’un scan. Ceux qui entrent sans l’appli se comptent d’un toucher."; }],
    [ENVOI, function () { return "21:00 · Coup d’envoi. Tu sais qui est là, et qui est encore attendu."; }],
    [FIN, function () { return "21:30 · Les places gardées sont libérées : une arrivée pas validée compte absente."; }],
  ];

  var dans = function (selecteur) { return figure.querySelector(selecteur + " .v21"); };
  var chiffres = figure.querySelectorAll(".kpi b .v21");
  // Le mot qui s’accorde avec un chiffre (data-mot), au pluriel puis au singulier (0 et 1), comme dans la Console ;
  // null : invariable. À 17:00, avant ce script, la page a déjà ses mots au singulier (les .v17).
  var MOTS = [null, ["arrivés", "arrivé"], ["attendus", "attendu"], null, ["places", "place"]];
  var tuiles = figure.querySelectorAll(".kpi");
  var surQuota = figure.querySelectorAll(".kpi small")[1];
  var lieux = {
    heure: dans(".salle-soir__heure"),
    recit: dans(".salle-soir__recit"),
    ecran: figure.querySelector(".salle__ecran"),
    quota: figure.querySelector("#salle-quota span"),
    curseur: figure.querySelector("#salle-curseur"),
    jouer: figure.querySelector("#salle-jouer"),
  };
  var icone = lieux.jouer.querySelector("path");

  var dessiner = function () {
    var ouvert = minute <= ENVOI;
    var prisFin = Math.round(quota * 30 / 35);
    var arrivesFin = Math.round(prisFin * 23 / 30);
    var tard = Math.round((prisFin - arrivesFin) * 3 / 7);
    var pris = Math.round(lisse(minute, 0, 225) * prisFin);
    var arrives = ouvert ? Math.round(lisse(minute, 110, ENVOI) * arrivesFin)
      : arrivesFin + Math.round(Math.min(1, (minute - ENVOI) / 20) * tard);
    var liberes = minute >= FIN ? prisFin - arrivesFin - tard : 0;
    var sans = Math.round(lisse(minute, 90, ENVOI) * Math.min(18, CAPACITE - quota));
    ordre.forEach(function (siege, i) {
      var e;
      if (i < quota) e = i < arrives ? "a" : i < pris - liberes ? "g" : i < pris ? "l" : "e";
      else e = i - quota < sans ? "s" : "l";
      if (siege.getAttribute("data-e") !== e) siege.setAttribute("data-e", e);
    });
    var valeurs = [arrives + sans, arrives, pris - liberes - arrives, sans, quota - pris];
    for (var k = 0; k < chiffres.length; k += 1) {
      chiffres[k].textContent = String(valeurs[k]);
      var mot = MOTS[k] && tuiles[k].querySelector("[data-mot]");
      if (mot) mot.textContent = MOTS[k][valeurs[k] <= 1 ? 1 : 0];
    }
    if (surQuota) surQuota.textContent = "/" + quota;
    var recit = "";
    RECITS.forEach(function (r) { if (minute >= r[0]) recit = r[1](quota); });
    lieux.recit.textContent = recit;
    lieux.heure.textContent = heure(minute);
    lieux.ecran.textContent = heure(Math.min(minute, ENVOI));
    if (lieux.quota.textContent !== String(quota)) lieux.quota.textContent = String(quota);
    lieux.curseur.value = String(minute);
    lieux.curseur.setAttribute("aria-valuetext", heure(minute));
  };

  // La lecture : de l’heure où l’on est jusqu’à 21:30. Sans mouvement, d’un moment de la soirée au suivant.
  var lecture = null;
  var bouton = function (enCours) {
    icone.setAttribute("d", enCours ? PAUSE : LECTURE);
    lieux.jouer.setAttribute("aria-label", enCours ? "Mettre la soirée en pause"
      : minute > 0 && minute < FIN && !depuisLeDebut ? "Reprendre la soirée" : "Rejouer la soirée");
  };
  var arreter = function () {
    if (!lecture) return;
    window.cancelAnimationFrame(lecture.image);
    window.clearTimeout(lecture.pas);
    lecture = null;
    bouton(false);
  };
  var jouer = function () {
    arreter();
    if (minute >= FIN || depuisLeDebut) minute = 0;
    depuisLeDebut = false;
    lecture = { image: 0, pas: 0 };
    bouton(true);
    dessiner();
    if (calme) {
      var suivant = function () {
        minute = RECITS.map(function (r) { return r[0]; }).filter(function (m) { return m > minute; })[0];
        dessiner();
        if (minute >= FIN) arreter();
        else lecture.pas = window.setTimeout(suivant, 1600);
      };
      lecture.pas = window.setTimeout(suivant, 1600);
      return;
    }
    var depart = minute;
    var t0 = null;
    var image = function (t) {
      if (t0 === null) t0 = t;
      minute = Math.min(FIN, Math.round(depart + (t - t0) / DUREE_MS * FIN));
      dessiner();
      if (minute >= FIN) arreter();
      else lecture.image = window.requestAnimationFrame(image);
    };
    lecture.image = window.requestAnimationFrame(image);
  };

  // Les places sur Baromatch changent la salle, pas l’heure ; le curseur choisit l’heure, et la lecture repart de là.
  figure.querySelectorAll("[data-pas]").forEach(function (b) {
    b.addEventListener("click", function () {
      seule = false;
      quota = Math.max(10, Math.min(60, quota + Number(b.getAttribute("data-pas"))));
      dessiner();
      if (!lecture) bouton(false);
    });
  });
  lieux.curseur.addEventListener("input", function () {
    arreter();
    seule = false;
    depuisLeDebut = false;
    minute = Number(lieux.curseur.value);
    dessiner();
    bouton(false);
  });
  lieux.jouer.addEventListener("click", function () {
    seule = false;
    if (lecture) arreter();
    else jouer();
  });

  dessiner();
  figure.setAttribute("data-vivant", "");
  figure.querySelectorAll(".salle-soir__commandes [disabled]").forEach(function (e) { e.disabled = false; });
  if (!seule || typeof window.IntersectionObserver !== "function") return;
  new window.IntersectionObserver(function (entrees) {
    if (!seule) return;
    var visible = entrees.some(function (entree) { return entree.isIntersecting; });
    if (visible && !lecture && minute < FIN) jouer();
    else if (!visible && lecture) arreter();
  }, { threshold: 0.5 }).observe(figure.querySelector(".salle"));
})();
