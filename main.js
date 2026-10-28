/* Baromatch — liste d’attente
   L’adresse d’envoi est l’attribut action du formulaire de index.html (Formspree). S’il est vide ou garde
   TON-ID-FORMSPREE, le bouton ouvre un mail vers contact@baromatch.fr.

   Après l’inscription, l’adresse reste dans le champ et le message la rappelle : une faute se voit. « Corriger
   l’adresse » (ou taper dans le champ) rouvre l’envoi ; la nouvelle inscription porte aussi l’adresse qu’elle
   remplace (champ « remplace »), comme une autre ville choisie après l’inscription. Ce champ informe seulement le
   propriétaire : rien n’est remplacé ni effacé sur sa seule foi (n’importe qui peut l’écrire en envoyant au
   formulaire), une suppression passe par contact@baromatch.fr.

   L’issue d’un envoi se décide en un seul endroit (transmettre) : inscrite, adresse refusée par Formspree, ou panne
   (réseau, pas de réponse en 10 s, tout autre refus). Chaque échec laisse une issue : écrire à contact@baromatch.fr.
   (Le même texte et la même règle sont dans boutique.js : ses tests et ceux-ci vérifient les deux pages.)

   La ville (Paris, Lyon, Marseille, Lille ou Autre) part avec l’adresse ; le message d’inscription la reprend. */

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
    inscrite: function (courriel, ville) {
      var quand = ville === "Paris" || !ville ? "au lancement et pour les premiers tests"
        : ville === "Autre" ? "si Baromatch ouvre dans une nouvelle ville" : "si Baromatch arrive à " + ville;
      return "C’est noté : on t’écrit à " + courriel + " " + quand + ".";
    }
  };
  var inscrite = "";
  var villeInscrite = "";
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

  function villeChoisie() {
    var choix = form.querySelector('input[name="ville"]:checked');
    return choix ? choix.value : "";
  }

  function ouvrirLaMessagerie(courriel, ville) {
    var sujet = encodeURIComponent("Préviens-moi au lancement");
    var corps = encodeURIComponent("Mon adresse : " + courriel + (ville ? "\nMa ville : " + ville : ""));
    window.location.href = "mailto:" + CONTACT + "?subject=" + sujet + "&body=" + corps;
    afficher(TEXTES.messagerie, "ok");
  }

  // Une inscription réussie se dit aussi à la mesure d’audience (mesure.js, si elle est active) : seulement qu’elle a
  // eu lieu, ni l’adresse ni la ville.
  function inscrire(courriel, ville) {
    inscrite = courriel;
    villeInscrite = ville;
    afficher(TEXTES.inscrite(courriel, ville), "ok");
    aller("inscrite");
    document.dispatchEvent(new CustomEvent("baromatch:compter", { detail: "liste-attente" }));
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
    var ville = villeChoisie();
    if (urlEnvoi.indexOf("TON-ID-FORMSPREE") !== -1 || urlEnvoi === "") return ouvrirLaMessagerie(courriel, ville);

    var donnees = new FormData(form);
    if (inscrite && (inscrite !== courriel || villeInscrite !== ville)) donnees.append("remplace", inscrite);

    aller("envoi");
    annoncerLEnvoi();

    transmettre(urlEnvoi, donnees).then(function (issue) {
      if (issue === "ok") return inscrire(courriel, ville);
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

  // Une autre ville après l’inscription rouvre l’envoi, comme une adresse corrigée.
  form.addEventListener("change", function (event) {
    if (event.target.name === "ville" && etat === "inscrite") rouvrir();
  });
})();

/* Le film, sans le son : il part seul, en boucle, à l’écran (rien ne se charge avant), et s’arrête hors de l’écran.
   Son bouton l’arrête (WCAG 2.2.2), et la pause tient. Le bouton dit ce qu’il fera, sans état « enfoncé » (4.1.2). En
   mouvement réduit, en économie de données, ou si la lecture automatique est refusée : le lecteur classique. */
(function () {
  var video = document.getElementById("film");
  var lecture = document.getElementById("film-lecture");
  if (!video || !lecture) return;

  var icone = lecture.querySelector("path");
  var calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var econome = navigator.connection && navigator.connection.saveData;
  // Vrai quand la personne a mis le film en pause : il ne repart alors que par son bouton.
  var arreteParToi = false;
  var observateur = null;

  // Le focus du bouton passe au lecteur classique, qui est à la personne : le défilement ne le lance plus.
  function lecteurClassique() {
    var avaitLeFocus = document.activeElement === lecture;
    if (observateur) observateur.disconnect();
    video.controls = true;
    lecture.hidden = true;
    if (avaitLeFocus) video.focus();
  }

  // Une lecture refusée passe au lecteur classique ; une lecture annulée par une pause (AbortError) n’est pas un refus.
  function lire() {
    var essai = video.play();
    if (essai && essai.catch) {
      essai.catch(function (erreur) {
        if (!erreur || erreur.name !== "AbortError") lecteurClassique();
      });
    }
  }

  function direLaLecture() {
    lecture.setAttribute("aria-label", video.paused ? "Lire le film" : "Mettre le film en pause");
    icone.setAttribute("d", video.paused ? "M7 4.5v15l12-7.5z" : "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z");
  }

  if (calme || econome) {
    lecteurClassique();
    return;
  }
  lecture.hidden = false;
  direLaLecture();
  video.addEventListener("play", direLaLecture);
  video.addEventListener("pause", direLaLecture);
  if ("IntersectionObserver" in window) {
    observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (!entree.isIntersecting) video.pause();
        else if (!arreteParToi) lire();
      });
    }, { threshold: 0.35 });
    observateur.observe(video);
  }

  lecture.addEventListener("click", function () {
    arreteParToi = !video.paused;
    if (arreteParToi) video.pause();
    else lire();
  });
})();

/* Un soir de match : ses écrans ne se chargent qu’à 600 px de la section (.est-proche). Sur ordinateur, ils sont
   empilés à côté des moments (.instant), et celui du moment au milieu de la fenêtre se montre (.est-actif). */
(function () {
  var soiree = document.querySelector(".soiree");
  var instants = document.querySelectorAll(".instant");
  if (!soiree || !instants.length) return;
  if (!("IntersectionObserver" in window)) {
    soiree.classList.add("est-proche");
    return;
  }
  var approche = new IntersectionObserver(function (entrees) {
    if (entrees[0].isIntersecting) {
      soiree.classList.add("est-proche");
      approche.disconnect();
    }
  }, { rootMargin: "600px 0px" });
  approche.observe(soiree);

  // Parmi les moments dans la bande du milieu (30 % de la fenêtre), le plus proche du milieu ; bande vide : rien ne change.
  var dansLaBande = [];
  var milieu = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (entree) {
      var rang = dansLaBande.indexOf(entree.target);
      if (entree.isIntersecting && rang < 0) dansLaBande.push(entree.target);
      if (!entree.isIntersecting && rang >= 0) dansLaBande.splice(rang, 1);
    });
    var centre = window.innerHeight / 2;
    var proche = null;
    var ecart = Infinity;
    dansLaBande.forEach(function (corps) {
      var boite = corps.getBoundingClientRect();
      var ici = Math.abs(boite.top + boite.height / 2 - centre);
      if (ici < ecart) { ecart = ici; proche = corps; }
    });
    if (!proche) return;
    for (var i = 0; i < instants.length; i++) instants[i].classList.toggle("est-actif", instants[i] === proche.parentNode);
  }, { rootMargin: "-35% 0px -35% 0px" });
  for (var i = 0; i < instants.length; i++) milieu.observe(instants[i].querySelector(".instant__corps"));
})();

/* « Maintiens pour essayer » : le geste de l’appli. Tenir le bouton (doigt, souris, ou Espace et Entrée au clavier)
   remplit le verre en 1,4 s ; lâcher avant le vide. Plein, il dit « Place gardée. », puis revient au départ. Rien
   n’est envoyé ni réservé : la note, lue par les lecteurs d’écran (role="status"), le dit. En mouvement réduit, ou
   avec un lecteur d’écran (un clic sans pointeur), un appui suffit. */
(function () {
  var essai = document.getElementById("essai");
  var bouton = document.getElementById("essai-bouton");
  var mot = document.getElementById("essai-mot");
  var note = document.getElementById("essai-note");
  if (!essai || !bouton || !mot || !note) return;

  var calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DEPART = note.textContent;
  var minuteur = 0;
  var retour = 0;

  function remplir() {
    bouton.classList.remove("est-tenu");
    bouton.classList.add("est-plein");
    mot.textContent = "Place gardée.";
    note.textContent = "C’était un essai\u00a0: rien n’est réservé.";
    retour = setTimeout(function () {
      bouton.classList.remove("est-plein");
      mot.textContent = "Maintiens pour essayer";
      note.textContent = DEPART;
    }, 3500);
  }

  function tenir(evenement) {
    if (evenement.type === "keydown" && (evenement.repeat || (evenement.key !== " " && evenement.key !== "Enter"))) return;
    if (evenement.type === "pointerdown" && evenement.button !== 0) return;
    evenement.preventDefault();
    if (bouton.classList.contains("est-plein") || bouton.classList.contains("est-tenu")) return;
    clearTimeout(retour);
    if (calme) {
      remplir();
      return;
    }
    bouton.classList.add("est-tenu");
    minuteur = setTimeout(remplir, 1400);
  }

  function lacher() {
    if (!bouton.classList.contains("est-tenu")) return;
    clearTimeout(minuteur);
    bouton.classList.remove("est-tenu");
    note.textContent = "Lâché trop tôt\u00a0: le verre se vide. Tiens jusqu’au bout.";
  }

  bouton.addEventListener("pointerdown", tenir);
  bouton.addEventListener("keydown", tenir);
  ["pointerup", "pointerleave", "pointercancel", "keyup", "blur"].forEach(function (type) {
    bouton.addEventListener(type, lacher);
  });
  bouton.addEventListener("contextmenu", function (evenement) { evenement.preventDefault(); });
  // Un lecteur d’écran active un bouton par un simple clic, sans pointeur ni touche tenue : ce clic remplit le verre, comme
  // « Réserver sans maintenir » dans l’appli.
  bouton.addEventListener("click", function (evenement) {
    // (Une touche tenue n’en fait pas : son appui est annulé dans tenir().)
    if (evenement.detail === 0 && !bouton.classList.contains("est-plein")) {
      clearTimeout(retour);
      remplir();
    }
  });
  essai.hidden = false;
})();
