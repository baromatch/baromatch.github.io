// Attendre qu’une page soit finie avant de mesurer ce qui est sous le premier écran.
// Sur « Pour les bars », pour-les-bars-amorce.js ne demande le formulaire et pour-les-bars.css qu’après le premier
// affichage, donc après la fin du goto() : sans cette attente, un test lit le formulaire encore invisible et la page
// sans sa feuille. Ailleurs, rien à attendre.
export const attendreLaPageFinie = async (onglet) => {
  if (new URL(onglet.url()).pathname !== '/pour-les-bars.html') return;
  await onglet.waitForFunction(() => {
    const formulaire = document.getElementById('demande');
    const feuille = [...document.styleSheets].some((s) => (s.href ?? '').endsWith('/pour-les-bars.css') && s.cssRules.length > 0);
    return feuille && !!formulaire && !formulaire.hidden && getComputedStyle(formulaire).visibility !== 'hidden';
  });
};

// Les images paresseuses (loading="lazy") ne se chargent qu’en approchant de l’écran : la page défile jusqu’en bas,
// revient en haut, puis chaque image affichée est chargée (une image cachée à cette largeur ne se charge jamais).
// Pour une capture pleine page qui montre toutes les images, ou pour vérifier qu’elles se chargent.
export const chargerLesImages = async (onglet) => {
  await onglet.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((suite) => requestAnimationFrame(() => requestAnimationFrame(suite)));
    }
    window.scrollTo(0, 0);
  });
  await onglet.waitForFunction(() => [...document.images].filter((image) => image.getClientRects().length > 0)
    .every((image) => image.complete));
};
