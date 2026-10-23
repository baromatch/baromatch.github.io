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

test('la page Confidentialité ne décrit comme destinataire ni Mapbox, ni Firebase, ni Anthropic', async ({ page }) => {
  const texte = await texteDe(page, '/confidentialite.html');
  // Le pseudo est vérifié par le serveur seul, avec une liste de mots ; les photos, seules envoyées à Anthropic, sont
  // fermées : la page ne le nomme pas tant qu’elle ne les décrit pas.
  expect(texte).not.toMatch(/Mapbox|Firebase|Anthropic/);
  // Google ne reçoit qu’une chose : l’adresse Gmail des testeurs Android (sa section, et sa ligne dans les prestataires).
  const horsDuTest = await page.locator('main').evaluate((main) => {
    const copie = main.cloneNode(true);
    copie.querySelector('#testeurs-android + ul').remove();
    for (const li of copie.querySelectorAll('#prestataires + ul > li')) if (li.textContent.startsWith('Google ')) li.remove();
    return copie.textContent;
  });
  expect(horsDuTest).not.toMatch(/Google/);
  // Les rapports d’erreurs : Sentry, une fois allumé, en Europe, 30 jours, sans rien qui désigne quelqu’un.
  const plantages = normaliser(await page.locator('#plantages ~ ul').first().innerText());
  await expect(page.locator('#plantages + p')).toContainText('Tant qu’on ne l’a pas allumé, aucun rapport ne part chez lui.');
  expect(plantages).toContain('dans la région Europe de Sentry (Francfort, en Allemagne). Sentry garde les rapports 30 jours, puis les efface.');
  expect(plantages).toContain('le code enlève ton adresse mail, ton pseudo, un prénom, l’identifiant de ton compte');
  expect(plantages).toContain('Notre compte Sentry est réglé pour ne pas la garder.');
  expect(plantages).toContain('Un rapport n’est rattaché à aucun compte');
  await expect(page.locator('#prestataires + ul > li', { hasText: /^Sentry/ })).toContainText('une fois qu’on l’a allumé');
  // Les mails d’alerte, par Resend : des chiffres, jamais un fan.
  await expect(page.locator('#prestataires + ul > li', { hasText: /^Resend/ })).toContainText('ils ne disent que la sorte d’alerte et des chiffres, jamais un fan, un pseudo, une adresse mail, un code ni le nom d’un bar');
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

// Les sauvegardes : faites par nous, chiffrées, 28 jours, jamais chez Railway ; un compte supprimé y reste au plus
// 28 jours. Et chaque durée de conservation de l’appli a sa ligne dans « Combien de temps ».
test('la page Confidentialité : les sauvegardes chiffrées, 28 jours, et une ligne par durée', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const sauvegardes = normaliser(await page.locator('#sauvegardes + ul').innerText());
  expect(sauvegardes).toContain('Qui les fait : nous, pas Railway.');
  expect(sauvegardes).toContain('chaque copie est chiffrée avec une phrase de passe que seul le responsable de Baromatch connaît');
  expect(sauvegardes).toContain('Jamais chez Railway.');
  expect(sauvegardes).toContain('chaque sauvegarde est effacée au bout de 28 jours, sa deuxième copie aussi');
  expect(sauvegardes).toContain('il reste dans les sauvegardes faites avant, jusqu’à ce qu’elles soient effacées : 28 jours au plus.');
  await expect(page.locator('#suppression + p + ul')).toContainText('ton compte reste dans les sauvegardes faites avant ta suppression, jusqu’à ce qu’elles soient effacées : 28 jours au plus');
  await expect(page.locator('#prestataires + ul > li', { hasText: /^Railway/ })).toContainText('Railway ne fait pas de sauvegarde de notre base : c’est nous qui les faisons');
  const texte = await texteDe(page, '/confidentialite.html');
  expect(texte).not.toMatch(/sauvegarde de notre base, chez Railway|copies de sauvegarde de notre base, chez Railway/);
  await page.goto('/confidentialite.html');
  const durees = (await page.locator('#combien-de-temps ~ ul').first().locator('> li').allInnerTexts()).map(normaliser);
  for (const ligne of [
    'L’heure à laquelle tu dis arriver avec « Je suis en retard », et l’heure jusqu’à laquelle ta place est alors gardée : aujourd’hui, avec ta place. Prévu : effacées un jour après le coup d’envoi.',
    'L’attente après des mauvais mots de passe, pour l’équipe des bars : 24 heures après le dernier mauvais mot de passe.',
    'La case « mot de passe à changer » d’un compte de bar : jusqu’à ce que la personne choisisse son propre mot de passe.',
    'Les sauvegardes chiffrées de notre base : effacées au bout de 28 jours.',
    'Les rapports d’erreurs chez Sentry, une fois allumé : 30 jours.',
    'Nos mails d’alerte, sans donnée personnelle : dans notre boîte mail tant qu’on les garde, et chez Resend selon ses conditions.',
    'Les compteurs du service (des nombres par tranche de 5 minutes, sans personne) : 2 heures.',
    'La demande d’un bar envoyée par le formulaire du site : 12 mois (voir « Les demandes des bars »).',
  ]) expect(durees).toContain(ligne);
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
