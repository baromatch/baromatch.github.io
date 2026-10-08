/* Baromatch — la boutique.

   Aujourd'hui : mode « réservation ». Rien n'est vendu ni payé. Le fan choisit ses pièces, laisse son adresse,
   et la réservation part par Formspree (le même formulaire que la liste d'attente) vers contact@baromatch.fr.

   Pour vendre plus tard, sans toucher au reste : renseigne `lienAchat` sur un produit (un lien de paiement Stripe,
   une page produit d'une boutique en impression à la demande…). Son bouton devient « Acheter » et ouvre ce lien.
   Les prix ci-dessous sont indicatifs : ils sont affichés comme tels tant que `lienAchat` est vide. */

(function () {
  "use strict";

  var CONFIG = {
    formulaire: "https://formspree.io/f/mqpeedoj",
    contact: "contact@baromatch.fr",
    quantiteMax: 5,
    piecesMax: 20,
    cleStockage: "baromatch-boutique-v1"
  };

  var COULEURS = {
    nuit: { nom: "Nuit", tissu: "#161925", contour: "rgba(255,255,255,0.20)", encre: "#F7F7F9", marque: "bq-marque" },
    creme: { nom: "Crème", tissu: "#EFE6D6", contour: "rgba(10,11,16,0.16)", encre: "#12141C", marque: "bq-marque-nuit" },
    naturel: { nom: "Naturel", tissu: "#E8DCC3", contour: "rgba(10,11,16,0.16)", encre: "#12141C", marque: "bq-marque-nuit" },
    nuitAmbre: { nom: "Nuit et ambre", tissu: "#161925", contour: "rgba(255,255,255,0.20)", encre: "#F7F7F9", marque: "bq-marque" }
  };

  var TAILLES = ["XS", "S", "M", "L", "XL", "XXL"];

  var PRODUITS = [
    {
      id: "tshirt-le-verre",
      nom: "Le verre",
      type: "T-shirt",
      prix: 29,
      texte: "Coton bio épais, coupe droite. Le verre de Baromatch sur le cœur, rien d’autre.",
      couleurs: ["nuit", "creme"],
      tailles: TAILLES,
      dessin: "tshirt",
      lienAchat: null
    },
    {
      id: "sweat-coup-d-envoi",
      nom: "Coup d’envoi",
      type: "Sweat à capuche",
      prix: 59,
      texte: "Molleton doux pour les fins de match en terrasse. Le verre et « Coup d’envoi » sur la poitrine.",
      couleurs: ["nuit", "creme"],
      tailles: TAILLES,
      dessin: "sweat",
      lienAchat: null
    },
    {
      id: "casquette",
      nom: "La casquette",
      type: "Casquette brodée",
      prix: 25,
      texte: "Six pans, visière courbée, réglable à l’arrière. Le verre brodé devant.",
      couleurs: ["nuit", "creme"],
      tailles: null,
      dessin: "casquette",
      lienAchat: null
    },
    {
      id: "echarpe",
      nom: "L’écharpe",
      type: "Écharpe tricotée",
      prix: 25,
      texte: "Aux couleurs de la nuit et de l’ambre. Aucun club dessus : elle va à tous les matchs.",
      couleurs: ["nuitAmbre"],
      tailles: null,
      dessin: "echarpe",
      lienAchat: null
    },
    {
      id: "tote-ce-soir",
      nom: "Ce soir",
      type: "Tote bag",
      prix: 19,
      texte: "Toile de coton épaisse, assez grande pour le maillot et l’écharpe.",
      couleurs: ["naturel"],
      tailles: null,
      dessin: "tote",
      lienAchat: null
    },
    {
      id: "sous-bocks",
      nom: "Les sous-bocks",
      type: "Lot de 6",
      prix: 12,
      texte: "Le sous-bock de l’appli, en vrai : carton épais, six numéros différents.",
      couleurs: null,
      tailles: null,
      dessin: "sousbocks",
      lienAchat: null
    }
  ];

  // ---------- Les dessins (SVG, 320 × 320) ----------

  function attrs(c) {
    return 'fill="' + c.tissu + '" stroke="' + c.contour + '" stroke-width="2" stroke-linejoin="round"';
  }

  function volume(d) {
    return '<path d="' + d + '" fill="url(#bq-ombre)"/><path d="' + d + '" fill="url(#bq-pli)"/>';
  }

  var DESSINS = {
    tshirt: function (c) {
      var corps = "M112 50 L72 64 L30 104 L60 142 L86 126 L86 282 Q160 292 234 282 L234 126 L260 142 L290 104 L248 64 L208 50 Q196 80 160 80 Q124 80 112 50 Z";
      return '<path d="' + corps + '" ' + attrs(c) + "/>" + volume(corps) +
        '<path d="M112 50 Q124 80 160 80 Q196 80 208 50" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M86 126 L86 140 M234 126 L234 140" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>' +
        '<use href="#' + c.marque + '" x="184" y="104" width="36" height="36"/>';
    },
    sweat: function (c) {
      var corps = "M104 74 L66 88 L40 150 L36 262 L64 268 L74 168 L86 156 L86 288 Q160 298 234 288 L234 156 L246 168 L256 268 L284 262 L280 150 L254 88 L216 74 Z";
      var capuche = "M112 78 Q106 26 160 24 Q214 26 208 78 Q186 100 160 100 Q134 100 112 78 Z";
      return '<path d="' + corps + '" ' + attrs(c) + "/>" + volume(corps) +
        '<path d="M36 262 L64 268 L63 282 L35 276 Z M284 262 L256 268 L257 282 L285 276 Z M86 288 Q160 298 234 288 L234 302 Q160 312 86 302 Z" ' + attrs(c) + "/>" +
        '<path d="M36 262 L64 268 L63 282 L35 276 Z M284 262 L256 268 L257 282 L285 276 Z M86 288 Q160 298 234 288 L234 302 Q160 312 86 302 Z" fill="rgba(0,0,0,0.18)"/>' +
        '<path d="' + capuche + '" ' + attrs(c) + "/>" + volume(capuche) +
        '<path d="M128 76 Q128 44 160 42 Q192 44 192 76 Q178 90 160 90 Q142 90 128 76 Z" fill="rgba(0,0,0,0.38)"/>' +
        '<path d="M146 98 L142 136 M174 98 L178 136" stroke="' + c.encre + '" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M114 214 L206 214 L220 262 L100 262 Z" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3" stroke-linejoin="round"/>' +
        '<use href="#' + c.marque + '" x="141" y="140" width="38" height="38"/>' +
        '<text x="160" y="198" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="2.2" fill="#FFB13D">COUP D’ENVOI</text>';
    },
    casquette: function (c) {
      var calotte = "M64 196 Q60 100 160 92 Q260 100 256 196 Z";
      var visiere = "M48 196 Q160 176 272 196 Q280 222 244 232 Q160 214 76 232 Q40 222 48 196 Z";
      return '<path d="' + calotte + '" ' + attrs(c) + "/>" + volume(calotte) +
        '<path d="M160 94 L160 192 M112 104 Q100 150 104 194 M208 104 Q220 150 216 194" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="2"/>' +
        '<circle cx="160" cy="94" r="7" ' + attrs(c) + "/>" +
        '<path d="' + visiere + '" ' + attrs(c) + '/><path d="' + visiere + '" fill="rgba(0,0,0,0.24)"/>' +
        '<path d="M64 196 Q160 182 256 196" fill="none" stroke="rgba(0,0,0,0.32)" stroke-width="3"/>' +
        '<use href="#' + c.marque + '" x="132" y="118" width="56" height="56"/>';
    },
    echarpe: function () {
      var franges = "";
      for (var y = 124; y <= 196; y += 8) {
        franges += "M24 " + y + " L8 " + (y + 3) + " M296 " + y + " L312 " + (y + 3) + " ";
      }
      return '<path d="' + franges + '" stroke="#FFB13D" stroke-width="3" stroke-linecap="round"/>' +
        '<rect x="24" y="118" width="272" height="84" rx="6" fill="#161925" stroke="rgba(255,255,255,0.20)" stroke-width="2"/>' +
        '<rect x="24" y="118" width="46" height="84" rx="6" fill="url(#bq-ambre)"/><rect x="250" y="118" width="46" height="84" rx="6" fill="url(#bq-ambre)"/>' +
        '<rect x="54" y="118" width="6" height="84" fill="#161925"/><rect x="260" y="118" width="6" height="84" fill="#161925"/>' +
        '<path d="M24 132 H296 M24 188 H296" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>' +
        '<rect x="24" y="118" width="272" height="84" rx="6" fill="url(#bq-ombre)"/>' +
        '<text x="160" y="168" text-anchor="middle" font-size="20" font-weight="800" letter-spacing="3" fill="#F7F7F9">BAROMATCH</text>';
    },
    tote: function (c) {
      var sac = "M78 104 L242 104 L250 292 Q160 298 70 292 Z";
      return '<path d="M118 112 Q116 44 160 44 Q204 44 202 112" fill="none" stroke="#D3C3A3" stroke-width="12" stroke-linecap="round"/>' +
        '<path d="' + sac + '" ' + attrs(c) + "/>" + volume(sac) +
        '<path d="M110 104 H128 V126 H110 Z M192 104 H210 V126 H192 Z" fill="rgba(0,0,0,0.08)"/>' +
        '<g font-weight="800" font-size="25" letter-spacing="-0.4" fill="#12141C">' +
        '<text x="94" y="170">Ton match.</text><text x="94" y="202">Ton bar.</text><text x="94" y="234" fill="#C76E08">Ce soir.</text></g>' +
        '<use href="#bq-marque-nuit" x="204" y="252" width="28" height="28"/>';
    },
    sousbocks: function () {
      return '<circle cx="118" cy="138" r="80" fill="#E3D6BD" stroke="rgba(10,11,16,0.16)" stroke-width="2"/>' +
        '<circle cx="118" cy="138" r="66" fill="none" stroke="#12141C" stroke-opacity="0.22" stroke-width="2" stroke-dasharray="2 6"/>' +
        '<text x="98" y="110" text-anchor="middle" font-size="24" font-weight="800" fill="#12141C" fill-opacity="0.72">N°12</text>' +
        '<circle cx="202" cy="186" r="88" fill="rgba(0,0,0,0.35)"/>' +
        '<circle cx="196" cy="178" r="88" fill="#F3EBDD" stroke="rgba(10,11,16,0.16)" stroke-width="2"/>' +
        '<circle cx="196" cy="178" r="76" fill="none" stroke="#12141C" stroke-opacity="0.22" stroke-width="2" stroke-dasharray="2 6"/>' +
        '<use href="#bq-marque-nuit" x="162" y="122" width="68" height="68"/>' +
        '<text x="196" y="222" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="2.4" fill="#12141C">BAROMATCH</text>' +
        '<text x="196" y="240" text-anchor="middle" font-size="11" font-weight="600" fill="#12141C" fill-opacity="0.6">N°08</text>';
    }
  };

  function dessin(produit, cleCouleur) {
    var c = COULEURS[cleCouleur || "nuit"] || COULEURS.nuit;
    var nomCouleur = produit.couleurs && produit.couleurs.length > 1 ? ", coloris " + c.nom : "";
    return '<svg viewBox="0 0 320 320" role="img" aria-label="' + echapper(produit.type + " " + produit.nom + nomCouleur) + '">' +
      DESSINS[produit.dessin](c) + "</svg>";
  }

  // ---------- Outils ----------

  var euros = (function () {
    try {
      var f = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
      return function (n) { return f.format(n); };
    } catch (e) {
      return function (n) { return n + " €"; };
    }
  })();

  function echapper(texte) {
    return String(texte).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function produitPar(id) {
    for (var i = 0; i < PRODUITS.length; i++) if (PRODUITS[i].id === id) return PRODUITS[i];
    return null;
  }

  function pieces(n) { return n + (n > 1 ? " pièces" : " pièce"); }

  // ---------- La réservation, gardée sur l'appareil ----------

  var panier = lire();

  function lire() {
    try {
      var brut = window.localStorage.getItem(CONFIG.cleStockage);
      var liste = brut ? JSON.parse(brut) : [];
      return Array.isArray(liste) ? liste.filter(function (l) { return produitPar(l.id) && l.quantite > 0; }) : [];
    } catch (e) {
      return [];
    }
  }

  function garder() {
    try { window.localStorage.setItem(CONFIG.cleStockage, JSON.stringify(panier)); } catch (e) { /* stockage indisponible : la réservation reste en mémoire */ }
  }

  function totalPieces() { return panier.reduce(function (s, l) { return s + l.quantite; }, 0); }
  function totalEuros() { return panier.reduce(function (s, l) { return s + l.quantite * produitPar(l.id).prix; }, 0); }

  function detailLigne(l) {
    var p = produitPar(l.id);
    var morceaux = [];
    if (l.couleur && p.couleurs && p.couleurs.length > 1) morceaux.push(COULEURS[l.couleur].nom);
    if (l.taille) morceaux.push("taille " + l.taille);
    return morceaux.join(", ");
  }

  // ---------- La vitrine ----------

  var grille = document.getElementById("boutique-grille");
  if (!grille) return;

  function choix(produit, nom, legende, options, rendu) {
    var html = '<fieldset class="boutique-choix"><legend>' + legende + '</legend><div class="boutique-choix__options">';
    options.forEach(function (valeur, i) {
      var idChamp = produit.id + "-" + nom + "-" + i;
      html += '<label class="boutique-puce" for="' + idChamp + '"><input type="radio" id="' + idChamp + '" name="' + produit.id + "-" + nom +
        '" value="' + echapper(valeur) + '"' + (nom === "couleur" && i === 0 ? " checked" : "") + "><span>" + rendu(valeur) + "</span></label>";
    });
    return html + "</div></fieldset>";
  }

  PRODUITS.forEach(function (p) {
    var article = document.createElement("article");
    article.className = "boutique-produit";
    article.setAttribute("aria-labelledby", "nom-" + p.id);
    var premiere = p.couleurs ? p.couleurs[0] : null;
    var html = '<div class="boutique-produit__vitrine" data-vitrine>' + dessin(p, premiere) + "</div>" +
      '<div class="boutique-produit__corps">' +
      '<p class="boutique-produit__type">' + echapper(p.type) + "</p>" +
      '<h3 class="boutique-produit__nom" id="nom-' + p.id + '">' + echapper(p.nom) + "</h3>" +
      '<p class="boutique-produit__texte">' + echapper(p.texte) + "</p>" +
      '<p class="boutique-produit__prix">' + euros(p.prix) + (p.lienAchat ? "" : " <span>prix indicatif</span>") + "</p>";
    if (p.couleurs && p.couleurs.length > 1) {
      html += choix(p, "couleur", "Couleur", p.couleurs, function (cle) {
        return '<i class="boutique-pastille" style="background:' + COULEURS[cle].tissu + '" aria-hidden="true"></i>' + COULEURS[cle].nom;
      });
    }
    if (p.tailles) {
      html += choix(p, "taille", "Taille", p.tailles, function (t) { return t; });
    }
    html += p.lienAchat
      ? '<a class="boutique-produit__ajouter" href="' + echapper(p.lienAchat) + '" rel="noopener">Acheter</a>'
      : '<button class="boutique-produit__ajouter" type="button" data-ajouter>Ajouter à ma réservation</button>';
    html += '<p class="boutique-produit__retour" role="status" aria-live="polite"></p></div>';
    article.innerHTML = html;
    grille.appendChild(article);

    var vitrine = article.querySelector("[data-vitrine]");
    var retour = article.querySelector(".boutique-produit__retour");

    article.addEventListener("change", function (event) {
      if (event.target.name === p.id + "-couleur") vitrine.innerHTML = dessin(p, event.target.value);
      if (event.target.name === p.id + "-taille") { retour.textContent = ""; retour.className = "boutique-produit__retour"; }
    });

    var bouton = article.querySelector("[data-ajouter]");
    if (!bouton) return;
    bouton.addEventListener("click", function () {
      var couleur = p.couleurs ? (article.querySelector('input[name="' + p.id + '-couleur"]:checked') || {}).value || p.couleurs[0] : null;
      var taille = null;
      if (p.tailles) {
        var coche = article.querySelector('input[name="' + p.id + '-taille"]:checked');
        if (!coche) {
          retour.textContent = "Choisis d’abord ta taille.";
          retour.className = "boutique-produit__retour boutique-produit__retour--erreur";
          article.querySelector('input[name="' + p.id + '-taille"]').focus();
          return;
        }
        taille = coche.value;
      }
      if (totalPieces() >= CONFIG.piecesMax) {
        retour.textContent = "Ta réservation est pleine (" + CONFIG.piecesMax + " pièces au plus).";
        retour.className = "boutique-produit__retour boutique-produit__retour--erreur";
        return;
      }
      var ligne = panier.filter(function (l) { return l.id === p.id && l.couleur === couleur && l.taille === taille; })[0];
      if (ligne) {
        if (ligne.quantite >= CONFIG.quantiteMax) {
          retour.textContent = CONFIG.quantiteMax + " exemplaires au plus pour une même pièce.";
          retour.className = "boutique-produit__retour boutique-produit__retour--erreur";
          return;
        }
        ligne.quantite += 1;
      } else {
        panier.push({ id: p.id, couleur: couleur, taille: taille, quantite: 1 });
      }
      garder();
      majBarre();
      var detail = detailLigne({ id: p.id, couleur: couleur, taille: taille });
      retour.textContent = "Ajouté à ta réservation" + (detail ? " (" + detail + ")" : "") + ".";
      retour.className = "boutique-produit__retour";
    });
  });

  // ---------- La barre et le panneau ----------

  var barre = document.getElementById("boutique-barre");
  var barreTexte = document.getElementById("barre-texte");
  var dialogue = document.getElementById("panier");
  var liste = document.getElementById("panier-liste");
  var total = document.getElementById("panier-total");
  var formulaire = document.getElementById("panier-form");
  var vue = document.getElementById("panier-vue");
  var merci = document.getElementById("panier-merci");
  var retourForm = document.getElementById("panier-retour");
  var envoyer = formulaire.querySelector('button[type="submit"]');

  function majBarre() {
    var n = totalPieces();
    barre.hidden = n === 0;
    document.body.classList.toggle("avec-barre", n > 0);
    barreTexte.textContent = pieces(n) + " · " + euros(totalEuros()) + " (indicatif)";
  }

  function majPanier() {
    liste.innerHTML = "";
    panier.forEach(function (l, i) {
      var p = produitPar(l.id);
      var li = document.createElement("li");
      li.className = "panier__ligne";
      var detail = detailLigne(l);
      li.innerHTML = '<div><p class="panier__nom">' + echapper(p.nom) + " <span>" + echapper(p.type) + "</span></p>" +
        (detail ? '<p class="panier__detail">' + echapper(detail) + "</p>" : "") +
        '<button class="panier__retirer" type="button" data-retirer="' + i + '">Retirer</button></div>' +
        '<div class="panier__droite"><div class="panier__quantite" role="group" aria-label="Quantité de ' + echapper(p.nom) + '">' +
        '<button type="button" data-moins="' + i + '" aria-label="Un de moins">−</button>' +
        "<output>" + l.quantite + "</output>" +
        '<button type="button" data-plus="' + i + '" aria-label="Un de plus">+</button></div>' +
        '<p class="panier__prix">' + euros(l.quantite * p.prix) + "</p></div>";
      liste.appendChild(li);
    });
    total.textContent = euros(totalEuros());
    if (panier.length === 0) {
      liste.innerHTML = '<li class="panier__vide">Ta réservation est vide. Choisis une pièce dans la collection.</li>';
    }
    envoyer.disabled = panier.length === 0;
  }

  liste.addEventListener("click", function (event) {
    var cible = event.target.closest("button");
    if (!cible) return;
    var i;
    if (cible.hasAttribute("data-retirer")) {
      panier.splice(Number(cible.getAttribute("data-retirer")), 1);
    } else if (cible.hasAttribute("data-moins")) {
      i = Number(cible.getAttribute("data-moins"));
      panier[i].quantite -= 1;
      if (panier[i].quantite <= 0) panier.splice(i, 1);
    } else if (cible.hasAttribute("data-plus")) {
      i = Number(cible.getAttribute("data-plus"));
      if (panier[i].quantite < CONFIG.quantiteMax && totalPieces() < CONFIG.piecesMax) panier[i].quantite += 1;
    } else {
      return;
    }
    garder();
    majPanier();
    majBarre();
  });

  function ouvrir() {
    vue.hidden = false;
    merci.hidden = true;
    retourForm.textContent = "";
    majPanier();
    if (typeof dialogue.showModal === "function") dialogue.showModal();
    else dialogue.setAttribute("open", "");
  }

  function fermer() {
    if (typeof dialogue.close === "function") dialogue.close();
    else dialogue.removeAttribute("open");
  }

  document.getElementById("barre-ouvrir").addEventListener("click", ouvrir);
  Array.prototype.forEach.call(document.querySelectorAll("[data-fermer]"), function (b) { b.addEventListener("click", fermer); });
  dialogue.addEventListener("click", function (event) { if (event.target === dialogue) fermer(); });

  function resume() {
    return panier.map(function (l) {
      var p = produitPar(l.id);
      var detail = detailLigne(l);
      return l.quantite + " × " + p.nom + " (" + p.type + ")" + (detail ? " — " + detail : "") + " — " + euros(l.quantite * p.prix);
    }).join("\n");
  }

  function erreur(message) {
    retourForm.className = "panier__retour panier__retour--erreur";
    retourForm.innerHTML = message;
  }

  formulaire.addEventListener("submit", function (event) {
    event.preventDefault();
    var mail = formulaire.querySelector('input[type="email"]');
    var accord = formulaire.querySelector('input[name="accord"]');
    if (panier.length === 0) { erreur("Ajoute au moins une pièce."); return; }
    if (!mail.value || !mail.checkValidity()) { erreur("Vérifie ton adresse mail : elle doit ressembler à prenom@exemple.fr."); mail.focus(); return; }
    if (!accord.checked) { erreur("Coche la case pour qu’on puisse t’écrire à l’ouverture."); accord.focus(); return; }

    document.getElementById("panier-selection").value = resume();
    document.getElementById("panier-total-champ").value = euros(totalEuros()) + " (indicatif), " + pieces(totalPieces());

    envoyer.disabled = true;
    envoyer.textContent = "Envoi…";
    retourForm.textContent = "";

    fetch(CONFIG.formulaire, { method: "POST", body: new FormData(formulaire), headers: { Accept: "application/json" } })
      .then(function (reponse) {
        if (!reponse.ok) throw new Error("HTTP " + reponse.status);
        panier = [];
        garder();
        majBarre();
        formulaire.reset();
        vue.hidden = true;
        merci.hidden = false;
        merci.querySelector("h3").focus();
      })
      .catch(function () {
        var sujet = encodeURIComponent("Réservation boutique Baromatch");
        var corps = encodeURIComponent("Ma réservation :\n" + resume() + "\n\nMon adresse : " + mail.value);
        erreur("La réservation n’est pas partie. Réessaie dans un instant, ou <a href=\"mailto:" + CONFIG.contact + "?subject=" + sujet + "&body=" + corps + "\">envoie-la par mail</a>.");
      })
      .then(function () {
        envoyer.disabled = panier.length === 0;
        envoyer.textContent = "Réserver sans payer";
      });
  });

  majBarre();
})();
