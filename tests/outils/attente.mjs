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

// La police est arrivée : le cœur de Bricolage Grotesque est chargé, et plus aucune police n’est en chemin. Pas
// « chaque police chargée » : les deux autres fichiers de Bricolage Grotesque et la police de secours (styles.css) restent
// « unloaded » tant que la page n’en a pas besoin. À passer à waitForFunction.
export const laPoliceEstLa = () => [...document.fonts].some((police) => police.family === 'Bricolage Grotesque' && police.status === 'loaded')
  && [...document.fonts].every((police) => police.status !== 'loading');

// « Pour les bars » lente, comme sur une machine chargée : sa police (demandée dès la tête, en préchargement)
// retenue 1,5 s. Le premier affichage vient alors avant « load » (la police s’affiche en remplacement, font-display:
// swap), et l’amorce demande la feuille et le script pendant que la page charge encore ; une feuille ou un script que le
// test retient retient alors « load » aussi. Un tel test n’attend que le HTML lu (goto avec waitUntil:
// 'domcontentloaded'), jamais « load ». Rend de quoi attendre que la police soit partie vers la page, ce que le test
// fait avant de finir, et qui vérifie qu’elle a bien été retenue (sinon le test ne reproduirait plus la page lente).
export const ralentirLaPolice = async (onglet) => {
  const envois = [];
  await onglet.route('**/fonts/bricolage-grotesque.woff2', (route) => {
    const envoi = new Promise((resoudre) => { setTimeout(resoudre, 1_500); }).then(() => route.continue());
    envois.push(envoi);
    return envoi;
  });
  return async () => {
    if (envois.length === 0) throw new Error('ralentirLaPolice : la police n’a pas été demandée, rien n’a été retenu');
    await Promise.all(envois);
  };
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
