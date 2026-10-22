// La page Confidentialité et la page « Supprimer ton compte » disent ce qui est vrai aujourd’hui : une seule adresse
// pour les demandes sur les données, aucun service qui ne reçoit rien décrit comme destinataire, aucune garantie ni
// durée automatique annoncée comme déjà en place, et rien qui ressemble à une case à remplir.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';

const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const texteDe = async (page, chemin) => {
  await page.goto(chemin);
  return normaliser(await page.locator('main').innerText());
};

// Les fichiers servis aux visiteurs (les tests, qui vérifient justement son absence, ne sont pas lus).
test('une seule adresse pour les données : contact@baromatch.fr, nulle part l’ancienne adresse dédiée', async () => {
  const fichiers = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: racine, encoding: 'utf8' })
    .split('\0')
    .filter((f) => /\.(?:html|js|mjs|json|txt|xml)$/.test(f) && !f.startsWith('tests/') && existsSync(path.join(racine, f)));
  const avecLAncienne = fichiers.filter((f) => readFileSync(path.join(racine, f), 'utf8').includes('confidentialite' + '@'));
  expect(avecLAncienne).toEqual([]);
});

test('la page Confidentialité : contact@ partout, aucune case à remplir', async ({ page }) => {
  const texte = await texteDe(page, '/confidentialite.html');
  const mails = await page.locator('main a[href^="mailto:"]').evaluateAll((a) => [...new Set(a.map((l) => l.getAttribute('href').split('?')[0]))]);
  expect(mails).toEqual(['mailto:contact@baromatch.fr']);
  expect(texte).not.toMatch(/\[|\]|à compléter|à préciser|TODO|⚠/i);
});

test('la page Confidentialité ne décrit comme destinataire ni Sentry, ni Mapbox, ni Firebase, ni Anthropic', async ({ page }) => {
  const texte = await texteDe(page, '/confidentialite.html');
  expect(texte).not.toMatch(/Sentry|Mapbox|Firebase|Anthropic/);
  // Google ne reçoit qu’une chose : l’adresse Gmail des testeurs Android (sa section, et sa ligne dans les prestataires).
  const horsDuTest = await page.locator('main').evaluate((main) => {
    const copie = main.cloneNode(true);
    copie.querySelector('#testeurs-android + ul').remove();
    for (const li of copie.querySelectorAll('#prestataires + ul > li')) if (li.textContent.startsWith('Google ')) li.remove();
    return copie.textContent;
  });
  expect(horsDuTest).not.toMatch(/Google/);
  // Les rapports d’erreurs : rien ne part aujourd’hui, et la page le décrira d’abord.
  await expect(page.locator('#plantages + p')).toHaveText(/aucun service de suivi des erreurs ne reçoit de rapport de l’appli ni de notre serveur/);
  // Les notifications : seuls les rappels programmés par le téléphone.
  await expect(page.locator('#notifications + ul')).toContainText('Notre serveur n’envoie aucune notification sur ton téléphone pour l’instant');
  // Les photos : fermées, et la page sera mise à jour avant.
  expect(texte).toContain('Les photos de profil ne sont pas ouvertes pour l’instant.');
  expect(texte).toContain('Avant de les ouvrir, on mettra cette page à jour');
});

test('la page Confidentialité : l’hébergement aux Pays-Bas, et aucune garantie de transfert annoncée comme établie', async ({ page }) => {
  const texte = await texteDe(page, '/confidentialite.html');
  await expect(page.locator('#prestataires + ul')).toContainText('en Europe (Pays-Bas)');
  expect(texte).not.toMatch(/clauses contractuelles types|Data Privacy Framework|mécanisme équivalent|pour notre compte/);
  expect(texte).toContain('Pour toute question sur ces transferts, écris-nous');
});

test('la page Confidentialité : les durées que l’effacement automatique appliquera disent ce qui se passe aujourd’hui', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const duree = normaliser(await page.locator('#combien-de-temps ~ ul').first().innerText());
  expect(duree).toContain('Tes sessions de connexion : aujourd’hui, tant que ton compte existe. Prévu : effacées 30 jours après leur fin.');
  expect(duree).toContain('Les matchs que tu veux voir : aujourd’hui, tant que ton compte existe. Prévu : effacés 30 jours après le match.');
  expect(duree).toContain('aujourd’hui, tant que ton compte existe. Prévu : effacés au bout de 6 mois.');
  const texte = await texteDe(page, '/confidentialite.html');
  expect(texte).not.toMatch(/effacée? automatiquement|Les journaux techniques : 30 jours|rien n’est gardé|anonymisé/);
  // La recherche d’adresse : les adresses trouvées sont gardées 5 minutes.
  expect(texte).toContain('Notre serveur garde les adresses trouvées 5 minutes');
});

test('la page « Supprimer ton compte » : contact@, ce qui part tout de suite, et ce qui reste pseudonymisé', async ({ page }) => {
  const texte = await texteDe(page, '/supprimer-mon-compte.html');
  const mails = await page.locator('main a[href^="mailto:"]').evaluateAll((a) => a.map((l) => l.getAttribute('href').split('?')[0]));
  expect([...new Set(mails)]).toEqual(['mailto:contact@baromatch.fr']);
  expect(texte).toContain('L’adresse IP et le type d’appareil de tes traces de sécurité.');
  expect(texte).toContain('ta place en liste d’attente, tes notifications, et ta photo si tu en avais une');
  expect(texte).toContain('ta langue');
  expect(texte).toContain('Ces données sont pseudonymisées');
  expect(texte).not.toMatch(/Personne ne peut plus les relier à toi|au bout de 6 mois|sans ton historique/);
  expect(texte).toContain('sans adresse IP ni appareil, avec une empreinte de ton adresse mail');
  await expect(page.locator('.document__date')).toHaveText('Mise à jour le 20 octobre 2026');
});
