// La boutique vue par un fan : rien n’y est réservé, on y fait une sélection et on demande à être prévenu ; une adresse
// incomplète est refusée, l’adresse est rappelée après l’envoi et se corrige ; le message d’erreur se voit sur un
// téléphone de 640 px ; la fenêtre reste utilisable avec le texte à 200 %. Chaque échec d’envoi (service muet au-delà de
// 10 s, coupure, panne, refus) offre d’envoyer la sélection par mail ; seul un refus qui nomme l’adresse dit de la
// vérifier. Et si boutique.js ne se lance pas, la collection s’affiche quand même, sans trou.
import { test, expect } from '@playwright/test';
import { champDe, simulerFormspree } from './outils/formspree.mjs';
import { arreterLHorloge } from './outils/horloge.mjs';

const SELECTION = [{ id: 'tshirt-le-verre', couleur: 'nuit', taille: 'M', quantite: 1 }];
// Chaque échec écrit l’adresse en toutes lettres (sans messagerie installée, le lien ne s’ouvre pas) et garde le lien
// « par mail », qui emporte la sélection.
const PANNE = 'Ta sélection n’est pas partie. Réessaie dans un instant, ou envoie-la par mail à contact@baromatch.fr.';
const REFUSEE = 'Cette adresse ne semble pas valide. Vérifie-la : elle doit ressembler à prenom@exemple.fr. Si elle est juste, envoie ta sélection par mail à contact@baromatch.fr.';

// La page avec une sélection déjà gardée sur l’appareil, et la fenêtre ouverte.
const ouvrirAvecUneSelection = async (page) => {
  await page.goto('/boutique.html');
  await page.evaluate((s) => localStorage.setItem('baromatch-boutique-v1', JSON.stringify(s)), SELECTION);
  await page.reload();
  await page.locator('#barre-ouvrir').click();
  await expect(page.locator('#panier')).toBeVisible();
};

test('les mots disent une sélection et une demande d’être prévenu, pas une réservation', async ({ page }) => {
  await page.goto('/boutique.html');
  const boutons = await page.locator('.boutique-produit__ajouter').allTextContents();
  expect(boutons).toEqual(Array(6).fill('Ajouter à ma sélection'));
  const tshirt = page.locator('article', { has: page.locator('#nom-tshirt-le-verre') });
  await tshirt.locator('label', { hasText: /^M$/ }).click();
  await tshirt.locator('.boutique-produit__ajouter').click();
  await expect(tshirt.locator('.boutique-produit__retour')).toHaveText('Ajouté à ta sélection (Nuit, taille M).');
  await expect(page.locator('#barre-ouvrir')).toHaveText('Voir ma sélection');
  await page.locator('#barre-ouvrir').click();
  await expect(page.locator('#panier-titre')).toHaveText('Ta sélection');
  await expect(page.locator('#panier-form button[type="submit"]')).toHaveText('Me prévenir à l’ouverture');

  const texte = await page.locator('body').innerText();
  expect(texte).not.toMatch(/réservation|Réserve|réserver/i);
  await expect(page.locator('.boutique-texte')).toContainText('Choisis tes pièces dès maintenant : on t’écrit à l’ouverture, sans rien payer.');
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', /[Rr]éserv/);

  // L’accueil ne présente plus la boutique (décision du propriétaire, 28 octobre) : on y arrive par le menu.
  await page.goto('/');
  await expect(page.locator('main a[href="/boutique.html"]')).toHaveCount(0);
  await expect(page.locator('.entete__nav a[href="/boutique.html"]')).toHaveText('Boutique');
});

test('les questions : la date et la livraison sans ambiguïté', async ({ page }) => {
  await page.goto('/boutique.html');
  const reponse = (question) => page.locator('.boutique-questions details', { has: page.locator('summary', { hasText: question }) }).locator('p');
  await expect(reponse('Quand ouvre la boutique')).toHaveText('Pas de date pour l’instant : la boutique ouvre avec le lancement de l’appli à Paris. Tu seras parmi les premiers prévenus.');
  await expect(reponse('Les prix vont-ils changer')).toHaveText('Les prix affichés sont indicatifs. Avant toute commande, on te donne le prix final, frais de livraison compris s’il y en a.');
});

test('« Coup d’envoi » ne laisse pas son guillemet seul en bout de ligne', async ({ page }) => {
  await page.goto('/boutique.html');
  const texte = await page.locator('#boutique-grille article', { has: page.locator('#nom-sweat-coup-d-envoi') }).locator('.boutique-produit__texte').textContent();
  expect(texte).toContain('« Coup d’envoi »');
});

test('« paul@gmail » est refusé sans envoi ; après l’envoi, l’adresse est rappelée et se corrige', async ({ page }) => {
  const envois = await simulerFormspree(page);
  await ouvrirAvecUneSelection(page);
  const mail = page.locator('#panier-mail');
  const retour = page.locator('#panier-retour');
  await mail.fill('paul@gmail');
  await page.locator('#panier-accord').check();
  await page.locator('#panier-form button[type="submit"]').click();
  await expect(retour).toHaveText('Il manque la fin de ton adresse, par exemple .fr ou .com.');
  await expect(mail).toBeFocused();
  await expect(mail).toHaveAttribute('aria-invalid', 'true');
  expect(envois).toEqual([]);

  await mail.fill('paul.martin@gmail.co');
  await page.locator('#panier-form button[type="submit"]').click();
  const merci = page.locator('#panier-merci');
  await expect(merci).toBeVisible();
  await expect(merci.locator('p')).toHaveText('On t’écrit à paul.martin@gmail.co à l’ouverture de la boutique, avec le prix final de ta sélection. Rien n’est réservé ni commandé : tu décides à ce moment-là.');
  expect(envois).toHaveLength(1);
  expect(champDe(envois[0], 'email')).toBe('paul.martin@gmail.co');

  await merci.locator('#panier-corriger').click();
  await expect(mail).toBeFocused();
  await expect(mail).toHaveValue('paul.martin@gmail.co');
  await expect(page.locator('#panier-liste .panier__ligne')).toHaveCount(1);
  // La case de consentement n’est pas recochée à la place de la personne : une case précochée ne vaut pas accord.
  await expect(page.locator('#panier-accord')).not.toBeChecked();
  await mail.fill('paul.martin@gmail.com');
  await page.locator('#panier-form button[type="submit"]').click();
  await expect(retour).toHaveText('Coche la case pour qu’on puisse t’écrire à l’ouverture.');
  expect(envois).toHaveLength(1);
  await page.locator('#panier-accord').check();
  await page.locator('#panier-form button[type="submit"]').click();
  await expect(merci.locator('p')).toContainText('On t’écrit à paul.martin@gmail.com à l’ouverture');
  expect(envois).toHaveLength(2);
  expect(champDe(envois[1], 'email')).toBe('paul.martin@gmail.com');
  expect(champDe(envois[1], 'remplace')).toBe('paul.martin@gmail.co');
  expect(champDe(envois[1], 'selection')).toContain('Le verre');
});

const envoyerLaSelection = async (page, adresse = 'paul@exemple.fr') => {
  await page.locator('#panier-mail').fill(adresse);
  await page.locator('#panier-accord').check();
  await page.locator('#panier-form button[type="submit"]').click();
};

// Le lien « par mail » du message : il écrit à contact@baromatch.fr avec la sélection et l’adresse.
const verifierLeMailDeSecours = async (page, texteDuLien) => {
  const lien = page.locator('#panier-retour a');
  await expect(lien).toHaveText(texteDuLien);
  const url = new URL(await lien.getAttribute('href'));
  expect(url.protocol + url.pathname).toBe('mailto:contact@baromatch.fr');
  expect(url.searchParams.get('subject')).toBe('Sélection boutique Baromatch');
  const corps = url.searchParams.get('body');
  expect(corps).toContain('1 × Le verre (T-shirt) — Nuit, taille M');
  expect(corps).toContain('paul@exemple.fr');
};

test('une adresse refusée par le service d’envoi (422 sur l’adresse) : le message dit de la vérifier, et offre le mail', async ({ page }) => {
  await simulerFormspree(page, 422);
  await ouvrirAvecUneSelection(page);
  await envoyerLaSelection(page);
  await expect(page.locator('#panier-retour')).toHaveText(REFUSEE);
  await expect(page.locator('#panier-mail')).toBeFocused();
  await expect(page.locator('#panier-mail')).toHaveAttribute('aria-invalid', 'true');
  await verifierLeMailDeSecours(page, 'envoie ta sélection par mail');
});

for (const cas of [
  { nom: 'un 422 sur autre chose que l’adresse', reponse: { statut: 422, corps: { errors: [{ code: 'REQUIRED_FIELD_MISSING', field: 'selection' }] } } },
  { nom: 'une panne du service (500)', reponse: 500 },
  { nom: 'une coupure du réseau', reponse: 'coupure' },
]) {
  test(`${cas.nom} : « pas partie », avec la sélection prête à partir par mail`, async ({ page }) => {
    await simulerFormspree(page, cas.reponse);
    await ouvrirAvecUneSelection(page);
    await envoyerLaSelection(page);
    await expect(page.locator('#panier-retour')).toHaveText(PANNE);
    await expect(page.locator('#panier-mail')).not.toHaveAttribute('aria-invalid', 'true');
    await verifierLeMailDeSecours(page, 'envoie-la par mail');
    await expect(page.locator('#panier-form button[type="submit"]')).toBeEnabled();
    await expect(page.locator('#panier-liste .panier__ligne')).toHaveCount(1);
  });
}

test('un service qui ne répond pas : au bout de 10 s, « pas partie » avec le mail, et le bouton revient', async ({ page }) => {
  const debut = new Date('2026-10-13T17:30:00+02:00').getTime();
  await arreterLHorloge(page, debut + 1000);
  await simulerFormspree(page, 'silence');
  await ouvrirAvecUneSelection(page);
  await envoyerLaSelection(page);
  const envoyer = page.locator('#panier-form button[type="submit"]');
  await expect(envoyer).toHaveText('Envoi…');
  await page.clock.runFor(9_000);
  await expect(envoyer).toHaveText('Envoi…');
  await page.clock.runFor(1_000);
  await expect(page.locator('#panier-retour')).toHaveText(PANNE);
  await verifierLeMailDeSecours(page, 'envoie-la par mail');
  await expect(envoyer).toBeEnabled();
  await expect(envoyer).toHaveText('Me prévenir à l’ouverture');
});

test('une erreur d’affichage après un envoi réussi ne le fait pas passer pour un échec', async ({ page }) => {
  await simulerFormspree(page);
  await ouvrirAvecUneSelection(page);
  // Le titre du remerciement a disparu du balisage : la sélection est pourtant partie.
  await page.evaluate(() => document.querySelector('#panier-merci h3').remove());
  await envoyerLaSelection(page);
  await expect(page.locator('#panier-merci')).toBeVisible();
  await expect(page.locator('#panier-merci-adresse')).toHaveText('paul@exemple.fr');
  await expect(page.locator('#panier-retour')).toBeEmpty();
});

// WCAG 2.4.3 et 4.1.3 : « Un de plus », « Un de moins » et « Retirer » gardent le focus sur un contrôle qui a du sens
// quand la liste se refait (le même, sinon celui de la ligne suivante ou précédente, sinon le titre de la fenêtre quand
// elle est vide), et la nouvelle quantité et le total sont dits par une zone de statut DANS la fenêtre (ce qui est
// dehors est inerte tant qu’elle est ouverte).
const DEUX_LIGNES = [
  { id: 'tshirt-le-verre', couleur: 'nuit', taille: 'M', quantite: 1 },
  { id: 'casquette', couleur: 'creme', taille: null, quantite: 1 },
];

const ouvrirAvec = async (page, selection) => {
  await page.goto('/boutique.html');
  await page.evaluate((s) => localStorage.setItem('baromatch-boutique-v1', JSON.stringify(s)), selection);
  await page.reload();
  await page.locator('#barre-ouvrir').click();
  await expect(page.locator('#panier')).toBeVisible();
};

// Le nom du contrôle qui a le focus, ou « page » s’il est tombé sur la page.
const focusSur = (page) => page.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return 'page';
  return `${e.id ? `#${e.id}` : ''}${['data-plus', 'data-moins', 'data-retirer'].filter((a) => e.hasAttribute(a)).map((a) => `[${a}="${e.getAttribute(a)}"]`).join('')}`;
});

test('dans la sélection, chaque bouton de quantité garde le focus et la nouvelle quantité et le total sont dits dans la fenêtre', async ({ page }) => {
  await ouvrirAvec(page, DEUX_LIGNES);
  const annonce = page.locator('#panier-annonce');
  await expect(annonce).toHaveAttribute('role', 'status');
  expect(await annonce.evaluate((zone) => !!zone.closest('dialog#panier'))).toBe(true);
  const quantite = (i) => page.locator('.panier__ligne').nth(i).locator('output');

  await page.locator('[data-plus="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(quantite(0)).toHaveText('2');
  expect(await focusSur(page)).toBe('[data-plus="0"]');
  await expect(annonce).toHaveText('Le verre (Nuit, taille M) : 2. Total indicatif 83 €.');
  await page.keyboard.press('Enter');
  await expect(quantite(0)).toHaveText('3');
  expect(await focusSur(page)).toBe('[data-plus="0"]');
  await expect(annonce).toHaveText('Le verre (Nuit, taille M) : 3. Total indicatif 112 €.');

  await page.locator('[data-moins="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(quantite(0)).toHaveText('2');
  expect(await focusSur(page)).toBe('[data-moins="0"]');
  await expect(annonce).toHaveText('Le verre (Nuit, taille M) : 2. Total indicatif 83 €.');

  // « Un de moins » à 1 retire la ligne : le focus passe au même bouton de la ligne qui prend sa place.
  await page.locator('[data-moins="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.panier__ligne')).toHaveCount(1);
  expect(await focusSur(page)).toBe('[data-moins="0"]');
  await expect(annonce).toHaveText('Pièce retirée : La casquette (Crème). Total indicatif 58 €.');
});

test('« Retirer » passe le focus à la ligne suivante, puis à la précédente, puis au titre de la fenêtre vide', async ({ page }) => {
  await ouvrirAvec(page, [...DEUX_LIGNES, { id: 'echarpe', couleur: 'nuitAmbre', taille: null, quantite: 2 }]);
  const annonce = page.locator('#panier-annonce');
  await page.locator('[data-retirer="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.panier__ligne')).toHaveCount(2);
  expect(await focusSur(page)).toBe('[data-retirer="0"]');
  await expect(page.locator('.panier__ligne').first()).toContainText('La casquette');
  await expect(annonce).toHaveText('Pièce retirée : Le verre (Nuit, taille M). Total indicatif 75 €.');

  await page.locator('[data-retirer="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.panier__ligne')).toHaveCount(1);
  expect(await focusSur(page)).toBe('[data-retirer="0"]');
  await expect(annonce).toHaveText('Pièce retirée : L’écharpe. Total indicatif 25 €.');

  await page.keyboard.press('Enter');
  await expect(page.locator('.panier__vide')).toBeVisible();
  expect(await focusSur(page)).toBe('#panier-titre');
  await expect(annonce).toHaveText('Pièce retirée : La casquette (Crème). Ta sélection est vide.');
  // Le focus reste dans la fenêtre : Tab va au bouton de fermeture.
  await page.keyboard.press('Tab');
  await expect(page.locator('.panier__fermer')).toBeFocused();
});

test('la fenêtre s’ouvre toujours sur « Fermer » : le titre ne prend le focus que quand la sélection se vide', async ({ page }) => {
  await ouvrirAvec(page, DEUX_LIGNES);
  await expect(page.locator('.panier__fermer')).toBeFocused();
  await expect(page.locator('#panier-titre')).not.toHaveAttribute('tabindex', /.*/);
  for (const _ of DEUX_LIGNES) await page.locator('[data-retirer="0"]').press('Enter');
  expect(await focusSur(page)).toBe('#panier-titre');
  await page.keyboard.press('Escape');
  await page.goto('/boutique.html');
  await page.evaluate((s) => localStorage.setItem('baromatch-boutique-v1', JSON.stringify(s)), DEUX_LIGNES);
  await page.reload();
  await page.locator('#barre-ouvrir').click();
  await expect(page.locator('.panier__fermer')).toBeFocused();
});

test('au plus 5 exemplaires : « Un de plus » le dit dans la fenêtre, et garde le focus', async ({ page }) => {
  await ouvrirAvec(page, [{ id: 'casquette', couleur: 'nuit', taille: null, quantite: 5 }]);
  await page.locator('[data-plus="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panier-annonce')).toHaveText('5 exemplaires au plus pour une même pièce.');
  expect(await focusSur(page)).toBe('[data-plus="0"]');
  await expect(page.locator('.panier__ligne output')).toHaveText('5');
});

// WCAG 2.4.3 : après « C’est noté. », la sélection est vide et la barre du bas disparaît ; fermer la fenêtre (« Revenir
// à la boutique », × ou Échap) amène le focus sur le titre de la collection, visible, au lieu d’un bouton caché.
for (const fermeture of ['Revenir à la boutique', 'Échap']) {
  test(`après un envoi réussi, fermer par « ${fermeture} » amène le focus sur la collection, à l’écran`, async ({ page }) => {
    await simulerFormspree(page);
    await ouvrirAvecUneSelection(page);
    await envoyerLaSelection(page);
    await expect(page.locator('#panier-merci')).toBeVisible();
    if (fermeture === 'Échap') await page.keyboard.press('Escape');
    else await page.locator('#panier-merci [data-fermer]').press('Enter');
    await expect(page.locator('#panier')).toBeHidden();
    await expect(page.locator('#boutique-barre')).toBeHidden();
    await expect(page.locator('#titre-collection')).toBeFocused();
    await expect(page.locator('#titre-collection')).toBeInViewport();
  });
}

test('fermer la fenêtre avec une sélection rend le focus à « Voir ma sélection »', async ({ page }) => {
  await ouvrirAvecUneSelection(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#barre-ouvrir')).toBeFocused();
});

// WCAG 2.4.3 et 4.1.3 : comme la liste d’attente et « Pour les bars », le bouton d’envoi garde le focus pendant l’envoi
// (aria-disabled, jamais disabled), ignore un second appui, et « Envoi… » est dit dans la zone de statut ; après un
// échec, le focus est encore sur lui.
test('pendant l’envoi, le bouton garde le focus et ignore un second appui ; « Envoi… » est dit ; après la panne, le focus y est encore', async ({ page }) => {
  const debut = new Date('2026-10-13T17:30:00+02:00').getTime();
  await arreterLHorloge(page, debut + 1000);
  const envois = await simulerFormspree(page, 'silence');
  await ouvrirAvecUneSelection(page);
  const envoyer = page.locator('#panier-form button[type="submit"]');
  await page.locator('#panier-mail').fill('paul@exemple.fr');
  await page.locator('#panier-accord').check();
  await envoyer.focus();
  await page.keyboard.press('Enter');
  await expect(envoyer).toHaveText('Envoi…');
  await expect(envoyer).toBeFocused();
  await expect(envoyer).toHaveAttribute('aria-disabled', 'true');
  await expect(envoyer).not.toHaveAttribute('disabled', /.*/);
  await expect(page.locator('#panier-retour')).toHaveText('Envoi…');
  await page.keyboard.press('Enter');
  await page.locator('#panier-mail').press('Enter');
  await envoyer.focus();
  expect(envois).toHaveLength(1);
  await page.clock.runFor(10_000);
  await expect(page.locator('#panier-retour')).toHaveText(PANNE);
  await expect(envoyer).toBeFocused();
  await expect(envoyer).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(envoyer).toHaveText('Me prévenir à l’ouverture');
  expect(envois).toHaveLength(1);
});

for (const cas of [{ nom: 'une coupure du réseau', reponse: 'coupure' }, { nom: 'une panne du service (500)', reponse: 500 }]) {
  test(`après ${cas.nom}, le focus reste sur le bouton d’envoi, jamais sur la page`, async ({ page }) => {
    await simulerFormspree(page, cas.reponse);
    await ouvrirAvecUneSelection(page);
    await page.locator('#panier-mail').fill('paul@exemple.fr');
    await page.locator('#panier-accord').check();
    await page.locator('#panier-form button[type="submit"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#panier-retour')).toHaveText(PANNE);
    expect(await focusSur(page)).not.toBe('page');
    await expect(page.locator('#panier-form button[type="submit"]')).toBeFocused();
  });
}

// WCAG 1.4.11 en couleurs forcées (contraste élevé de Windows) : la taille et la couleur choisies se voient (un bord
// Highlight plus épais), et les pastilles de couleur gardent leur teinte et un bord visible.
test('en couleurs forcées, la taille et la couleur choisies se voient, et les pastilles gardent leur teinte', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/boutique.html');
  const tshirt = page.locator('article', { has: page.locator('#nom-tshirt-le-verre') });
  await tshirt.locator('label', { hasText: /^M$/ }).click();
  const puces = await tshirt.locator('.boutique-puce').evaluateAll((labels) => labels.map((label) => {
    const s = getComputedStyle(label.querySelector('span'));
    return { texte: label.textContent.trim(), coche: label.querySelector('input').checked, bord: s.borderTopColor, epaisseur: parseFloat(s.borderTopWidth) };
  }));
  const cochees = puces.filter((p) => p.coche);
  const autres = puces.filter((p) => !p.coche);
  expect(cochees.map((p) => p.texte)).toEqual(['Nuit', 'M']);
  for (const cochee of cochees) {
    expect(cochee.epaisseur, `${cochee.texte} : bord plus épais`).toBeGreaterThanOrEqual(2);
    for (const autre of autres) expect(cochee.bord, `${cochee.texte} et ${autre.texte}`).not.toBe(autre.bord);
  }
  const pastilles = await tshirt.locator('.boutique-pastille').evaluateAll((liste) => liste.map((p) => {
    const s = getComputedStyle(p);
    return { fond: s.backgroundColor, bord: s.borderTopColor, epaisseur: parseFloat(s.borderTopWidth) };
  }));
  expect(pastilles.map((p) => p.fond)).toEqual(['rgb(22, 25, 37)', 'rgb(239, 230, 214)']);
  for (const pastille of pastilles) {
    expect(pastille.epaisseur).toBeGreaterThanOrEqual(1);
    expect(pastille.bord).not.toMatch(/rgba\(.*, 0(\.\d+)?\)$/);
  }
});

// WCAG 3.3.1 et 1.3.1 : tant que l’erreur se voit, aria-describedby relie la taille (chaque bouton du groupe) et la case
// de consentement à leur message ; le lien part quand le message part.
test('l’erreur de taille et celle du consentement sont reliées à leur contrôle tant qu’elles se voient', async ({ page }) => {
  await simulerFormspree(page, 'silence');
  await page.goto('/boutique.html');
  const tshirt = page.locator('article', { has: page.locator('#nom-tshirt-le-verre') });
  const tailles = tshirt.locator('input[name="tshirt-le-verre-taille"]');
  const message = tshirt.locator('.boutique-produit__retour');
  await expect(tailles.first()).not.toHaveAttribute('aria-describedby', /.*/);
  await tshirt.locator('.boutique-produit__ajouter').click();
  await expect(message).toHaveText('Choisis d’abord ta taille.');
  await expect(tailles.first()).toBeFocused();
  const id = await message.getAttribute('id');
  expect(id).toBeTruthy();
  for (const taille of await tailles.all()) {
    await expect(taille).toHaveAttribute('aria-describedby', id);
    await expect(taille).toHaveAccessibleDescription('Choisis d’abord ta taille.');
  }
  await tshirt.locator('label', { hasText: /^M$/ }).click();
  await expect(message).toBeEmpty();
  for (const taille of await tailles.all()) await expect(taille).not.toHaveAttribute('aria-describedby', /.*/);

  await tshirt.locator('.boutique-produit__ajouter').click();
  await page.locator('#barre-ouvrir').click();
  const accord = page.locator('#panier-accord');
  await page.locator('#panier-mail').fill('paul@exemple.fr');
  await page.locator('#panier-form button[type="submit"]').click();
  await expect(page.locator('#panier-retour')).toHaveText('Coche la case pour qu’on puisse t’écrire à l’ouverture.');
  await expect(accord).toBeFocused();
  await expect(accord).toHaveAttribute('aria-describedby', 'panier-retour');
  await expect(accord).toHaveAccessibleDescription('Coche la case pour qu’on puisse t’écrire à l’ouverture.');
  await accord.check();
  await page.locator('#panier-form button[type="submit"]').click();
  await expect(page.locator('#panier-retour')).toHaveText('Envoi…');
  await expect(accord).not.toHaveAttribute('aria-describedby', /.*/);
});

test('sur un téléphone de 360 × 640, le message d’erreur se voit dans la fenêtre', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await ouvrirAvecUneSelection(page);
  await page.locator('#panier-form button[type="submit"]').click();
  const retour = page.locator('#panier-retour');
  await expect(retour).toHaveText('Vérifie ton adresse mail : elle doit ressembler à prenom@exemple.fr.');
  const boite = await retour.boundingBox();
  const fenetre = await page.locator('.panier__corps').boundingBox();
  expect(boite.y, 'haut du message').toBeGreaterThanOrEqual(fenetre.y);
  expect(boite.y + boite.height, 'bas du message').toBeLessThanOrEqual(fenetre.y + fenetre.height);
  // Le message est au-dessus du bouton d’envoi.
  const envoyer = await page.locator('#panier-form button[type="submit"]').boundingBox();
  expect(boite.y + boite.height).toBeLessThanOrEqual(envoyer.y);
});

for (const largeur of [320, 360]) {
  test(`à ${largeur} px, texte à 200 % : la fenêtre ne déborde pas, son titre se lit, le bouton d’envoi s’atteint`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 });
    await ouvrirAvecUneSelection(page);
    const taille = () => page.locator('#panier-titre').evaluate((h) => parseFloat(getComputedStyle(h).fontSize));
    const normale = await taille();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    // Le titre grandit avec le texte (WCAG 1.4.4, F94) : deux fois plus grand à 200 %.
    expect(await taille()).toBeCloseTo(2 * normale, 0);
    const lu = await page.evaluate(() => {
      const fenetre = document.querySelector('#panier');
      const cadre = fenetre.getBoundingClientRect();
      const dehors = [...fenetre.querySelectorAll('*')].filter((e) => e.getClientRects().length && !e.closest('.attente__piege'))
        .filter((e) => { const r = e.getBoundingClientRect(); return r.left < cadre.left - 0.5 || r.right > cadre.right + 0.5; })
        .map((e) => `${e.tagName.toLowerCase()}.${e.className} « ${e.textContent.trim().slice(0, 30)} »`);
      const corps = fenetre.querySelector('.panier__corps');
      const titre = fenetre.querySelector('#panier-titre');
      // Un mot du titre coupé en deux lignes (« sélectio-n ») a deux boîtes.
      const texte = titre.firstChild;
      const motsCoupes = [...texte.textContent.matchAll(/\S+/g)].filter((mot) => {
        const plage = document.createRange();
        plage.setStart(texte, mot.index);
        plage.setEnd(texte, mot.index + mot[0].length);
        return new Set([...plage.getClientRects()].map((r) => Math.round(r.top))).size > 1;
      }).map((mot) => mot[0]);
      return {
        dehors,
        defileDeCote: corps.scrollWidth > corps.clientWidth || fenetre.scrollWidth > fenetre.clientWidth,
        titreCoupe: titre.scrollWidth > titre.clientWidth,
        motsCoupes,
        cadreDansLEcran: cadre.left >= 0 && cadre.right <= window.innerWidth,
      };
    });
    expect(lu.dehors).toEqual([]);
    expect(lu.defileDeCote).toBe(false);
    expect(lu.titreCoupe).toBe(false);
    expect(lu.motsCoupes, 'un mot du titre coupé en deux').toEqual([]);
    expect(lu.cadreDansLEcran).toBe(true);
    const envoyer = page.locator('#panier-form button[type="submit"]');
    await envoyer.scrollIntoViewIfNeeded();
    await expect(envoyer).toBeInViewport();
  });
}

test('si boutique.js ne se lance pas, la collection s’affiche quand même, sans trou avant les questions', async ({ page }) => {
  await page.route('**/boutique.js', (route) => route.abort());
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/boutique.html');
  await expect(page.locator('.boutique-produit')).toHaveCount(6);
  await expect(page.locator('.boutique-produit').first()).toBeVisible();
  await expect(page.locator('.boutique-sans-js')).toBeVisible();
  const ecart = await page.evaluate(() => {
    const vitrine = document.querySelector('.boutique-vitrine');
    const dernier = [...vitrine.querySelectorAll('.boutique-produit')].pop().getBoundingClientRect().bottom;
    return document.querySelector('.boutique-questions').getBoundingClientRect().top - dernier;
  });
  expect(ecart).toBeLessThan(250);
});

for (const texte of [100, 200]) {
  test(`texte à ${texte} % : la barre du bas ne cache pas ce qui a le focus au clavier (WCAG 2.4.11)`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/boutique.html');
    await page.evaluate((s) => localStorage.setItem('baromatch-boutique-v1', JSON.stringify(s)), SELECTION);
    await page.reload();
    await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, texte);
    await expect(page.locator('#boutique-barre')).toBeVisible();
    const caches = [];
    for (let i = 0; i < 45; i += 1) {
      await page.keyboard.press('Tab');
      const lu = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body || e.closest('#boutique-barre')) return null;
        const r = e.getBoundingClientRect();
        return { nom: (e.textContent || e.id).trim().slice(0, 30), bas: r.bottom, barre: document.getElementById('boutique-barre').getBoundingClientRect().top };
      });
      if (lu && lu.bas > lu.barre + 0.5) caches.push(`${lu.nom} : bas à ${Math.round(lu.bas)} px, barre à ${Math.round(lu.barre)} px`);
    }
    expect(caches).toEqual([]);
  });
}
