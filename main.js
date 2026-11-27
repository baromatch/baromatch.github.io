(function () {
var doc = document;
var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
doc.body.classList.add("js");

/* La liste d'attente : le formulaire de l'accueil (#attente), dans le premier écran. */
function liste(form) {
var champ = form.querySelector('input[type="email"]');
var bouton = form.querySelector('button[type="submit"]');
var retour = form.querySelector(".attente__retour");
var corriger = form.querySelector(".attente__corriger");
if (!champ || !bouton || !retour) return;
var texteBouton = bouton.textContent;
var CONTACT = "contact@baromatch.fr";
var DELAI_MS = 10000;
var ADRESSE_COMPLETE = /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/;
var TEXTES = {
forme: "Vérifie ton adresse mail : elle doit ressembler à prenom@exemple.fr.",
incomplete: "Il manque la fin de ton adresse, par exemple .fr ou .com.",
refusee: "Cette adresse ne semble pas valide. Vérifie-la : elle doit ressembler à prenom@exemple.fr. Si elle est juste, écris à " + CONTACT + ".",
panne: "L’inscription n’est pas passée. Réessaie dans un instant, ou écris à " + CONTACT + ".",
envoi: "Envoi…",
note: "Inscrit",
inscrite: function (courriel, ville) {
var quand = ville === "Paris" || !ville ? "au lancement et pour les premiers tests"
: ville === "Autre" ? "si Baromatch ouvre dans une nouvelle ville" : "si Baromatch arrive à " + ville;
return "C’est noté : on t’écrit à " + courriel + " " + quand + ".";
}
};
var inscrite = "";
var villeInscrite = "";
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
function annoncerLEnvoi() {
afficher("", "envoi");
var texte = doc.createElement("span");
texte.className = "visuellement-cache";
texte.textContent = TEXTES.envoi;
retour.appendChild(texte);
}
function montrerLeRetour() {
var bas = corriger && !corriger.hidden ? corriger : retour;
if (bas.scrollIntoView) bas.scrollIntoView({ block: "nearest" });
}
function signaler(message) {
afficher(message, "erreur");
champ.setAttribute("aria-invalid", "true");
champ.focus();
montrerLeRetour();
}
function rouvrir() {
aller("repos");
}
function refusDeLAdresse(corps) {
var erreurs = corps && corps.errors;
return Array.isArray(erreurs) && erreurs.some(function (e) {
return !!e && (e.field === "email" || e.code === "TYPE_EMAIL");
});
}
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
var choix = form.querySelector('input[name="ville"]:checked, input[type="hidden"][name="ville"]');
return choix ? choix.value : "";
}
function inscrire(courriel, ville) {
inscrite = courriel;
villeInscrite = ville;
afficher(TEXTES.inscrite(courriel, ville), "ok");
aller("inscrite");
montrerLeRetour();
doc.dispatchEvent(new CustomEvent("baromatch:compter", { detail: "liste-attente" }));
}
form.addEventListener("submit", function (event) {
event.preventDefault();
if (etat !== "repos") return;
var courriel = champ.value.trim();
if (!courriel || !champ.checkValidity()) return signaler(TEXTES.forme);
if (!ADRESSE_COMPLETE.test(courriel)) return signaler(TEXTES.incomplete);
champ.removeAttribute("aria-invalid");
var urlEnvoi = form.getAttribute("action") || "";
var ville = villeChoisie();
var donnees = new FormData(form);
if (inscrite && (inscrite !== courriel || villeInscrite !== ville)) donnees.append("remplace", inscrite);
aller("envoi");
annoncerLEnvoi();
transmettre(urlEnvoi, donnees).then(function (issue) {
if (issue === "ok") return inscrire(courriel, ville);
rouvrir();
if (issue === "refusee") return signaler(TEXTES.refusee);
afficher(TEXTES.panne, "erreur");
montrerLeRetour();
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
form.addEventListener("change", function (event) {
if (event.target.name === "ville" && etat === "inscrite") rouvrir();
});
}
Array.prototype.forEach.call(doc.querySelectorAll("form[data-attente]"), liste);
doc.addEventListener("click", function (evenement) {
if (evenement.defaultPrevented || evenement.button || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey || evenement.altKey) return;
var lien = evenement.target.closest && evenement.target.closest('a[href="#attente"]');
var champ = doc.getElementById("attente-mail");
if (lien && champ) setTimeout(function () { champ.focus(); }, 0);
});
})();
