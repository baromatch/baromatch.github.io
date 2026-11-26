/* L'accueil « La salle » : la page fait l'heure. Le moment qui passe au milieu de l'écran donne son heure à la salle ;
   le geste « Maintiens » garde ta place ; le sous-bock prend la date du jour. Sans ce script, la page est complète. */
(function () {
var doc = document;
var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var soiree = doc.querySelector(".veillee");
if (!soiree) return;

/* Les moments : le dernier qui a passé la ligne donne son heure à la salle. Sur téléphone, la ligne est un peu sous la
   salle (qui reste en haut) ; sur ordinateur, au milieu de l'écran. */
var moments = doc.querySelectorAll("[data-heure]");
var salle = doc.querySelector(".salle");
var attend = false;
function placer() {
attend = false;
var grand = window.matchMedia("(min-width: 960px)").matches;
var ligne = grand ? window.innerHeight * 0.5 : Math.max(salle.getBoundingClientRect().bottom, 0) + window.innerHeight * 0.14;
var heure = moments[0].dataset.heure;
Array.prototype.forEach.call(moments, function (m) { if (m.getBoundingClientRect().top <= ligne) heure = m.dataset.heure; });
soiree.dataset.etat = heure;
}
function demander() { if (!attend) { attend = true; window.requestAnimationFrame(placer); } }
if (moments.length && salle) {
window.addEventListener("scroll", demander, { passive: true });
window.addEventListener("resize", demander);
placer();
}

/* Le geste : maintenir 1,4 s remplit le bouton ; lâché avant, il se vide. Doigt, souris, barre d'espace ou Entrée.
   Avec « réduire les animations », un appui suffit. Rien n'est réservé. */
var DUREE = 1400;
var bouton = doc.querySelector("[data-maintiens]");
if (bouton) {
var statut = doc.querySelector("[data-statut]");
var minuteur = 0;
var tenu = false;
var fini = function () {
tenu = false;
bouton.classList.remove("se-remplit");
bouton.classList.add("plein");
doc.documentElement.classList.add("place-gardee");
statut.textContent = "Place gardée.";
};
var commencer = function () {
if (tenu || bouton.classList.contains("plein")) return;
if (calme) { fini(); return; }
tenu = true;
bouton.classList.add("se-remplit");
minuteur = setTimeout(fini, DUREE);
};
var lacher = function () {
if (!tenu) return;
tenu = false;
clearTimeout(minuteur);
bouton.classList.remove("se-remplit");
statut.textContent = "Trop tôt : maintiens jusqu’en haut.";
};
bouton.addEventListener("pointerdown", function (e) {
e.preventDefault();
if (bouton.setPointerCapture) bouton.setPointerCapture(e.pointerId);
commencer();
});
bouton.addEventListener("pointerup", lacher);
bouton.addEventListener("pointercancel", lacher);
bouton.addEventListener("lostpointercapture", lacher);
bouton.addEventListener("contextmenu", function (e) { e.preventDefault(); });
bouton.addEventListener("keydown", function (e) {
if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); commencer(); }
});
bouton.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") lacher(); });
bouton.addEventListener("blur", lacher);
}

/* Le sous-bock : la date d'aujourd'hui, à Paris. */
var jour = doc.querySelector("[data-jour]");
if (jour && window.Intl) {
try { jour.textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date()); } catch (e) { /* la date reste « Ce soir » */ }
}
})();
