// La liste d’attente de l’accueil : une adresse sans fin de domaine (« paul@gmail ») est refusée avec un message clair,
// sans rien envoyer ; après l’inscription, l’adresse est rappelée pour qu’une faute se voie, et on peut la corriger (la
// correction dit à Baromatch quelle adresse elle remplace). Chaque échec d’envoi laisse une issue : contact@baromatch.fr.
// Seul un refus de l’adresse elle-même par le service d’envoi (422 qui la nomme) dit de la vérifier ; un service muet
// au-delà de 10 s, une coupure ou un autre refus sont une panne. Les messages ont l’apostrophe typographique.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { champDe, FORMSPREE, simulerFormspree } from './outils/formspree.mjs';
import { arreterLHorloge } from './outils/horloge.mjs';

// toHaveText ramène chaque blanc, espace insécable compris, à une espace simple.
const PANNE = 'L’inscription n’est pas passée. Réessaie dans un instant, ou écris à contact@baromatch.fr.';
const REFUSEE = 'Cette adresse ne semble pas valide. Vérifie-la : elle doit ressembler à prenom@exemple.fr. Si elle est juste, écris à contact@baromatch.fr.';
const INSCRITE = (adresse) => `C’est noté : on t’écrit à ${adresse} au lancement et pour les premiers tests.`;

const retour = (page) => page.locator('#attente-retour');
const champ = (page) => page.locator('#attente-mail');
const bouton = (page) => page.locator('#attente button[type="submit"]');
const corriger = (page) => page.locator('#attente-corriger');

const sInscrire = async (page, adresse = 'paul@exemple.fr') => {
  await champ(page).fill(adresse);
  await bouton(page).click();
};

test('« paul@gmail » est refusé sans envoi, avec ce qui manque', async ({ page }) => {
  const envois = await simulerFormspree(page);
  await page.goto('/');
  await sInscrire(page, 'paul@gmail');
  await expect(retour(page)).toHaveText('Il manque la fin de ton adresse, par exemple .fr ou .com.');
  await expect(retour(page)).toHaveClass(/attente__retour--erreur/);
  await expect(champ(page)).toBeFocused();
  await expect(champ(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(champ(page)).toHaveAttribute('aria-describedby', 'attente-retour');
  expect(envois).toEqual([]);

  await sInscrire(page, 'bonjour');
  await expect(retour(page)).toHaveText('Vérifie ton adresse mail : elle doit ressembler à prenom@exemple.fr.');
  expect(envois).toEqual([]);
});

test('après l’inscription, l’adresse est rappelée et on peut la corriger', async ({ page }) => {
  const envois = await simulerFormspree(page);
  await page.goto('/');
  await sInscrire(page, 'paul.martin@gmail.co');
  await expect(retour(page)).toHaveClass(/attente__retour--ok/);
  await expect(retour(page)).toHaveText(INSCRITE('paul.martin@gmail.co'));
  await expect(champ(page)).toHaveValue('paul.martin@gmail.co');
  await expect(champ(page)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(bouton(page)).toHaveText('C’est noté');
  await expect(bouton(page)).toBeDisabled();
  await expect(corriger(page)).toBeVisible();
  await expect(corriger(page)).toHaveText('Corriger l’adresse');
  expect(envois).toHaveLength(1);
  expect(champDe(envois[0], 'email')).toBe('paul.martin@gmail.co');
  expect(champDe(envois[0], 'remplace')).toBeNull();

  await corriger(page).click();
  await expect(champ(page)).toBeFocused();
  await expect(bouton(page)).toBeEnabled();
  await expect(bouton(page)).toHaveText('Me prévenir');
  await expect(corriger(page)).toBeHidden();
  await sInscrire(page, 'paul.martin@gmail.com');
  await expect(retour(page)).toHaveText(INSCRITE('paul.martin@gmail.com'));
  expect(envois).toHaveLength(2);
  expect(champDe(envois[1], 'email')).toBe('paul.martin@gmail.com');
  expect(champDe(envois[1], 'remplace')).toBe('paul.martin@gmail.co');
});

test('taper dans le champ après l’inscription rouvre l’envoi', async ({ page }) => {
  await simulerFormspree(page);
  // Un service d’envoi lent, comme sur une machine chargée : la réponse arrive 0,5 s après la demande.
  await page.route(FORMSPREE, async (route) => {
    await new Promise((resoudre) => { setTimeout(resoudre, 500); });
    await route.fallback();
  });
  await page.goto('/');
  await sInscrire(page, 'paul@gmail.com');
  // L’inscription faite, pas seulement partie : pendant « Envoi… », le bouton est déjà inactif, et ce qu’on tape alors
  // ne rouvre rien.
  await expect(retour(page)).toHaveText(INSCRITE('paul@gmail.com'));
  await expect(bouton(page)).toHaveText('C’est noté');
  await expect(bouton(page)).toBeDisabled();
  await champ(page).press('End');
  await champ(page).pressSequentially('x');
  await expect(bouton(page)).toBeEnabled();
  await expect(bouton(page)).toHaveText('Me prévenir');
});

test('une adresse refusée par le service d’envoi (422 sur l’adresse) : le message dit de la vérifier, et à qui écrire', async ({ page }) => {
  await simulerFormspree(page, 422);
  await page.goto('/');
  await sInscrire(page);
  await expect(retour(page)).toHaveClass(/attente__retour--erreur/);
  await expect(retour(page)).toHaveText(REFUSEE);
  await expect(champ(page)).toBeFocused();
  await expect(champ(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(bouton(page)).toBeEnabled();
  await expect(bouton(page)).toHaveText('Me prévenir');
});

for (const cas of [
  { nom: 'un 422 sur autre chose que l’adresse', reponse: { statut: 422, corps: { errors: [{ code: 'REQUIRED_FIELD_MISSING', field: 'message' }] } } },
  { nom: 'un 422 sans corps lisible', reponse: { statut: 422, corps: '<html>erreur</html>' } },
  { nom: 'une panne du service (500)', reponse: 500 },
  { nom: 'une coupure du réseau', reponse: 'coupure' },
]) {
  test(`${cas.nom} : une panne, avec l’adresse de secours, sans accuser l’adresse`, async ({ page }) => {
    await simulerFormspree(page, cas.reponse);
    await page.goto('/');
    await sInscrire(page);
    await expect(retour(page)).toHaveText(PANNE);
    await expect(retour(page)).toHaveClass(/attente__retour--erreur/);
    await expect(champ(page)).not.toHaveAttribute('aria-invalid', 'true');
    await expect(bouton(page)).toBeEnabled();
    await expect(bouton(page)).toHaveText('Me prévenir');
  });
}

test('un service qui ne répond pas : au bout de 10 s, une panne avec l’adresse de secours, et l’envoi se rouvre', async ({ page }) => {
  // L’horloge de la page est simulée et arrêtée : seul runFor la fait avancer.
  const debut = new Date('2026-10-13T17:30:00+02:00').getTime();
  await arreterLHorloge(page, debut + 1000);
  const envois = await simulerFormspree(page, 'silence');
  await page.goto('/');
  await sInscrire(page);
  await expect(bouton(page)).toHaveText('Envoi…');
  await page.clock.runFor(9_000);
  await expect(bouton(page)).toHaveText('Envoi…');
  await page.clock.runFor(1_000);
  await expect(retour(page)).toHaveText(PANNE);
  await expect(bouton(page)).toBeEnabled();
  await expect(bouton(page)).toHaveText('Me prévenir');
  expect(envois).toHaveLength(1);
  // Réessayer est possible tout de suite.
  await bouton(page).click();
  await expect.poll(() => envois.length).toBe(2);
});

// WCAG 2.4.3 et 4.1.3 : pendant l’envoi, le bouton garde le focus (aria-disabled, jamais disabled, comme sur « Pour les
// bars ») et ignore un second appui ; « Envoi… » est dit dans la zone de statut. Après l’issue, quelle qu’elle soit, le
// focus n’est jamais sur la page elle-même.
const focusSurLaPage = (page) => page.evaluate(() => !document.activeElement || document.activeElement === document.body);

test('pendant l’envoi, le bouton garde le focus et ignore un second appui ; « Envoi… » est dit, puis la panne au bout de 10 s', async ({ page }) => {
  const debut = new Date('2026-10-13T17:30:00+02:00').getTime();
  await arreterLHorloge(page, debut + 1000);
  const envois = await simulerFormspree(page, 'silence');
  await page.goto('/');
  await champ(page).fill('paul@exemple.fr');
  await bouton(page).focus();
  await page.keyboard.press('Enter');
  await expect(bouton(page)).toHaveText('Envoi…');
  await expect(bouton(page)).toBeFocused();
  await expect(bouton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(bouton(page)).not.toHaveAttribute('disabled', /.*/);
  await expect(retour(page)).toHaveText('Envoi…');
  await expect(retour(page)).toHaveAttribute('role', 'status');
  // Un second appui, et Entrée dans le champ, n’envoient rien de plus.
  await page.keyboard.press('Enter');
  await champ(page).press('Enter');
  await bouton(page).focus();
  expect(envois).toHaveLength(1);
  await page.clock.runFor(10_000);
  await expect(retour(page)).toHaveText(PANNE);
  await expect(bouton(page)).toBeFocused();
  await expect(bouton(page)).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(bouton(page)).toHaveText('Me prévenir');
  expect(envois).toHaveLength(1);
});

for (const cas of [
  { nom: 'une coupure du réseau', reponse: 'coupure', texte: PANNE },
  { nom: 'une panne du service (500)', reponse: 500, texte: PANNE },
  { nom: 'une inscription réussie', reponse: 200, texte: INSCRITE('paul@exemple.fr') },
]) {
  test(`après ${cas.nom}, le focus reste sur le bouton, jamais sur la page`, async ({ page }) => {
    await simulerFormspree(page, cas.reponse);
    await page.goto('/');
    await champ(page).fill('paul@exemple.fr');
    await bouton(page).focus();
    await page.keyboard.press('Enter');
    await expect(retour(page)).toHaveText(cas.texte);
    expect(await focusSurLaPage(page)).toBe(false);
    await expect(bouton(page)).toBeFocused();
  });
}

test('une erreur d’affichage après une inscription réussie ne la fait pas passer pour un échec', async ({ page }) => {
  await simulerFormspree(page);
  await page.goto('/');
  // Le bouton « Corriger l’adresse » refuse de s’afficher : l’inscription est pourtant partie.
  await page.evaluate(() => {
    const corrigerLAdresse = document.getElementById('attente-corriger');
    const { get, set } = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
    Object.defineProperty(corrigerLAdresse, 'hidden', {
      configurable: true,
      get() { return get.call(this); },
      set(valeur) { if (!valeur) throw new Error('affichage en panne'); set.call(this, valeur); },
    });
  });
  await sInscrire(page);
  await expect(retour(page)).toHaveText(INSCRITE('paul@exemple.fr'));
  await expect(retour(page)).not.toHaveText(PANNE);
});

test('les messages des scripts du site ont l’apostrophe typographique', () => {
  for (const fichier of ['main.js', 'boutique.js', 'tablee.js']) {
    const source = readFileSync(path.join(racine, fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const chaines = [...source.matchAll(/"([^"\n]*)"/g)].map((m) => m[1]);
    expect(chaines.filter((c) => /\p{L}'\p{L}/u.test(c)), fichier).toEqual([]);
  }
});
