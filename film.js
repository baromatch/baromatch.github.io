(function () {
var video = document.getElementById("film");
var lecture = document.getElementById("film-lecture");
if (!video || !lecture) return;
var icone = lecture.querySelector("path");
var calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var econome = navigator.connection && navigator.connection.saveData;
var arreteParToi = false;
var observateur = null;
function lecteurClassique() {
var avaitLeFocus = document.activeElement === lecture;
if (observateur) observateur.disconnect();
video.controls = true;
lecture.hidden = true;
if (avaitLeFocus) video.focus();
}
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
