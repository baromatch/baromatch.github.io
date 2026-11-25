// La hauteur de l’accueil, en deux parts : le bloc que le générateur écrit entre les repères (la carte du prochain match, sa
// bande « Aussi ce soir » et « Toute la semaine » pliée : de .prochain au bas de nav.jours), et tout le reste, écrit à la
// main. À passer à page.evaluate sur une page ouverte (tests/accueil.spec.mjs, tests/accueil-sans-bar.spec.mjs).
export const lireLaHauteurDeLAccueil = (onglet) => onglet.evaluate(() => {
  const debut = document.querySelector('.prochain');
  const fin = document.querySelector('nav.jours') ?? debut;
  const bloc = fin.getBoundingClientRect().bottom - debut.getBoundingClientRect().top;
  return { total: document.documentElement.scrollHeight, bloc, horsDuBloc: document.documentElement.scrollHeight - bloc };
});

// Au téléphone (390 px), le budget de longueur : ce qui est écrit à la main tient en moins de 8 écrans (il en avait 11,4),
// et le bloc du générateur, dont le contenu suit les matchs du jour, tient en un écran au plus quel que soit leur nombre
// (la semaine est pliée : sa hauteur ne dépend plus du nombre de matchs). Mesuré le 25 novembre 2026 : 6 241 px hors du bloc,
// 846 px le bloc (une carte, 5 puces, la semaine pliée) ; le bloc sans match n’en fait que 78.
export const ECRANS_A_LA_MAIN = 8;
export const BLOC_AU_PLUS_PX = 900;
