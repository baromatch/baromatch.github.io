// La page « Deviens testeur Android » (testeurs-android.html) et ce qui y mène : qui peut s’inscrire (18 ans ou plus,
// un téléphone Android, un compte Google), ce que font les testeurs (le lien du test Google Play, au moins 14 jours
// d’affilée, leurs retours), que rien n’est payé, et rien d’inventé (ni nombre de testeurs, ni avis, ni date de test).
// Le formulaire part vers Formspree sans JavaScript, comme la liste d’attente des pages de ville : le même formulaire
// Formspree, le même champ piège, l’accord donné en s’inscrivant, à côté du lien vers Confidentialité ; rien d’autre ne
// part que le prénom ou le pseudo, l’adresse Gmail, la ville et la case des 18 ans. Confidentialité dit tout cela, avec
// Google pour la seule adresse Gmail. L’accueil, À propos et llms.txt disent où en est l’appli sans dater la phrase.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ENVOI_DE_LA_LISTE } from '../generateur/attente.mjs';
import { racine } from './outils/environnement.mjs';

const CHEMIN = '/testeurs-android.html';
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const lire = (fichier) => readFileSync(path.join(racine, fichier), 'utf8');
const texteDe = async (page, selecteur = 'main') => normaliser(await page.locator(selecteur).innerText());
const MOIS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';

test.use({ javaScriptEnabled: false });

test('qui peut s’inscrire, ce que font les testeurs, ce qu’ils y gagnent, et que rien n’est payé', async ({ page }) => {
  await page.goto(CHEMIN);
  await expect(page.locator('h1')).toHaveText('Deviens testeur Android');
  const qui = normaliser(await page.locator('#qui + ul').innerText());
  expect(qui).toContain('Tu as 18 ans ou plus.');
  expect(qui).toContain('Tu as un téléphone Android.');
  expect(qui).toContain('Tu as un compte Google,');
  const comment = normaliser(await page.locator('#comment + ol').innerText());
  expect(comment).toContain('On ajoute ton adresse Gmail, à la main, à la liste des testeurs de Baromatch sur Google Play, puis on t’écrit à cette adresse avec le lien du test.');
  expect(comment).toContain('tu installes Baromatch depuis Google Play');
  // La règle de Google : rester inscrit sans interruption ; ensuite seulement, Baromatch peut demander à ouvrir au public.
  expect(comment).toContain('pendant au moins 14 jours d’affilée : Google demande que les testeurs restent inscrits au test sans interruption pendant au moins 14 jours avant que Baromatch puisse demander à ouvrir l’appli au public sur Google Play.');
  expect(comment).toContain('Tu nous dis ce que tu en penses');
  await expect(page.locator('#ce-que-tu-y-gagnes + ul > li')).toHaveCount(2);
  // Le test existe d’abord parce que Google le demande : la page ne dit pas qu’il existe pour les retours.
  expect(normaliser(await page.locator('main').textContent())).not.toContain('c’est pour eux que le test existe');
  const savoir = normaliser(await page.locator('#a-savoir + ul').innerText());
  expect(savoir).toContain('Rien n’est payé : tu ne paies rien, et tu n’es pas payé non plus.');
  expect(savoir).toContain('Aucun cadeau ni aucune récompense ne sont promis');
  expect(await texteDe(page, '.document__chapeau')).toContain('Rien n’est payé.');
});

test('rien d’inventé : ni nombre de testeurs, ni avis, ni date du test, ni alcool, ni pari', async ({ page }) => {
  await page.goto(CHEMIN);
  const texte = normaliser(await page.locator('main').textContent());
  // Le seul nombre de la page qui compte des gens ou des jours : les 14 jours de Google, et l’âge.
  expect(texte).not.toMatch(/\d+\s*(?:testeurs?|inscrits?|personnes|fans)/i);
  expect([...new Set(texte.match(/\d+ (?:jours|mois|ans)/g))].sort()).toEqual(['14 jours', '18 ans', '3 mois']);
  expect(texte).not.toMatch(/avis|note de|étoiles|★/i);
  // Aucune date de début ou de fin du test : seule la date de mise à jour de la page.
  expect(texte.match(new RegExp(`\\d{1,2}(?:er)? (?:${MOIS}) \\d{4}`, 'g'))).toEqual(['22 octobre 2026']);
  expect(texte).not.toMatch(/bientôt|dès (?:le|la) |en (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i);
  expect(texte).not.toMatch(/alcool|bière|verre offert|\bcotes?\b|\bpari\b|\bparier\b|paris sportifs/i);
  expect(texte).not.toContain('!');
});

test('le formulaire : le Formspree de la liste d’attente, sans JavaScript, les champs exigés, le champ piège', async ({ page }) => {
  await page.goto(CHEMIN);
  const form = page.locator('form#inscription-testeur');
  await expect(form).toHaveAttribute('action', ENVOI_DE_LA_LISTE);
  await expect(form).toHaveAttribute('method', 'POST');
  // Ce que la page envoie, dans l’ordre : rien d’autre (la page n’a aucun script qui ajouterait un champ).
  const champs = await form.locator('input, select, textarea').evaluateAll((l) => l.map((c) => [c.name, c.type, c.required]));
  expect(champs).toEqual([
    ['prenom', 'text', true],
    ['email', 'email', true],
    ['ville', 'text', true],
    ['majeur', 'checkbox', true],
    ['_gotcha', 'text', false],
    ['_subject', 'hidden', false],
    ['type', 'hidden', false],
  ]);
  expect(await page.locator('script:not([type="application/ld+json"])').count()).toBe(0);
  // Le piège : hors de l’écran, hors du clavier, tu pour les lecteurs d’écran, comme celui de la liste d’attente.
  const piege = page.locator('.attente__piege');
  await expect(piege).toHaveAttribute('aria-hidden', 'true');
  await expect(piege.locator('input')).toHaveAttribute('tabindex', '-1');
  await expect(piege.locator('input')).toHaveAttribute('autocomplete', 'off');
  // Chaque champ a son étiquette.
  for (const nom of ['Ton prénom ou ton pseudo', 'L’adresse Gmail de ton compte Google Play', 'Ta ville', 'J’ai 18 ans ou plus.']) {
    await expect(page.getByLabel(nom, { exact: true })).toHaveCount(1);
  }
  // L’accord, juste au-dessus du bouton : ce qu’on garde, à qui l’adresse est donnée, et le lien vers Confidentialité.
  const accord = page.locator('#testeur-usage');
  expect(normaliser(await accord.innerText())).toContain('En t’inscrivant, tu acceptes que Baromatch garde ton prénom ou ton pseudo, ton adresse Gmail et ta ville pour le test, et donne ton adresse Gmail à Google pour t’ajouter aux testeurs sur Google Play.');
  await expect(accord.locator('a')).toHaveAttribute('href', '/confidentialite.html#testeurs-android');
  await expect(page.locator('button[type="submit"]')).toHaveAttribute('aria-describedby', 'testeur-usage');
});

test('sans JavaScript, l’inscription envoie à Formspree le prénom, l’adresse, la ville et la case, rien d’autre, sans violation', async ({ page }) => {
  const refus = [];
  page.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) refus.push(message.text()); });
  const corps = [];
  await page.route(/formspree\.io/, (route) => {
    corps.push([route.request().method(), route.request().url(), route.request().postData()]);
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' });
  });
  await page.goto(CHEMIN);
  const envoyer = page.locator('#inscription-testeur button[type="submit"]');
  // Un champ vide, une adresse sans @ ou la case non cochée : le navigateur arrête l’envoi.
  await envoyer.click();
  expect(await page.locator('#testeur-prenom').evaluate((c) => c.validity.valueMissing)).toBe(true);
  await page.locator('#testeur-prenom').fill('Nico_B');
  await page.locator('#testeur-mail').fill('nico.gmail.com');
  await page.locator('#testeur-ville').fill('Paris');
  await envoyer.click();
  expect(await page.locator('#testeur-mail').evaluate((c) => c.validity.typeMismatch)).toBe(true);
  await page.locator('#testeur-mail').fill('nico@gmail.com');
  await envoyer.click();
  expect(await page.locator('#testeur-majeur').evaluate((c) => c.validity.valueMissing)).toBe(true);
  expect(corps).toEqual([]);

  await page.getByLabel('J’ai 18 ans ou plus.').check();
  await envoyer.click();
  await page.waitForURL(/formspree\.io/, { waitUntil: 'commit' });
  expect(corps.map(([methode, adresse]) => [methode, adresse])).toEqual([['POST', ENVOI_DE_LA_LISTE]]);
  const envoi = new URLSearchParams(corps[0][2]);
  expect([...envoi.keys()].sort()).toEqual(['_gotcha', '_subject', 'email', 'majeur', 'prenom', 'type', 'ville']);
  expect(Object.fromEntries(envoi)).toEqual({
    prenom: 'Nico_B', email: 'nico@gmail.com', ville: 'Paris', majeur: 'oui', _gotcha: '',
    _subject: 'Nouvelle inscription au test Android de Baromatch', type: 'testeur-android',
  });
  expect(refus).toEqual([]);
});

test('Confidentialité : ce qu’on garde des testeurs, pourquoi, sur quelle base, qui le voit, combien de temps, comment partir', async ({ page }) => {
  await page.goto('/confidentialite.html');
  await expect(page.locator('#testeurs-android')).toHaveText('Les testeurs Android');
  const section = page.locator('#testeurs-android + ul');
  const texte = normaliser(await section.innerText());
  expect(texte).toContain('Ce qu’on collecte : ton prénom ou ton pseudo, l’adresse Gmail de ton compte Google Play, ta ville, et la case qui dit que tu as 18 ans ou plus');
  expect(texte).toContain('Rien d’autre : ni nom de famille, ni téléphone, ni adresse postale.');
  expect(texte).toContain('Pourquoi : t’ajouter au test fermé de l’appli sur Google Play, t’envoyer le lien du test');
  expect(texte).toContain('Sur quelle base : ton consentement, donné en t’inscrivant. Tu peux le retirer à tout moment, en nous écrivant.');
  expect(texte).toContain('Combien de temps : jusqu’à la fin du test fermé (l’ouverture de l’appli au public sur Google Play, ou l’arrêt du test), puis 3 mois au plus.');
  expect(texte).toContain('Les retours que tu nous envoies par mail pendant le test sont gardés aussi longtemps que ton inscription, puis effacés.');
  expect(texte).toContain('retire ton adresse de la liste des testeurs sur Google Play');
  expect(texte).toContain('L’inscription passe par Formspree, Inc., un prestataire situé aux États-Unis, comme la liste d’attente');
  expect(texte).toContain('Formspree voit aussi ton adresse IP et ton navigateur.');
  expect(texte).toContain('on écrit ton adresse Gmail dans la liste des testeurs de Baromatch sur Google Play ; ton prénom ou ton pseudo et ta ville restent chez nous.');
  expect(texte).toContain('Tes données ne sont ni vendues ni louées.');
  expect(texte).toContain('On le fait à la main, sous un mois.');
  await expect(section.locator('a[href="mailto:contact@baromatch.fr"]')).toHaveCount(1);
  await expect(section.locator('a[href="/testeurs-android.html"]')).toHaveCount(1);
  // Ce que dit le formulaire est ce que garde la page : les mêmes champs.
  await expect(page.locator('#prestataires + ul')).toContainText('Formspree reçoit les inscriptions du site (liste d’attente, test Android, boutique)');
  await expect(page.locator('#prestataires + ul')).toContainText('Google reçoit l’adresse Gmail des testeurs Android, pour les ajouter au test fermé de l’appli sur Google Play');
  expect(await texteDe(page)).toContain('Retirer ton accord à tout moment, quand un usage repose sur lui (le match de ton club, les messages de Baromatch, la liste d’attente, le test Android, la boutique).');
});

test('la page dit la même durée que Confidentialité, et y mène', async ({ page }) => {
  await page.goto(CHEMIN);
  expect(normaliser(await page.locator('#tes-donnees + p').innerText())).toContain('On les garde jusqu’à la fin du test fermé (l’ouverture de l’appli au public sur Google Play, ou l’arrêt du test), puis 3 mois au plus.');
  await expect(page.locator('#tes-donnees + p a')).toHaveAttribute('href', '/confidentialite.html#testeurs-android');
});

test('plus aucun lien vers la page : ni l’accueil, ni À propos, ni le plan du site, ni llms.txt', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section.testeurs-accueil')).toHaveCount(0);
  await expect(page.locator('a[href="/testeurs-android.html"]')).toHaveCount(0);
  await page.goto('/a-propos.html');
  await expect(page.locator('a[href="/testeurs-android.html"]')).toHaveCount(0);
  expect(normaliser(await page.locator('#aujourd-hui + p').innerText())).toBe('L’appli commence à Paris, avec ses premiers bars.');
  const datee = new RegExp(`\\b[Ee]n (?:${MOIS}) \\d{4}, l’appli`);
  for (const fichier of ['index.html', 'a-propos.html', 'llms.txt']) {
    const texte = lire(fichier);
    expect(texte, fichier).not.toMatch(datee);
    expect(texte, fichier).not.toMatch(/en test sur Android|pas encore ouverte?|testeurs? Android|pas d’appli iPhone/i);
  }
  expect(lire('sitemap.xml')).not.toContain('testeurs-android.html');
  expect(lire('llms.txt')).not.toContain('testeurs-android.html');
});
