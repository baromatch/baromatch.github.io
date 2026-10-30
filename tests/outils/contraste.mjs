// Les calculs de contraste de WCAG 2.2 (luminance relative, rapport de contraste), partagés par les tests qui
// mesurent une couleur telle qu’elle est peinte. Une couleur : { r, v, b, a } (0–255, alpha 0–1).

// « rgb(10, 11, 16) » ou « rgba(255, 255, 255, 0.36) », comme getComputedStyle les écrit ; « color(srgb 0.79 0.77 0.75) »
// (de 0 à 1, « / a » pour l’opacité) pour une couleur de color-mix().
export const lireCouleur = (css) => {
  const [r, v, b, a = 1] = css.match(/[\d.]+/g).map(Number);
  const k = css.startsWith('color(srgb ') ? 255 : 1;
  return { r: r * k, v: v * k, b: b * k, a };
};

// Une couleur translucide posée sur une autre : la couleur que l’œil voit.
export const poser = (dessus, dessous) => ({
  r: dessus.r * dessus.a + dessous.r * (1 - dessus.a),
  v: dessus.v * dessus.a + dessous.v * (1 - dessus.a),
  b: dessus.b * dessus.a + dessous.b * (1 - dessus.a),
  a: 1,
});

export const luminance = ({ r, v, b }) => [r, v, b]
  .map((c) => c / 255)
  .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  .reduce((somme, c, i) => somme + c * [0.2126, 0.7152, 0.0722][i], 0);

export const rapport = (x, y) => {
  const [claire, sombre] = [luminance(x), luminance(y)].sort((m, n) => n - m);
  return (claire + 0.05) / (sombre + 0.05);
};
