import { test } from '@playwright/test';

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

// Ouvrir une page et ne la mesurer qu’entière : chacune de ses feuilles de style (<link rel="stylesheet">) chargée et
// lue. Sous une forte charge (la suite entière, deux contrôles à la fois sur une machine de 4 cœurs), une requête de
// /styles.css s’est perdue en route une fois sur neuf passages : le navigateur abandonne la feuille, et ouvre quand même
// la page, sans elle (« load » n’attend pas une feuille en échec) ; le test des villes mesurait alors des puces de
// 18 px au lieu de 44. Seule, la même page s’ouvre entière à chaque fois (400 ouvertures, aucune requête perdue). Une
// page incomplète est donc rechargée, une fois, et le rapport du test le note (la feuille, l’erreur du navigateur) ;
// incomplète encore, l’ouverture échoue en les nommant. Ce que le test mesure reste la page telle que le site la sert.
// (Une feuille en échec peut garder un objet feuille, illisible : lire ses règles lève alors une SecurityError.)
const feuillesManquantes = (onglet) => onglet.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')]
  .filter((lien) => {
    try {
      return !lien.sheet || lien.sheet.cssRules.length === 0;
    } catch {
      return true;
    }
  })
  .map((lien) => new URL(lien.href).pathname));

export const ouvrirEntiere = async (onglet, adresse) => {
  const perdues = [];
  const noter = (requete) => perdues.push(`${new URL(requete.url()).pathname} (${requete.failure()?.errorText ?? 'échec'})`);
  onglet.on('requestfailed', noter);
  try {
    await onglet.goto(adresse);
    let manquantes = await feuillesManquantes(onglet);
    if (!manquantes.length) return;
    test.info().annotations.push({ type: 'page rechargée', description: `${manquantes.join(', ')} manquait ; requêtes perdues : ${perdues.join(', ') || 'aucune'}` });
    perdues.length = 0;
    await onglet.reload();
    manquantes = await feuillesManquantes(onglet);
    if (manquantes.length) throw new Error(`Page incomplète deux fois de suite : ${manquantes.join(', ')} ne s’est pas chargée (requêtes perdues : ${perdues.join(', ') || 'aucune'})`);
  } finally {
    onglet.off('requestfailed', noter);
  }
};
