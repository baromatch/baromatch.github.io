// Le formulaire de la page des bars en anglais (/en/for-bars/) : le même que celui de pour-les-bars.html (même script,
// pour-les-bars.js, mêmes champs, même serveur, mêmes limites), avec ses mots en anglais (le bloc JSON #textes-en de la
// page). Ce fichier reprend, en anglais, les tests de tests/pour-les-bars-formulaire.spec.mjs qui disent ce que la page
// écrit ou envoie : le contrat de la page, ce qui part, ce que la page vérifie, chaque réponse du serveur, l’e-mail tout
// prêt, le réseau, le brouillon, l’accessibilité. Ce qui ne dépend pas de la langue (le détail des espaces insécables
// français, la dérive de l’horloge, les caractères refusés) reste testé une fois, sur la page française, par le même
// script. Le serveur est simulé (page.route), jamais l’API de production ; l’horloge de la page est simulée et arrêtée.
import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { arreterLHorloge } from './outils/horloge.mjs';

const PAGE = '/en/for-bars/';
// Le piège à robots, un champ caché que seul un robot remplit.
const PIEGE = '#demande-piege';
const ADRESSE = 'https://api-production-8ce4.up.railway.app/api/public/bar-contact';
const BROUILLON = 'baromatch-demande-bar';
const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const DEBUT = new Date('2026-10-12T16:00:00Z').getTime();
const JOUR = 24 * 60 * 60 * 1000;

const SAISIE = {
  barName: 'Le Zinc des Amis',
  city: 'Paris 11e',
  contactName: 'Camille',
  email: 'camille@lezinc.fr',
};
const CHAMPS = {
  barName: '#demande-bar',
  city: '#demande-ville',
  contactName: '#demande-nom',
  email: '#demande-email',
};

// Les textes que le script écrit en anglais (le bloc #textes-en de la page, de la forme de TEXTES dans pour-les-bars.js).
// Un message : [titre, texte]. En anglais, les espaces sont ordinaires : le test des espaces insécables est celui de la
// page française (tests/pour-les-bars-formulaire.spec.mjs).
const TEXTES = {
  resume: (n) => (n === 1 ? '1 detail to fix' : `${n} details to fix`),
  envoi: 'Sending…',
  bouton: 'Send my request',
  copier: 'Copy the text',
  copie: 'Text copied',
  modifier: 'Edit my request',
  accord: 'Tick the box to send your request.',
  emailIncomplet: 'This e-mail address is not complete.',
  emailArobase: 'Your e-mail address is missing the @.',
  emailFin: 'Your e-mail address is missing its ending, for example .com or .fr.',
  emailCaractere: 'This e-mail address has a character that is not accepted: check accents, spaces and dots.',
  signe: {
    barName: 'The name of your bar has an emoji or a sign we can\'t accept: remove it.',
    city: 'Your area has an emoji or a sign we can\'t accept: remove it.',
    contactName: 'Your first name has an emoji or a sign we can\'t accept: remove it.',
  },
  brouillon: ['What you had written is here.', 'Finish, tick the box, then send your request.'],
  lent: ['The network is slow.', 'Your request is still on its way: keep this page open.'],
  courriel: ['Your request has not gone yet.', 'Press “Open my e-mail app” and send the prepared e-mail: everything you wrote is already in it. We reply by e-mail.'],
  messagerie: ['Did your e-mail app open?', 'Send the e-mail, and you\'re done. What you wrote stays here until you close the tab.'],
  horsLigne: ['No network.', 'Keep this page open: your request goes as soon as the network is back. You can also send it by e-mail, just below.'],
  reseauRevenu: ['The network is back.', 'Your request has not gone: check it, then press “Send my request”.'],
  expiree: ['This page has been open for more than a day.', 'Reload it to send your request: what you wrote stays.'],
  expireeSansBrouillon: ['This page has been open for more than a day.', 'Send your request by e-mail: everything you wrote is already in it. If you reload the page, what you wrote may be erased.'],
  messagerieSansBrouillon: ['Did your e-mail app open?', 'Send the e-mail, and you\'re done.'],
  copieImpossible: ['Copy the text yourself.', 'Your browser doesn\'t let us copy it: it is selected, ready to copy. Paste it into an e-mail to contact@baromatch.fr.'],
  correction: ['Your first request has already gone.', 'Send this correction by e-mail: less than 10 minutes after the first, with the same address and the same bar, our server keeps only the first.'],
  invalide: ['Some of your details are not accepted.', 'Send your request by e-mail: everything you wrote is already in it.'],
  tropDEnvois: ['Many requests from this connection.', 'We accept 5 per hour from the same network. Send your request by e-mail, or try again in an hour.'],
};
// La capsule ambre est le geste principal ; une capsule de verre, le second choix.
const AMBRE = 'rgb(255, 177, 61)';
const fond = (locator) => locator.evaluate((e) => getComputedStyle(e).backgroundColor);
const INDICES = {
  '#demande-ville': 'For example “Paris 11e”. Baromatch starts in Paris; elsewhere, write to us anyway.',
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
  // Le HTML lu, pas « load » : une feuille que le test retient peut retenir « load » (ralentirLaPolice).
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
  'Bar: Le Zinc des Amis',
  'First name: Camille',
  'E-mail: camille@lezinc.fr',
  'Area: Paris 11e',
];
// Le texte à copier commence par l’objet et une ligne vide (le lien mailto: porte l’objet à part).
const aCopier = (lignes, bar = 'Le Zinc des Amis') => [`Subject: Bar request — ${bar}`, '', ...lignes].join('\n');

test.describe('the contract of the page', () => {
  test('with JavaScript the form appears; each field has the server’s lengths; both message areas are there, empty; the labels are in English', async ({ page }) => {
    await ouvrir(page);
    const longueurs = await page.$$eval('#demande [maxlength]', (champs) => Object.fromEntries(champs.map((c) => [c.name, [c.minLength, c.maxLength]])));
    expect(longueurs).toEqual({
      barName: [2, 80], contactName: [2, 80], email: [-1, 254], city: [2, 60],
    });
    await expect(page.locator('#demande-statut')).toHaveAttribute('role', 'status');
    await expect(page.locator('#demande-alerte')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#demande-statut')).toBeEmpty();
    await expect(page.locator('#demande-alerte')).toBeEmpty();
    await expect(page.locator('#demande-resume')).toBeHidden();
    await expect(page.locator('#demande-courriel')).toBeHidden();
    await expect(page.locator('#demande-envoyee')).toBeHidden();
    await expect(page.locator('#demande-ville')).toHaveAccessibleDescription(INDICES['#demande-ville']);
    await expect(page.locator('#demande-courriel-lien')).toHaveText('Open my e-mail app');
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.bouton);
    expect(await page.$$eval('#demande .formulaire__grille label', (l) => l.map((e) => e.textContent.trim()))).toEqual(['Bar name', 'Your first name', 'Your e-mail', 'Area']);
    expect(await page.$$eval('#demande .formulaire__grille [name]', (c) => c.map((e) => e.name))).toEqual(['barName', 'contactName', 'email', 'city']);
  });

  test('the link under the box leads to the English privacy summary on the same page, which links to the French page', async ({ page }) => {
    await ouvrir(page);
    await expect(page.locator('#demande .formulaire__confidentialite a')).toHaveAttribute('href', '#privacy');
    await expect(page.locator('#demande .formulaire__confidentialite a')).toHaveText('Read the privacy summary');
    const liens = await page.locator('#privacy a[href^="/confidentialite.html"]').evaluateAll((a) => a.map((l) => l.getAttribute('href')));
    expect(liens).toContain('/confidentialite.html');
    expect(liens).toContain('/confidentialite.html#bars');
    await page.goto('/confidentialite.html#bars');
    await expect(page.locator('h2#bars')).toBeVisible();
  });
});

test.describe('what is sent', () => {
  test('exactly the server’s fields, trimmed, the box, the empty trap and a whole time; to the Baromatch server only, with no cookie and no other header', async ({ page, baseURL }) => {
    const { envois, adresses, erreurs } = await ouvrir(page);
    await envoyerUneDemande(page, Object.fromEntries(Object.entries(SAISIE).map(([nom, valeur]) => [nom, `  ${valeur}  `])));
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    expect(envois).toHaveLength(1);
    const requete = envois[0];
    expect(requete.method()).toBe('POST');
    const corps = requete.postDataJSON();
    expect(Object.keys(corps)).toEqual(['barName', 'contactName', 'email', 'city', 'consent', 'website', 'fillMs']);
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

  test('the box is touched with a finger: its label is 44 px high at least, the box 24 px wide, and touching the label ticks it', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await ouvrir(page);
    const cible = await page.locator('label[for="demande-accord"]').boundingBox();
    expect(cible.height).toBeGreaterThanOrEqual(44);
    const caseACocher = await page.locator('#demande-accord').boundingBox();
    expect(caseACocher.width).toBeGreaterThanOrEqual(24);
    await page.locator('label[for="demande-accord"] span').click();
    await expect(page.locator('#demande-accord')).toBeChecked();
  });

  test('never before 3 s after the form is shown: the request waits under “Sending…”, said in the status area too', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await envoyer(page);
    await expect(page.locator('#demande-envoyer')).toHaveText(TEXTES.envoi);
    await expect(page.locator('#demande-statut')).toHaveText(TEXTES.envoi);
    await page.clock.runFor(2000);
    await partiesEnTout(page, envois, 0);
    await attendreEnvois(page, envois, 1);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
  });

  test('while sending, the button keeps the focus, says it is unavailable, and a second click or Enter sends nothing more', async ({ page }) => {
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
    await page.clock.runFor(1000);
    await partiesEnTout(page, envois, 1);
  });

  test('the label of the button is in its own element: the small glass stays, and the label returns after sending', async ({ page }) => {
    await ouvrir(page);
    const bouton = page.locator('#demande-envoyer');
    await expect(bouton.locator('svg')).toHaveCount(1);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.click('#demande-nouvelle');
    await expect(bouton).toHaveText(TEXTES.bouton);
    await expect(bouton.locator('svg')).toHaveCount(1);
  });
});

test.describe('before sending, the form checks', () => {
  test('required fields: one error under each field, a summary that takes the focus and leads to the fields', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await apresTroisSecondes(page);
    await envoyer(page);
    const resume = page.locator('#demande-resume');
    await expect(resume).toBeVisible();
    await expect(resume).toBeFocused();
    await expect(page.locator('#demande-resume-titre')).toHaveText(TEXTES.resume(5));
    await expect(resume).toHaveAccessibleName(TEXTES.resume(5));
    const attendus = [
      ['#demande-bar', 'Enter the name of your bar.'],
      ['#demande-nom', 'Enter your first name.'],
      ['#demande-email', 'Enter your e-mail address.'],
      ['#demande-ville', 'Enter your area.'],
      ['#demande-accord', TEXTES.accord],
    ];
    await expect(resume.locator('li a')).toHaveText(attendus.map(([, texte]) => texte));
    expect(await resume.locator('li a').evaluateAll((liens) => liens.map((l) => l.getAttribute('href')))).toEqual(attendus.map(([id]) => id));
    for (const [id, texte] of attendus) {
      await expect(page.locator(id)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(`${id}-erreur`)).toBeVisible();
      await expect(page.locator(`${id}-erreur`)).toHaveText(texte);
      await expect(page.locator(id)).toHaveAccessibleDescription(INDICES[id] ? `${texte} ${INDICES[id]}` : texte);
    }
    expect(envois).toHaveLength(0);
    await resume.getByRole('link', { name: 'Enter your area.' }).click();
    await expect(page.locator('#demande-ville')).toBeFocused();
    await page.keyboard.type('Lyon');
    await expect(page.locator('#demande-ville')).not.toHaveAttribute('aria-invalid');
    await expect(page.locator('#demande-ville-erreur')).toBeHidden();
    await expect(resume.locator('li')).toHaveCount(4);
    await expect(page.locator('#demande-resume-titre')).toHaveText(TEXTES.resume(4));
  });

  test('the shape of the e-mail; the hint of the area stays with its error', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, { ...SAISIE, email: 'camille@lezinc' }, { poses: { city: 'P' } });
    await expect(page.locator('#demande-resume')).toBeFocused();
    await expect(page.locator('#demande-resume-titre')).toHaveText(TEXTES.resume(2));
    await expect(page.locator('#demande-email-erreur')).toHaveText(TEXTES.emailFin);
    await expect(page.locator('#demande-ville-erreur')).toHaveText('Use at least 2 characters for your area.');
    await expect(page.locator('#demande-ville')).toHaveAttribute('aria-describedby', 'demande-ville-erreur demande-ville-indice');
    await expect(page.locator('#demande-ville')).toHaveAccessibleDescription(`Use at least 2 characters for your area. ${INDICES['#demande-ville']}`);
    expect(envois).toHaveLength(0);
  });

  // The server’s limits, at their edge: the same text is refused with a message that says what to do, or accepted and
  // sent as it is (once the ends are trimmed). Same values as the French page.
  const BORDS = [
    ['barName', 'A', 'Use at least 2 characters for the name of your bar.'],
    ['barName', ' Ab ', null],
    ['barName', 'B'.repeat(81), 'Shorten the name of your bar: 80 characters at most.'],
    ['barName', 'B'.repeat(80), null],
    ['city', 'P', 'Use at least 2 characters for your area.'],
    ['city', 'Pa', null],
    ['city', 'P'.repeat(61), 'Shorten your area: 60 characters at most.'],
    ['city', 'P'.repeat(60), null],
    ['contactName', 'C', 'Use at least 2 characters for your first name.'],
    ['contactName', 'Al', null],
    ['contactName', 'C'.repeat(81), 'Shorten your first name: 80 characters at most.'],
    ['contactName', 'C'.repeat(80), null],
    ['email', `${'a'.repeat(242)}@example.test`, 'This e-mail address is too long: 254 characters at most.'],
    ['email', `${'a'.repeat(241)}@example.test`, null],
    ['email', 'contact@', TEXTES.emailIncomplet],
    ['email', '@lezinc.fr', TEXTES.emailIncomplet],
    ['email', 'karim.lezincdesamis.fr', TEXTES.emailArobase],
    ['email', 'karim@lezinc', TEXTES.emailFin],
    ['email', 'karim@lezinc.', TEXTES.emailFin],
    ['email', 'andré@lezinc.fr', TEXTES.emailCaractere],
    ['email', 'camille..martin@lezinc.fr', TEXTES.emailCaractere],
    ['email', 'camille martin@lezinc.fr', TEXTES.emailCaractere],
    ['email', 'Camille.Martin+bar@le-zinc.paris', null],
  ];
  for (const [nom, valeur, erreur] of BORDS) {
    const court = valeur.length > 24 ? `${valeur.slice(0, 12)}… (${valeur.length})` : valeur;
    test(`${nom} “${court}”: ${erreur ? 'refused' : 'accepted'}`, async ({ page }) => {
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

  test('an emoji sequence in a one-line field: refused with its English message under each field; nothing is sent', async ({ page }) => {
    const { envois } = await ouvrir(page);
    const famille = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    await envoyerUneDemande(page, SAISIE, { poses: { barName: `Zinc ${famille}`, city: `Paris ${famille}`, contactName: `Cam ${famille}` } });
    await expect(page.locator('#demande-bar-erreur')).toHaveText(TEXTES.signe.barName);
    await expect(page.locator('#demande-ville-erreur')).toHaveText(TEXTES.signe.city);
    await expect(page.locator('#demande-nom-erreur')).toHaveText(TEXTES.signe.contactName);
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);
  });

  test('the box: without it nothing is sent; as the only error, it takes the focus and stays on screen, with no summary above', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page, SAISIE, { accord: false });
    await expect(page.locator('#demande-accord')).toBeFocused();
    await expect(page.locator('#demande-resume')).toBeHidden();
    await expect(page.locator('#demande-accord')).toBeInViewport();
    await expect(page.locator('#demande-accord-erreur')).toBeInViewport();
    await expect(page.locator('#demande-accord-erreur')).toHaveText(TEXTES.accord);
    await expect(page.locator('#demande-accord')).toHaveAccessibleDescription(TEXTES.accord);
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);
  });

  test('the trap field filled: “It’s sent.” shows, nothing is sent, and the draft stays in the tab; one space only: a person, and the request goes', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await page.locator(PIEGE).evaluate((champ) => { champ.value = 'https://example.com'; });
    await apresTroisSecondes(page);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect(page.locator('#demande-envoyee')).toBeFocused();
    expect(await page.evaluate((cle) => JSON.parse(sessionStorage.getItem(cle)), BROUILLON)).toEqual(SAISIE);
    await page.clock.runFor(20_000);
    await partiesEnTout(page, envois, 0);
    await expect(page.locator('label[for="demande-piege"]')).toHaveText('Leave this field empty');
    await expect(page.locator(PIEGE)).toHaveAttribute('tabindex', '-1');
  });

  test('a page open for more than 24 h asks to be reloaded, nothing is sent, and what was written comes back', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await page.clock.fastForward(JOUR + 1);
    await envoyer(page);
    const statut = page.locator('#demande-statut');
    await attendreMessage(statut, TEXTES.expiree);
    const recharger = statut.getByRole('button', { name: 'Reload the page' });
    await expect(recharger).toBeFocused();
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 0);
    await Promise.all([page.waitForEvent('load'), recharger.click()]);
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
    await attendreMessage(page.locator('#demande-statut'), TEXTES.brouillon);
  });

  test('the draft comes back after a reload, without the box or the trap, and the page says so', async ({ page }) => {
    await ouvrir(page);
    await remplir(page);
    await page.locator(PIEGE).fill('trap');
    expect(await page.evaluate((cle) => JSON.parse(sessionStorage.getItem(cle)), BROUILLON)).toEqual(SAISIE);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page.reload();
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
    await expect(page.locator(PIEGE)).toHaveValue('');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.brouillon);
    await page.check('#demande-accord');
    await apresTroisSecondes(page);
    await envoyer(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect(page.locator('#demande-statut')).toBeEmpty();
  });
});

test.describe('the server’s answers', () => {
  test('201: “It’s sent.” takes the focus, with the typed address; the form is emptied and the draft erased; “Send a new request” brings it back', async ({ page }) => {
    const { erreurs } = await ouvrir(page);
    await envoyerUneDemande(page);
    const envoyee = page.locator('#demande-envoyee');
    await expect(envoyee).toBeVisible();
    await expect(envoyee).toBeFocused();
    await expect(envoyee.locator('.merci__titre')).toHaveText('It’s sent.');
    await expect(page.locator('#demande-envoyee-email')).toHaveText(SAISIE.email);
    await expect(page.locator('#demande')).toBeHidden();
    await expect(page.locator('.formulaire__ailleurs')).toBeHidden();
    expect(await page.evaluate((cle) => sessionStorage.getItem(cle), BROUILLON)).toBeNull();
    for (const id of Object.values(CHAMPS)) expect(await page.locator(id).inputValue()).toBe('');
    expect(erreurs).toEqual([]);
    await page.click('#demande-nouvelle');
    await expect(page.locator('#demande')).toBeVisible();
    await expect(envoyee).toBeHidden();
    await expect(page.locator('#demande-bar')).toBeFocused();
    for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
  });

  test('400 CONSENTEMENT_REQUIS: the message of the box, on the box, which takes the focus (no summary above)', async ({ page }) => {
    await ouvrir(page, [refus('CONSENTEMENT_REQUIS')]);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-accord')).toBeFocused();
    await expect(page.locator('#demande-resume')).toBeHidden();
    await expect(page.locator('#demande-accord-erreur')).toHaveText(TEXTES.accord);
    await expect(page.locator('#demande-accord')).not.toBeChecked();
    await expect(page.locator('#demande-bar')).toHaveValue(SAISIE.barName);
  });

  test('400 REQUETE_INVALIDE: the message, without repeating what is typed; e-mail becomes the main gesture and the send button goes away', async ({ page }) => {
    await ouvrir(page, [refus('REQUETE_INVALIDE')]);
    await envoyerUneDemande(page);
    const alerte = page.locator('#demande-alerte');
    await attendreMessage(alerte, TEXTES.invalide);
    await expect(alerte.locator('.message')).toHaveClass(/message--erreur/);
    await expect(alerte.locator('.message')).toHaveClass(/message--bloque/);
    for (const valeur of Object.values(SAISIE)) expect(await alerte.textContent()).not.toContain(valeur);
    await expect(page.locator('#demande-courriel')).toBeVisible();
    await expect(page.locator('#demande-courriel-lien')).toHaveAttribute('href', /^mailto:contact@baromatch\.fr\?/);
    expect(await fond(page.locator('#demande-courriel-lien'))).toBe(AMBRE);
    await expect(page.locator('#demande-envoyer')).toBeHidden();
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
  });

  test('400 FORMULAIRE_EXPIRE: the page asks to be reloaded', async ({ page }) => {
    await ouvrir(page, [refus('FORMULAIRE_EXPIRE')]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.expiree);
    await expect(page.locator('#demande-statut').getByRole('button', { name: 'Reload the page' })).toBeFocused();
  });

  test('429: the rule is said without blaming; e-mail is the main gesture and takes the focus, the send button stays second', async ({ page }) => {
    const { envois } = await ouvrir(page, [reponse(429, { statusCode: 429, message: 'Rate limit exceeded' })]);
    await envoyerUneDemande(page);
    const alerte = page.locator('#demande-alerte');
    await attendreMessage(alerte, TEXTES.tropDEnvois);
    await expect(alerte.locator('.message')).toHaveClass(/message--erreur/);
    await expect(alerte.locator('.message')).not.toHaveClass(/message--bloque/);
    await expect(page.locator('#demande-courriel')).toBeVisible();
    expect(await fond(page.locator('#demande-courriel-lien'))).toBe(AMBRE);
    await expect(page.locator('#demande-envoyer')).toBeVisible();
    expect(await fond(page.locator('#demande-envoyer'))).not.toBe(AMBRE);
    await expect(page.locator('#demande-courriel-lien')).toBeFocused();
    await page.clock.runFor(10_000);
    await partiesEnTout(page, envois, 1);
  });

  for (const [status, json] of [[404, {}], [405, {}], [501, {}], [403, { ok: false, statusCode: 403, reason: 'ORIGINE_REFUSEE', message: 'ORIGINE_REFUSEE' }]]) {
    test(`${status}${json.reason ? ` ${json.reason}` : ''}: the last step goes through e-mail, with no new try`, async ({ page, baseURL }) => {
      const { envois, adresses } = await ouvrir(page, [reponse(status, json)]);
      await envoyerUneDemande(page);
      const statut = page.locator('#demande-statut');
      await attendreMessage(statut, TEXTES.courriel);
      await expect(statut.locator('.message')).toHaveClass(/message--bloque/);
      await expect(page.locator('#demande-courriel')).toBeVisible();
      await expect(page.locator('#demande-envoyer')).toBeHidden();
      await expect(page.locator('#demande-courriel-lien')).toBeFocused();
      for (const [nom, valeur] of Object.entries(SAISIE)) await expect(page.locator(CHAMPS[nom])).toHaveValue(valeur);
      await page.clock.runFor(15_000);
      await partiesEnTout(page, envois, 1);
      expect(adresses.filter((a) => !a.startsWith(`${baseURL}/`) && a !== ADRESSE)).toEqual([]);
    });
  }

  test('a network failure while online: one new try 2 s later, then e-mail', async ({ page }) => {
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

  test('a server error (500) then 201 on the new try: “It’s sent.”', async ({ page }) => {
    const { envois } = await ouvrir(page, [reponse(500, {}), CREEE]);
    await envoyerUneDemande(page);
    await attendreEnvois(page, envois, 2);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
  });

  test('after 4 s of “Sending…” the status area says the network is slow and the request is on its way; the new try still goes, once', async ({ page }) => {
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
    await page.clock.runFor(6_000);
    await attendreEnvois(page, envois, 2);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect(statut).toBeEmpty();
    await page.clock.runFor(20_000);
    await partiesEnTout(page, envois, 2);
  });

  test('offline: nothing goes, a message says so, and the request goes once when the network returns', async ({ page, context }) => {
    const { envois } = await ouvrir(page);
    await remplir(page);
    await apresTroisSecondes(page);
    await context.setOffline(true);
    await envoyer(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.horsLigne);
    await partiesEnTout(page, envois, 0);
    await context.setOffline(false);
    await attendreEnvois(page, envois, 1);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await page.clock.runFor(20_000);
    await partiesEnTout(page, envois, 1);
  });
});

test.describe('the ready-made e-mail', () => {
  test('the subject, one line per field, nothing else; the same text to copy, subject first; & ? # % pass intact', async ({ page }) => {
    await ouvrir(page, [reponse(404, {})]);
    const bar = 'Le Zinc & Co ? #1 at 100 % $&';
    const quartier = 'Paris 11e & Bastille ? #1 : 10 %';
    await envoyerUneDemande(page, { ...SAISIE, barName: bar, city: quartier });
    const courriel = await lireCourriel(page);
    expect(courriel.destinataire).toBe('contact@baromatch.fr');
    expect(courriel.lien).not.toMatch(/[ +\n#]/);
    expect(Object.keys(courriel)).toEqual(['lien', 'destinataire', 'subject', 'body']);
    expect(courriel.subject).toBe(`Bar request — ${bar}`);
    const lignes = [`Bar: ${bar}`, ...LIGNES_COMPLETES.slice(1, 3), `Area: ${quartier}`];
    expect(courriel.body.split('\r\n')).toEqual(lignes);
    await expect(page.locator('#demande-courriel-texte')).toHaveValue(aCopier(lignes, bar));
    await expect(page.locator('#demande-courriel-texte')).toHaveAttribute('readonly', '');
    await expect(page.locator('label[for="demande-courriel-texte"]')).toHaveText('Your e-mail app does not open? Copy this text and send it to contact@baromatch.fr.');
  });

  test('“Copy the text” copies the request, says “Text copied” for 2 s, keeping its icon', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    const copier = page.locator('#demande-courriel-copier');
    await expect(copier).toHaveText(TEXTES.copier);
    await copier.click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText().then((texte) => texte.replace(/\r\n/g, '\n')))).toBe(aCopier(LIGNES_COMPLETES));
    await expect(copier).toHaveText(TEXTES.copie);
    await expect(copier.locator('svg')).toHaveCount(1);
    await page.clock.runFor(2100);
    await expect(copier).toHaveText(TEXTES.copier);
  });

  test('“Copy the text” without a clipboard: the page says so, and the text stays selected, ready to copy', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    await page.click('#demande-courriel-copier');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.copieImpossible);
    const texte = page.locator('#demande-courriel-texte');
    await expect(texte).toBeFocused();
    expect(await texte.evaluate((t) => [t.selectionStart, t.selectionEnd])).toEqual([0, aCopier(LIGNES_COMPLETES).length]);
  });

  test('“Edit my request” brings back the first field, and what is corrected goes into the e-mail', async ({ page }) => {
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.courriel);
    const modifier = page.locator('#demande-courriel').getByRole('button', { name: TEXTES.modifier });
    await expect(modifier).toBeVisible();
    await modifier.click();
    await expect(page.locator('#demande-bar')).toBeFocused();
    await page.fill('#demande-bar', 'Le Zinc');
    const courriel = await lireCourriel(page);
    expect(courriel.subject).toBe('Bar request — Le Zinc');
  });

  test('after “Open my e-mail app”, a calm line replaces the message; the draft stays in the tab', async ({ page }) => {
    await ouvrir(page, [reponse(404, {})]);
    await sansOuvrirLaMessagerie(page);
    await envoyerUneDemande(page);
    await page.click('#demande-courriel-lien');
    await attendreMessage(page.locator('#demande-statut'), TEXTES.messagerie);
    expect(await page.evaluate((cle) => JSON.parse(sessionStorage.getItem(cle)), BROUILLON)).toEqual(SAISIE);
    await expect(page.locator('#demande-envoyer')).toBeHidden();
  });

  test('a correction within 10 minutes of a sent request, same address and bar: it does not go from here, e-mail carries it, and the page says why', async ({ page }) => {
    const { envois } = await ouvrir(page);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await partiesEnTout(page, envois, 1);
    await page.click('#demande-nouvelle');
    await page.fill('#demande-ville', 'Paris 12e');
    await page.check('#demande-accord');
    await apresTroisSecondes(page);
    await envoyer(page);
    await attendreMessage(page.locator('#demande-statut'), TEXTES.correction);
    await expect(page.locator('#demande-courriel')).toBeVisible();
    await page.clock.runFor(5000);
    await partiesEnTout(page, envois, 1);
  });
});

test.describe('the commands, at 360 px and at 200 % text', () => {
  test('send, open the e-mail app, copy, edit, reload, send a new request: 44 px high at least', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await ouvrir(page, [reponse(404, {})]);
    const hauteur = async (selecteur) => (await page.locator(selecteur).boundingBox()).height;
    expect(await hauteur('#demande-envoyer')).toBeGreaterThanOrEqual(43.5);
    await envoyerUneDemande(page);
    for (const selecteur of ['#demande-courriel-lien', '#demande-courriel-copier', '#demande-modifier']) expect(await hauteur(selecteur), selecteur).toBeGreaterThanOrEqual(43.5);
  });

  test('at 200 % on 320 × 568: the summary has the focus and reads by its title; nothing leaves the width', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await ouvrir(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await apresTroisSecondes(page);
    await envoyer(page);
    await expect(page.locator('#demande-resume')).toBeFocused();
    await expect(page.locator('#demande-resume')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const debordent = await page.locator('#proposer *').evaluateAll((els) => els.filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map((el) => el.tagName + (el.id ? `#${el.id}` : '')));
    expect(debordent).toEqual([]);
  });

  test('sent at 200 %: “It’s sent.” reads at the top of the screen, the thank-you has the focus', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await ouvrir(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-envoyee')).toBeFocused();
    await expect(page.locator('#demande-envoyee .merci__titre')).toBeInViewport();
  });
});

test.describe('accessibility of the form (axe)', () => {
  const ETATS = {
    'at rest': async () => {},
    'with errors': async (page) => { await apresTroisSecondes(page); await envoyer(page); await expect(page.locator('#demande-resume')).toBeVisible(); },
  };
  for (const [nom, preparer] of Object.entries(ETATS)) {
    for (const largeur of [360, 1280]) {
      test(`${nom}, at ${largeur} px: no WCAG 2.2 AA violation`, async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: 800 });
        await ouvrir(page);
        await preparer(page);
        expect(await analyser(page)).toEqual([]);
      });
    }
  }

  test('sent, and at the e-mail step: no violation', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await ouvrir(page, [reponse(404, {})]);
    await envoyerUneDemande(page);
    await expect(page.locator('#demande-courriel')).toBeVisible();
    expect(await analyser(page)).toEqual([]);
  });
});
