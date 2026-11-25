(function () {
var doc = document;
var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
doc.body.classList.add("js");

/* La liste d'attente : le formulaire de l'appli (#attente) et la ligne « Préviens-moi » de la carte du match. */
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
note: "C’est noté",
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

/* Le prochain match : la carte du passage, reprise à l'heure où la page est lue. Aucune donnée n'est gardée sur l'appareil. */
(function () {
var racine = doc.getElementById("donnees-ce-soir");
var coup = doc.querySelector(".coup");
if (!racine || !coup) return;
var D;
try { D = JSON.parse(racine.textContent); } catch (e) { return; }
var T = D.t;
var FIN = 3 * 3600000;
var MIN = 60000;
var $ = function (s, c) { return (c || coup).querySelector(s); };
var jourF = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
var heureF = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
var lettresF = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });
var jour = function (ms) { return jourF.format(new Date(ms)); };
var ecartDeJours = function (de, a) { return Math.round((Date.parse(jour(a) + "T00:00:00Z") - Date.parse(jour(de) + "T00:00:00Z")) / 86400000); };
var heure = function (ms) { return heureF.format(new Date(ms)); };
var enLettres = function (ms) {
var p = {};
lettresF.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
return p.weekday + " " + (p.day === "1" ? "1er" : p.day) + " " + p.month;
};
var jourDit = function (ms, maintenant) {
var e = ecartDeJours(maintenant, ms);
if (e <= 0) return Number(heure(ms).slice(0, 2)) >= 17 ? T.ceSoir : T.aujourdhui;
return e === 1 ? T.demain : enLettres(ms);
};
var remplir = function (texte, valeurs) { return texte.replace(/\{(\w+)\}/g, function (_, k) { return valeurs[k] || ""; }); };
var capitale = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
var matchs = D.matchs.map(function (m) { m.ms = Date.parse(m.coup); return m; });
var disque = function (cle, classe, prefixe) {
var ns = "http://www.w3.org/2000/svg";
var svg = doc.createElementNS(ns, "svg");
svg.setAttribute("class", classe);
svg.setAttribute("aria-hidden", "true");
svg.setAttribute("focusable", "false");
var use = doc.createElementNS(ns, "use");
use.setAttribute("href", "#" + prefixe + cle);
svg.appendChild(use);
return svg;
};
var titre = $("#soir-titre", doc);
var quandTitre = titre && titre.querySelector("[data-soir-quand]");
var heros = null;
var vu = "";
var modifie = { amis: false, bar: false };

function messages(m, maintenant) {
var quand = jourDit(m.ms, maintenant) + " à " + heure(m.ms);
var nom = m.a.nom + " – " + m.b.nom;
return {
amis: remplir(T.amisMessage, { match: nom, quand: quand, lien: "https://baromatch.fr" + m.page }),
bar: remplir(T.barMessage, { match: nom, quand: quand, lien: "https://baromatch.fr/pour-les-bars.html" })
};
}
function poserLesMessages(m, maintenant) {
var textes = messages(m, maintenant);
["amis", "bar"].forEach(function (cle) {
var champ = $('[data-message="' + cle + '"]');
var lien = $('[data-wa="' + cle + '"]');
if (!champ || !lien) return;
if (!modifie[cle]) champ.value = textes[cle];
lien.href = "https://wa.me/?text=" + encodeURIComponent(champ.value);
});
}
Array.prototype.forEach.call(coup.querySelectorAll("[data-message]"), function (champ) {
champ.addEventListener("input", function () {
var cle = champ.getAttribute("data-message");
modifie[cle] = true;
var lien = $('[data-wa="' + cle + '"]');
if (lien) lien.href = "https://wa.me/?text=" + encodeURIComponent(champ.value);
});
});

function montrer(m, maintenant) {
heros = m;
var quand = jourDit(m.ms, maintenant);
coup.setAttribute("data-coup", m.coup);
coup.style.setProperty("--club-a", m.a.lumiere);
coup.style.setProperty("--club-b", m.b.lumiere);
if (quandTitre) quandTitre.textContent = "· " + quand;
$("[data-coup-compet]").textContent = m.compet;
var t = $("[data-coup-heure]");
t.textContent = heure(m.ms);
t.setAttribute("datetime", m.coup);
var lien = $("[data-coup-page]");
lien.href = m.page;
lien.parentNode.dataset.mot = m.mot;
lien.firstChild.textContent = m.a.nom + " ";
var fin = lien.lastChild;
fin.textContent = " " + m.b.nom;
var ds = coup.querySelectorAll(".coup__disque use");
[m.a.cle, m.b.cle].forEach(function (c, i) { ds[i].setAttribute("href", "#" + (doc.getElementById("d-" + c) ? "d-" : "p-") + c); });
$("[data-coup-detail]").textContent = capitale(quand) + ", " + heure(m.ms);
var nuit = $("[data-pas-de-match]");
if (nuit) nuit.hidden = !(ecartDeJours(maintenant, m.ms) > 0 && !matchs.some(function (x) { return jour(x.ms) === jour(maintenant) && x.ms + FIN > maintenant; }));
var titreRep = $("[data-faire-titre]");
var suite = $("[data-faire-suite]");
if (m.bars) {
titreRep.textContent = remplir(T.avecBars, { bars: m.barsTexte, verbe: m.verbe });
suite.textContent = "";
var a = doc.createElement("a");
a.className = "lien";
a.setAttribute("data-voir-bars", "");
a.href = m.page + "#titre-bars";
a.textContent = T.voirLesBars;
suite.appendChild(a);
} else {
titreRep.textContent = T.aucunBar;
suite.textContent = T.aucunBarSuite;
}
var agenda = $(".faire__agenda");
agenda.textContent = "";
if (m.ics) {
var ics = doc.createElement("a");
ics.className = "lien-trait";
ics.setAttribute("data-agenda", "");
ics.href = m.page + "match.ics";
ics.type = "text/calendar";
ics.textContent = T.agenda;
agenda.appendChild(ics);
}
var resume = $(".faire__bouton .visuellement-cache");
if (resume) resume.textContent = " : " + m.a.nom + " – " + m.b.nom;
poserLesMessages(m, maintenant);
}

function lesAutres(maintenant) {
var meme = jour(heros.ms);
return matchs.filter(function (m) {
return m !== heros && m.ms + FIN > maintenant && (jour(m.ms) === meme || m.ms <= maintenant);
}).slice(0, 5);
}
function bande(maintenant) {
var zone = $("[data-bande]", doc);
var liste = $("[data-bande-liste]", doc);
var titreBande = $("[data-bande-titre]", doc);
var tous = $("[data-tous]", doc);
if (!zone || !liste) return;
var autres = lesAutres(maintenant);
var cle = autres.map(function (m) { return m.id; }).join("|") + "@" + heros.id + (autres.map(function (m) { return m.ms <= maintenant ? "1" : "0"; }).join(""));
if (cle !== zone.getAttribute("data-cle")) {
zone.setAttribute("data-cle", cle);
liste.textContent = "";
autres.forEach(function (m) {
var li = doc.createElement("li");
var a = doc.createElement("a");
a.className = "puce";
a.href = m.page;
a.appendChild(disque(m.a.cle, "insigne", "p-"));
a.appendChild(disque(m.b.cle, "insigne", "p-"));
var nom = doc.createElement("span");
nom.className = "puce__nom";
nom.textContent = m.a.nom + " – " + m.b.nom;
nom.dataset.mot = m.mot;
a.appendChild(nom);
var h = doc.createElement(m.ms <= maintenant ? "span" : "time");
h.className = m.ms <= maintenant ? "puce__en-cours" : "puce__heure";
if (m.ms > maintenant) h.setAttribute("datetime", m.coup);
h.textContent = m.ms <= maintenant ? T.enCours : heure(m.ms);
a.appendChild(h);
li.appendChild(a);
liste.appendChild(li);
});
}
zone.hidden = !autres.length;
if (titreBande) titreBande.textContent = remplir(T.autres, { quand: jourDit(heros.ms, maintenant) });
if (tous) {
var aujourdhui = ecartDeJours(maintenant, heros.ms) <= 0;
tous.textContent = aujourdhui ? T.tous : T.tousSemaine;
tous.href = aujourdhui ? "/ce-soir/" : "/matchs/";
}
}

function dans(ms) {
var minutes = Math.max(1, Math.ceil(ms / MIN));
if (minutes < 60) return "dans " + minutes + " min";
var h = Math.floor(minutes / 60);
var r = minutes % 60;
return "dans " + h + " h" + (r ? " " + (r < 10 ? "0" : "") + r : "");
}
function tic() {
var maintenant = Date.now();
var prochain = null;
for (var i = 0; i < matchs.length; i++) if (matchs[i].ms > maintenant) { prochain = matchs[i]; break; }
if (!prochain) {
coup.hidden = true;
var zoneB = $("[data-bande]", doc);
if (zoneB) zoneB.hidden = true;
if (!$(".prochain__rien", doc)) {
var p = doc.createElement("p");
p.className = "prochain__rien";
p.textContent = T.rien + " ";
var a = doc.createElement("a");
a.href = "/matchs/";
a.textContent = T.rienLien;
p.appendChild(a);
coup.parentNode.insertBefore(p, coup);
}
return;
}
if (!heros || heros !== prochain) montrer(prochain, maintenant);
else if (vu !== jour(maintenant)) montrer(prochain, maintenant);
vu = jour(maintenant);
bande(maintenant);
var d = $("[data-dans]");
var reste = heros.ms - maintenant;
if (ecartDeJours(maintenant, heros.ms) <= 0) {
var texte = dans(reste);
if (d.textContent !== texte) d.textContent = texte;
d.hidden = false;
} else d.hidden = true;
coup.style.setProperty("--chaleur", Math.max(0, Math.min(1, 1 - reste / (6 * 3600000))).toFixed(2));
}
tic();
setInterval(tic, 5000);
doc.addEventListener("visibilitychange", function () { if (!doc.hidden) tic(); });
var faire = doc.getElementById("faire");
if (faire) faire.addEventListener("toggle", function () {
if (faire.open && faire.scrollIntoView) faire.scrollIntoView({ block: "nearest", behavior: calme ? "auto" : "smooth" });
});
})();

/* Le téléphone de démo : il se remplit seul, trois tours (avec une pause), et se maintient au doigt, à la souris ou à la barre d'espace. */
(function () {
var tel = doc.querySelector(".g-tel");
if (!tel) return;
var verre = tel.querySelector(".g-verre");
var bouton = tel.querySelector(".g-tel__pause");
var liquide = tel.querySelector(".g-verre__liq");
var TOURS = 3;
var tours = 0;
var etat = "fin";
function libelle(nouveau) {
if (!bouton) return;
bouton.setAttribute("data-etat", nouveau);
bouton.setAttribute("aria-label", nouveau === "pause" ? "Mettre la démo en pause" : nouveau === "jouer" ? "Reprendre la démo" : "Rejouer la démo");
}
function lancer() {
if (calme) return;
tel.classList.remove("est-main", "est-arrete");
tel.style.removeProperty("--p");
tours = 0;
tel.classList.remove("est-auto");
void tel.offsetWidth;
tel.classList.add("est-auto");
etat = "auto";
libelle("pause");
}
function finir() {
tel.classList.remove("est-auto", "est-arrete", "est-main");
tel.style.removeProperty("--p");
etat = "fin";
libelle("rejouer");
}
if (liquide) liquide.addEventListener("animationiteration", function (e) {
if (e.target !== liquide) return;
tours += 1;
if (tours >= TOURS) finir();
});
if (bouton) {
bouton.hidden = calme;
bouton.addEventListener("click", function () {
if (etat === "auto") { tel.classList.add("est-arrete"); etat = "arrete"; libelle("jouer"); }
else if (etat === "arrete") { tel.classList.remove("est-arrete"); etat = "auto"; libelle("pause"); }
else lancer();
});
}
var visible = true;
if ("IntersectionObserver" in window) {
new IntersectionObserver(function (entrees) {
visible = entrees.some(function (e) { return e.isIntersecting; });
if (etat === "auto" || etat === "arrete") tel.classList.toggle("est-arrete", !visible || etat === "arrete");
}, { threshold: 0.3 }).observe(tel);
}
doc.addEventListener("visibilitychange", function () {
if (etat === "auto") tel.classList.toggle("est-arrete", doc.hidden);
});
var DUREE = 1400;
var VIDANGE = 300;
var p = 0;
var tenu = false;
var depart = 0;
var base = 0;
var rafId = 0;
var fini = false;
function poser(v) {
p = v;
tel.style.setProperty("--p", v.toFixed(4));
tel.style.setProperty("--ok", v >= 1 ? "1" : "0");
tel.style.setProperty("--repos", v >= 1 ? "0" : "1");
}
function boucle(t) {
if (tenu) {
poser(Math.min(1, base + (t - depart) / DUREE));
if (p >= 1) { tenu = false; fini = true; etat = "main-fin"; verre.setAttribute("aria-label", "Démo : place gardée. Rien n’est réservé pour de vrai."); libelle("rejouer"); return; }
} else {
poser(Math.max(0, base - (t - depart) / VIDANGE));
if (p <= 0) return;
}
rafId = window.requestAnimationFrame(boucle);
}
function appuyer(e) {
if (e && e.button > 0) return;
if (calme) {
tel.classList.add("est-main");
fini = !fini;
poser(fini ? 1 : 0);
verre.setAttribute("aria-label", fini ? "Démo : place gardée. Rien n’est réservé pour de vrai. Appuie pour recommencer." : "Démo : appuie pour garder 2 places. Rien n’est réservé pour de vrai.");
return;
}
tel.classList.remove("est-auto", "est-arrete");
tel.classList.add("est-main");
if (etat !== "main") poser(etat === "main-fin" ? 0 : p);
fini = false;
etat = "main";
libelle("rejouer");
tenu = true;
base = p;
depart = performance.now();
window.cancelAnimationFrame(rafId);
rafId = window.requestAnimationFrame(boucle);
}
function lacher() {
if (!tenu) return;
tenu = false;
base = p;
depart = performance.now();
window.cancelAnimationFrame(rafId);
rafId = window.requestAnimationFrame(boucle);
}
if (verre) {
verre.addEventListener("pointerdown", function (e) { e.preventDefault(); appuyer(e); });
["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { verre.addEventListener(n, lacher); });
verre.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); appuyer(); } });
verre.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") lacher(); });
verre.addEventListener("click", function (e) { e.preventDefault(); });
verre.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}
if (!calme) window.requestAnimationFrame(function () { window.setTimeout(lancer, 250); });
})();

/* L'album : le sous-bock se colle quand il arrive à l'écran. */
(function () {
var album = doc.querySelector(".album");
if (album) {
if (calme || !("IntersectionObserver" in window)) album.classList.add("est-pose");
else {
var o = new IntersectionObserver(function (es) {
if (es.some(function (x) { return x.isIntersecting; })) { album.classList.add("est-pose"); o.disconnect(); }
}, { threshold: 0.6 });
o.observe(album);
}
}
})();
/* Le film : son script (film.js) ne vient qu’à son approche. */
(function () {
var cadre = doc.getElementById("film-cadre");
if (!cadre) return;
var charge = false;
function venir() {
if (charge) return;
charge = true;
var s = doc.createElement("script");
s.src = "/film.js";
s.defer = true;
doc.head.appendChild(s);
}
if (!("IntersectionObserver" in window)) return venir();
var o = new IntersectionObserver(function (es) {
if (es.some(function (x) { return x.isIntersecting; })) { o.disconnect(); venir(); }
}, { rootMargin: "800px 0px" });
o.observe(cadre);
})();
(function () {
var texte = doc.getElementById("film-texte");
if (!texte) return;
function ouvrir() { if (location.hash === "#film-texte") texte.open = true; }
ouvrir();
window.addEventListener("hashchange", ouvrir);
})();
})();
