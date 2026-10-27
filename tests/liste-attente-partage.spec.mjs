// Après l’inscription d’un fan à la liste d’attente de l’accueil, et seulement après : « Partager Baromatch », et la
// page des bars à envoyer à son bar (« Ton bar préféré n’est pas sur Baromatch ? Envoie-lui la page Pour les bars »).
// Rien avant l’envoi, pendant l’envoi, sur une erreur, ni quand on corrige l’adresse (jusqu’à la nouvelle inscription).
// Le bouton « Partager » du téléphone (navigator.share) reçoit l’adresse nue de la page, sans aucun paramètre ; sans
// lui, l’adresse est copiée et la zone de statut le dit ; si la copie est refusée, l’adresse s’affiche en lien,
// sélectionnée. Rien ne part sur le réseau : ni le partage, ni la copie. Deux boutons de verre (l’ambre reste à « Me
// prévenir »), de 44 px au moins, au clavier, sans violation axe.
import { test, expect } from '@playwright/test';
import { violationsAxe } from './outils/axe.mjs';
import { simulerFormspree } from './outils/formspree.mjs';

const ACCUEIL = 'https://baromatch.fr/';
const BARS = 'https://baromatch.fr/pour-les-bars.html';
const PARTAGER = 'Partager Baromatch';
// La phrase des bars : la question, puis l’action. toHaveText ramène l’espace insécable à une espace simple.
const QUESTION = 'Ton bar préféré n’est pas sur Baromatch ?';
const ENVOYER = 'Envoie-lui la page Pour les bars';
const PHRASE_DES_BARS = `${QUESTION} ${ENVOYER}`;
const COPIE = 'Lien copié.';
const ECHEC = 'Copie impossible : appuie longtemps sur le lien pour le copier.';
const INSCRITE = 'C’est noté : on t’écrit à paul@exemple.fr au lancement et pour les premiers tests.';
const AMBRE = 'rgb(255, 177, 61)';

const bloc = (page) => page.locator('#attente-partage');
const partager = (page) => page.getByRole('button', { name: PARTAGER, exact: true });
const envoyer = (page) => page.locator('#attente-partage-bars');
const statut = (page) => page.locator('#attente-partage-statut');
const retour = (page) => page.locator('#attente-retour');
const champ = (page) => page.locator('#attente-mail');
const bouton = (page) => page.locator('#attente button[type="submit"]');

const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();

// Le bouton « Partager » du téléphone, simulé : chaque appel est gardé ; il partage, ou il est refusé comme le test le
// dit (AbortError : fermé sans partager ; NotAllowedError : refusé par le navigateur).
const simulerLePartage = (page, refus = '') => page.addInitScript((nom) => {
  window.__partages = [];
  Object.defineProperty(Navigator.prototype, 'share', {
    configurable: true,
    writable: true,
    value(donnees) {
      window.__partages.push(JSON.parse(JSON.stringify(donnees)));
      return nom ? Promise.reject(new DOMException('refusé', nom)) : Promise.resolve();
    },
  });
}, refus);

// Un navigateur sans le bouton « Partager » du téléphone (un ordinateur, souvent).
const sansLePartage = (page) => page.addInitScript(() => {
  delete Navigator.prototype.share;
  delete navigator.share;
});

// Le presse-papiers, simulé : chaque copie est gardée. 'accepte', 'refuse' (la permission manque), ou 'absent' (pas
// d’API, comme hors https).
const simulerLePressePapiers = (page, comportement = 'accepte') => page.addInitScript((mode) => {
  window.__copies = [];
  const pressePapiers = mode === 'absent' ? undefined : {
    writeText(texte) {
      window.__copies.push(texte);
      return mode === 'accepte' ? Promise.resolve() : Promise.reject(new DOMException('refusé', 'NotAllowedError'));
    },
  };
  Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => pressePapiers });
}, comportement);

const partages = (page) => page.evaluate(() => window.__partages ?? []);
const copies = (page) => page.evaluate(() => window.__copies ?? []);

// L’accueil ouvert et fini (plus rien ne se charge), puis une inscription réussie, envoyée au clavier comme un fan.
const sInscrire = async (page, { largeur = 360 } = {}) => {
  await simulerFormspree(page);
  await page.setViewportSize({ width: largeur, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(bloc(page)).toBeHidden();
  await champ(page).fill('paul@exemple.fr');
  await bouton(page).focus();
  await page.keyboard.press('Enter');
  await expect(retour(page)).toHaveText(INSCRITE);
};

// Ce qui part sur le réseau à partir de maintenant.
const ecouterLeReseau = (page) => {
  const requetes = [];
  page.on('request', (requete) => requetes.push(requete.url()));
  return requetes;
};

for (const largeur of [360, 1280]) {
  test(`à ${largeur} px : après l’inscription, « ${PARTAGER} » et la page des bars, en verre, de 44 px, au clavier, sans violation axe`, async ({ page }) => {
    await sInscrire(page, { largeur });
    await expect(bloc(page)).toBeVisible();
    // Les deux phrases, mot pour mot, dans cet ordre ; l’apostrophe typographique et l’espace insécable avant « ? ».
    expect(normaliser(await bloc(page).innerText())).toBe(`${PARTAGER} ${PHRASE_DES_BARS}`);
    expect(await page.locator('#attente-partage-question').textContent()).toBe('Ton bar préféré n’est pas sur Baromatch ?');
    await expect(partager(page)).toBeVisible();
    await expect(envoyer(page)).toHaveText(ENVOYER);
    // L’action des bars se nomme par la phrase entière : la question, puis ce que fait le bouton.
    await expect(envoyer(page)).toHaveAccessibleName(PHRASE_DES_BARS);
    for (const action of [partager(page), envoyer(page)]) {
      await expect(action).toHaveAttribute('type', 'button');
      const lu = await action.evaluate((e) => {
        const s = getComputedStyle(e);
        return { hauteur: e.getBoundingClientRect().height, fond: s.backgroundColor, police: s.fontFamily, droite: e.getBoundingClientRect().right };
      });
      expect(lu.hauteur).toBeGreaterThanOrEqual(44);
      expect(lu.fond, 'du verre, pas l’ambre de « Me prévenir »').not.toBe(AMBRE);
      expect(lu.police).toMatch(/^"Bricolage Grotesque"/);
      expect(lu.droite).toBeLessThanOrEqual(largeur);
    }
    // Le focus reste sur le bouton de l’inscription (le message est dit par la zone de statut, comme avant) ; au
    // clavier, « Corriger l’adresse », puis les deux actions, chacune avec le contour du site.
    await expect(bouton(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#attente-corriger')).toBeFocused();
    for (const action of [partager(page), envoyer(page)]) {
      await page.keyboard.press('Tab');
      await expect(action).toBeFocused();
      expect(await action.evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).outlineWidth])).toEqual(['solid', '2px']);
    }
    expect(await violationsAxe(page)).toEqual([]);
  });
}

// Le texte agrandi (WCAG 1.4.4 et 1.4.10) : sur 320 px, la phrase des bars passe sur deux lignes, et sur plus encore
// à 200 % ; chaque capsule garde de l’air autour de son texte (12 px au moins, en haut et en bas), et rien ne sort de
// l’écran.
for (const taille of [100, 200]) {
  test(`à 320 px, texte à ${taille} % : les capsules du partage gardent de l’air autour du texte, rien ne sort de l’écran`, async ({ page }) => {
    await sInscrire(page, { largeur: 320 });
    await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, taille);
    for (const action of [partager(page), envoyer(page)]) {
      const lu = await action.evaluate((e) => {
        const plage = document.createRange();
        plage.selectNodeContents(e);
        const texte = plage.getBoundingClientRect();
        const boite = e.getBoundingClientRect();
        return {
          haut: texte.top - boite.top,
          bas: boite.bottom - texte.bottom,
          dedans: boite.left >= 0 && boite.right <= document.documentElement.clientWidth,
        };
      });
      expect(lu.haut, `${await action.textContent()} : en haut`).toBeGreaterThanOrEqual(12);
      expect(lu.bas, `${await action.textContent()} : en bas`).toBeGreaterThanOrEqual(12);
      expect(lu.dedans).toBe(true);
    }
    const lignes = await envoyer(page).evaluate((e) => {
      const plage = document.createRange();
      plage.selectNodeContents(e);
      return new Set([...plage.getClientRects()].map((r) => Math.round(r.top))).size;
    });
    expect(lignes).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}

test('le bouton « Partager » du téléphone reçoit les adresses nues, sans paramètre, et rien ne part sur le réseau', async ({ page }) => {
  await simulerLePartage(page);
  await simulerLePressePapiers(page);
  await sInscrire(page);
  const requetes = ecouterLeReseau(page);
  await partager(page).click();
  await expect.poll(() => partages(page)).toHaveLength(1);
  await envoyer(page).press('Enter');
  await expect.poll(() => partages(page)).toHaveLength(2);
  const [baromatch, bars] = await partages(page);
  expect(baromatch).toEqual({ title: 'Baromatch — Trouve un bar qui diffuse ton match, à Paris', text: 'Ton match. Ton bar. Ce soir.', url: ACCUEIL });
  expect(bars).toEqual({ title: 'Les soirs de match, ton bar sur Baromatch — Pour les bars', text: 'Les soirs de match, ton bar sur Baromatch.', url: BARS });
  for (const { url } of [baromatch, bars]) {
    const adresse = new URL(url);
    expect([adresse.search, adresse.hash, adresse.username, adresse.password]).toEqual(['', '', '', '']);
  }
  // Partagé par le téléphone : rien à copier, rien à dire.
  expect(await copies(page)).toEqual([]);
  await expect(statut(page)).toBeEmpty();
  expect(requetes).toEqual([]);
});

test('sans le bouton du téléphone : l’adresse nue est copiée, et « Lien copié. » est dit poliment, sans rien envoyer', async ({ page }) => {
  await sansLePartage(page);
  await simulerLePressePapiers(page);
  await sInscrire(page);
  const requetes = ecouterLeReseau(page);
  await expect(statut(page)).toHaveAttribute('role', 'status');
  await expect(statut(page)).toHaveAttribute('aria-live', 'polite');
  await partager(page).click();
  await expect(statut(page)).toHaveText(COPIE);
  expect(await copies(page)).toEqual([ACCUEIL]);
  await envoyer(page).click();
  await expect.poll(() => copies(page)).toEqual([ACCUEIL, BARS]);
  await expect(statut(page)).toHaveText(COPIE);
  // Copié : l’adresse n’a pas à s’afficher.
  await expect(statut(page).locator('a')).toHaveCount(0);
  // Le message de l’inscription reste, avec l’adresse à vérifier.
  await expect(retour(page)).toHaveText(INSCRITE);
  expect(requetes).toEqual([]);
});

for (const [nom, presse] of [['refusée par le navigateur', 'refuse'], ['impossible (pas de presse-papiers)', 'absent']]) {
  test(`la copie ${nom} : l’adresse s’affiche en lien, sélectionnée, avec de quoi la copier à la main`, async ({ page }) => {
    await sansLePartage(page);
    await simulerLePressePapiers(page, presse);
    await sInscrire(page);
    const requetes = ecouterLeReseau(page);
    await envoyer(page).click();
    await expect(statut(page)).toHaveText(`${ECHEC} baromatch.fr/pour-les-bars.html`);
    const lien = statut(page).locator('a');
    await expect(lien).toHaveAttribute('href', BARS);
    await expect(lien).toHaveText('baromatch.fr/pour-les-bars.html');
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('baromatch.fr/pour-les-bars.html');
    expect(await violationsAxe(page)).toEqual([]);
    // L’autre bouton : son adresse remplace la première.
    await partager(page).click();
    await expect(statut(page)).toHaveText(`${ECHEC} baromatch.fr/`);
    await expect(statut(page).locator('a')).toHaveCount(1);
    await expect(statut(page).locator('a')).toHaveAttribute('href', ACCUEIL);
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('baromatch.fr/');
    expect(await copies(page)).toEqual(presse === 'refuse' ? [BARS, ACCUEIL] : []);
    expect(requetes).toEqual([]);
  });
}

test('le partage du téléphone refusé par le navigateur : la copie prend le relais', async ({ page }) => {
  await simulerLePartage(page, 'NotAllowedError');
  await simulerLePressePapiers(page);
  await sInscrire(page);
  await envoyer(page).click();
  await expect(statut(page)).toHaveText(COPIE);
  expect(await partages(page)).toHaveLength(1);
  expect(await copies(page)).toEqual([BARS]);
});

test('le partage du téléphone fermé sans partager : rien n’est copié, rien n’est dit', async ({ page }) => {
  await simulerLePartage(page, 'AbortError');
  await simulerLePressePapiers(page);
  await sInscrire(page);
  await partager(page).click();
  await expect.poll(() => partages(page)).toHaveLength(1);
  // Le temps que le refus du partage revienne à la page.
  await page.evaluate(() => new Promise((suite) => { setTimeout(suite, 50); }));
  expect(await copies(page)).toEqual([]);
  await expect(statut(page)).toBeEmpty();
});

// Rien tant que l’inscription n’est pas faite : une adresse refusée (par la page ou par le service d’envoi), une panne,
// une coupure, pendant l’envoi ; ni quand la page ouvre la messagerie (le formulaire pas encore branché : rien ne dit
// que le mail partira).
for (const cas of [
  { nom: 'une adresse incomplète', adresse: 'paul@exemple', reponse: 200, message: 'Il manque la fin de ton adresse, par exemple .fr ou .com.' },
  { nom: 'une adresse refusée par le service', reponse: 422, message: /Cette adresse ne semble pas valide/ },
  { nom: 'une panne du service', reponse: 500, message: /L’inscription n’est pas passée/ },
  { nom: 'une coupure du réseau', reponse: 'coupure', message: /L’inscription n’est pas passée/ },
  { nom: 'l’envoi en cours', reponse: 'silence', message: 'Envoi…' },
  { nom: 'la messagerie qui s’ouvre', reponse: 200, sansEnvoi: true, message: 'Ta messagerie s’ouvre : envoie le mail et on te préviendra au lancement.' },
]) {
  test(`${cas.nom} : ni « ${PARTAGER} » ni la page des bars`, async ({ page }) => {
    await simulerFormspree(page, cas.reponse);
    await page.goto('/');
    await expect(bloc(page)).toBeHidden();
    if (cas.sansEnvoi) await page.locator('#attente').evaluate((f) => f.removeAttribute('action'));
    await champ(page).fill(cas.adresse ?? 'paul@exemple.fr');
    await bouton(page).click();
    await expect(retour(page)).toHaveText(cas.message);
    await expect(bloc(page)).toBeHidden();
    await expect(partager(page)).toHaveCount(0);
  });
}

test('corriger l’adresse, taper dans le champ ou changer de ville les retire ; la nouvelle inscription les ramène, sans l’ancienne réponse', async ({ page }) => {
  await sansLePartage(page);
  await simulerLePressePapiers(page);
  await sInscrire(page);
  await partager(page).click();
  await expect(statut(page)).toHaveText(COPIE);

  await page.locator('#attente-corriger').click();
  await expect(bloc(page)).toBeHidden();
  await expect(champ(page)).toBeFocused();
  await champ(page).fill('paul@exemple.com');
  await bouton(page).click();
  await expect(retour(page)).toHaveText('C’est noté : on t’écrit à paul@exemple.com au lancement et pour les premiers tests.');
  await expect(bloc(page)).toBeVisible();
  await expect(statut(page)).toBeEmpty();

  await champ(page).press('End');
  await champ(page).pressSequentially('x');
  await expect(bouton(page)).toHaveText('Me prévenir');
  await expect(bloc(page)).toBeHidden();
  await champ(page).fill('paul@exemple.com');
  await bouton(page).click();
  await expect(bloc(page)).toBeVisible();

  await page.getByRole('radio', { name: 'Lyon' }).check();
  await expect(bouton(page)).toHaveText('Me prévenir');
  await expect(bloc(page)).toBeHidden();
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('rien de tout ça : le formulaire part vers le service d’envoi, qui répond lui-même', async ({ page }) => {
    await page.goto('/');
    await expect(bloc(page)).toBeHidden();
    await expect(page.getByRole('button', { name: PARTAGER })).toHaveCount(0);
  });
});
