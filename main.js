/* Baromatch — liste d’attente
   L’adresse d’envoi est l’attribut action du formulaire de index.html (Formspree). S’il est vide ou garde
   TON-ID-FORMSPREE, le bouton ouvre un mail vers contact@baromatch.fr.

   Après l’inscription, l’adresse reste dans le champ et le message la rappelle : une faute se voit. « Corriger
   l’adresse » (ou taper dans le champ) rouvre l’envoi ; la nouvelle inscription porte aussi l’adresse qu’elle
   remplace (champ « remplace »). Ce champ informe seulement le propriétaire : rien n’est remplacé ni effacé sur sa
   seule foi (n’importe qui peut l’écrire en envoyant au formulaire), une suppression passe par confidentialite@.

   L’issue d’un envoi se décide en un seul endroit (transmettre) : inscrite, adresse refusée par Formspree, ou panne
   (réseau, pas de réponse en 10 s, tout autre refus). Chaque échec laisse une issue : écrire à contact@baromatch.fr.
   (Le même texte et la même règle sont dans boutique.js : ses tests et ceux-ci vérifient les deux pages.) */

(function () {
  var form = document.getElementById("attente");
  if (!form) return;

  var champ = form.querySelector('input[type="email"]');
  var bouton = form.querySelector('button[type="submit"]');
  var retour = document.getElementById("attente-retour");
  var corriger = document.getElementById("attente-corriger");
  var texteBouton = bouton.textContent;
  var CONTACT = "contact@baromatch.fr";
  // Au-delà, un envoi sans réponse est une panne : le bouton revient au lieu de rester sur « Envoi… ».
  var DELAI_MS = 10000;
  // Une adresse complète : un « @ », puis un domaine avec un point suivi d’au moins deux caractères qui ne sont ni un
  // point, ni une espace, ni un « @ » (des lettres ou des chiffres : « a@b.12 » passe). « paul@gmail » ne passe pas,
  // alors que le navigateur l’accepte.
  var ADRESSE_COMPLETE = /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/;
  var TEXTES = {
    forme: "Vérifie ton adresse mail : elle doit ressembler à prenom@exemple.fr.",
    incomplete: "Il manque la fin de ton adresse, par exemple .fr ou .com.",
    refusee: "Cette adresse ne semble pas valide. Vérifie-la : elle doit ressembler à prenom@exemple.fr. Si elle est juste, écris à " + CONTACT + ".",
    panne: "L’inscription n’est pas passée. Réessaie dans un instant, ou écris à " + CONTACT + ".",
    messagerie: "Ta messagerie s’ouvre : envoie le mail et on te préviendra au lancement.",
    envoi: "Envoi…",
    note: "C’est noté",
    inscrite: function (courriel) {
      return "C’est noté : on t’écrit à " + courriel + " au lancement et pour les premiers tests.";
    }
  };
  var inscrite = "";
  // Le formulaire n’a qu’un état à la fois (comme pour-les-bars.js) : « repos » (on peut envoyer), « envoi » ou
  // « inscrite » (c’est parti ; taper dans le champ ou « Corriger l’adresse » le ramène au repos). Seul `aller` le
  // change. Hors du repos, le bouton reste focalisable (aria-disabled, jamais disabled : le focus ne tombe pas sur la
  // page) et la page ignore ses appuis.
  var etat = "repos";

  function aller(nouvel) {
    etat = nouvel;
    if (etat === "repos") bouton.removeAttribute("aria-disabled");
    else bouton.setAttribute("aria-disabled", "true");
    bouton.textContent = etat === "envoi" ? TEXTES.envoi : etat === "inscrite" ? TEXTES.note : texteBouton;
    if (corriger) corriger.hidden = etat !== "inscrite";
  }

  function afficher(message, type) {
    retour.textContent = message;
    retour.className = "attente__retour attente__retour--" + type;
  }

  // « Envoi… » est aussi écrit, caché, dans la zone de statut : un lecteur d’écran entend l’attente.
  function annoncerLEnvoi() {
    afficher("", "envoi");
    var texte = document.createElement("span");
    texte.className = "visuellement-cache";
    texte.textContent = TEXTES.envoi;
    retour.appendChild(texte);
  }

  function signaler(message) {
    afficher(message, "erreur");
    champ.setAttribute("aria-invalid", "true");
    champ.focus();
  }

  function rouvrir() {
    aller("repos");
  }

  // Formspree répond 422 quand il refuse un envoi, avec la liste de ce qu’il refuse (errors[].field, errors[].code).
  // Seul un refus de l’adresse elle-même mérite « vérifie ton adresse » ; un autre refus est une panne de notre côté.
  function refusDeLAdresse(corps) {
    var erreurs = corps && corps.errors;
    return Array.isArray(erreurs) && erreurs.some(function (e) {
      return !!e && (e.field === "email" || e.code === "TYPE_EMAIL");
    });
  }

  // L’issue d’un envoi : "ok", "refusee" ou "panne". La promesse ne rejette jamais et se règle une seule fois, à la
  // réponse ou au bout de DELAI_MS (même sans AbortController) ; l’affichage vient après, hors de tout catch.
  function transmettre(urlEnvoi, donnees) {
    return new Promise(function (conclure) {
      var regle = false;
      var controle = typeof AbortController === "function" ? new AbortController() : null;
      var minuteur = setTimeout(function () {
        if (controle) controle.abort();
        une("panne");
      }, DELAI_MS);
      function une(issue) {
        if (regle) return;
        regle = true;
        clearTimeout(minuteur);
        conclure(issue);
      }
      fetch(urlEnvoi, {
        method: "POST",
        body: donnees,
        headers: { Accept: "application/json" },
        signal: controle ? controle.signal : undefined
      })
        .then(function (reponse) {
          if (reponse.ok) return "ok";
          if (reponse.status !== 422) return "panne";
          return reponse.json().then(function (corps) {
            return refusDeLAdresse(corps) ? "refusee" : "panne";
          }, function () { return "panne"; });
        }, function () { return "panne"; })
        .then(une, function () { une("panne"); });
    });
  }

  function ouvrirLaMessagerie(courriel) {
    var sujet = encodeURIComponent("Préviens-moi au lancement");
    var corps = encodeURIComponent("Mon adresse : " + courriel);
    window.location.href = "mailto:" + CONTACT + "?subject=" + sujet + "&body=" + corps;
    afficher(TEXTES.messagerie, "ok");
  }

  function inscrire(courriel) {
    inscrite = courriel;
    afficher(TEXTES.inscrite(courriel), "ok");
    aller("inscrite");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (etat !== "repos") return;

    var courriel = champ.value.trim();
    if (!courriel || !champ.checkValidity()) return signaler(TEXTES.forme);
    if (!ADRESSE_COMPLETE.test(courriel)) return signaler(TEXTES.incomplete);
    champ.removeAttribute("aria-invalid");

    var urlEnvoi = form.getAttribute("action") || "";
    // Formulaire pas encore branché : on passe par un mail.
    if (urlEnvoi.indexOf("TON-ID-FORMSPREE") !== -1 || urlEnvoi === "") return ouvrirLaMessagerie(courriel);

    var donnees = new FormData(form);
    if (inscrite && inscrite !== courriel) donnees.append("remplace", inscrite);

    aller("envoi");
    annoncerLEnvoi();

    transmettre(urlEnvoi, donnees).then(function (issue) {
      if (issue === "ok") return inscrire(courriel);
      rouvrir();
      if (issue === "refusee") signaler(TEXTES.refusee);
      else afficher(TEXTES.panne, "erreur");
    });
  });

  if (corriger) {
    corriger.addEventListener("click", function () {
      rouvrir();
      afficher("", "ok");
      champ.focus();
      champ.select();
    });
  }

  champ.addEventListener("input", function () {
    champ.removeAttribute("aria-invalid");
    if (etat === "inscrite") rouvrir();
  });
})();

/* Le film : la version portrait sur téléphone, paysage ailleurs ; lecture muette en boucle, le son au choix.
   La page ne nomme aucune affiche et ne précharge pas le film (preload="none") : on choisit ici l’affiche
   de l’écran, la seule téléchargée, et le film ne se charge qu’en arrivant à l’écran.
   Il part seul : « Pause », juste avant le son, l’arrête (WCAG 2.2.2), et la pause tient, le film ne repart pas en
   revenant à l’écran. Chaque bouton dit ce qu’il fera (« Pause » / « Lire », « Mettre le son » / « Couper le son »),
   sans état « enfoncé » qui contredirait son nom (4.1.2). En mouvement réduit, ou si le navigateur refuse la lecture
   automatique, le lecteur classique remplace les deux boutons. */
(function () {
  var video = document.getElementById("film");
  var cadre = document.getElementById("film-cadre");
  var commandes = document.getElementById("film-commandes");
  var lecture = document.getElementById("film-lecture");
  var bouton = document.getElementById("film-son");
  if (!video || !cadre || !commandes || !lecture || !bouton) return;

  var portrait = window.matchMedia("(max-width: 719px) and (orientation: portrait)").matches;
  video.poster = video.getAttribute(portrait ? "data-affiche-portrait" : "data-affiche-paysage");
  if (portrait) {
    cadre.classList.add("film__cadre--portrait");
    video.src = video.getAttribute("data-portrait");
  }

  var calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Vrai quand la personne a mis le film en pause : il ne repart alors que par « Lire » (ou « Mettre le son »).
  var arreteParToi = false;

  // Le focus d’un bouton qui s’efface passe au lecteur classique qui le remplace, pas à la page.
  function lecteurClassique() {
    var avaitLeFocus = commandes.contains(document.activeElement);
    video.controls = true;
    commandes.hidden = true;
    if (avaitLeFocus) video.focus();
  }

  // Une lecture refusée (lecture automatique bloquée, film illisible) passe au lecteur classique. Une lecture annulée
  // par une pause avant d’avoir commencé (AbortError : le film se chargeait encore) n’est pas un refus.
  function lire() {
    var essai = video.play();
    if (essai && essai.catch) {
      essai.catch(function (erreur) {
        if (!erreur || erreur.name !== "AbortError") lecteurClassique();
      });
    }
  }

  function direLaLecture() {
    lecture.textContent = video.paused ? "Lire" : "Pause";
  }

  if (calme) {
    lecteurClassique();
  } else {
    lecture.hidden = false;
    direLaLecture();
    video.addEventListener("play", direLaLecture);
    video.addEventListener("pause", direLaLecture);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entrees) {
        entrees.forEach(function (entree) {
          if (!entree.isIntersecting) video.pause();
          else if (!arreteParToi) lire();
        });
      }, { threshold: 0.35 }).observe(video);
    }
  }

  lecture.addEventListener("click", function () {
    arreteParToi = !video.paused;
    if (arreteParToi) video.pause();
    else lire();
  });

  bouton.addEventListener("click", function () {
    var avecSon = video.muted;
    video.muted = !avecSon;
    if (avecSon) {
      arreteParToi = false;
      video.currentTime = 0;
      lire();
    }
    bouton.classList.toggle("film__son--avec-son", avecSon);
    bouton.textContent = avecSon ? "Couper le son" : "Mettre le son";
  });
})();
