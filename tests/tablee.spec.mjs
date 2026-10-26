// La page d’un lien de tablée (/t/‹code›, servie par 404.html et tablee.js), vue sur un téléphone sans l’appli : ce
// qu’est une tablée, la carte de l’invitation, « tu peux venir sans l’appli » juste dessous, puis comment avoir l’appli
// (« Ouvrir dans l’appli » sur Android seulement, pour qui l’a déjà). Aucune donnée personnelle : ni le pseudo de l’hôte,
// ni ceux de la tablée, même quand le serveur les envoie.
// Plus de « Ouvre ce lien sur ton téléphone avec Baromatch » (on y est déjà, et sans l’appli). Un lien mort ne montre
// que le titre, la phrase d’état et « Me prévenir au lancement » ; une panne (serveur muet 8 s, coupure, réponse
// incomplète) y ajoute la définition d’une tablée et « Réessayer ». L’heure se lit « Ce soir, coup d’envoi à 21 h ».
// L’API ne répond qu’à https://baromatch.fr : depuis www ou http, la page y renvoie d’abord, même chemin.
import { test, expect } from '@playwright/test';
import { arreterLHorloge as arreterLHorlogeA } from './outils/horloge.mjs';
import { API_TABLEE, enTetesCors, INVITATION } from './outils/invitation.mjs';
import { violationsAxe } from './outils/axe.mjs';

const LIEN = '/t/abcdefghjkmn';
// Mardi 13 octobre 2026, 17:30 à Paris : le soir d’un match à 21:00.
const MAINTENANT = new Date('2026-10-13T17:30:00+02:00');
const PANNE = 'L’invitation ne s’affiche pas pour l’instant. Réessaie dans un moment, ou demande le bar et l’heure à la personne qui t’invite.';
const DEFINITION = 'Une tablée, c’est un groupe de potes qui regarde le match ensemble, à la même table.';
const VENIR = 'Tu peux venir quand même : arrive avec la personne qui t’invite. À l’entrée, son pass compte aussi pour toi.';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const invitation = (plus = {}) => ({ ...INVITATION, ...plus });
const match = (plus = {}) => ({ ...INVITATION.match, ...plus });

// L’API simulée : une réponse par appel, dans l’ordre (la dernière se répète). Une réponse : { statut, corps },
// 'silence' (jamais de réponse) ou 'coupure' (échec réseau) ; { delai } la retient autant de millisecondes.
const simulerLAPI = async (page, ...reponses) => {
  const demandes = [];
  await page.route(API_TABLEE, async (route) => {
    demandes.push(route.request());
    const r = reponses[Math.min(demandes.length - 1, reponses.length - 1)];
    if (r === 'silence') return;
    if (r === 'coupure') return route.abort('failed');
    if (r.delai) await new Promise((suite) => setTimeout(suite, r.delai));
    const corps = typeof r.corps === 'string' ? r.corps : JSON.stringify(r.corps ?? {});
    await route.fulfill({ status: r.statut, contentType: 'application/json', body: corps, headers: await enTetesCors(route.request()) });
  });
  return demandes;
};

const ouvrir = async (page, ...reponses) => {
  await page.clock.setFixedTime(MAINTENANT);
  const demandes = await simulerLAPI(page, ...reponses);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(LIEN);
  return demandes;
};

// L’horloge de la page simulée et arrêtée : seul runFor fait partir les minuteurs.
const arreterLHorloge = async (page) => {
  await arreterLHorlogeA(page, MAINTENANT.getTime() + 1000);
};

const visibles = (page) => page.locator('#tablee').evaluate((t) => [...t.querySelectorAll('h1, h2, p, dt, dd, a, button')]
  .filter((e) => e.getClientRects().length > 0).map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

const verifierLaPanne = async (page) => {
  await expect(page.locator('#tablee-titre')).toHaveText('Une tablée t’attend.');
  await expect(page.locator('#tablee-etat')).toHaveText(PANNE);
  expect(await visibles(page)).toEqual(['La tablée', 'Une tablée t’attend.', PANNE, DEFINITION, 'Réessayer', 'Me prévenir au lancement']);
};

test('invitation ouverte : la carte, puis « tu peux venir sans l’appli », puis l’appli ; plus de « Ouvre ce lien »', async ({ page }) => {
  await ouvrir(page, { statut: 200, corps: invitation() });
  await expect(page.locator('#tablee-titre')).toHaveText('Une place t’attend.');
  await expect(page).toHaveTitle('Une place t’attend — Baromatch');
  await expect(page.locator('#tablee-etat')).toHaveText('Il reste 3 places à la table.');
  await expect(page.locator('#tablee-definition')).toHaveText(DEFINITION);
  await expect(page.locator('#tablee-carte')).toBeVisible();
  await expect(page.locator('#tablee-match')).toHaveText('Paris – Marseille');
  await expect(page.locator('#tablee-heure')).toHaveText('Ce soir, coup d’envoi à 21 hArrivée prévue à 20 h 30');
  const carte = page.locator('#tablee-bar a');
  await expect(carte).toHaveText('Voir sur la carte');
  await expect(carte).toHaveAttribute('href', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Le Comptoir, 12 rue Oberkampf, 75011 Paris')}`);

  const venir = page.locator('#tablee-venir');
  await expect(venir).toBeVisible();
  await expect(venir.locator('h2')).toHaveText('Tu n’as pas l’appli ?');
  await expect(venir.locator('p')).toHaveText(VENIR);
  // Juste sous la carte, avant ce qui parle de l’appli.
  expect(await page.evaluate(() => document.getElementById('tablee-carte').nextElementSibling.id)).toBe('tablee-venir');

  // Comment avoir l’appli : le test fermé sur Android, sinon la liste d’attente. « Ouvrir dans l’appli » est pour Android.
  const appli = page.locator('#tablee-appli');
  await expect(appli).toContainText('Baromatch est en test sur Android, à Paris. Pas d’appli iPhone pour l’instant.');
  await expect(appli).toContainText('Tu as un téléphone Android ? Deviens testeur pour installer l’appli avant tout le monde. Sinon, laisse ton adresse : on te prévient au lancement.');
  await expect(appli.getByRole('link', { name: 'Deviens testeur' })).toHaveAttribute('href', '/testeurs-android.html');
  await expect(appli.getByRole('link', { name: 'Me prévenir au lancement' })).toHaveAttribute('href', '/#attente');
  await expect(page.locator('#tablee-ouvrir')).toBeHidden();
  await expect(page.locator('#tablee-reessayer')).toBeHidden();
  expect((await visibles(page)).join(' ')).not.toMatch(/Ouvre ce lien|avec Baromatch\./);
});

// Aucune donnée personnelle : le serveur envoie le pseudo de l’hôte et ceux de la tablée, la page n’en montre aucun,
// ni dans la page, ni dans l’onglet.
for (const cas of [
  { nom: 'une place', corps: invitation({ open: 1, members: [{ pseudo: 'Nico_B', host: true }, { pseudo: 'Lea_93', host: false }] }), titre: 'Une place t’attend.', etat: 'Il reste 1 place à la table.' },
  { nom: 'la table pleine', corps: invitation({ open: 0, full: true, members: [{ pseudo: 'Nico_B', host: true }, { pseudo: 'Lea_93', host: false }] }), titre: 'La table est pleine.', etat: 'Le bar a peut-être encore de la place : demande à la personne qui t’invite.' },
]) {
  test(`${cas.nom} : aucun pseudo, ni de l’hôte ni de la tablée`, async ({ page }) => {
    await ouvrir(page, { statut: 200, corps: cas.corps });
    await expect(page.locator('#tablee-titre')).toHaveText(cas.titre);
    await expect(page.locator('#tablee-etat')).toHaveText(cas.etat);
    expect(await page.locator('body').innerText()).not.toMatch(/Nico_B|Lea_93/);
    expect(await page.title()).not.toMatch(/Nico_B|Lea_93/);
  });
}

test('sans pseudo d’hôte dans la réponse : la même invitation', async ({ page }) => {
  await ouvrir(page, { statut: 200, corps: invitation({ host: null }) });
  await expect(page.locator('#tablee-titre')).toHaveText('Une place t’attend.');
  await expect(page.locator('#tablee-venir p')).toHaveText(VENIR);
});

test('table pleine : demander à la personne qui t’invite, sans la note sur son pass ni « regarde dans l’appli »', async ({ page }) => {
  await ouvrir(page, { statut: 200, corps: invitation({ open: 0, full: true }) });
  await expect(page.locator('#tablee-titre')).toHaveText('La table est pleine.');
  await expect(page.locator('#tablee-etat')).toHaveText('Le bar a peut-être encore de la place : demande à la personne qui t’invite.');
  await expect(page.locator('#tablee-carte')).toBeVisible();
  await expect(page.locator('#tablee-venir')).toBeHidden();
  expect((await visibles(page)).join(' ')).not.toMatch(/pass compte|regarde dans l’appli/);
});

// « Ouvrir dans l’appli », sur Android seulement (l’appli n’existe pas ailleurs) : pour qui a l’appli et voit quand même
// cette page. Un « intent » de Chrome ouvre baromatch://t/‹code› dans fr.baromatch.app ; sans l’appli, le navigateur va
// à la page des testeurs Android. Seulement quand l’invitation est là (ouverte ou pleine).
const INTENT = 'intent://t/abcdefghjkmn#Intent;scheme=baromatch;package=fr.baromatch.app;S.browser_fallback_url=';

test.describe('sur Android', () => {
  test.use({ userAgent: ANDROID });

  for (const cas of [
    { nom: 'invitation ouverte', corps: invitation() },
    { nom: 'table pleine', corps: invitation({ open: 0, full: true }) },
  ]) {
    test(`${cas.nom} : « Ouvrir dans l’appli », avant ce qui dit comment l’avoir`, async ({ page }) => {
      await ouvrir(page, { statut: 200, corps: cas.corps });
      const lien = page.locator('#tablee-ouvrir-lien');
      await expect(page.locator('#tablee-ouvrir p')).toHaveText('Tu l’as déjà sur ce téléphone ?');
      await expect(lien).toBeVisible();
      await expect(lien).toHaveText('Ouvrir dans l’appli');
      await expect(lien).toHaveAttribute('href', `${INTENT}${encodeURIComponent('https://baromatch.fr/testeurs-android.html')};end`);
      const ordre = await page.locator('#tablee-appli-detail').evaluate((d) => [...d.children].map((e) => e.id || e.tagName.toLowerCase()));
      expect(ordre).toEqual(['h2', 'tablee-ouvrir', 'p', 'p']);
    });
  }

  for (const cas of [
    { nom: 'lien inconnu (404)', reponses: [{ statut: 404 }], titre: 'Ce lien ne mène à aucune tablée.' },
    { nom: 'invitation terminée (410)', reponses: [{ statut: 410 }], titre: 'Cette invitation est terminée.' },
    { nom: 'panne (500)', reponses: [{ statut: 500 }], titre: 'Une tablée t’attend.' },
  ]) {
    test(`${cas.nom} : pas de « Ouvrir dans l’appli »`, async ({ page }) => {
      await ouvrir(page, ...cas.reponses);
      await expect(page.locator('#tablee-titre')).toHaveText(cas.titre);
      await expect(page.locator('#tablee-ouvrir')).toBeHidden();
    });
  }

  for (const largeur of [360, 1280]) {
    test(`à ${largeur} px, l’invitation avec « Ouvrir dans l’appli » : aucune violation axe`, async ({ page }) => {
      await ouvrir(page, { statut: 200, corps: invitation() });
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.locator('#tablee-ouvrir-lien')).toBeVisible();
      expect(await violationsAxe(page)).toEqual([]);
    });
  }

  test('en attente de l’invitation : pas encore de « Ouvrir dans l’appli »', async ({ page }) => {
    await ouvrir(page, 'silence');
    await expect(page.locator('#tablee-etat')).toHaveText('On regarde l’invitation…');
    await expect(page.locator('#tablee-ouvrir')).toBeHidden();
  });
});

test.describe('sur iPhone', () => {
  test.use({ userAgent: IPHONE });

  test('l’invitation, sans « Ouvrir dans l’appli » (pas d’appli iPhone)', async ({ page }) => {
    await ouvrir(page, { statut: 200, corps: invitation() });
    await expect(page.locator('#tablee-carte')).toBeVisible();
    await expect(page.locator('#tablee-ouvrir')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Me prévenir au lancement' })).toBeVisible();
  });
});

// Le nom du match, tel que le serveur le donne : son titre ; sans titre, les deux équipes (homeTeam, awayTeam), sinon
// le nom des deux clubs (canonicalName).
for (const cas of [
  { nom: 'sans titre, les équipes', match: match({ title: '' }), attendu: 'Paris Saint-Germain – Olympique de Marseille' },
  { nom: 'sans titre ni équipes, les clubs', match: match({ title: ' ', homeTeam: null, awayTeam: null }), attendu: 'Paris Saint-Germain – Olympique de Marseille' },
]) {
  test(`le nom du match ${cas.nom} : « ${cas.attendu} »`, async ({ page }) => {
    await ouvrir(page, { statut: 200, corps: invitation({ match: cas.match }) });
    await expect(page.locator('#tablee-match')).toHaveText(cas.attendu);
    await expect(page.locator('#tablee-titre')).toHaveText('Une place t’attend.');
  });
}

for (const cas of [
  { nom: 'lien inconnu (404)', statut: 404, titre: 'Ce lien ne mène à aucune tablée.', etat: 'Il a peut-être changé : demande le nouveau lien à la personne qui t’invite.' },
  { nom: 'invitation terminée (410)', statut: 410, titre: 'Cette invitation est terminée.', etat: 'Le match a commencé, ou la tablée n’existe plus.' },
]) {
  test(`${cas.nom} : le titre, la phrase d’état et « Me prévenir au lancement », rien d’autre`, async ({ page }) => {
    await ouvrir(page, { statut: cas.statut });
    await expect(page.locator('#tablee-titre')).toHaveText(cas.titre);
    await expect(page.locator('#tablee-etat')).toHaveText(cas.etat);
    await expect(page.locator('#tablee-appli .tablee__bouton')).toBeVisible();
    expect(await visibles(page)).toEqual(['La tablée', cas.titre, cas.etat, 'Me prévenir au lancement']);
  });
}

// WCAG 2.4.2 : le titre de l’onglet suit l’état et dit la même chose que le titre de la page (sans son point), pour qui
// passe d’un onglet à l’autre : lien mort, invitation terminée, invitation ouverte, table pleine, panne, attente.
const TITRE_EN_PANNE = 'Une tablée t’attend — Baromatch';
for (const cas of [
  { nom: 'invitation ouverte', reponses: [{ statut: 200, corps: invitation() }], titre: 'Une place t’attend.' },
  { nom: 'lien inconnu (404)', reponses: [{ statut: 404 }], titre: 'Ce lien ne mène à aucune tablée.' },
  { nom: 'code mal formé', chemin: '/t/ABCDEF', reponses: ['coupure'], titre: 'Ce lien ne mène à aucune tablée.' },
  { nom: 'invitation terminée (410)', reponses: [{ statut: 410 }], titre: 'Cette invitation est terminée.' },
  { nom: 'table pleine', reponses: [{ statut: 200, corps: invitation({ open: 0, full: true }) }], titre: 'La table est pleine.' },
  { nom: 'panne (500)', reponses: [{ statut: 500 }], titre: 'Une tablée t’attend.', etat: PANNE },
  { nom: 'attente', reponses: ['silence'], titre: 'Une tablée t’attend.', etat: 'On regarde l’invitation…' },
]) {
  test(`${cas.nom} : le titre de l’onglet est celui de la page`, async ({ page }) => {
    await page.clock.setFixedTime(MAINTENANT);
    await simulerLAPI(page, ...cas.reponses);
    await page.goto(cas.chemin ?? LIEN);
    await expect(page.locator('#tablee-titre')).toHaveText(cas.titre);
    if (cas.etat) await expect(page.locator('#tablee-etat')).toHaveText(cas.etat);
    await expect(page).toHaveTitle(`${cas.titre.replace(/\.$/, '')} — Baromatch`);
  });
}

test('« Réessayer » après une panne : le titre de l’onglet suit l’état qui arrive', async ({ page }) => {
  await ouvrir(page, { statut: 500 }, { statut: 410 });
  await verifierLaPanne(page);
  await expect(page).toHaveTitle(TITRE_EN_PANNE);
  await page.locator('#tablee-reessayer').click();
  await expect(page.locator('#tablee-titre')).toHaveText('Cette invitation est terminée.');
  await expect(page).toHaveTitle('Cette invitation est terminée — Baromatch');
});

test('un code mal formé : « aucune tablée », sans rien demander au serveur', async ({ page }) => {
  await page.clock.setFixedTime(MAINTENANT);
  const demandes = await simulerLAPI(page, { statut: 200, corps: invitation() });
  await page.goto('/t/abc');
  await expect(page.locator('#tablee-titre')).toHaveText('Ce lien ne mène à aucune tablée.');
  expect(await visibles(page)).toEqual(['La tablée', 'Ce lien ne mène à aucune tablée.', 'Il a peut-être changé : demande le nouveau lien à la personne qui t’invite.', 'Me prévenir au lancement']);
  expect(demandes).toHaveLength(0);
});

test('une panne : la définition, « Réessayer » qui ramène au titre, et l’invitation quand le serveur répond', async ({ page }) => {
  const demandes = await ouvrir(page, { statut: 500 }, { statut: 200, corps: invitation() });
  await verifierLaPanne(page);
  await page.locator('#tablee-reessayer').click();
  await expect(page.locator('#tablee-titre')).toHaveText('Une place t’attend.');
  await expect(page.locator('#tablee-titre')).toBeFocused();
  await expect(page.locator('#tablee-carte')).toBeVisible();
  await expect(page.locator('#tablee-reessayer')).toBeHidden();
  expect(demandes).toHaveLength(2);
});

test('une coupure du réseau : la panne, avec « Réessayer »', async ({ page }) => {
  await ouvrir(page, 'coupure');
  await verifierLaPanne(page);
});

for (const cas of [
  { nom: 'sans nom de bar', corps: invitation({ bar: { id: 'bar_x', name: ' ', address: '12 rue Oberkampf' } }) },
  { nom: 'sans nom de match (ni titre, ni équipes, ni clubs)', corps: invitation({ match: match({ title: '', homeTeam: null, awayTeam: null, homeClub: null, awayClub: null }) }) },
  { nom: 'avec une heure illisible', corps: invitation({ kickoffAt: 'bientôt' }) },
  { nom: 'qui n’est pas du JSON', corps: '<html>erreur</html>' },
]) {
  test(`une réponse incomplète (${cas.nom}) : la panne, avec « Réessayer »`, async ({ page }) => {
    await ouvrir(page, { statut: 200, corps: cas.corps });
    await verifierLaPanne(page);
  });
}

for (const sansAbortController of [false, true]) {
  test(`un serveur muet${sansAbortController ? ', sur un navigateur sans AbortController' : ''} : au bout de 8 s, la panne et « Réessayer »`, async ({ page }) => {
    if (sansAbortController) await page.addInitScript(() => { delete window.AbortController; });
    await arreterLHorloge(page);
    await simulerLAPI(page, 'silence');
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(LIEN);
    await expect(page.locator('#tablee-etat')).toHaveText('On regarde l’invitation…');
    await page.clock.runFor(7_900);
    await expect(page.locator('#tablee-etat')).toHaveText('On regarde l’invitation…');
    await page.clock.runFor(100);
    await verifierLaPanne(page);
  });
}

for (const cas of [
  { quand: 'aujourd’hui à 13:30', coup: '2026-10-13T13:30:00+02:00', heure: 'Aujourd’hui, coup d’envoi à 13 h 30' },
  { quand: 'demain à 21:00', coup: '2026-10-14T21:00:00+02:00', heure: 'Demain, coup d’envoi à 21 h' },
  { quand: 'samedi à 13:30', coup: '2026-10-17T13:30:00+02:00', heure: 'Samedi 17 octobre, coup d’envoi à 13 h 30' },
]) {
  test(`l’heure d’un match ${cas.quand} : « ${cas.heure} »`, async ({ page }) => {
    await ouvrir(page, { statut: 200, corps: invitation({ kickoffAt: cas.coup, arrivalTime: null }) });
    await expect(page.locator('#tablee-heure')).toHaveText(cas.heure);
  });
}

// Le passage à l’heure d’été (dimanche 28 mars 2027, 2 h → 3 h) : samedi à 23 h 30, « maintenant + 24 h » tombe lundi
// à 0 h 30. « Demain » se lit dans le calendrier de Paris, pas en ajoutant 24 heures.
for (const cas of [
  { coup: '2027-03-28T21:00:00+02:00', heure: 'Demain, coup d’envoi à 21 h' },
  { coup: '2027-03-29T21:00:00+02:00', heure: 'Lundi 29 mars, coup d’envoi à 21 h' },
]) {
  test(`samedi 27 mars 2027 à 23 h 30, veille du changement d’heure : « ${cas.heure} »`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2027-03-27T23:30:00+01:00'));
    await simulerLAPI(page, { statut: 200, corps: invitation({ kickoffAt: cas.coup, arrivalTime: null }) });
    await page.goto(LIEN);
    await expect(page.locator('#tablee-heure')).toHaveText(cas.heure);
  });
}

for (const ecran of [{ largeur: 360, hauteur: 740 }, { largeur: 1280, hauteur: 800 }]) {
  for (const cas of [{ nom: '', plus: {} }, { nom: ' sans nombre de places', plus: { open: null } }]) {
    test(`à ${ecran.largeur} px, l’invitation${cas.nom} qui arrive après une demi-seconde ne fait pas sauter la page`, async ({ page }) => {
      await page.clock.setFixedTime(MAINTENANT);
      await simulerLAPI(page, { statut: 200, corps: invitation(cas.plus), delai: 500 });
      await page.setViewportSize({ width: ecran.largeur, height: ecran.hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(LIEN);
      await expect(page.locator('#tablee-carte')).toBeVisible();
      const decalage = await page.evaluate(() => new Promise((resoudre) => {
        let total = 0;
        new PerformanceObserver((liste) => {
          for (const entree of liste.getEntries()) if (!entree.hadRecentInput) total += entree.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resoudre(total), 300);
      }));
      expect(decalage).toBeLessThanOrEqual(0.01);
    });
  }
}

// Sans nombre de places dans la réponse, la phrase d’état reste vide : elle ne laisse pas de ligne blanche sous le titre
// (sa ligne n’est gardée que tant que tablee.js n’a pas tourné).
test('une invitation ouverte sans nombre de places : pas de ligne vide sous le titre', async ({ page }) => {
  await ouvrir(page, { statut: 200, corps: invitation({ open: null }) });
  await expect(page.locator('#tablee-titre')).toHaveText('Une place t’attend.');
  await expect(page.locator('#tablee-carte')).toBeVisible();
  await expect(page.locator('#tablee-etat')).toBeHidden();
});

test('si tablee.js ne se charge pas, la page ne reste pas sur « On regarde l’invitation… » : « Me prévenir au lancement » est là', async ({ page }) => {
  await page.route('**/tablee.js', (route) => route.abort());
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(LIEN);
  await expect(page.locator('#tablee-titre')).toHaveText('Une tablée t’attend.');
  await expect(page.locator('#tablee-appli .tablee__bouton')).toBeVisible();
  await expect(page.locator('#tablee-appli .tablee__bouton')).toHaveText('Me prévenir au lancement');
  expect((await visibles(page)).join(' ')).not.toContain('On regarde l’invitation');
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le lien d’une tablée dit ce qu’il faut faire, au lieu de seulement « page introuvable »', async ({ page }) => {
    await page.goto(LIEN);
    const aide = page.locator('.perdu__sans-js');
    await expect(aide).toBeVisible();
    await expect(aide).toHaveText('Tu as ouvert le lien d’une tablée ? Il faut JavaScript pour afficher l’invitation. Sans lui, demande le bar et l’heure à la personne qui t’invite.');
    await expect(page.locator('a', { hasText: 'Revenir à l’accueil' })).toBeVisible();
  });
});

test('une vraie page introuvable montre « Cette page n’existe pas. », sans rien de la tablée', async ({ page }) => {
  await page.goto('/nimporte-quoi.html');
  await expect(page.locator('h1:visible')).toHaveText('Cette page n’existe pas.');
  await expect(page.locator('a', { hasText: 'Revenir à l’accueil' })).toBeVisible();
  await expect(page.locator('#tablee')).toBeHidden();
  expect(await page.title()).toBe('Page introuvable — Baromatch');
});

for (const chemin of ['/nimporte-quoi.html', LIEN]) {
  test(`${chemin} sur un téléphone court : le verre garde sa taille et sa marge (le réglage de l’accueil ne le touche pas)`, async ({ page }) => {
    await simulerLAPI(page, 'coupure');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(chemin);
    const verre = await page.locator('.perdu .verre').evaluate((e) => {
      const s = getComputedStyle(e);
      return { largeur: s.width, hauteur: s.height, marge: s.marginBottom };
    });
    expect(verre).toEqual({ largeur: '140px', hauteur: '140px', marge: '28px' });
  });
}

// GET /api/tablee/:code répond lui-même « Cache-Control: no-store » : la page ne le redemande pas. Un mode de cache
// ajouterait des en-têtes que le pré-vol CORS peut refuser ; la demande part sans cookie ni mode de cache.
test('la demande au serveur ne force pas son propre cache et part sans cookie', async ({ page }) => {
  await page.addInitScript(() => {
    window.__options = [];
    const fetchDOrigine = window.fetch;
    window.fetch = function (adresse, options) {
      window.__options.push({ adresse: String(adresse), ...options, signal: undefined });
      return fetchDOrigine.apply(this, arguments);
    };
  });
  await ouvrir(page, { statut: 200, corps: invitation() });
  await expect(page.locator('#tablee-carte')).toBeVisible();
  const options = await page.evaluate(() => window.__options);
  expect(options).toHaveLength(1);
  expect(options[0].adresse).toBe('https://api-production-8ce4.up.railway.app/api/tablee/abcdefghjkmn');
  expect(options[0].cache).toBeUndefined();
  expect(options[0].credentials).toBe('omit');
  expect(Object.keys(options[0].headers ?? {})).toEqual(['Accept']);
});

test.describe('une seule adresse : https://baromatch.fr', () => {
  // Les adresses du site, servies ici par le serveur local (404.html pour /t/…, avec son statut 404).
  async function servirLeSite(page, baseURL) {
    const pages = [];
    page.on('framenavigated', (cadre) => { if (cadre === page.mainFrame()) pages.push(cadre.url()); });
    await page.route(/^https?:\/\/(www\.)?baromatch\.fr\//, async (route) => {
      const url = new URL(route.request().url());
      try {
        const locale = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
        await route.fulfill({ response: locale });
      } catch (erreur) {
        // La page renvoyée est déjà partie (location.replace) : ce qu’elle demandait n’a plus personne à qui répondre.
        if (!/disposed|closed|already handled/i.test(erreur.message)) throw erreur;
      }
    });
    return pages;
  }

  for (const depart of ['https://www.baromatch.fr', 'http://baromatch.fr', 'http://www.baromatch.fr']) {
    test(`depuis ${depart}, le lien renvoie aussitôt vers https://baromatch.fr, même chemin, et l’invitation s’affiche`, async ({ page, baseURL }) => {
      await page.clock.setFixedTime(MAINTENANT);
      const demandes = await simulerLAPI(page, { statut: 200, corps: invitation() });
      const pages = await servirLeSite(page, baseURL);
      await page.goto(`${depart}${LIEN}?depuis=whatsapp#invitation`);
      await page.waitForURL(`https://baromatch.fr${LIEN}?depuis=whatsapp#invitation`);
      await expect(page.locator('#tablee-carte')).toBeVisible();
      expect(pages).toEqual([`${depart}${LIEN}?depuis=whatsapp#invitation`, `https://baromatch.fr${LIEN}?depuis=whatsapp#invitation`]);
      const origines = await Promise.all(demandes.map(async (d) => (await d.allHeaders()).origin));
      expect(origines).toEqual(['https://baromatch.fr']);
    });
  }

  test('sur https://baromatch.fr, la page reste où elle est', async ({ page, baseURL }) => {
    await page.clock.setFixedTime(MAINTENANT);
    await simulerLAPI(page, { statut: 200, corps: invitation() });
    const pages = await servirLeSite(page, baseURL);
    await page.goto(`https://baromatch.fr${LIEN}`);
    await expect(page.locator('#tablee-carte')).toBeVisible();
    expect(pages).toEqual([`https://baromatch.fr${LIEN}`]);
  });
});
