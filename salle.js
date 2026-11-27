/* L'accueil « La salle » : la page fait l'heure. Le moment qui passe au milieu de l'écran donne son heure à la salle ;
   le geste « Maintiens » garde ta place ; le sous-bock prend la date du jour. Sans ce script, la page est complète. */
(function () {
var doc = document;
var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var soiree = doc.querySelector(".veillee");
if (!soiree) return;

/* Les moments : le dernier qui a passé la ligne donne son heure à la salle. Sur téléphone, la ligne est un peu sous la
   salle collée en haut ; sur ordinateur, ou quand la salle ne colle pas, au milieu de l'écran. */
var moments = doc.querySelectorAll("[data-heure]");
var salle = doc.querySelector(".salle");
var attend = false;
function placer() {
attend = false;
var milieu = window.matchMedia("(min-width: 960px)").matches || getComputedStyle(salle).position !== "sticky";
var ligne = milieu ? window.innerHeight * 0.5 : Math.max(salle.getBoundingClientRect().bottom, 0) + window.innerHeight * 0.14;
var heure = moments[0].dataset.heure;
Array.prototype.forEach.call(moments, function (m) { if (m.getBoundingClientRect().top <= ligne) heure = m.dataset.heure; });
if (soiree.dataset.etat !== heure) soiree.dataset.etat = heure;
}
/* Au téléphone, la salle colle en haut tant qu'elle prend au plus un tiers de l'écran ; plus grande (texte agrandi, écran
   bas), elle reste en haut de la page et laisse la place au texte. La règle se relit quand la salle change de taille.
   L'écran compté est le petit écran (svh, la barre du navigateur affichée), lu dans le dessin, haut au plus de 28svh
   (accueil.css) : quand la barre se cache en défilant, la salle ne se décolle pas et ne se recolle pas. */
var dessin = salle && salle.querySelector(".salle__dessin");
function libre() {
var vue = dessin ? parseFloat(getComputedStyle(dessin).maxHeight) / 0.28 : NaN;
if (!(vue > 0)) vue = window.innerHeight;
var trop = !window.matchMedia("(min-width: 960px)").matches && salle.offsetHeight > vue / 3;
doc.documentElement.classList.toggle("salle-libre", trop);
}
function demander() { if (!attend) { attend = true; window.requestAnimationFrame(placer); } }
if (moments.length && salle) {
window.addEventListener("scroll", demander, { passive: true });
window.addEventListener("resize", demander);
/* Le premier état se calcule après la première image : mesurer la page avant forcerait sa mise en page entière et
   retarderait l'affichage. En haut de page, la salle est déjà à 18:42 sans script. Les transitions ne commencent
   qu'une fois la salle à son premier état : à l'arrivée, rien ne bouge. */
window.requestAnimationFrame(function () { setTimeout(function () {
libre();
placer();
window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { soiree.classList.add("pret"); }); });
if (window.ResizeObserver) new ResizeObserver(function () { libre(); demander(); }).observe(salle);
window.addEventListener("resize", libre);
}, 0); });
}

/* Le geste : maintenir 1,4 s remplit le bouton ; lâché avant, il se vide. Doigt, souris, barre d'espace ou Entrée.
   Avec « réduire les animations », un appui suffit. Rien n'est réservé. */
var DUREE = 1400;
var bouton = doc.querySelector("[data-maintiens]");
if (bouton) {
var statut = doc.querySelector("[data-statut]");
var mot = bouton.querySelector(".tenir__mot");
var minuteur = 0;
var tenu = false;
var fini = function () {
tenu = false;
bouton.classList.remove("se-remplit");
bouton.classList.add("plein");
doc.documentElement.classList.add("place-gardee");
statut.textContent = "Place gardée. Ton rond ambre est dans la salle.";
if (mot) mot.textContent = "Place gardée jusqu’à 21:30";
};
var commencer = function () {
if (tenu || bouton.classList.contains("plein")) return;
if (calme) { fini(); return; }
tenu = true;
bouton.classList.add("se-remplit");
minuteur = setTimeout(fini, DUREE);
};
/* Lâché trop tôt, le bouton se vide et le dit ; un doigt qui fait défiler la page (pointercancel) le vide sans un mot. */
var lacher = function (e) {
if (!tenu) return;
tenu = false;
clearTimeout(minuteur);
bouton.classList.remove("se-remplit");
if (!e || e.type !== "pointercancel") statut.textContent = "Trop tôt. Maintiens jusqu’au bout.";
};
bouton.addEventListener("pointerdown", function (e) {
if (e.pointerType === "mouse" && e.button !== 0) return;
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
bouton.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") lacher(e); });
bouton.addEventListener("blur", lacher);
}

/* Le sous-bock : la date d'aujourd'hui, à Paris. */
var jour = doc.querySelector("[data-jour]");
if (jour && window.Intl) {
try { jour.textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date()); } catch (e) { /* la date reste « Ce soir » */ }
}
})();
