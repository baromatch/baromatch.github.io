// Le formulaire des bars (pour-les-bars.js, sur pour-les-bars.html) : ce qu’il envoie, quand, et ce qu’il dit pour
// chaque réponse du serveur. Le serveur est simulé ici (page.route), avec les réponses que la page sait lire : aucun
// test n’écrit à l’API de production. L’horloge de la page est simulée et arrêtée (page.clock) : rien ne part tant
// qu’un test ne fait pas avancer le temps, ce qui rend exacts les 3 s, les 2 s avant le nouvel essai, les 10 s et
// les 24 h.
import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { ralentirLaPremiereImage } from './outils/attente.mjs';
import { arreterLHorloge } from './outils/horloge.mjs';

const PAGE = '/pour-les-bars.html';
// Le piège à robots, un champ caché que seul un robot remplit.
const PIEGE = '#demande-piege';
const ADRESSE = 'https://api-production-8ce4.up.railway.app/api/public/bar-contact';
const BROUILLON = 'baromatch-demande-bar';
const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const DEBUT = new Date('2026-10-12T16:00:00Z').getTime();
const JOUR = 24 * 60 * 60 * 1000;

const SAISIE = {
  barName: 'Le Zinc des Amis',
  city: 'Paris',
  contactName: 'Camille Martin',
  email: 'camille@lezinc.fr',
  phone: '+33 6 12 34 56 78',
  message: 'Deux écrans, 60 places.\nSurtout la Ligue 1.',
};
const CHAMPS = {
  barName: '#demande-bar',
  city: '#demande-ville',
  contactName: '#demande-nom',
  email: '#demande-email',
  phone: '#demande-telephone',
  message: '#demande-message',
};

// Les textes que le script écrit (pour-les-bars.js, TEXTES), ceux des limites du serveur compris. Un message :
// [titre, texte]. Écrits ici avec des espaces ordinaires : toHaveText ne distingue pas l’espace insécable de l’espace
// ordinaire ; les insécables ont leur propre test.
const TEXTES = {
  resume: (n) => (n === 1 ? '1 information à corriger' : `${n} informations à corriger`),
  envoi: 'Envoi…',
  bouton: 'Envoyer ma demande',
  copier: 'Copier le texte',
  copie: 'Texte copié',
  modifier: 'Modifier ma demande',
  accord: 'Coche la case pour envoyer ta demande.',
  telephone: 'Écris ton numéro avec des chiffres, ou laisse ce champ vide.',
  telephoneCourt: 'Ton numéro est trop court : écris au moins 6 chiffres.',
  telephoneLong: 'Raccourcis ton numéro : 20 caractères au plus.',
  emailIncomplet: 'Cette adresse e-mail n’est pas complète.',
  emailArobase: 'Il manque le @ dans ton adresse e-mail.',
  emailFin: 'Il manque la fin de ton adresse e-mail, par exemple .fr ou .com.',
  emailCaractere: 'Cette adresse e-mail a un caractère qui ne passe pas : vérifie les accents, les espaces et les points.',
  signe: {
    barName: 'Le nom de ton bar a un émoji ou un signe qui ne passe pas chez nous : retire-le.',
    city: 'Le nom de ta ville a un émoji ou un signe qui ne passe pas chez nous : retire-le.',
    contactName: 'Ton nom a un émoji ou un signe qui ne passe pas chez nous : retire-le.',
    message: 'Ton message a un signe qui ne passe pas chez nous : retire-le.',
  },
  brouillon: ['Ce que tu avais écrit est là.', 'Termine, coche la case, puis envoie ta demande.'],
  lent: ['Le réseau est lent.', 'Ta demande est toujours en route : garde cette page ouverte.'],
  courriel: ['Ta demande n’est pas encore partie.', 'Appuie sur « Ouvrir ma messagerie » et envoie le mail préparé : tout ce que tu as écrit y est déjà. On te répond par e-mail ou par téléphone.'],
  messagerie: ['Ta messagerie s’est ouverte ?', 'Envoie le mail, et c’est fait. Ce que tu as écrit reste ici jusqu’à ce que tu fermes l’onglet.'],
  horsLigne: ['Pas de réseau.', 'Garde cette page ouverte : ta demande part dès que le réseau revient. Tu peux aussi l’envoyer par e-mail, juste en dessous.'],
  reseauRevenu: ['Le réseau est revenu.', 'Ta demande n’est pas partie : vérifie-la, puis appuie sur « Envoyer ma demande ».'],
  expiree: ['Cette page est ouverte depuis plus d’un jour.', 'Recharge-la pour envoyer ta demande : ce que tu as écrit reste là.'],
  // Sans stockage dans l’onglet (bloqué, ou absent d’une vue web), la page ne promet pas que le texte survit.
  expireeSansBrouillon: ['Cette page est ouverte depuis plus d’un jour.', 'Envoie ta demande par e-mail : tout ce que tu as écrit y est déjà. Si tu recharges la page, ce que tu as écrit peut s’effacer.'],
  messagerieSansBrouillon: ['Ta messagerie s’est ouverte ?', 'Envoie le mail, et c’est fait.'],
  copieImpossible: ['Copie le texte toi-même.', 'Ton navigateur ne nous laisse pas le copier : il est sélectionné, prêt à copier. Colle-le dans un mail à contact@baromatch.fr.'],
  correction: ['Ta première demande est déjà partie.', 'Envoie cette correction par e-mail : moins de 10 minutes après la première, avec la même adresse et le même bar, notre serveur ne garde que la première.'],
  invalide: ['Une information ne passe pas chez nous.', 'Envoie ta demande par e-mail : tout ce que tu as écrit y est déjà.'],
  tropDEnvois: ['Beaucoup d’envois depuis cette connexion.', 'On en accepte 5 par heure depuis un même réseau. Envoie ta demande par e-mail, ou réessaie dans une heure.'],
};
// La capsule ambre est le geste principal ; une capsule de verre, le second choix.
const AMBRE = 'rgb(255, 177, 61)';
const fond = (locator) => locator.evaluate((e) => getComputedStyle(e).backgroundColor);
const INDICES = {
  '#demande-ville': 'Baromatch commence à Paris. Ailleurs, écris-nous quand même.',
  '#demande-message': 'Par exemple : tes écrans, la taille de ta salle, les matchs que tu diffuses.',
};

const reponse = (status, json) => ({ status, json });
const CREEE = reponse(201, { ok: true });
const refus = (reason) => reponse(400, { ok: false, statusCode: 400, reason, message: reason });

// Ouvre la page, horloge arrêtée, avec un serveur simulé. `reponses` est consommée dans l’ordre (la dernière
// sert ensuite à chaque fois) : { status, json }, 'coupure' (échec réseau), 'silence' (jamais de réponse) ou
// une fonction qui reçoit la route. Rend les demandes reçues, toutes les adresses demandées et les erreurs.
// feuille : attendre aussi pour-les-bars.css appliquée (sauf pour un test qui la retient).
async function ouvrir(page, reponses = [CREEE], { feuille = true } = {}) {
  const envois = [];
  const adresses = [];
  const erreurs = [];
  page.on('request', (requete) => adresses.push(requete.url()));
  page.on('console', (message) => { if (message.type() === 'error') erreurs.push(message.text()); });
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));
  const file = [...reponses];
  await page.route(ADRESSE, async (route, requete) => {
    envois.push(requete);
    const suite = file.length > 1 ? file.shift() : file[0];
    if (typeof suite === 'function') return suite(route);
    if (suite === 'coupure') return route.abort('failed');
    if (suite === 'silence') return undefined;
    return route.fulfill({
      status: suite.status,
      contentType: suite.contentType ?? 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: suite.corps ?? JSON.stringify(suite.json ?? {}),
    });
  });
  // La page compte elle-même chaque demande au moment où elle part : une demande partie pendant le dernier
  // page.clock.runFor n’a peut-être pas encore atteint page.route, ce compte-ci est déjà juste (partiesEnTout).
  await page.addInitScript((adresse) => {
    window.demandesParties = 0;
    const fetchDeLaPage = window.fetch;
    window.fetch = function (cible) {
      if (String(cible) === adresse) window.demandesParties += 1;
      return fetchDeLaPage.apply(this, arguments);
    };
  }, ADRESSE);
  await arreterLHorloge(page, DEBUT + 1000);
  // Le HTML lu, pas « load » : une feuille que le test retient peut retenir « load » (ralentirLaPremiereImage).
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  // Le formulaire est là (son script est arrivé), et sa feuille : un test peut couper le réseau sans perdre ni l’un ni
  // l’autre.
  await expect(page.locator('#demande')).toBeVisible();
  if (feuille) await expect.poll(() => page.evaluate(() => [...document.styleSheets].some((f) => f.href?.endsWith('/pour-les-bars.css')))).toBe(true);
  return { envois, adresses, erreurs };
}

// Exactement `nombre` demandes sont parties de la page depuis son chargement, et le serveur simulé les a reçues.
async function partiesEnTout(page, envois, nombre) {
  expect(await page.evaluate(() => window.demandesParties)).toBe(nombre);
  await expect.poll(() => envois.length).toBe(nombre);
}

async function remplir(page, valeurs = SAISIE, { accord = true } = {}) {
  for (const [nom, valeur] of Object.entries(valeurs)) await page.fill(CHAMPS[nom], valeur);
  if (accord) await page.check('#demande-accord');
}

// Une valeur posée sans passer par le clavier (collée, ou au-delà du maxlength), comme un texte collé.
const poser = (page, selecteur, valeur) => page.locator(selecteur).evaluate((champ, v) => { champ.value = v; }, valeur);

// Le formulaire est affiché depuis plus de 3 s : la demande peut partir tout de suite.
const apresTroisSecondes = (page) => page.clock.fastForward(3000);
const envoyer = (page) => page.click('#demande-envoyer');

// Remplit la demande (case cochée, sauf { accord: false }), pose les valeurs de `poses` sans passer par le clavier
// ({ nom du champ: valeur }, comme un texte collé), attend que le formulaire soit affiché depuis 3 s (sauf
// { attendre: false }) et appuie sur « Envoyer ma demande ».
async function envoyerUneDemande(page, saisie = SAISIE, { accord = true, poses = {}, attendre = true } = {}) {
  await remplir(page, saisie, { accord });
  for (const [nom, valeur] of Object.entries(poses)) await poser(page, CHAMPS[nom], valeur);
  if (attendre) await apresTroisSecondes(page);
  await envoyer(page);
}

// Avance l’horloge par petits pas jusqu’à ce que le serveur ait reçu `nombre` demandes.
async function attendreEnvois(page, envois, nombre) {
  await expect.poll(async () => {
    if (envois.length < nombre) await page.clock.runFor(250);
    return envois.length;
  }, { timeout: 10_000, intervals: [50] }).toBe(nombre);
}

// axe attend des minuteurs de la page : l’horloge simulée repart avant l’analyse.
async function analyser(page) {
  await page.clock.resume();
  // Un bouton qui change d’état prend son nouveau fond en 150 ms (une transition) et son texte d’un coup : axe lit l’état
  // posé, une fois finies les transitions et animations en cours du formulaire, sinon il mesure un texte déjà clair sur
  // un fond encore ambre. Celles qui tournent sans fin (le petit verre qui se remplit pendant l’envoi) ne comptent pas ;
  // une transition remplacée par une autre est annulée (AbortError), l’autre est attendue.
  await page.locator('#proposer').evaluate((zone) => Promise.all(zone.getAnimations({ subtree: true })
    .filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity)
    .map((animation) => animation.finished.catch((erreur) => { if (erreur.name !== 'AbortError') throw erreur; }))));
  const resultat = await new AxeBuilder({ page }).include('#proposer').withTags(NORMES).analyze();
  return resultat.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

// Une zone annoncée montre une seule boîte .message, avec ce titre et ce texte.
async function attendreMessage(zone, [titre, texte]) {
  await expect(zone.locator('.message')).toHaveCount(1);
  await expect(zone.locator('.message__titre')).toHaveText(titre);
  await expect(zone.locator('.message__texte')).toHaveText(texte);
}

// Un clic sur « Ouvrir ma messagerie » n’ouvre rien pendant le test (aucune messagerie ici) : la page, elle, réagit
// au clic comme d’habitude.
const sansOuvrirLaMessagerie = (page) => page.evaluate(() => document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('a[href^="mailto:"]')) e.preventDefault();
}));

// Le courriel tout prêt : le lien mailto: décodé à la main (un « + » n’y est jamais une espace).
async function lireCourriel(page) {
  await expect(page.locator('#demande-courriel')).toBeVisible();
  const lien = await page.locator('#demande-courriel-lien').getAttribute('href');
  const [destinataire, requete] = lien.replace(/^mailto:/, '').split('?');
  const parametres = Object.fromEntries(requete.split('&').map((paire) => {
    const [cle, valeur] = paire.split('=');
    return [cle, decodeURIComponent(valeur)];
  }));
  return { lien, destinataire, ...parametres };
}

const LIGNES_COMPLETES = [
  'Bar : Le Zinc des Amis',
  'Ville : Paris',
  'Nom : Camille Martin',
  'E-mail : camille@lezinc.fr',
  'Téléphone : +33 6 12 34 56 78',
  'Message : Deux écrans, 60 places.',
  'Surtout la Ligue 1.',
];
// Le texte à copier commence par l’objet et une ligne vide (le lien mailto: porte l’objet à part).
const aCopier = (lignes, bar = 'Le Zinc des Amis') => [`Objet : Demande d’un bar — ${bar}`, '', ...lignes].join('\n');

test.describe('le contrat de la page', () => {
  test('avec JavaScript, le formulaire apparaît ; chaque champ a les longueurs du serveur ; les deux zones de message sont là, vides', async ({ page }) => {
    await ouvrir(page);
    await expect(page.locator('#demande')).toBeVisible();
    const longueurs = await page.$$eval('#demande [maxlength]', (champs) => Object.fromEntries(champs.map((c) => [c.name, [c.minLength, c.maxLength]])));
    expect(longueurs).toEqual({
      barName: [2, 80], city: [2, 60], contactName: [2, 80], email: [-1, 254], phone: [6, 20], message: [-1, 1000],
    });
    await expect(page.locator('#demande-statut')).toHaveAttribute('role', 'status');
    await expect(page.locator('#demande-alerte')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#demande-statut')).toBeEmpty();
    await expect(page.locator('#demande-alerte')).toBeEmpty();
    await expect(page.locator('#demande-resume')).toBeHidden();
    await expect(page.locator('#demande-courriel')).toBeHidden();
    await expect(page.locator('#demande-envoyee')).toBeHidden();
    await expect(page.locator('#demande-ville')).toHaveAccessibleDescription(INDICES['#demande-ville']);
    await expect(page.locator('#demande-courriel-lien')).toHaveText('Ouvrir ma messagerie');
  });

  test('sur une page sans formulaire, le script ne fait rien', async ({ page, baseURL }) => {
    const erreurs = [];
    const adresses = [];
    page.on('pageerror', (erreur) => erreurs.push(erreur.message));
    page.on('request', (requete) => adresses.push(requete.url()));
    await page.route('**/sans-formulaire.html', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="fr"><title>Rien</title><p>Pas de formulaire ici.</p><script src="/pour-les-bars.js"></script></html>',
    }));
    const script = page.waitForResponse('**/pour-les-bars.js');
    await page.goto('/sans-formulaire.html');
    expect((await script).status()).toBe(200);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    expect(erreurs).toEqual([]);
    expect(adresses.filter((a) => !a.startsWith(baseURL))).toEqual([]);
    expect(page.url()).toBe(`${baseURL}/sans-formulaire.html`);
  });

  // Ce que la section dit est vérifié par confidentialite-bars.spec.mjs.
  test('le lien sous la case mène à la section des bars de la page Confidentialité', async ({ page }) => {
    await ouvrir(page);
    // Le lien est sous la case, hors de son étiquette : viser la case n’ouvre pas la page.
    await expect(page.locator('#demande .formulaire__confidentialite a')).toHaveAttribute('href', '/confidentialite.html#bars');
    await page.goto('/confidentialite.html#bars');
    await expect(page.locator('h2#bars')).toBeVisible();
  });
});

test.describe('une seule adresse : https://baromatch.fr', () => {
  // Les adresses du site, servies ici par le serveur local : le serveur Baromatch refuse toute autre origine que
  // https://baromatch.fr (403 ORIGINE_REFUSEE, et le navigateur bloque la réponse).
  async function servirLeSite(page, baseURL) {
    const pages = [];
    page.on('framenavigated', (cadre) => { if (cadre === page.mainFrame()) pages.push(cadre.url()); });
    await page.route(/^https?:\/\/(www\.)?baromatch\.fr\.?\//, async (route) => {
      const url = new URL(route.request().url());
      try {
        const locale = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
        await route.fulfill({ response: locale });
      } catch (erreur) {
        // La page renvoyée est déjà partie (location.replace) : une feuille ou une image qu’elle demandait n’a
        // plus personne à qui répondre. Toute autre erreur reste une erreur.
        if (!/disposed|closed|already handled/i.test(erreur.message)) throw erreur;
      }
    });
    return pages;
  }

  for (const depart of ['https://www.baromatch.fr', 'http://baromatch.fr', 'http://www.baromatch.fr', 'https://baromatch.fr.']) {
    test(`depuis ${depart}, la page renvoie aussitôt vers https://baromatch.fr, même chemin, même recherche, même ancre`, async ({ page, baseURL }) => {
      const pages = await servirLeSite(page, baseURL);
      await page.goto(`${depart}/pour-les-bars.html?depuis=affiche#proposer`);
      await page.waitForURL('https://baromatch.fr/pour-les-bars.html?depuis=affiche#proposer');
      await expect(page.locator('#demande')).toBeVisible();
      expect(pages).toEqual([`${depart}/pour-les-bars.html?depuis=affiche#proposer`, 'https://baromatch.fr/pour-les-bars.html?depuis=affiche#proposer']);
    });
  }

  test('sur https://baromatch.fr, et sur le serveur des tests, la page reste où elle est', async ({ page, baseURL }) => {
    const pages = await servirLeSite(page, baseURL);
    // Le renvoi se décide en tête de pour-les-bars-amorce.js, qui s’arrête là s’il renvoie : le formulaire n’apparaît
    // qu’après (l’amorce charge son script). Formulaire visible, donc aucun renvoi n’est parti : pas de minuterie.
    await page.goto('https://baromatch.fr/pour-les-bars.html');
    await expect(page.locator('#demande')).toBeVisible();
    expect(pages).toEqual(['https://baromatch.fr/pour-les-bars.html']);
    await page.goto(`${baseURL}/pour-les-bars.html`);
    await expect(page.locator('#demande')).toBeVisible();
    expect(pages).toEqual(['https://baromatch.fr/pour-les-bars.html', `${baseURL}/pour-les-bars.html`]);
    expect(page.url()).toBe(`${baseURL}/pour-les-bars.html`);
  });
});

test.describe('ce qui part', () => {
  test('exactement les champs du serveur, nettoyés de leurs espaces, la case, le piège vide et un temps entier ; vers le seul serveur Baromatch, sans cookie ni autre en-tête', async ({ page, baseURL }) => {
    const { envois, adresses, erreurs } = await ouvrir(page);
    await envoyerUneDemande(page, Object.fromEntries(Object.entries(SAISIE).map(([nom, valeur]) => [nom, `  ${valeur}  `])));
    await expect(page.locator('#demande-envoyee')).toBeVisible();

    expect(envois).toHaveLength(1);
    const requete = envois[0];
    expect(requete.method()).toBe('POST');
    const corps = requete.postDataJSON();
    expect(Object.keys(corps)).toEqual(['barName', 'city', 'contactName', 'email', 'phone', 'message', 'consent', 'website', 'fillMs']);
    const { fillMs, ...reste } = corps;
    expect(reste).toEqual({ ...SAISIE, consent: true, website: '' });
    expect(Number.isSafeInteger(fillMs)).toBe(true);
    expect(fillMs).toBeGreaterThanOrEqual(3000);
    expect(fillMs).toBeLessThan(10_000);

    const entetes = await requete.allHeaders();
    expect(entetes['content-type']).toBe('application/json');
    for (const nom of ['cookie', 'referer', 'authorization', 'idempotency-key', 'x-requested-with']) expect(entetes[nom], nom).toBeUndefined();
    expect(entetes.origin).toBe(new URL(baseURL).origin);

    expect(adresses.filter((a) => !a.startsWith(`${baseURL}/`) && a !== ADRESSE)).toEqual([]);
    expect(erreurs).toEqual([]);
  });

  test('la page ne demande qu’un en-tête, Content-Type, et aucun mode de cache : rien qui puisse entrer dans le pré-vol CORS', async ({ page }) => {
    // Un en-tête de plus passerait par le pré-vol CORS, qui peut le refuser ; un mode de cache (no-store…) peut faire
    // ajouter Pragma et Cache-Control par un navigateur. Les options passées à fetch sont relevées telles que la page
    // les donne.
    await page.addInitScript(() => {
      window.optionsDemandees = [];
      const vraiFetch = window.fetch;
      window.fetch = function (adresse, options) {
        window.optionsDemandees.push(JSON.parse(JSON.stringify({ ...options, body: undefined, signal: undefined })));
        return vraiFetch.apply(this, arguments);
      };
    });
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(await page.evaluate(() => window.optionsDemandees)).toEqual([{
      method: 'POST', headers: { 'Content-Type': 'application/json' }, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
    }]);
    const entetes = Object.keys(await envois[0].allHeaders());
    expect(entetes.filter((nom) => ['cache-control', 'pragma'].includes(nom))).toEqual([]);
  });

  test('un téléphone et un message laissés vides ne partent pas', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, { ...SAISIE, phone: '   ', message: '' });
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    const corps = envois[0].postDataJSON();
    expect(Object.keys(corps)).toEqual(['barName', 'city', 'contactName', 'email', 'consent', 'website', 'fillMs']);
  });

  test('un caractère de contrôle collé devient une espace, une moitié d’émoji perdue devient « � » ; les retours à la ligne du message restent', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, SAISIE, { poses: {
      barName: 'Le\tZinc\u0085 des Amis',
      contactName: 'Camille\u007f Martin\uD83D',
      message: 'Bonjour\tà vous.\nÀ bientôt 🎉',
    } });
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    const corps = envois[0].postDataJSON();
    expect(corps.barName).toBe('Le Zinc  des Amis');
    expect(corps.contactName).toBe('Camille  Martin�');
    expect(corps.message).toBe('Bonjour à vous.\nÀ bientôt 🎉');
  });

  test('jamais avant 3 s après l’affichage du formulaire : la demande attend sous « Envoi… », dit aussi dans la zone de statut', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, SAISIE, { attendre: false });
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.envoi);
    await expect(page.locator('#demande-statut')).toHaveText(TEXTES.envoi);
    await expect(page.locator('#demande-statut .visuellement-cache')).toHaveText(TEXTES.envoi);
    await page.clock.runFor(2990);
    await page.evaluate(() => 0);
    await partiesEnTout(page, envois, 0);
    await attendreEnvois(page, envois, 1);
    expect(envois[0].postDataJSON().fillMs).toBeGreaterThanOrEqual(3000);
    expect(envois[0].postDataJSON().fillMs).toBeLessThanOrEqual(3250);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
  });

  test('pendant l’envoi, le bouton garde le focus, se dit indisponible, et un second clic ou Entrée n’envoie rien de plus', async ({ page }) => {
    const { envois } = await ouvrir(page, ['silence']);
    const bouton = page.locator('#demande-envoyer');
    await envoyerUneDemande(page, SAISIE, { attendre: false });
    await expect(bouton).toBeFocused();
    await expect(bouton).toHaveAttribute('aria-disabled', 'true');
    await expect(bouton).toHaveText(TEXTES.envoi);
    await expect(bouton).not.toHaveAttribute('disabled');
    await bouton.click({ force: true });
    await page.keyboard.press('Enter');
    await page.clock.runFor(3000);
    await expect.poll(() => envois.length).toBe(1);
    await bouton.click({ force: true });
    await page.keyboard.press('Enter');
    await expect(bouton).toBeFocused();
    await page.focus('#demande-nom');
    await page.keyboard.press('Enter');
    await page.clock.runFor(1000);
    await partiesEnTout(page, envois, 1);
  });

  test('le libellé du bouton est dans son propre élément : le petit verre reste, et le libellé revient après l’envoi', async ({ page }) => {
    // Le serveur simulé ne répond qu’une fois « Envoi… » vu.
    let repondre;
    const reponduApres = new Promise((resoudre) => { repondre = resoudre; });
    await ouvrir(page, [async (route) => {
      await reponduApres;
      await route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ok: false, statusCode: 400, reason: 'REQUETE_INVALIDE', message: 'REQUETE_INVALIDE' }) });
    }]);
    const bouton = page.locator('#demande-envoyer');
    await expect(bouton.locator('[data-libelle]')).toHaveText(TEXTES.bouton);
    await envoyerUneDemande(page);
    await expect(bouton.locator('[data-libelle]')).toHaveText(TEXTES.envoi);
    await expect(bouton.locator('svg')).toHaveCount(1);
    repondre();
    await expect(page.locator('#demande-alerte .message')).toHaveCount(1);
    await expect(bouton).toHaveText(TEXTES.bouton);
    await expect(bouton.locator('svg')).toHaveCount(1);
    await expect(page.locator('#demande-statut')).toBeEmpty();
  });
});

// Les règles du serveur sur les caractères et les formes, recopiées ici (caractères de contrôle, moitiés d’émoji,
// caractères invisibles, puis chaque champ) : un texte que la page envoie doit les passer.
const SERVEUR = (() => {
  const INVISIBLE_OU_SAUT = /[\p{Cf}\p{Zl}\p{Zp}]/u;
  const DRAPEAU_NOIR = 0x1f3f4;
  const lettreDeTag = (code) => code >= 0xe0020 && code <= 0xe007e;
  const FIN_DES_TAGS = 0xe007f;
  const aUnControle = (texte, lineFeed) => [...texte].some((c) => {
    const code = c.codePointAt(0);
    return !(code === 0x0a && lineFeed) && (code <= 0x1f || (code >= 0x7f && code <= 0x9f));
  });
  const bienForme = (texte) => [...texte].every((c) => c.codePointAt(0) < 0xd800 || c.codePointAt(0) > 0xdfff);
  const finDuDrapeau = (codes, debut) => {
    let i = debut + 1;
    while (i < codes.length && lettreDeTag(codes[i])) i += 1;
    return i > debut + 1 && codes[i] === FIN_DES_TAGS ? i : -1;
  };
  const aUnInvisible = (texte, emoji) => {
    const codes = [...texte].map((c) => c.codePointAt(0));
    for (let i = 0; i < codes.length; i += 1) {
      if (emoji && codes[i] === DRAPEAU_NOIR) {
        const fin = finDuDrapeau(codes, i);
        if (fin > 0) i = fin;
        continue;
      }
      if (!INVISIBLE_OU_SAUT.test(String.fromCodePoint(codes[i]))) continue;
      if (emoji && (codes[i] === 0x200c || codes[i] === 0x200d)) continue;
      return true;
    }
    return false;
  };
  const tape = (texte, message) => bienForme(texte) && !aUnControle(texte, message) && !aUnInvisible(texte, message);
  // Les champs que le serveur refuse dans un corps envoyé par la page (seules leurs règles de caractères et de forme).
  return (corps) => Object.entries(corps).filter(([nom, valeur]) => {
    if (['barName', 'city', 'contactName'].includes(nom)) return !tape(valeur.trim(), false);
    if (nom === 'message') return !tape(valeur.replace(/\r\n/g, '\n').trim(), true);
    if (nom === 'phone') return !/^[0-9 +.()-]+$/.test(valeur.trim());
    if (nom === 'email') return !/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i.test(valeur.trim());
    return false;
  }).map(([nom]) => nom);
})();

// Ce que le serveur refuse et que le visiteur ne voit pas, tel qu’il arrive par un copier-coller : la page les retire,
// ou met à leur place un retour à la ligne dans le message et une espace ailleurs (U+2028, U+2029). Les jointures
// (U+200C, U+200D) entre deux lettres sont invisibles : retirées d’un champ d’une ligne, gardées dans le message, où
// le serveur les accepte.
test.describe('les caractères que le serveur refuse', () => {
  const INVISIBLES = ['­', '؜', '᠎', '​', '‌', '‍', '‎', '‏', ' ', ' ',
    '‪', '‮', '⁠', '⁡', '⁦', '⁩', '﻿', '￹', '￻', '\u{E0001}', '\u{E0041}', '\u{E007F}'];
  const nom = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
  for (const c of INVISIBLES) {
    test(`${nom(c)} collé dans chaque champ : retiré (ou changé en saut de ligne ou en espace) ; ce qui part passe le serveur`, async ({ page }) => {
      const { envois } = await ouvrir(page);
      const saut = c === ' ' || c === ' ';
      const jointure = c === '‌' || c === '‍';
      const ligne = saut ? ' ' : '';
      await envoyerUneDemande(page, SAISIE, { poses: {
        barName: `Le Zinc${c}des Amis`,
        city: `Saint${c}Denis`,
        contactName: `Camille${c}Martin`,
        email: `camille@lezinc.fr${c}`,
        phone: `${c}+33 6 12 34 56 78${c}`,
        message: `Deux écrans${c}60 places`,
      } });
      await expect(page.locator('#demande-envoyee')).toBeVisible();
      const corps = envois[0].postDataJSON();
      expect(SERVEUR(corps)).toEqual([]);
      expect(corps).toMatchObject({
        barName: `Le Zinc${ligne}des Amis`,
        city: `Saint${ligne}Denis`,
        contactName: `Camille${ligne}Martin`,
        email: 'camille@lezinc.fr',
        phone: '+33 6 12 34 56 78',
        message: `Deux écrans${saut ? '\n' : jointure ? c : ''}60 places`,
      });
    });
  }

  test('un numéro copié d’un téléphone, entouré de marques de sens d’écriture, passe tel qu’on le voit', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, SAISIE, { poses: { phone: '‭+33 6 12 34 56 78‬' } });
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(envois[0].postDataJSON().phone).toBe('+33 6 12 34 56 78');
  });

  test('des invisibles mêlés à une moitié d’émoji, au bord d’un champ : il reste le texte visible, qui passe le serveur', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, SAISIE, { poses: { barName: `￹‏ ‍\uD800⁡${'x'.repeat(55)}` } });
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    const corps = envois[0].postDataJSON();
    expect(SERVEUR(corps)).toEqual([]);
    expect(corps.barName).toBe(`�${'x'.repeat(55)}`);
  });

  // Ce qui se voit ne disparaît pas en silence : un émoji fait de plusieurs (une jointure, ou les lettres invisibles
  // d’un drapeau régional) dans un champ d’une ligne, ou un signe qui porte un nombre, est refusé par la page, champ
  // par champ, avec ce qu’il faut faire ; rien ne part.
  test('un émoji composé dans un champ d’une ligne : refusé, avec son message, sous chaque champ ; rien ne part', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, SAISIE, { poses: {
      barName: 'Le Zinc 🏳️‍🌈',
      city: 'Londres 🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
      contactName: 'Camille 👨‍👩‍👧',
    } });
    await expect(page.locator('#demande-resume')).toBeFocused();
    await expect(page.locator('#demande-resume li a')).toHaveText([TEXTES.signe.barName, TEXTES.signe.city, TEXTES.signe.contactName]);
    for (const champ of ['barName', 'city', 'contactName']) {
      await expect(page.locator(`${CHAMPS[champ]}-erreur`)).toHaveText(TEXTES.signe[champ]);
    }
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);
  });

  test('dans le message, ces émojis passent tels quels ; un signe qui porte un nombre y est refusé', async ({ page }) => {
    const { envois } = await ouvrir(page, [CREEE]);
    const message = 'Deux écrans 👨‍👩‍👧 🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} 🏳️‍🌈';
    await envoyerUneDemande(page, SAISIE, { poses: { message: `Prix ؀100` } });
    await expect(page.locator('#demande-message-erreur')).toHaveText(TEXTES.signe.message);
    await partiesEnTout(page, envois, 0);
    await poser(page, CHAMPS.message, message);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    const corps = envois[0].postDataJSON();
    expect(SERVEUR(corps)).toEqual([]);
    expect(corps.message).toBe(message);
  });
});

test.describe('avant d’envoyer, le formulaire vérifie', () => {
  test('les champs obligatoires : une erreur sous chaque champ, un résumé qui prend le focus et mène aux champs', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await apresTroisSecondes(page);
    await envoyer(page);

    const resume = page.locator('#demande-resume');
    await expect(resume).toBeVisible();
    await expect(resume).toBeFocused();
    await expect(page.locator('#demande-resume-titre')).toHaveText(TEXTES.resume(5));
    await expect(resume).toHaveAccessibleName(TEXTES.resume(5));
    const attendus = [
      ['#demande-bar', 'Écris le nom de ton bar.'],
      ['#demande-ville', 'Écris ta ville.'],
      ['#demande-nom', 'Écris ton nom.'],
      ['#demande-email', 'Écris ton adresse e-mail.'],
      ['#demande-accord', TEXTES.accord],
    ];
    await expect(resume.locator('li a')).toHaveText(attendus.map(([, texte]) => texte));
    expect(await resume.locator('li a').evaluateAll((liens) => liens.map((l) => l.getAttribute('href')))).toEqual(attendus.map(([id]) => id));
    for (const [id, texte] of attendus) {
      await expect(page.locator(id)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(`${id}-erreur`)).toBeVisible();
      await expect(page.locator(`${id}-erreur`)).toHaveText(texte);
      // L’erreur d’abord, puis l’indice s’il y en a un : l’ordre où on les voit.
      await expect(page.locator(id)).toHaveAccessibleDescription(INDICES[id] ? `${texte} ${INDICES[id]}` : texte);
    }
    for (const id of ['#demande-telephone', '#demande-message']) {
      await expect(page.locator(id)).not.toHaveAttribute('aria-invalid');
      await expect(page.locator(`${id}-erreur`)).toBeHidden();
    }
    await expect(page.locator('#demande-message')).toHaveAttribute('aria-describedby', 'demande-message-indice');
    expect(envois).toHaveLength(0);

    await resume.getByRole('link', { name: 'Écris ta ville.' }).click();
    await expect(page.locator('#demande-ville')).toBeFocused();
    await page.keyboard.type('Lyon');
    await expect(page.locator('#demande-ville')).not.toHaveAttribute('aria-invalid');
    await expect(page.locator('#demande-ville-erreur')).toBeHidden();
    await expect(page.locator('#demande-ville')).toHaveAttribute('aria-describedby', 'demande-ville-indice');
    await expect(resume.locator('li')).toHaveCount(4);
    await expect(page.locator('#demande-resume-titre')).toHaveText(TEXTES.resume(4));
    await resume.getByRole('link', { name: TEXTES.accord }).click();
    await expect(page.locator('#demande-accord')).toBeFocused();
  });

  test('la forme de l’e-mail et du téléphone, la longueur du message ; l’indice du message reste avec l’erreur', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, { ...SAISIE, email: 'camille@lezinc', phone: '06 12 34 ab' }, { poses: { message: 'é'.repeat(1001) } });
    await expect(page.locator('#demande-resume')).toBeFocused();
    await expect(page.locator('#demande-resume-titre')).toHaveText(TEXTES.resume(3));
    await expect(page.locator('#demande-email-erreur')).toHaveText(TEXTES.emailFin);
    await expect(page.locator('#demande-telephone-erreur')).toHaveText(TEXTES.telephone);
    await expect(page.locator('#demande-message-erreur')).toHaveText('Raccourcis ton message : 1 000 caractères au plus.');
    await expect(page.locator('#demande-message')).toHaveAttribute('aria-describedby', 'demande-message-erreur demande-message-indice');
    await expect(page.locator('#demande-message')).toHaveAccessibleDescription(
      `Raccourcis ton message : 1 000 caractères au plus. ${INDICES['#demande-message']}`);
    await expect(page.locator('#demande-resume li')).toHaveCount(3);
    expect(envois).toHaveLength(0);
  });

  // Les limites du serveur, à leur bord : le même texte est refusé par la page avec un message qui dit quoi faire, ou
  // accepté et envoyé tel quel (après nettoyage des espaces du bout).
  const BORDS = [
    ['barName', 'A', 'Écris au moins 2 caractères pour le nom de ton bar.'],
    ['barName', ' Ab ', null],
    ['barName', 'B'.repeat(81), 'Raccourcis le nom de ton bar : 80 caractères au plus.'],
    ['barName', 'B'.repeat(80), null],
    ['city', 'P', 'Écris au moins 2 caractères pour ta ville.'],
    ['city', 'Pa', null],
    ['city', 'P'.repeat(61), 'Raccourcis le nom de ta ville : 60 caractères au plus.'],
    ['city', 'P'.repeat(60), null],
    ['contactName', 'C', 'Écris au moins 2 caractères pour ton nom.'],
    ['contactName', 'Al', null],
    ['contactName', 'C'.repeat(81), 'Raccourcis ton nom : 80 caractères au plus.'],
    ['contactName', 'C'.repeat(80), null],
    ['email', `${'a'.repeat(242)}@example.test`, 'Cette adresse e-mail est trop longue : 254 caractères au plus.'],
    ['email', `${'a'.repeat(241)}@example.test`, null],
    ['email', 'contact@', TEXTES.emailIncomplet],
    ['email', '@lezinc.fr', TEXTES.emailIncomplet],
    // Ce qui manque, dit en clair.
    ['email', 'karim.lezincdesamis.fr', TEXTES.emailArobase],
    ['email', 'karim@lezinc', TEXTES.emailFin],
    ['email', 'karim@lezinc.', TEXTES.emailFin],
    ['email', 'andré@lezinc.fr', TEXTES.emailCaractere],
    ['email', 'camille..martin@lezinc.fr', TEXTES.emailCaractere],
    ['email', 'camille martin@lezinc.fr', TEXTES.emailCaractere],
    ['email', 'Camille.Martin+bar@le-zinc.paris', null],
    ['phone', '12345', TEXTES.telephoneCourt],
    ['phone', '+(12) 34-5.', TEXTES.telephoneCourt],
    ['phone', '06 12 AB 56 78', TEXTES.telephone],
    ['phone', '0'.repeat(21), TEXTES.telephoneLong],
    ['phone', '+33 6 12 34 56 78', null],
    ['phone', '+33 (0)6.12-34', null],
    ['message', 'm'.repeat(1001), 'Raccourcis ton message : 1 000 caractères au plus.'],
    ['message', `${'m'.repeat(998)}\nm`, null],
  ];
  for (const [nom, valeur, erreur] of BORDS) {
    const court = valeur.length > 24 ? `${valeur.slice(0, 12)}… (${valeur.length})` : valeur;
    test(`${nom} « ${court} » : ${erreur ? 'refusé' : 'accepté'}`, async ({ page }) => {
      const { envois } = await ouvrir(page);
      await envoyerUneDemande(page, SAISIE, { poses: { [nom]: valeur } });
      if (erreur) {
        await expect(page.locator(`${CHAMPS[nom]}-erreur`)).toHaveText(erreur);
        await expect(page.locator('#demande-resume li')).toHaveCount(1);
        await page.clock.runFor(5000);
        await partiesEnTout(page, envois, 0);
      } else {
        await expect(page.locator('#demande-envoyee')).toBeVisible();
        expect(envois[0].postDataJSON()[nom]).toBe(valeur.trim());
      }
    });
  }

  // Quand la case est la seule erreur, le focus va sur la case, pas sur le résumé en haut du formulaire : la case et
  // le bouton restent à l’écran (avec le résumé, la page remontait de 830 px et la case sortait par le bas).
  test('la case : sans elle, rien ne part ; seule erreur, elle prend le focus et reste à l’écran, sans résumé en haut', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, SAISIE, { accord: false });
    await expect(page.locator('#demande-accord')).toBeFocused();
    await expect(page.locator('#demande-resume')).toBeHidden();
    await expect(page.locator('#demande-accord')).toBeInViewport();
    await expect(page.locator('#demande-accord-erreur')).toBeInViewport();
    await expect(page.locator('#demande-accord')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#demande-accord-erreur')).toHaveText(TEXTES.accord);
    await expect(page.locator('#demande-accord')).toHaveAccessibleDescription(TEXTES.accord);
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);
  });

  // Le piège à robots : un champ caché qu’un gestionnaire de mots de passe ne doit pas remplir. Un robot qui le remplit
  // croit que c’est parti, et rien ne part ; mais une personne peut être là (un remplissage automatique quand même) :
  // son brouillon reste dans l’onglet.
  test('le champ piège rempli : « C’est envoyé. » s’affiche, rien ne part, et le brouillon reste dans l’onglet', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await page.locator(PIEGE).evaluate((champ) => { champ.value = 'https://exemple.com'; });
    await apresTroisSecondes(page);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect(page.locator('#demande-envoyee')).toBeFocused();
    expect(await page.evaluate((cle) => JSON.parse(sessionStorage.getItem(cle)), BROUILLON)).toEqual(SAISIE);
    await page.clock.runFor(20_000);
    await partiesEnTout(page, envois, 0);
  });

  test('le piège ne garde qu’une espace : c’est une personne, et la demande part (avec website vide)', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await page.locator(PIEGE).evaluate((champ) => { champ.value = ' '; });
    await apresTroisSecondes(page);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await partiesEnTout(page, envois, 1);
    expect(envois[0].postDataJSON().website).toBe('');
  });

  test('le piège : un nom qu’aucun remplissage automatique ne reconnaît, et les attributs qui écartent les gestionnaires de mots de passe', async ({ page }) => {
    await ouvrir(page);
    const piege = page.locator('.formulaire__piege input');
    await expect(piege).toHaveCount(1);
    const { id, nom, attributs } = await piege.evaluate((champ) => ({
      id: champ.id,
      nom: champ.name,
      attributs: Object.fromEntries(['autocomplete', 'tabindex', 'data-1p-ignore', 'data-lpignore', 'data-form-type']
        .map((a) => [a, champ.getAttribute(a)])),
    }));
    expect(`#${id}`).toBe(PIEGE);
    for (const mot of [id, nom]) expect(mot).not.toMatch(/web|site|url|link|lien|mail|phone|tel|name|nom|company|org|address|adresse|city|ville/i);
    expect(attributs).toEqual({ autocomplete: 'off', tabindex: '-1', 'data-1p-ignore': '', 'data-lpignore': 'true', 'data-form-type': 'other' });
    await expect(page.locator('.formulaire__piege')).toHaveAttribute('aria-hidden', 'true');
  });

  test('le piège : jamais atteint au clavier, et hors de l’écran avant comme après pour-les-bars.css', async ({ page }) => {
    let lacher;
    const retenue = new Promise((resoudre) => { lacher = resoudre; });
    const imageArrivee = await ralentirLaPremiereImage(page);
    await page.route('**/pour-les-bars.css', async (route) => { await retenue; await route.continue(); });
    await ouvrir(page, [CREEE], { feuille: false });
    const horsEcran = () => page.locator(PIEGE).evaluate((champ) => {
      const boite = champ.getBoundingClientRect();
      return boite.right <= 0 || boite.bottom <= 0 || boite.left >= window.innerWidth || boite.width * boite.height <= 1;
    });
    expect(await horsEcran()).toBe(true);
    lacher();
    await expect.poll(() => page.evaluate(() => [...document.styleSheets].some((f) => f.href?.endsWith('/pour-les-bars.css')))).toBe(true);
    expect(await horsEcran()).toBe(true);
    await page.focus('#demande-bar');
    const parcourus = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      parcourus.push(await page.evaluate(() => document.activeElement?.id ?? ''));
    }
    expect(parcourus).toContain('demande-envoyer');
    expect(parcourus).not.toContain(PIEGE.slice(1));
    await imageArrivee();
  });

  test('la page ouverte depuis plus de 24 h : elle demande à être rechargée, rien ne part, et ce qui est écrit revient', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await page.clock.fastForward(JOUR + 1);
    await envoyer(page);
    const statut = page.locator('#demande-statut');
    await attendreMessage(statut, TEXTES.expiree);
    await expect(statut.locator('.message')).toHaveClass(/message--bloque/);
    const recharger = statut.getByRole('button', { name: 'Recharger la page' });
    // Le bouton d’envoi s’efface : le focus passe au bouton qui le remplace.
    await expect(recharger).toBeFocused();
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    await expect(page.locator('#demande-envoyer')).not.toHaveAttribute('aria-disabled');
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.bouton);
    await expect(page.locator('#demande-alerte')).toBeEmpty();
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);

    await Promise.all([page.waitForEvent('load'), recharger.click()]);
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
    await attendreMessage(page.locator('#demande-statut'), TEXTES.brouillon);
    await expect(page.locator('#demande-alerte')).toBeEmpty();
  });

  test('l’appareil a dormi plus de 24 h (l’heure a avancé, pas l’horloge de la page) : la page demande aussi à être rechargée', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await page.clock.fastForward(3000);
    // performance.now() n’avance pas pendant la veille : seule l’heure de l’appareil a bougé.
    await page.clock.setSystemTime(DEBUT + 1000 + 3000 + JOUR + 1);
    expect(await page.evaluate(() => performance.now())).toBeLessThan(10_000);
    await envoyer(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.expiree);
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);
  });

  test('une heure de l’appareil qui recule ne compte pas : la demande part', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await page.clock.fastForward(3000);
    await page.clock.setSystemTime(DEBUT - JOUR);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(envois).toHaveLength(1);
  });
});

test.describe('ce qui est tapé reste dans l’onglet', () => {
  test('le brouillon revient après un rechargement, sans la case ni le piège, et la page le dit', async ({ page }) => {
    await ouvrir(page);
    await remplir(page);
    await page.locator(PIEGE).fill('piège');
    const brouillon = await page.evaluate((cle) => JSON.parse(sessionStorage.getItem(cle)), BROUILLON);
    expect(brouillon).toEqual(SAISIE);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    await page.reload();
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
    await expect(page.locator(PIEGE)).toHaveValue('');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.brouillon);

    // Le message s’en va dès que la demande repart.
    await page.check('#demande-accord');
    await apresTroisSecondes(page);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect(page.locator('#demande-statut')).toBeEmpty();
  });
});

test.describe('les réponses du serveur', () => {
  test('201 : « C’est envoyé. » prend le focus, avec l’adresse tapée ; le formulaire est vidé et le brouillon effacé', async ({ page }) => {
    const { erreurs } = await ouvrir(page);
    await envoyerUneDemande(page);
    const envoyee = page.locator('#demande-envoyee');
    await expect(envoyee).toBeVisible();
    await expect(envoyee).toBeFocused();
    await expect(page.locator('#demande-envoyee-email')).toHaveText(SAISIE.email);
    await expect(page.locator('#demande')).toBeHidden();
    // « Tu préfères l’e-mail ? … Tu nous as déjà écrit ? » n’a plus lieu d’être sous le merci.
    await expect(page.locator('.formulaire__ailleurs')).toBeHidden();
    expect(await page.evaluate((cle) => sessionStorage.getItem(cle), BROUILLON)).toBeNull();
    for (const id of Object.values(CHAMPS)) expect(await page.locator(id).inputValue()).toBe('');
    expect(erreurs).toEqual([]);

    // « Envoie une nouvelle demande » : le formulaire revient avec ce qui vient de partir, à corriger.
    await page.click('#demande-nouvelle');
    await expect(page.locator('#demande')).toBeVisible();
    await expect(envoyee).toBeHidden();
    await expect(page.locator('.formulaire__ailleurs')).toBeVisible();
    await expect(page.locator('#demande-bar')).toBeFocused();
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.bouton);

    await page.reload();
    await expect(page.locator('#demande-bar')).toHaveValue(SAISIE.barName);
  });

  test('400 CONSENTEMENT_REQUIS : le message de la case, sur la case, qui prend le focus (pas de résumé en haut)', async ({ page }) => {
    await ouvrir(page, [refus('CONSENTEMENT_REQUIS')]);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-accord')).toBeFocused();
    await expect(page.locator('#demande-resume')).toBeHidden();
    await expect(page.locator('#demande-accord-erreur')).toHaveText(TEXTES.accord);
    await expect(page.locator('#demande-accord')).toHaveAccessibleDescription(TEXTES.accord);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.bouton);
    await expect(page.locator('#demande-bar')).toHaveValue(SAISIE.barName);
  });

  // La page vérifie ce que le serveur vérifie (longueurs, formes, caractères) : un REQUETE_INVALIDE vient d’une règle
  // ajoutée au serveur depuis, et il ne dit pas quel champ. La page n’accuse pas ce qui est tapé et ne repropose pas
  // le même bouton, qui échouerait encore : elle passe à l’e-mail, en geste principal.
  test('400 REQUETE_INVALIDE : « Une information ne passe pas chez nous. », sans rien répéter de ce qui est tapé ; l’e-mail devient le geste principal et le bouton d’envoi s’efface', async ({ page }) => {
    await ouvrir(page, [refus('REQUETE_INVALIDE')]);
    await envoyerUneDemande(page);
    const alerte = page.locator('#demande-alerte');
    await attendreMessage(alerte, TEXTES.invalide);
    await expect(alerte.locator('.message')).toHaveClass(/message--erreur/);
    await expect(alerte.locator('.message')).toHaveClass(/message--bloque/);
    for (const valeur of Object.values(SAISIE)) expect(await alerte.textContent()).not.toContain(valeur.split('\n')[0]);
    await expect(page.locator('#demande-statut')).toBeEmpty();
    await expect(page.locator('#demande-courriel')).toBeVisible();
    await expect(page.locator('#demande-courriel-lien')).toHaveAttribute('href', /^mailto:contact@baromatch\.fr\?/);
    expect(await fond(page.locator('#demande-courriel-lien'))).toBe(AMBRE);
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
    await expect(page.locator('#demande-envoyer')).not.toHaveAttribute('aria-disabled');
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
  });

  test('400 FORMULAIRE_EXPIRE : la page demande à être rechargée', async ({ page }) => {
    await ouvrir(page, [refus('FORMULAIRE_EXPIRE')]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.expiree);
    await expect(page.locator('#demande-statut').getByRole('button', { name: 'Recharger la page' })).toBeFocused();
  });

  test('un 400 au corps illisible est une panne, pas un refus : un nouvel essai, puis l’e-mail', async ({ page }) => {
    const { envois } = await ouvrir(page, [{ status: 400, contentType: 'text/html', corps: '<html>Bad Request</html>' }]);
    await envoyerUneDemande(page);
    await expect.poll(() => envois.length).toBe(1);
    await attendreEnvois(page, envois, 2);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await expect(page.locator('#demande-alerte')).toBeEmpty();
    await page.clock.runFor(15_000);
    await partiesEnTout(page, envois, 2);
  });

  test('un 400 dont le corps n’arrive jamais : abandonné après 10 s comme une demande sans réponse, puis renvoyé', async ({ page }) => {
    await page.addInitScript(() => {
      const lire = Response.prototype.json;
      Response.prototype.json = function () { return this.status === 400 ? new Promise(() => {}) : lire.call(this); };
    });
    const { envois } = await ouvrir(page, [refus('REQUETE_INVALIDE'), CREEE]);
    await envoyerUneDemande(page);
    await expect.poll(() => envois.length).toBe(1);
    await page.clock.runFor(9_000);
    await partiesEnTout(page, envois, 1);
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.envoi);
    await page.clock.runFor(1_000);
    await attendreEnvois(page, envois, 2);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
  });

  // Le wifi d’un bar est partagé : le message dit la règle sans accuser, et l’e-mail (qui passe tout de suite)
  // devient le geste principal ; « Envoyer ma demande » reste, en second, pour réessayer dans une heure.
  test('429 : « Beaucoup d’envois depuis cette connexion. », la règle dite sans accuser ; l’e-mail en geste principal, le bouton d’envoi reste en second', async ({ page }) => {
    const { envois } = await ouvrir(page, [reponse(429, { statusCode: 429, message: 'Rate limit exceeded' })]);
    await envoyerUneDemande(page);
    const alerte = page.locator('#demande-alerte');
    await attendreMessage(alerte, TEXTES.tropDEnvois);
    await expect(alerte.locator('.message')).toHaveClass(/message--erreur/);
    await expect(alerte.locator('.message')).not.toHaveClass(/message--bloque/);
    await expect(page.locator('#demande-statut')).toBeEmpty();
    await expect(page.locator('#demande-courriel')).toBeVisible();
    await expect(page.locator('#demande-courriel-lien')).toHaveAttribute('href', /^mailto:contact@baromatch\.fr\?/);
    expect(await fond(page.locator('#demande-courriel-lien'))).toBe(AMBRE);
    await expect(page.locator('#demande-envoyer')).toBeVisible();
    expect(await fond(page.locator('#demande-envoyer'))).not.toBe(AMBRE);
    await expect(page.locator('#demande-envoyer')).toBeFocused();
    await page.clock.runFor(10_000);
    await partiesEnTout(page, envois, 1);
  });

  for (const [status, json] of [[404, {}], [405, {}], [501, {}], [403, { ok: false, statusCode: 403, reason: 'ORIGINE_REFUSEE', message: 'ORIGINE_REFUSEE' }]]) {
    test(`${status}${json.reason ? ` ${json.reason}` : ''} : la dernière étape passe par l’e-mail, sans nouvel essai`, async ({ page, baseURL }) => {
      const { envois, adresses } = await ouvrir(page, [reponse(status, json)]);
      await envoyerUneDemande(page);
      const statut = page.locator('#demande-statut');
      await attendreMessage(statut, TEXTES.courriel);
      await expect(statut.locator('.message')).not.toHaveClass(/message--erreur/);
      await expect(statut.locator('.message')).toHaveClass(/message--bloque/);
      await expect(page.locator('#demande-alerte')).toBeEmpty();
      await expect(page.locator('#demande-courriel')).toBeVisible();
      // Le bouton d’envoi s’efface : le focus passe au lien qui ouvre la messagerie.
      await expect(page.locator('#demande-envoyer')).toBeHidden();
      await expect(page.locator('#demande-courriel-lien')).toBeFocused();
      await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.bouton);
      for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
      await page.clock.runFor(15_000);
      await partiesEnTout(page, envois, 1);
      expect(adresses.filter((a) => !a.startsWith(`${baseURL}/`) && a !== ADRESSE)).toEqual([]);
    });
  }

  test('l’e-mail tout prêt : l’objet, une ligne par champ rempli, rien d’autre ; le même texte à copier, objet en tête ; & ? # % passent intacts', async ({ page }) => {
    await ouvrir(page, [reponse(404, {})]);
    const bar = 'Le Zinc & Co ? #1 à 100 % $&';
    const message = 'Écrans : 2 & 1 projecteur ?\nRéduction 10 % #mardi';
    await envoyerUneDemande(page, { ...SAISIE, barName: bar, message });
    const courriel = await lireCourriel(page);
    expect(courriel.destinataire).toBe('contact@baromatch.fr');
    expect(courriel.lien).not.toMatch(/[ +\n#]/);
    expect(Object.keys(courriel)).toEqual(['lien', 'destinataire', 'subject', 'body']);
    expect(courriel.subject).toBe(`Demande d’un bar — ${bar}`);
    const lignes = [`Bar : ${bar}`, ...LIGNES_COMPLETES.slice(1, 5), ...message.split('\n').map((l, i) => (i ? l : `Message : ${l}`))];
    expect(courriel.body.split('\r\n')).toEqual(lignes);
    await expect(page.locator('#demande-courriel-texte')).toHaveValue(aCopier(lignes, bar));
    await expect(page.locator('#demande-courriel-texte')).toHaveAttribute('readonly', '');
  });

  test('l’e-mail tout prêt sans téléphone ni message : aucune ligne vide, et ce qui est corrigé ensuite y passe', async ({ page }) => {
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page, { ...SAISIE, phone: '', message: '  ' });
    let courriel = await lireCourriel(page);
    expect(courriel.body.split('\r\n')).toEqual(LIGNES_COMPLETES.slice(0, 4));
    expect(courriel.body).not.toMatch(/Téléphone|Message|\r\n\r\n|\r\n$/);
    await expect(page.locator('#demande-courriel-texte')).toHaveValue(aCopier(LIGNES_COMPLETES.slice(0, 4)));

    await page.fill('#demande-email', 'camille@lezinc-paris.fr');
    courriel = await lireCourriel(page);
    expect(courriel.body.split('\r\n')[3]).toBe('E-mail : camille@lezinc-paris.fr');
    await expect(page.locator('#demande-courriel-texte')).toHaveValue(/E-mail : camille@lezinc-paris\.fr$/);
  });

  test('« Copier le texte » copie la demande, dit « Texte copié » pendant 2 s, en gardant son icône', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    const copier = page.locator('#demande-courriel-copier');
    await expect(copier).toHaveText(TEXTES.copier);
    await copier.click();
    // Le presse-papiers de Windows rend les fins de ligne en CRLF : on compare le texte, pas la convention du système.
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText().then((texte) => texte.replace(/\r\n/g, '\n'))))
      .toBe(aCopier(LIGNES_COMPLETES));
    await expect(copier).toHaveText(TEXTES.copie);
    await expect(copier.locator('svg')).toHaveCount(1);
    await page.clock.runFor(1900);
    await expect(copier).toHaveText(TEXTES.copie);
    await page.clock.runFor(200);
    await expect(copier).toHaveText(TEXTES.copier);
    await expect(copier.locator('svg')).toHaveCount(1);
  });

  for (const [cas, sansPressePapiers] of [
    ['sans presse-papiers', () => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })],
    ['quand le presse-papiers est refusé', () => Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new DOMException('Refusé', 'NotAllowedError')) }, configurable: true,
    })],
  ]) {
    test(`« Copier le texte » ${cas} : la page le dit, et le texte reste sélectionné, prêt à copier`, async ({ page }) => {
      await page.addInitScript(sansPressePapiers);
      await ouvrir(page, [reponse(404, {})]);
      await envoyerUneDemande(page);
      await page.click('#demande-courriel-copier');
      await attendreMessage(page.locator('#demande-statut'), TEXTES.copieImpossible);
      await expect(page.locator('#demande-alerte')).toBeEmpty();
      const texte = page.locator('#demande-courriel-texte');
      await expect(texte).toBeFocused();
      expect(await texte.evaluate((t) => [t.selectionStart, t.selectionEnd])).toEqual([0, aCopier(LIGNES_COMPLETES).length]);
      await expect(page.locator('#demande-courriel-copier')).toHaveText(TEXTES.copier);
      await expect(page.locator('#demande-envoyer')).toBeHidden();
    });
  }

  test('un échec réseau en ligne : un seul nouvel essai 2 s plus tard, puis l’e-mail', async ({ page }) => {
    const { envois } = await ouvrir(page, ['coupure']);
    const echec = page.waitForEvent('requestfailed');
    await envoyerUneDemande(page);
    await echec;
    await page.clock.runFor(1500);
    await partiesEnTout(page, envois, 1);
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.envoi);
    await attendreEnvois(page, envois, 2);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await expect(page.locator('#demande-courriel')).toBeVisible();
    await page.clock.runFor(15_000);
    await partiesEnTout(page, envois, 2);
  });

  test('le réseau qui « revient » pendant l’attente du nouvel essai ne lance pas une seconde demande en parallèle', async ({ page }) => {
    const { envois } = await ouvrir(page, ['coupure', CREEE]);
    const echec = page.waitForEvent('requestfailed');
    await envoyerUneDemande(page);
    await echec;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.clock.runFor(1500);
    await partiesEnTout(page, envois, 1);
    await attendreEnvois(page, envois, 2);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.clock.runFor(15_000);
    await partiesEnTout(page, envois, 2);
  });

  test('une erreur du serveur (503) : un seul nouvel essai, puis l’e-mail', async ({ page }) => {
    const { envois } = await ouvrir(page, [reponse(503, {})]);
    await envoyerUneDemande(page);
    await expect.poll(() => envois.length).toBe(1);
    await attendreEnvois(page, envois, 2);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await page.clock.runFor(15_000);
    await partiesEnTout(page, envois, 2);
  });

  test('une erreur du serveur (500) puis 201 au nouvel essai : « C’est envoyé. »', async ({ page }) => {
    const { envois } = await ouvrir(page, [reponse(500, {}), CREEE]);
    await envoyerUneDemande(page);
    await attendreEnvois(page, envois, 2);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(envois[1].postDataJSON().fillMs).toBeGreaterThan(envois[0].postDataJSON().fillMs);
  });

  test('sans réponse après 10 s, la demande est abandonnée puis renvoyée une fois', async ({ page }) => {
    const { envois } = await ouvrir(page, ['silence', CREEE]);
    await envoyerUneDemande(page);
    await expect.poll(() => envois.length).toBe(1);
    await page.clock.runFor(9_000);
    await partiesEnTout(page, envois, 1);
    await page.clock.runFor(1_000);
    await attendreEnvois(page, envois, 2);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
  });

  test('hors ligne : rien ne part, un message le dit, et la demande part une fois quand le réseau revient', async ({ page, context }) => {
    const { envois } = await ouvrir(page);
    await context.setOffline(true);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.bouton);
    await expect(page.locator('#demande-envoyer')).toBeFocused();
    expect(envois).toHaveLength(0);
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
    // La messagerie, qui sait garder un mail à envoyer plus tard, est proposée en second choix (verre).
    await expect(page.locator('#demande-courriel')).toBeVisible();
    expect(await fond(page.locator('#demande-courriel-lien'))).not.toBe(AMBRE);
    expect(await fond(page.locator('#demande-envoyer'))).toBe(AMBRE);

    await context.setOffline(false);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.clock.runFor(20_000);
    await partiesEnTout(page, envois, 1);
  });

  test('hors ligne, puis « Ouvrir ma messagerie » : la demande part par le mail, et ne repart plus d’elle-même au retour du réseau', async ({ page, context }) => {
    const { envois } = await ouvrir(page);
    await context.setOffline(true);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
    await sansOuvrirLaMessagerie(page);
    await page.click('#demande-courriel-lien');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerie);
    await context.setOffline(false);
    await page.clock.runFor(20_000);
    await partiesEnTout(page, envois, 0);
    await expect(page.locator('#demande-envoyee')).toBeHidden();
    // Le bouton reste là, si la messagerie ne s’est pas ouverte.
    await expect(page.locator('#demande-envoyer')).toBeVisible();
  });

  test('le réseau revient alors qu’un champ a été vidé : rien ne part, rien ne bouge, la zone de statut dit que la demande attend « Envoyer ma demande »', async ({ page, context }) => {
    const { envois } = await ouvrir(page);
    await context.setOffline(true);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
    await page.fill('#demande-ville', '');
    await expect(page.locator('#demande-ville')).toBeFocused();

    await context.setOffline(false);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.reseauRevenu);
    // Le formulaire reste tel quel : ni résumé, ni erreur posée, ni focus déplacé.
    await expect(page.locator('#demande-resume')).toBeHidden();
    await expect(page.locator('#demande-ville')).not.toHaveAttribute('aria-invalid');
    await expect(page.locator('#demande-ville-erreur')).toBeHidden();
    await expect(page.locator('#demande-ville')).toBeFocused();
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);

    // La demande part au prochain « Envoyer ma demande », une fois corrigée.
    await page.fill('#demande-ville', 'Paris');
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(envois).toHaveLength(1);
  });

  test('le réseau coupé pendant l’envoi : le message hors ligne, puis l’envoi au retour du réseau', async ({ page, context }) => {
    const { envois } = await ouvrir(page, [async (route) => {
      await context.setOffline(true);
      await route.abort('internetdisconnected');
    }, CREEE]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 1);
    await context.setOffline(false);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(envois).toHaveLength(2);
  });

  test('les messages arrivent dans les deux zones déjà présentes : aucune zone annoncée n’est créée en cours de route', async ({ page }) => {
    await ouvrir(page, [refus('REQUETE_INVALIDE')]);
    // Les zones du formulaire (#proposer) : une autre partie de la page peut avoir les siennes.
    const zones = () => page.$$eval(['status', 'alert'].map((role) => `#proposer [role="${role}"]`).concat('#proposer [aria-live]').join(', '), (e) => e.map((z) => z.id));
    expect(await zones()).toEqual(['demande-statut', 'demande-alerte']);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-alerte'), TEXTES.invalide);
    expect(await zones()).toEqual(['demande-statut', 'demande-alerte']);
  });
});

// Un réseau lent ne laisse pas « Envoi… » muet ; l’étape de l’e-mail dit que rien n’est parti, garde un chemin vers le
// formulaire et se calme une fois la messagerie ouverte ; le texte à copier se lit en entier.
test.describe('pendant et après l’envoi, la page dit où en est la demande', () => {
  test('après 4 s de « Envoi… », la zone de statut dit que le réseau est lent et que la demande est en route ; le nouvel essai part toujours, une fois', async ({ page }) => {
    const { envois } = await ouvrir(page, ['silence', CREEE]);
    await envoyerUneDemande(page);
    const statut = page.locator('#demande-statut');
    await expect.poll(() => envois.length).toBe(1);
    await page.clock.runFor(3_900);
    await expect(statut.locator('.message')).toHaveCount(0);
    await expect(statut).toHaveText(TEXTES.envoi);
    await page.clock.runFor(200);
    await attendreMessage(statut, TEXTES.lent);
    await expect(statut.locator('.message')).not.toHaveClass(/message--erreur|message--bloque/);
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.envoi);
    await expect(page.locator('#demande-envoyer')).toBeFocused();
    // Le message reste pendant l’attente du nouvel essai (10 s, puis 2 s), qui part une seule fois et réussit.
    await page.clock.runFor(6_000);
    await attendreMessage(statut, TEXTES.lent);
    await attendreEnvois(page, envois, 2);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect(statut).toBeEmpty();
    await page.clock.runFor(20_000);
    await partiesEnTout(page, envois, 2);
  });

  test('une réponse qui arrive avant 4 s ne montre jamais le message du réseau lent', async ({ page }) => {
    await ouvrir(page, [reponse(429, {})]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-alerte'), TEXTES.tropDEnvois);
    await page.clock.runFor(10_000);
    await expect(page.locator('#demande-statut')).toBeEmpty();
  });

  test('l’étape de l’e-mail dit que la demande n’est pas encore partie ; « Modifier ma demande » ramène au premier champ, et ce qui est corrigé passe dans le mail', async ({ page }) => {
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    const modifier = page.locator('#demande-courriel').getByRole('button', { name: TEXTES.modifier });
    await expect(modifier).toBeVisible();
    await modifier.click();
    await expect(page.locator('#demande-bar')).toBeFocused();
    await page.fill('#demande-bar', 'Le Zinc');
    const courriel = await lireCourriel(page);
    expect(courriel.subject).toBe('Demande d’un bar — Le Zinc');
  });

  test('après « Ouvrir ma messagerie », une ligne calme remplace le message ; le brouillon reste dans l’onglet, le bouton d’envoi reste effacé', async ({ page }) => {
    const { envois } = await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await sansOuvrirLaMessagerie(page);
    await page.click('#demande-courriel-lien');
    const statut = page.locator('#demande-statut');
    await attendreMessage(statut, TEXTES.messagerie);
    await expect(statut.locator('.message')).toHaveClass(/message--bloque/);
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
    expect(await page.evaluate((cle) => JSON.parse(sessionStorage.getItem(cle)), BROUILLON)).toEqual(SAISIE);
    expect(envois).toHaveLength(1);
  });

  test('après un 429, « Ouvrir ma messagerie » donne la même ligne calme, sans effacer le bouton d’envoi', async ({ page }) => {
    await ouvrir(page, [reponse(429, {})]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-alerte'), TEXTES.tropDEnvois);
    await sansOuvrirLaMessagerie(page);
    await page.click('#demande-courriel-lien');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerie);
    await expect(page.locator('#demande-statut .message')).not.toHaveClass(/message--bloque/);
    await expect(page.locator('#demande-envoyer')).toBeVisible();
  });

  test('à 360 px, le texte à copier se lit en entier dans sa boîte, sans la faire défiler, même corrigé ensuite', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    const texte = page.locator('#demande-courriel-texte');
    await expect(texte).toBeVisible();
    expect(await texte.evaluate((t) => t.scrollHeight - t.clientHeight)).toBeLessThanOrEqual(0);
    await page.fill('#demande-message', 'Deux écrans, 60 places.\nSurtout la Ligue 1.\nEt la Ligue des champions le mardi.');
    await expect.poll(() => texte.evaluate((t) => t.value.includes('mardi'))).toBe(true);
    expect(await texte.evaluate((t) => t.scrollHeight - t.clientHeight)).toBeLessThanOrEqual(0);
  });
});

// Le formulaire n’a qu’un état à la fois : la page n’envoie que depuis un état qui le permet (au repos, hors ligne,
// après un 429), quel que soit le geste (le bouton, ou Entrée dans un champ quand le bouton est effacé) ; une seule
// zone décrit l’état ; une panne de la page elle-même finit à l’étape de l’e-mail, jamais sur un « Envoi… » sans fin.
// La page ne promet que ce qu’elle tient : le texte qui survit à un rechargement, seulement si l’onglet sait le garder ;
// une correction envoyée dans les 10 minutes, seulement si le serveur la garde.
test.describe('des états qui disent vrai', () => {
  // Le stockage de l’onglet refusé, comme quand le navigateur bloque les données des sites.
  const sansStockage = (page) => page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Bloqué', 'SecurityError'); } });
  });

  test('sans stockage dans l’onglet, la page périmée ne promet pas que le texte reste : l’e-mail mène, le rechargement reste possible', async ({ page }) => {
    await sansStockage(page);
    const { envois } = await ouvrir(page, [refus('FORMULAIRE_EXPIRE')]);
    await envoyerUneDemande(page);
    const statut = page.locator('#demande-statut');
    await attendreMessage(statut, TEXTES.expireeSansBrouillon);
    await expect(statut.getByRole('button', { name: 'Recharger la page' })).toBeVisible();
    await expect(page.locator('#demande-courriel')).toBeVisible();
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    expect((await lireCourriel(page)).body.split('\r\n')).toEqual(LIGNES_COMPLETES);
    await partiesEnTout(page, envois, 1);
  });

  test('sans stockage dans l’onglet, après « Ouvrir ma messagerie », la page ne promet pas que le texte reste jusqu’à la fermeture de l’onglet', async ({ page }) => {
    await sansStockage(page);
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await sansOuvrirLaMessagerie(page);
    await page.click('#demande-courriel-lien');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerieSansBrouillon);
  });

  // La règle des 10 minutes que la page annonce (TEXTES.correction), corrigée après « Envoie une nouvelle demande ».
  const corriger = async (page, valeurs) => {
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.click('#demande-nouvelle');
    for (const [nom, valeur] of Object.entries(valeurs)) await page.fill(CHAMPS[nom], valeur);
    await page.check('#demande-accord');
    await envoyer(page);
  };

  test('une correction dans les 10 minutes, pour la même demande (adresse et bar) : elle ne part pas d’ici, l’e-mail la porte, et la page dit pourquoi', async ({ page }) => {
    const { envois } = await ouvrir(page, [CREEE]);
    await envoyerUneDemande(page);
    // Comme pour les autres corrections : l’horloge n’avance qu’une fois la réussite affichée. Avancée avant la réponse
    // (une machine chargée), elle faisait passer le délai d’attente de l’envoi, et la première demande échouait.
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.clock.runFor(9 * 60 * 1000);
    await corriger(page, { phone: '+33 6 99 99 99 99', email: 'Camille@LeZinc.fr', barName: 'LE ZINC DES AMIS' });
    const statut = page.locator('#demande-statut');
    await attendreMessage(statut, TEXTES.correction);
    await expect(statut.locator('.message')).toHaveClass(/message--bloque/);
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
    expect((await lireCourriel(page)).body).toContain('Téléphone : +33 6 99 99 99 99');
    await page.clock.runFor(15_000);
    await partiesEnTout(page, envois, 1);
  });

  for (const [cas, attente, valeurs] of [
    ['après 10 minutes', 10 * 60 * 1000, { phone: '+33 6 99 99 99 99' }],
    ['avec une autre adresse', 0, { email: 'camille@lezinc-paris.fr' }],
    ['avec un autre bar', 0, { barName: 'Le Zinc de la Gare' }],
    ['sans rien changer (le serveur a déjà la première)', 0, {}],
  ]) {
    test(`une nouvelle demande ${cas} : elle part d’ici`, async ({ page }) => {
      const { envois } = await ouvrir(page, [CREEE]);
      await envoyerUneDemande(page);
      // L’heure de la demande partie est prise à la réponse : l’horloge n’avance qu’une fois la réussite affichée.
      await expect(page.locator('#demande-envoyee')).toBeVisible();
      await page.clock.runFor(attente);
      await corriger(page, valeurs);
      await expect(page.locator('#demande-envoyee')).toBeVisible();
      await partiesEnTout(page, envois, 2);
    });
  }

  // La page s’en souvient aussi après un rechargement : l’onglet garde l’adresse et le nom du bar de la dernière demande
  // partie (en minuscules) et son heure, rien d’autre, et seulement le temps de ces 10 minutes.
  const PARTIE = 'baromatch-demande-bar-partie';
  const corrigerApresRechargement = async (page, attente) => {
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.reload();
    await expect(page.locator('#demande')).toBeVisible();
    await page.clock.runFor(attente);
    await envoyerUneDemande(page, { ...SAISIE, phone: '+33 6 99 99 99 99' });
  };

  test('une correction après un rechargement, dans les 10 minutes, pour la même demande (adresse et bar) : l’e-mail la porte, et la page dit pourquoi', async ({ page }) => {
    const { envois } = await ouvrir(page, [CREEE]);
    await envoyerUneDemande(page);
    await corrigerApresRechargement(page, 8 * 60 * 1000);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.correction);
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    expect((await lireCourriel(page)).body).toContain('Téléphone : +33 6 99 99 99 99');
    await page.clock.runFor(15_000);
    // Le compte de la page repart de zéro au rechargement ; le serveur simulé, lui, compte tout.
    expect(await page.evaluate(() => window.demandesParties)).toBe(0);
    await expect.poll(() => envois.length).toBe(1);
  });

  test('une correction après un rechargement, 10 minutes passées : elle part d’ici', async ({ page }) => {
    const { envois } = await ouvrir(page, [CREEE]);
    await envoyerUneDemande(page);
    await corrigerApresRechargement(page, 10 * 60 * 1000);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect.poll(() => envois.length).toBe(2);
    expect(envois[1].postDataJSON().phone).toBe('+33 6 99 99 99 99');
  });

  test('après une demande partie, l’onglet ne garde que son adresse et son bar, en minuscules, et son heure ; plus rien 10 minutes après', async ({ page }) => {
    await ouvrir(page, [CREEE]);
    await envoyerUneDemande(page, { ...SAISIE, email: 'Camille@LeZinc.fr' });
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    const lireLOnglet = () => page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage)
      .map((cle) => [cle, JSON.parse(sessionStorage.getItem(cle))])));
    expect(await lireLOnglet()).toEqual({ [PARTIE]: { email: 'camille@lezinc.fr', bar: 'le zinc des amis', quand: DEBUT + 1000 + 3000 } });
    await page.clock.runFor(10 * 60 * 1000);
    await page.reload();
    await expect(page.locator('#demande')).toBeVisible();
    expect(await lireLOnglet()).toEqual({});
  });
});

test.describe('un seul état à la fois', () => {
  const entreeDansUnChamp = async (page) => {
    await page.focus('#demande-ville');
    await page.keyboard.press('Enter');
    await page.clock.runFor(15_000);
  };

  for (const [cas, reponses, zone, message] of [
    ['à l’étape de l’e-mail', [reponse(404, {})], '#demande-statut', TEXTES.courriel],
    ['après un REQUETE_INVALIDE', [refus('REQUETE_INVALIDE')], '#demande-alerte', TEXTES.invalide],
    ['quand le serveur dit la page périmée (FORMULAIRE_EXPIRE)', [refus('FORMULAIRE_EXPIRE')], '#demande-statut', TEXTES.expiree],
  ]) {
    test(`${cas}, Entrée dans un champ n’envoie rien de plus, et l’état reste`, async ({ page }) => {
      const { envois } = await ouvrir(page, reponses);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator(zone), message);
      await entreeDansUnChamp(page);
      await partiesEnTout(page, envois, 1);
      await attendreMessage(page.locator(zone), message);
      await expect(page.locator('#demande-envoyer')).toBeHidden();
    });
  }

  test('après un 429, « Envoyer ma demande » renvoie la demande, une fois', async ({ page }) => {
    const { envois } = await ouvrir(page, [reponse(429, {}), CREEE]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-alerte'), TEXTES.tropDEnvois);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.clock.runFor(15_000);
    await partiesEnTout(page, envois, 2);
  });

  test('envoyée avec Entrée depuis un champ, puis l’étape de l’e-mail : le focus reste dans le champ', async ({ page }) => {
    await ouvrir(page, [reponse(404, {})]);
    await remplir(page);
    await apresTroisSecondes(page);
    await page.focus('#demande-nom');
    await page.keyboard.press('Enter');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await expect(page.locator('#demande-nom')).toBeFocused();
  });

  for (const [cas, reponses, zone, message] of [
    ['un REQUETE_INVALIDE', [refus('REQUETE_INVALIDE')], '#demande-alerte', TEXTES.invalide],
    ['un 429', [reponse(429, {})], '#demande-alerte', TEXTES.tropDEnvois],
  ]) {
    test(`après ${cas}, « Ouvrir ma messagerie » : une seule zone décrit l’état, celle de statut`, async ({ page }) => {
      await ouvrir(page, reponses);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator(zone), message);
      await sansOuvrirLaMessagerie(page);
      await page.click('#demande-courriel-lien');
      await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerie);
      await expect(page.locator('#demande-alerte')).toBeEmpty();
    });
  }

  test('une panne dans ce qui lit la réponse : l’étape de l’e-mail, jamais un « Envoi… » sans fin', async ({ page }) => {
    // Un corps de 400 dont la lecture fait planter le script de la page.
    await page.addInitScript(() => {
      const lire = Response.prototype.json;
      Response.prototype.json = function () {
        if (this.status !== 400) return lire.call(this);
        return Promise.resolve({ get reason() { throw new Error('panne de lecture'); } });
      };
    });
    const { envois, erreurs } = await ouvrir(page, [refus('REQUETE_INVALIDE')]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await expect(page.locator('#demande-envoyer')).not.toHaveAttribute('aria-disabled');
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.bouton);
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
    await page.clock.runFor(15_000);
    await partiesEnTout(page, envois, 1);
    expect(erreurs.join(' ')).toContain('panne de lecture');
  });

  test('hors ligne, le focus dans le chemin e-mail : quand la demande repart au retour du réseau, il passe au bouton d’envoi, jamais à la page', async ({ page, context }) => {
    const { envois } = await ouvrir(page, [CREEE]);
    await context.setOffline(true);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
    await page.focus('#demande-courriel-copier');
    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)).toBe('demande-envoyer');
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await partiesEnTout(page, envois, 1);
  });

  test('le bouton d’envoi s’efface à l’étape de l’e-mail sans attendre pour-les-bars.css', async ({ page }) => {
    const imageArrivee = await ralentirLaPremiereImage(page);
    await page.route('**/pour-les-bars.css', () => {});
    await ouvrir(page, [reponse(404, {})], { feuille: false });
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
    await imageArrivee();
  });

  test('« Le réseau est lent » se compte depuis le départ de la demande, pas depuis le clic : une demande retenue 3 s ne le montre pas 1 s après son départ', async ({ page }) => {
    const { envois } = await ouvrir(page, ['silence']);
    await envoyerUneDemande(page, SAISIE, { attendre: false });
    // L’horloge est arrêtée : la demande part exactement 3 s après l’affichage du formulaire.
    await page.clock.runFor(3_000);
    await partiesEnTout(page, envois, 1);
    const statut = page.locator('#demande-statut');
    await page.clock.runFor(3_900);
    await expect(statut.locator('.message')).toHaveCount(0);
    await page.clock.runFor(200);
    await attendreMessage(statut, TEXTES.lent);
  });
});

// La typographie française de ce que le script écrit : une espace insécable avant « : », « ; », « ? », « ! » et « » »,
// et après « « » ; jamais une espace ordinaire. toHaveText confond les deux espaces : le texte est lu tel quel.
// Chaque cas mène le formulaire à des messages, puis lit tout son texte (zones, erreurs, résumé, libellés).
test.describe('les espaces insécables des messages du formulaire', () => {
  const lireLeFormulaire = (page) => page.evaluate(() => document.getElementById('demande').textContent
    + document.getElementById('demande-envoyee').textContent);
  const CAS = {
    'les erreurs de longueur, d’e-mail et de téléphone': async (page) => {
      await ouvrir(page);
      await envoyerUneDemande(page, SAISIE, { poses: { barName: 'B'.repeat(81), city: 'P'.repeat(61), contactName: 'C'.repeat(81),
        email: 'andré@lezinc.fr', phone: '12345', message: 'm'.repeat(1001) } });
      await expect(page.locator('#demande-resume li')).toHaveCount(6);
    },
    'les erreurs d’un e-mail et d’un numéro trop longs, et des émojis composés': async (page) => {
      await ouvrir(page);
      await envoyerUneDemande(page, SAISIE, { poses: { email: `${'a'.repeat(242)}@example.test`, phone: '0'.repeat(21),
        barName: 'Le Zinc 🏳️‍🌈', city: 'Londres 🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', contactName: 'Camille 👨‍👩‍👧', message: 'Prix ؀100' } });
      await expect(page.locator('#demande-resume li')).toHaveCount(6);
    },
    'l’étape de l’e-mail, puis la messagerie ouverte': async (page) => {
      await ouvrir(page, [reponse(404, {})]);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
      expect(await lireLeFormulaire(page)).toContain('Ta demande n’est pas encore partie.');
      await sansOuvrirLaMessagerie(page);
      await page.click('#demande-courriel-lien');
      await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerie);
    },
    'trop d’envois': async (page) => {
      await ouvrir(page, [reponse(429, {})]);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator('#demande-alerte'), TEXTES.tropDEnvois);
    },
    'une information refusée': async (page) => {
      await ouvrir(page, [refus('REQUETE_INVALIDE')]);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator('#demande-alerte'), TEXTES.invalide);
    },
    'la page périmée': async (page) => {
      await ouvrir(page, [refus('FORMULAIRE_EXPIRE')]);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.expiree);
    },
    'le réseau lent': async (page) => {
      await ouvrir(page, ['silence']);
      await envoyerUneDemande(page);
      await page.clock.runFor(4_100);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.lent);
    },
    'hors ligne': async (page, context) => {
      await ouvrir(page);
      await context.setOffline(true);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
    },
    'le réseau revenu': async (page, context) => {
      await ouvrir(page);
      await context.setOffline(true);
      await envoyerUneDemande(page);
      await page.fill('#demande-ville', '');
      await context.setOffline(false);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.reseauRevenu);
    },
    'la copie impossible': async (page) => {
      await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
      await ouvrir(page, [reponse(404, {})]);
      await envoyerUneDemande(page);
      await page.click('#demande-courriel-copier');
      await attendreMessage(page.locator('#demande-statut'), TEXTES.copieImpossible);
    },
    'la correction dans les 10 minutes': async (page) => {
      await ouvrir(page, [CREEE]);
      await envoyerUneDemande(page);
      await page.click('#demande-nouvelle');
      await page.fill('#demande-telephone', '+33 6 99 99 99 99');
      await page.check('#demande-accord');
      await envoyer(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.correction);
    },
    'sans stockage, la page périmée puis la messagerie ouverte': async (page) => {
      await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Bloqué', 'SecurityError'); } }));
      await ouvrir(page, [refus('FORMULAIRE_EXPIRE')]);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.expireeSansBrouillon);
      expect(await lireLeFormulaire(page)).not.toMatch(/ [:;?!»]|« /);
      await sansOuvrirLaMessagerie(page);
      await page.click('#demande-courriel-lien');
      await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerieSansBrouillon);
    },
  };
  for (const [nom, mener] of Object.entries(CAS)) {
    test(`${nom} : aucune espace ordinaire avant : ; ? ! » ni après «`, async ({ page, context }) => {
      await mener(page, context);
      const texte = await lireLeFormulaire(page);
      expect(texte.match(/.{0,24} [:;?!»]|« .{0,24}/g) ?? []).toEqual([]);
    });
  }
});

// Les commandes que le formulaire montre selon son état se touchent du doigt sur 44 px de haut au moins (le minimum
// du site) : les autres tests du site les mesurent avant qu’elles n’apparaissent.
test.describe('les commandes des états, à 360 px', () => {
  const hauteur = async (locator) => (await locator.boundingBox()).height;
  test('envoyer, ouvrir la messagerie, copier, modifier, recharger, envoyer une nouvelle demande : 44 px de haut au moins', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await ouvrir(page, [reponse(404, {}), CREEE]);
    expect(await hauteur(page.locator('#demande-envoyer'))).toBeGreaterThanOrEqual(44);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    for (const id of ['#demande-courriel-lien', '#demande-courriel-copier', '#demande-modifier']) {
      expect(await hauteur(page.locator(id)), id).toBeGreaterThanOrEqual(44);
    }
    await page.reload();
    await expect(page.locator('#demande')).toBeVisible();
    await page.clock.fastForward(JOUR + 1);
    await page.check('#demande-accord');
    await envoyer(page);
    const recharger = page.locator('#demande-statut').getByRole('button', { name: 'Recharger la page' });
    expect(await hauteur(recharger)).toBeGreaterThanOrEqual(44);
  });

  test('« Envoie une nouvelle demande », sous « C’est envoyé. » : 44 px de haut au moins', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await ouvrir(page);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(await hauteur(page.locator('#demande-nouvelle'))).toBeGreaterThanOrEqual(44);
  });
});

test.describe('accessibilité du formulaire (axe)', () => {
  for (const largeur of [360, 1280]) {
    test(`à ${largeur} px, avec les erreurs affichées`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page);
      await page.fill('#demande-email', 'camille@');
      await apresTroisSecondes(page);
      await envoyer(page);
      await expect(page.locator('#demande-resume')).toBeVisible();
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, à l’étape de l’e-mail`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page, [reponse(404, {})]);
      await envoyerUneDemande(page);
      await expect(page.locator('#demande-courriel')).toBeVisible();
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, après un 429`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page, [reponse(429, {})]);
      await envoyerUneDemande(page);
      await expect(page.locator('#demande-alerte .message')).toBeVisible();
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, après un REQUETE_INVALIDE (l’e-mail mène, le bouton d’envoi effacé)`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page, [refus('REQUETE_INVALIDE')]);
      await envoyerUneDemande(page);
      await expect(page.locator('#demande-alerte .message--bloque')).toBeVisible();
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, réseau lent`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page, ['silence']);
      await envoyerUneDemande(page);
      await page.clock.runFor(4_100);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.lent);
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, hors ligne avec l’e-mail en second choix, puis la messagerie ouverte`, async ({ page, context }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page);
      // Les transitions dix fois plus lentes, comme sur une machine chargée (1,5 s au lieu de 150 ms) : axe ne lit les
      // couleurs qu’une fois l’état posé (analyser), jamais un bouton à mi-chemin entre deux fonds.
      const cdp = await context.newCDPSession(page);
      await cdp.send('Animation.enable');
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
      await context.setOffline(true);
      await envoyerUneDemande(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
      expect(await analyser(page)).toEqual([]);
      await sansOuvrirLaMessagerie(page);
      await page.click('#demande-courriel-lien');
      await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerie);
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, une correction dans les 10 minutes à l’étape de l’e-mail, puis la copie impossible`, async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page, [CREEE]);
      await envoyerUneDemande(page);
      await page.click('#demande-nouvelle');
      await page.fill('#demande-telephone', '+33 6 99 99 99 99');
      await page.check('#demande-accord');
      await envoyer(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.correction);
      expect(await analyser(page)).toEqual([]);
      await page.click('#demande-courriel-copier');
      await attendreMessage(page.locator('#demande-statut'), TEXTES.copieImpossible);
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, sans stockage, page périmée (l’e-mail mène) et un émoji refusé sous un champ`, async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Bloqué', 'SecurityError'); } }));
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page, [refus('FORMULAIRE_EXPIRE')]);
      await envoyerUneDemande(page, SAISIE, { poses: { barName: 'Le Zinc 🏳️‍🌈' } });
      await expect(page.locator('#demande-bar-erreur')).toHaveText(TEXTES.signe.barName);
      expect(await analyser(page)).toEqual([]);
      await poser(page, CHAMPS.barName, SAISIE.barName);
      await envoyer(page);
      await attendreMessage(page.locator('#demande-statut'), TEXTES.expireeSansBrouillon);
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, page ouverte depuis plus d’un jour`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page);
      await remplir(page);
      await page.clock.fastForward(JOUR + 1);
      await envoyer(page);
      await expect(page.locator('#demande-statut .message--bloque')).toBeVisible();
      expect(await analyser(page)).toEqual([]);
    });

    test(`à ${largeur} px, « C’est envoyé. »`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await ouvrir(page);
      await envoyerUneDemande(page);
      await expect(page.locator('#demande-envoyee')).toBeVisible();
      expect(await analyser(page)).toEqual([]);
    });
  }
});
