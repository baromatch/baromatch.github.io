// L’accueil : « Le prochain match » (generateur/accueil.mjs, main.js) et le téléphone de démo. Ce qu’on vérifie :
// - le choix du match : le premier qui n’a pas commencé, jamais celui qui se joue, jamais un match reporté ou sans heure ;
// - un soir sans match, ou quand tous ont commencé : le prochain à venir, dit honnêtement (« demain », la date) ;
// - le bouton ne promet aucun bar, et la réponse sans bar dit « Aucun bar encore pour ce match » avec trois gestes qui
//   existent : deux messages WhatsApp (celui des potes porte le lien de la page du match), l’agenda, « Préviens-moi » ;
// - le compte à rebours à la minute, silencieux pour un lecteur d’écran ;
// - le geste du téléphone de démo : « Démo », trois tours puis l’arrêt, une pause, le maintien au doigt, à la souris et à
//   la barre d’espace, l’image fixe de la fin avec « réduire les animations » et sans JavaScript ;
// - rien n’est gardé sur l’appareil du visiteur : le site ne retient pas son club.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { accueilAvecLaSemaine, blocDeLaSemaine, controlerLaSemaine, lumiereDe, matchsDeLAccueil } from '../generateur/accueil.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { racine } from './outils/environnement.mjs';
import { violationsAxe } from './outils/axe.mjs';
import { arreterLHorloge } from './outils/horloge.mjs';
import { decrireLesPlusFaibles, lignesTropFaibles, mesurerAuPixel } from './outils/pixels-peints.mjs';

const CONTENU = chargerLeContenu(racine);
const { textes } = CONTENU;
const ACCUEIL = readFileSync(path.join(racine, 'index.html'), 'utf8');
const MAIN = readFileSync(path.join(racine, 'main.js'), 'utf8');
const H = 3_600_000;

const club = (cle, court, slug) => ({ cle, court, nom: court, slug });
const unMatch = ({ slug, debut, domicile, exterieur, competition = 'Ligue 1', soirees = [], statut = null, heureConfirmee = true }) => ({
  slug, ids: [slug], debut: Date.parse(debut), heureConfirmee, statut, competition, domicile, exterieur, soirees,
});
const soiree = (ville) => ({ bar: { ville: { nom: ville } } });
// Mercredi 25 novembre 2026, 19 h à Paris (18 h UTC) : deux matchs ce soir, un demain, un samedi.
const MERCREDI = Date.parse('2026-11-25T18:00:00Z');
const PSG_ROME = unMatch({ slug: 'psg-rome-2026-11-25', debut: '2026-11-25T20:00:00Z', domicile: club('psg', 'PSG', 'paris-saint-germain-fc'), exterieur: club('rome', 'Rome', 'as-roma'), competition: 'Ligue des champions' });
const LILLE_BAYERN = unMatch({ slug: 'lille-bayern-2026-11-25', debut: '2026-11-25T20:00:00Z', domicile: club('lille', 'Lille'), exterieur: club('bayern', 'Bayern'), competition: 'Ligue des champions' });
const TOT_SABAH = unMatch({ slug: 'sabah-barca-2026-11-25', debut: '2026-11-25T17:45:00Z', domicile: club('sabah', 'Sabah'), exterieur: club('barca', 'Barça'), competition: 'Ligue des champions' });
const DEMAIN = unMatch({ slug: 'lens-nice-2026-11-26', debut: '2026-11-26T19:45:00Z', domicile: club('lens', 'Lens'), exterieur: club('nice', 'Nice') });
const SAMEDI = unMatch({ slug: 'ol-om-2026-11-28', debut: '2026-11-28T19:45:00Z', domicile: club('ol', 'OL'), exterieur: club('om', 'OM'), soirees: [soiree('Paris'), soiree('Paris')] });
const REPORTE = unMatch({ slug: 'angers-lorient-2026-11-25', debut: '2026-11-25T19:00:00Z', domicile: club('angers', 'Angers'), exterieur: club('lorient', 'Lorient'), statut: 'reporte' });
const SANS_HEURE = unMatch({ slug: 'brest-metz-2026-11-25', debut: '2026-11-25T19:30:00Z', domicile: club('brest', 'Brest'), exterieur: club('metz', 'Metz'), heureConfirmee: false });
const TOUS = [TOT_SABAH, PSG_ROME, LILLE_BAYERN, REPORTE, SANS_HEURE, DEMAIN, SAMEDI];
const bloc = ({ matchs = TOUS, bars = [], maintenant = MERCREDI } = {}) => blocDeLaSemaine({ donnees: { matchs, bars }, textes, maintenant });
const texteDe = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/[ \n]+/g, ' ').trim();

test.describe('le choix du match, du générateur', () => {
  test('le premier match qui n’a pas commencé ; jamais celui qui se joue, ni un match reporté, ni un match sans heure', () => {
    // 19 h 30 à Paris : Sabah – Barça (18 h 45) se joue, PSG – Rome (21 h) est le prochain.
    const choisis = matchsDeLAccueil({ matchs: TOUS }, Date.parse('2026-11-25T18:30:00Z'));
    expect(choisis.map((m) => m.slug)).toEqual(['psg-rome-2026-11-25', 'lille-bayern-2026-11-25', 'lens-nice-2026-11-26', 'ol-om-2026-11-28']);
    const html = bloc({ maintenant: Date.parse('2026-11-25T18:30:00Z') });
    expect(html).toContain('data-coup="2026-11-25T21:00:00+01:00"');
    expect(html).toContain('href="/matchs/psg-rome-2026-11-25/"');
    // Sabah – Barça se joue : il n’est pas la carte, il est dans la bande, « en cours ».
    expect(texteDe(html.match(/<h3 class="coup__titre" data-mot="\d+">([\s\S]*?)<\/h3>/)[1])).toBe('PSG – Rome');
    expect(html).toMatch(/<a class="puce" href="\/matchs\/sabah-barca-2026-11-25\/">[^]*?<span class="puce__en-cours">en cours<\/span>/);
  });

  test('tous les matchs du soir ont commencé : le prochain est celui de demain, dit « demain » ; « Pas de match ce soir. » seulement quand rien ne se joue', () => {
    const html = bloc({ maintenant: Date.parse('2026-11-25T20:30:00Z') });
    expect(html).toContain('data-coup="2026-11-26T20:45:00+01:00"');
    expect(html).toContain('· demain');
    expect(html).toContain('Demain, 20:45');
    // PSG – Rome se joue encore (trois heures) : ce n’est pas un soir sans match.
    expect(html).toContain('data-pas-de-match hidden>');
  });

  test('un jour sans aucun match : le prochain est demain, et la carte le dit (« Pas de match ce soir. »)', () => {
    const html = bloc({ matchs: [DEMAIN], maintenant: Date.parse('2026-11-25T08:00:00Z') });
    expect(html).toContain('· demain');
    expect(html).toMatch(/<p class="coup__nuit" data-pas-de-match>Pas de match ce soir\./);
  });

  test('un soir sans match, le samedi : la date en toutes lettres, pas un « ce soir »', () => {
    const jeudi = Date.parse('2026-11-26T20:00:00Z');
    const html = bloc({ matchs: [SAMEDI], maintenant: jeudi });
    expect(html).toContain('· samedi 28 novembre');
    expect(html).toContain('Samedi 28 novembre, 20:45');
    expect(html).not.toContain('ce soir</span>');
    expect(html).toMatch(/<p class="coup__nuit" data-pas-de-match>/);
  });

  test('aucun match à venir : une phrase honnête et la semaine, sans carte', () => {
    const html = bloc({ matchs: [PSG_ROME], maintenant: Date.parse('2026-11-26T08:00:00Z') });
    expect(html).not.toContain('class="coup"');
    expect(texteDe(html)).toContain(textes.accueil.rien);
    expect(controlerLaSemaine(html)).toEqual([]);
  });

  test('la lumière d’un club garde le texte blanc lisible, même pour un club blanc ou noir', () => {
    const luminance = (hex) => {
      const [r, v, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * v + 0.0722 * b;
    };
    for (const c of [club('psg', 'PSG', 'paris-saint-germain-fc'), club('stuttgart', 'Stuttgart', 'vfb-stuttgart'), club('angers', 'Angers', 'angers-sco'), club('inconnu', 'Inconnu', 'club-inconnu'), club('nt-fr', 'France', 'nt-fr')]) {
      const lumiere = lumiereDe(c);
      expect(lumiere, c.cle).toMatch(/^#[0-9A-F]{6}$/);
      // Le texte blanc (luminance 1) sur cette couleur : au moins 4,5:1.
      expect(1.05 / (luminance(lumiere) + 0.05), c.cle).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('la carte et sa réponse, du générateur', () => {
  test('le bouton dit « Que faire pour ce match » et ne promet aucun bar', () => {
    const html = bloc();
    const bouton = html.match(/<summary class="capsule faire__bouton">(.*?)<\/summary>/)[1];
    expect(texteDe(bouton)).toMatch(/^Que faire pour ce match/);
    expect(bouton).not.toMatch(/bar|réserv|trouve/i);
    expect(controlerLaSemaine(html)).toEqual([]);
  });

  test('sans bar publié : « Aucun bar encore pour ce match. », deux messages, l’agenda, « Préviens-moi » sur une ligne', () => {
    const html = bloc();
    expect(html).toContain('data-faire-titre>Aucun bar encore pour ce match.</p>');
    expect(html).toContain('data-message="amis"');
    expect(html).toContain('data-message="bar"');
    expect(html).toContain('href="/matchs/psg-rome-2026-11-25/match.ics"');
    expect(html).toMatch(/<form class="prevenir attente" id="attente-carte" action="https:\/\/formspree\.io\/f\/mqpeedoj" method="POST" data-attente/);
    expect(html).toContain('name="ville" value="Paris"');
  });

  test('le message aux potes porte le lien de la page du match, celui du bar le lien de « Pour les bars » ; chaque bouton ouvre WhatsApp avec ce texte', () => {
    const html = bloc({ maintenant: Date.parse('2026-11-25T18:30:00Z') });
    const champ = (cle) => html.match(new RegExp(`data-message="${cle}"[^>]*>([^<]*)</textarea>`))[1].replace(/&amp;/g, '&');
    const amis = champ('amis');
    expect(amis).toContain('https://baromatch.fr/matchs/psg-rome-2026-11-25/');
    expect(amis).toContain('PSG – Rome');
    expect(amis).toContain('ce soir à 21:00');
    expect(champ('bar')).toContain('https://baromatch.fr/pour-les-bars.html');
    for (const cle of ['amis', 'bar']) {
      const lien = html.match(new RegExp(`data-wa="${cle}" href="(https://wa\\.me/\\?text=[^"]+)"`))[1];
      expect(decodeURIComponent(lien.split('text=')[1])).toBe(champ(cle));
    }
  });

  test('avec des bars qui le diffusent : leur nombre, « Voir les bars », et le même bouton', () => {
    const html = bloc({ matchs: [SAMEDI], maintenant: Date.parse('2026-11-28T09:00:00Z') });
    expect(texteDe(html)).toContain('2 bars à Paris diffusent ce match.');
    expect(html).toContain('href="/matchs/ol-om-2026-11-28/#titre-bars"');
    expect(html).toContain('Que faire pour ce match');
    expect(html).not.toContain('Aucun bar encore pour ce match.</p>');
  });

  test('les insignes viennent de generateur/insigne.mjs : une planche de symboles, jamais une image', () => {
    const html = bloc();
    expect(html).toContain('<symbol id="d-psg"');
    expect(html).toContain('<symbol id="p-lille"');
    expect(html).toContain('<use href="#d-psg"/>');
    expect(html).not.toMatch(/<img\b/);
  });

  test('le bloc ne garde rien sur l’appareil, et le script non plus', () => {
    expect(MAIN).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    expect(accueilAvecLaSemaine(ACCUEIL, bloc())).toContain('id="donnees-ce-soir"');
  });
});

// L’accueil de la page, avec le bloc du passage « maintenant » (le script le reprend à l’heure de lecture).
const ouvrirLAccueil = async (page, { maintenant = MERCREDI, matchs = TOUS, bars = [], instant = maintenant } = {}) => {
  const html = accueilAvecLaSemaine(ACCUEIL, bloc({ matchs, bars, maintenant }));
  await page.route((adresse) => adresse.pathname === '/', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await arreterLHorloge(page, instant);
  await page.goto('/');
};

test.describe('le prochain match, lu à l’heure du visiteur', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('à 19 h : PSG – Rome dans 1 h, compté à la minute, en silence pour un lecteur d’écran', async ({ page }) => {
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    await expect(page.locator('.coup__titre')).toContainText('PSG');
    const dans = page.locator('[data-dans]');
    await expect(dans).toHaveText('dans 1 h 30');
    // Silencieux : ni région annoncée, ni texte lu à chaque minute.
    await expect(dans).toHaveAttribute('aria-hidden', 'true');
    expect(await dans.evaluate((e) => e.closest('[aria-live], [role="status"], [role="timer"], [role="alert"]'))).toBeNull();
    await page.clock.runFor(60_000 * 5);
    await expect(dans).toHaveText('dans 1 h 25');
    await expect(page.locator('.coup__heure')).toContainText('Ce soir, 21:00');
  });

  test('à 21 h 10 : PSG – Rome a commencé, le prochain est celui de demain ; celui qui se joue passe dans la bande, « en cours »', async ({ page }) => {
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T19:50:00Z') });
    await expect(page.locator('.coup__titre')).toContainText('PSG');
    await page.clock.runFor(30 * 60_000);
    await expect(page.locator('.coup__titre')).toContainText('Lens');
    await expect(page.locator('.prochain__etiquette')).toContainText('· demain');
    await expect(page.locator('[data-pas-de-match]')).toBeHidden();
    const bande = page.locator('[data-bande-liste] .puce');
    await expect(bande.filter({ hasText: 'PSG' })).toContainText('en cours');
  });

  test('tous les matchs ont commencé et plus rien demain : la date du prochain, sans « Pas de match ce soir. » tant qu’un match se joue', async ({ page }) => {
    await ouvrirLAccueil(page, { matchs: [PSG_ROME, SAMEDI], instant: Date.parse('2026-11-25T19:50:00Z') });
    await page.clock.runFor(30 * 60_000);
    await expect(page.locator('.coup__titre')).toContainText('OL');
    await expect(page.locator('.prochain__etiquette')).toContainText('· samedi 28 novembre');
    await expect(page.locator('.coup__heure')).toContainText('Samedi 28 novembre, 20:45');
    await expect(page.locator('[data-pas-de-match]')).toBeHidden();
  });

  test('la bande montre les autres matchs du même jour, vers leur page', async ({ page }) => {
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    const bande = page.locator('[data-bande-liste] .puce');
    await expect(bande).toHaveCount(1);
    await expect(bande.first()).toContainText('Lille – Bayern');
    await expect(bande.first()).toHaveAttribute('href', '/matchs/lille-bayern-2026-11-25/');
    expect(await bande.first().evaluate((a) => a.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  });

  test('« Que faire pour ce match » ouvre la réponse honnête ; les messages s’écrivent et suivent WhatsApp', async ({ page }) => {
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    await expect(page.locator('.faire__corps')).toBeHidden();
    await page.locator('.faire__bouton').click();
    await expect(page.locator('.faire__titre')).toHaveText('Aucun bar encore pour ce match.');
    const amis = page.locator('[data-message="amis"]');
    await expect(amis).toHaveValue(/https:\/\/baromatch\.fr\/matchs\/psg-rome-2026-11-25\//);
    await amis.fill('On se retrouve où pour le match ? https://baromatch.fr/matchs/psg-rome-2026-11-25/');
    const lien = await page.locator('[data-wa="amis"]').getAttribute('href');
    expect(decodeURIComponent(lien.split('text=')[1])).toBe('On se retrouve où pour le match ? https://baromatch.fr/matchs/psg-rome-2026-11-25/');
    await expect(page.locator('[data-agenda]')).toHaveAttribute('href', '/matchs/psg-rome-2026-11-25/match.ics');
    // Le message du bar n’a pas bougé.
    expect(decodeURIComponent((await page.locator('[data-wa="bar"]').getAttribute('href')).split('text=')[1])).toContain('pour-les-bars.html');
  });

  test('« Préviens-moi » : une ligne, qui envoie l’adresse à la liste d’attente et le dit', async ({ page }) => {
    let corps = '';
    await page.route('https://formspree.io/**', (route) => { corps = route.request().postData() ?? ''; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    await page.locator('.faire__bouton').click();
    const ligne = page.locator('.prevenir__ligne');
    const [champ, bouton] = await Promise.all([page.locator('#prevenir-mail').boundingBox(), page.locator('.prevenir__bouton').boundingBox()]);
    expect(Math.abs(champ.y + champ.height / 2 - (bouton.y + bouton.height / 2))).toBeLessThan(4);
    await expect(ligne).toBeVisible();
    await page.locator('#prevenir-mail').fill('fan@exemple.fr');
    await page.locator('.prevenir__bouton').click();
    await expect(page.locator('#prevenir-retour')).toContainText('C’est noté');
    expect(corps).toContain('fan@exemple.fr');
    expect(corps).toContain('Paris');
  });

  test('rien n’est gardé sur l’appareil : ni stockage, ni cookie', async ({ page }) => {
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    await page.locator('.faire__bouton').click();
    await page.locator('[data-message="amis"]').fill('Salut');
    await page.locator('.g-verre').focus();
    const gardes = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }));
    expect(gardes).toEqual({ local: 0, session: 0, cookie: '' });
  });
});

test.describe('le téléphone de démo', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const lire = (page) => page.evaluate(() => {
    const tel = document.querySelector('.g-tel');
    const ok = document.querySelector('.g-verre__mot--ok');
    const liq = document.querySelector('.g-verre__liq');
    return {
      classes: tel.className,
      ok: Number(getComputedStyle(ok).opacity),
      liquide: getComputedStyle(liq).transform,
      p: tel.style.getPropertyValue('--p'),
    };
  });

  test('étiqueté « Démo », avec des clubs et un bar inventés ; jamais le match de ce soir', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.g-tel .etiquette-demo')).toHaveText('Démo');
    const texte = (await page.locator('.g-tel').innerText()).replace(/\s+/g, ' ');
    expect(texte).toMatch(/Bar de démonstration/);
    expect(texte).toMatch(/Alvène – Orvèle/);
    expect(texte).toMatch(/Bar et clubs inventés\. Rien n’est réservé\./);
    expect(await page.locator('.g-tel svg.insigne use').evaluateAll((u) => u.map((n) => n.getAttribute('href')))).toEqual(expect.arrayContaining(['#d-alvene', '#d-orvele']));
  });

  test('il se remplit seul, avec une pause, et s’arrête après trois tours sur l’image de la fin', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await expect(page.locator('.g-tel')).toHaveClass(/est-auto/);
    const pause = page.locator('.g-tel__pause');
    await expect(pause).toBeVisible();
    await expect(pause).toHaveAttribute('aria-label', 'Mettre la démo en pause');
    expect((await pause.boundingBox()).width).toBeGreaterThanOrEqual(44);
    await pause.click();
    await expect(page.locator('.g-tel')).toHaveClass(/est-arrete/);
    await expect(pause).toHaveAttribute('aria-label', 'Reprendre la démo');
    await pause.click();
    await expect(page.locator('.g-tel')).not.toHaveClass(/est-arrete/);
    // 3 tours de 5,6 s : l’animation s’arrête d’elle-même, sur « Place gardée. ».
    await expect(page.locator('.g-tel')).not.toHaveClass(/est-auto/, { timeout: 30_000 });
    await expect(pause).toHaveAttribute('aria-label', 'Rejouer la démo');
    const fin = await lire(page);
    expect(fin.ok).toBe(1);
    expect(fin.liquide).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test('au doigt ou à la souris : tenir remplit le verre jusqu’à « Place gardée. » ; lâcher trop tôt le vide', async ({ page }) => {
    await page.goto('/');
    const verre = page.locator('.g-verre');
    const boite = await verre.boundingBox();
    await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
    await page.mouse.down();
    await expect.poll(async () => (await lire(page)).classes).toMatch(/est-main/);
    await page.waitForTimeout(500);
    await page.mouse.up();
    await expect.poll(async () => Number((await lire(page)).p)).toBe(0);
    await page.mouse.down();
    await expect.poll(async () => (await lire(page)).ok, { timeout: 4000 }).toBe(1);
    await page.mouse.up();
    expect((await lire(page)).ok).toBe(1);
    await expect(verre).toHaveAttribute('aria-label', /place gardée\. Rien n’est réservé pour de vrai/);
  });

  test('à la barre d’espace : tenue, le verre se remplit ; relâchée trop tôt, il se vide', async ({ page }) => {
    await page.goto('/');
    await page.locator('.g-verre').focus();
    await page.keyboard.down('Space');
    await page.waitForTimeout(400);
    await page.keyboard.up('Space');
    await expect.poll(async () => Number((await lire(page)).p)).toBe(0);
    await page.keyboard.down('Space');
    await expect.poll(async () => (await lire(page)).ok, { timeout: 4000 }).toBe(1);
    await page.keyboard.up('Space');
  });

  test('avec « réduire les animations » : l’image fixe de la fin, pas de pause, et un appui change l’état', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(500);
    expect((await lire(page)).classes).not.toMatch(/est-auto/);
    await expect(page.locator('.g-tel__pause')).toBeHidden();
    expect((await lire(page)).ok).toBe(1);
    expect((await lire(page)).liquide).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await page.locator('.g-verre').click();
    await expect.poll(async () => (await lire(page)).ok).toBe(1);
    await page.locator('.g-verre').click();
    await expect.poll(async () => (await lire(page)).ok).toBe(0);
  });
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

  test('le téléphone montre l’image fixe de la fin, et la carte du passage est complète', async ({ page }) => {
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    const fin = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.g-verre__mot--ok')).opacity));
    expect(fin).toBe(1);
    await expect(page.locator('.g-tel__pause')).toBeHidden();
    await expect(page.locator('.coup__titre')).toContainText('PSG');
    await expect(page.locator('.coup__heure')).toContainText('21:00');
    // La légende décrit l’image fixe, et ne propose aucun geste qu’on ne peut pas faire sans script.
    await expect(page.locator('.g-tel__fixe')).toBeVisible();
    await expect(page.locator('.g-tel__fixe')).toContainText('Image fixe');
    await expect(page.locator('.g-tel__aide')).toBeHidden();
    expect(await page.locator('.g-tel__legende').innerText()).not.toMatch(/Maintiens/);
    await page.locator('.faire__bouton').click();
    await expect(page.locator('.faire__titre')).toHaveText('Aucun bar encore pour ce match.');
    await expect(page.locator('[data-wa="amis"]')).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
  });
});

// La carte du prochain match montre ses deux noms dès le premier écran d’un téléphone (390 × 664), sous le titre, sa phrase
// et le téléphone de démo (la fenêtre du téléphone est basse : le bouton qu’on maintient y est toujours).
test.describe('le premier écran d’un téléphone', () => {
  for (const [largeur, hauteur] of [[390, 664], [390, 844]]) {
    test(`à ${largeur} × ${hauteur} : le titre, sa phrase, le bouton de la démo et les deux noms de la carte du prochain match`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
      await page.evaluate(() => document.fonts.ready);
      for (const selecteur of ['#titre', '.geste__texte', '.g-verre', '.coup__ou', '.coup__titre']) {
        const boite = await page.locator(selecteur).boundingBox();
        expect(boite.y, `${selecteur} : haut`).toBeGreaterThanOrEqual(0);
        expect(boite.y + boite.height, `${selecteur} : bas`).toBeLessThanOrEqual(hauteur);
      }
      await expect(page.locator('.coup__titre')).toHaveText('PSG – Rome');
    });
  }
});

// Le polish d’avant la mise en ligne : « Toute la semaine » a la gouttière de l’accueil, l’étiquette « Démo » et le bouton pause
// ne cachent aucun texte du téléphone (dont la fenêtre est rognée au téléphone), « Que faire pour ce match » passe à la ligne
// proprement (deux lignes au plus, équilibrées) à 320 px avec le texte à 200 %.
test.describe('les finitions de l’accueil sur téléphone', () => {
  const agrandir = (page, pourcent) => page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);

  for (const largeur of [320, 390]) {
    test(`à ${largeur} px : « Toute la semaine » a la même gouttière de 16 px que le reste de l’accueil`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
      await page.evaluate(() => document.fonts.ready);
      const lu = await page.evaluate(() => {
        const gauche = (s) => document.querySelector(s).getBoundingClientRect().left;
        const droite = (s) => Math.max(...[...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect().right));
        return { titre: gauche('.jours__titre'), liste: gauche('.jours ul'), etiquette: gauche('.prochain__etiquette'), droite: droite('.jours ul'), gouttiere: parseFloat(getComputedStyle(document.querySelector('.jours')).paddingLeft) };
      });
      expect(lu.titre).toBeGreaterThanOrEqual(16);
      expect(lu.titre).toBeCloseTo(lu.etiquette, 0);
      expect(lu.liste).toBeCloseTo(lu.etiquette, 0);
      expect(lu.droite).toBeLessThanOrEqual(largeur - 16 + 0.5);
      expect(lu.gouttiere).toBeGreaterThanOrEqual(16);
    });
  }

  // Le texte de l’écran du téléphone qui se voit dans sa fenêtre (rognée), croisé avec l’étiquette « Démo » et le bouton pause.
  const texteSousLesPuces = (page) => page.evaluate(() => {
    const fenetre = document.querySelector('.g-tel__fenetre').getBoundingClientRect();
    const puces = ['.g-tel .etiquette-demo', '.g-tel__pause'].map((s) => document.querySelector(s)).filter((e) => e && e.getClientRects().length);
    const cache = [];
    const parcours = document.createTreeWalker(document.querySelector('.g-ecran'), NodeFilter.SHOW_TEXT);
    for (let noeud = parcours.nextNode(); noeud; noeud = parcours.nextNode()) {
      if (!noeud.textContent.trim()) continue;
      const etendue = document.createRange();
      etendue.selectNodeContents(noeud);
      for (const r of etendue.getClientRects()) {
        // Ce qui est rogné par la fenêtre n’est pas vu : on garde la part visible.
        const vu = { left: Math.max(r.left, fenetre.left), right: Math.min(r.right, fenetre.right), top: Math.max(r.top, fenetre.top), bottom: Math.min(r.bottom, fenetre.bottom) };
        if (vu.right <= vu.left || vu.bottom <= vu.top) continue;
        for (const puce of puces) {
          const p = puce.getBoundingClientRect();
          if (vu.left < p.right && vu.right > p.left && vu.top < p.bottom && vu.bottom > p.top) cache.push(`${noeud.textContent.trim()} sous ${puce.className.split(' ').at(-1)}`);
        }
      }
    }
    return { cache, puces: puces.length, bas: document.querySelector('.g-tel .etiquette-demo').getBoundingClientRect().bottom, haut: fenetre.top };
  });

  for (const [largeur, hauteur] of [[390, 664], [390, 844]]) {
    for (const pourcent of [100, 200]) {
      for (const mouvement of ['reduce', 'no-preference']) {
        test(`à ${largeur} × ${hauteur}, texte à ${pourcent} %${mouvement === 'reduce' ? '' : ', animations'} : l’étiquette « Démo » et le bouton pause ne cachent aucun texte du téléphone`, async ({ page }) => {
          await page.setViewportSize({ width: largeur, height: hauteur });
          await page.emulateMedia({ reducedMotion: mouvement });
          await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
          await page.evaluate(() => document.fonts.ready);
          await agrandir(page, pourcent);
          const lu = await texteSousLesPuces(page);
          expect(lu.puces).toBeGreaterThan(0);
          expect(lu.cache).toEqual([]);
          // L’étiquette est au-dessus de la fenêtre du téléphone, pas dessus.
          expect(lu.bas).toBeLessThanOrEqual(lu.haut + 0.5);
        });
      }
    }
  }

  for (const [largeur, pourcent] of [[320, 200], [360, 200], [390, 200], [320, 100]]) {
    test(`à ${largeur} px, texte à ${pourcent} % : « Que faire pour ce match » tient en deux lignes équilibrées au plus, sur une cible d’au moins 44 px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
      await page.evaluate(() => document.fonts.ready);
      await agrandir(page, pourcent);
      const lu = await page.evaluate(() => {
        const bouton = document.querySelector('.faire__bouton');
        const texte = [...bouton.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        const etendue = document.createRange();
        etendue.selectNodeContents(texte);
        const lignes = new Map();
        for (const r of etendue.getClientRects()) lignes.set(Math.round(r.top), (lignes.get(Math.round(r.top)) ?? 0) + r.width);
        const b = bouton.getBoundingClientRect();
        const carte = bouton.closest('.coup').getBoundingClientRect();
        return { largeurs: [...lignes.values()], hauteur: b.height, largeur: b.width, dedans: b.left >= carte.left - 0.5 && b.right <= carte.right + 0.5 };
      });
      expect(lu.largeurs.length, `lignes : ${lu.largeurs.map(Math.round)}`).toBeLessThanOrEqual(2);
      // Équilibrées : la ligne courte fait au moins la moitié de la longue (jamais un mot seul sur sa ligne).
      if (lu.largeurs.length === 2) expect(Math.min(...lu.largeurs)).toBeGreaterThanOrEqual(Math.max(...lu.largeurs) / 2);
      expect(lu.hauteur).toBeGreaterThanOrEqual(44);
      expect(lu.largeur).toBeGreaterThanOrEqual(44);
      expect(lu.dedans).toBe(true);
    });
  }
});

// « Toute la semaine » : les liens des matchs des sept jours, en texte simple, écrits par le générateur dans le bloc.
test.describe('« Toute la semaine », du générateur', () => {
  test('un lien vers la page de chaque match des sept jours, rangés par jour ; ni reporté, ni passé, ni au-delà de sept jours', () => {
    const lointain = unMatch({ slug: 'metz-brest-2026-12-05', debut: '2026-12-05T19:45:00Z', domicile: club('metz', 'Metz'), exterieur: club('brest', 'Brest') });
    const html = bloc({ matchs: [...TOUS, lointain] });
    const liste = html.match(/<nav class="jours page"[^>]*>([\s\S]*?)<\/nav>/)[1];
    const liens = [...liste.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => m[1]);
    // Aujourd’hui (PSG – Rome, Lille – Bayern ; Sabah – Barça a commencé il y a plus de trois heures : fini), demain, samedi.
    expect(liens).toEqual(expect.arrayContaining(['/matchs/psg-rome-2026-11-25/', '/matchs/lille-bayern-2026-11-25/', '/matchs/lens-nice-2026-11-26/', '/matchs/ol-om-2026-11-28/']));
    expect(liens).not.toContain('/matchs/angers-lorient-2026-11-25/');
    expect(liens).not.toContain('/matchs/metz-brest-2026-12-05/');
    expect(liste).toMatch(/<b>Mercredi 25 novembre<\/b>/);
    expect(liste).toMatch(/<b>Samedi 28 novembre<\/b>/);
    expect(texteDe(liste)).toContain('Toute la semaine');
    // Du texte simple : aucun insigne, aucun style en ligne, un seul titre h2 dans le bloc (celui de la carte).
    expect(liste).not.toMatch(/<svg|style=|<h[1-6]/);
    expect(controlerLaSemaine(html)).toEqual([]);
  });

  test('aucun match à venir : pas de liste', () => {
    expect(bloc({ matchs: [] })).not.toContain('class="jours');
  });
});

// Le téléphone de démo : sa lumière n’est coupée par aucun rectangle, son petit texte suit la taille du texte du lecteur,
// ses couleurs viennent des jetons de styles.css, et il dit « le bouton », jamais « le verre » (pas un geste de boisson).
test.describe('le téléphone de démo, ses finitions', () => {
  const FEUILLE = readFileSync(path.join(racine, 'accueil.css'), 'utf8');

  test('la lumière du téléphone n’est ni masquée ni rognée à son cadre, et aucun ancêtre ne la coupe', async ({ page }) => {
    for (const [largeur, hauteur] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
      const lu = await page.evaluate(() => {
        const dessus = [];
        for (let e = document.querySelector('.geste__lumiere'); e && e !== document.body; e = e.parentElement) {
          const c = getComputedStyle(e);
          // Seul « main », large comme l’écran, rogne le côté (la page ne défile pas de côté) ; le haut et le bas restent libres.
          if (c.overflowY !== 'visible' || c.maskImage !== 'none' || c.clipPath !== 'none') dessus.push(`${e.tagName.toLowerCase()}.${e.className} : overflow-y ${c.overflowY}, mask ${c.maskImage}, clip-path ${c.clipPath}`);
        }
        return { dessus, defile: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(lu.dessus, `${largeur} px`).toEqual([]);
      expect(lu.defile, `${largeur} px`).toBeLessThanOrEqual(0);
    }
  });

  test('le petit texte de l’écran grandit avec le texte du lecteur, sans dépasser 1,4 fois', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    const taille = (selecteur) => page.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), selecteur);
    const petits = ['.g-feuille__note', '.g-feuille__etiq', '.g-bar__puces li', '.g-heures span'];
    const avant = {};
    for (const s of petits) avant[s] = await taille(s);
    expect(avant['.g-feuille__note']).toBeCloseTo(10.5, 1);
    expect(avant['.g-feuille__etiq']).toBeCloseTo(9.5, 1);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const s of petits) {
      const apres = await taille(s);
      expect(apres, `${s} grandit`).toBeGreaterThan(avant[s] * 1.25);
      expect(apres, `${s} reste dans l’écran`).toBeLessThanOrEqual(avant[s] * 1.4);
    }
    // Le téléphone reste entier : rien ne déborde de son écran, la page ne défile pas de côté.
    const lu = await page.evaluate(() => {
      const ecran = document.querySelector('.g-ecran').getBoundingClientRect();
      const dehors = [...document.querySelectorAll('.g-ecran *')].filter((e) => e.getClientRects().length && !e.closest('.g-pouce, .g-ecran__halo, .g-lueur, .g-verre__vague'))
        .filter((e) => { const r = e.getBoundingClientRect(); return r.right > ecran.right + 0.5 || r.left < ecran.left - 0.5; }).map((e) => e.className);
      return { dehors, defile: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(lu.dehors).toEqual([]);
    expect(lu.defile).toBeLessThanOrEqual(0);
  });

  test('l’écran du téléphone prend ses couleurs dans styles.css : aucune des trois couleurs de la marque écrite en dur dans ses règles', () => {
    const debut = FEUILLE.indexOf('.g-ecran{');
    const fin = FEUILLE.indexOf('/* ── Le geste');
    const regles = FEUILLE.slice(debut, fin);
    expect(regles.length).toBeGreaterThan(2000);
    expect(regles).not.toMatch(/#0A0B10|#F7F7F9|#FFB13D|#151722/i);
    expect(regles).toContain('var(--nuit)');
    expect(regles).toContain('var(--ambre)');
    expect(regles).toContain('var(--blanc-nuit)');
  });

  test('« le bouton », jamais « le verre » : la légende, ses descriptions parlées et le geste', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    const lu = await page.evaluate(() => ({
      legende: document.querySelector('.g-tel__legende').innerText,
      label: document.querySelector('.g-verre').getAttribute('aria-label'),
    }));
    expect(`${lu.legende} ${lu.label}`).not.toMatch(/\bverre\b/i);
    expect(lu.legende).toContain('Maintiens le bouton');
    expect(lu.legende).not.toContain('Image fixe');
  });
});

test.describe('à 200 % de texte', () => {
  test('rien ne déborde de côté et aucun mot n’est coupé, à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.locator('.faire__bouton').click();
    const defaut = await page.evaluate(() => {
      const coupes = [];
      for (const e of document.querySelectorAll('.geste__titre, .geste__texte, .coup__titre, .coup__heure, .faire__bouton, .faire__titre, .msg__envoi, .lien-trait, .prevenir__bouton, .puce__nom, .prochain__suite a, .g-tel__legende')) {
        if (e.scrollWidth > e.clientWidth + 1) coupes.push(`${e.className} : ${e.scrollWidth} > ${e.clientWidth}`);
      }
      return { coupes, defile: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(defaut.coupes).toEqual([]);
    expect(defaut.defile).toBeLessThanOrEqual(0);
  });
});

// Des noms longs, d’un seul mot pour la plupart (ceux qui sortaient de leur carte à 320 et 360 px, texte à 200 %), et
// les deux d’une vraie soirée : « OM – 1. Heidenheim 1846 » et « Werder Bremen – Borussia Mönchengladbach ». Chaque paire
// est la carte du prochain match une fois (le titre, ses insignes), et les suivantes de la bande (les puces) : un nom ne
// sort jamais de sa carte, aucun mot n’est coupé, la page ne défile pas de côté.
const PAIRES_LONGUES = [
  [['leverkusen', 'Leverkusen'], ['strasbourg', 'Strasbourg']], [['newcastle', 'Newcastle'], ['bodo-glimt', 'Bodø/Glimt']],
  [['olympiacos', 'Olympiacos'], ['nordsjaelland', 'Nordsjælland']], [['guadalajara', 'Guadalajara'], ['galatasaray', 'Galatasaray']],
  [['fenerbahce', 'Fenerbahçe'], ['hearts', 'Heart of Midlothian']], [['om', 'OM'], ['heidenheim', '1. Heidenheim 1846']],
  [['werder', 'Werder Bremen'], ['gladbach', 'Borussia Mönchengladbach']],
];
// La page du soir où la paire « tourne » est la première : chacune est la carte une fois, et les autres sont la bande.
const matchsAuxNomsLongs = (tour) => [...PAIRES_LONGUES.slice(tour), ...PAIRES_LONGUES.slice(0, tour)].map(([[a, nomA], [b, nomB]], i) => unMatch({
  slug: `${a}-${b}-2026-11-27`, debut: new Date(Date.parse('2026-11-27T19:00:00Z') + i * 10 * 60_000).toISOString(), domicile: club(a, nomA), exterieur: club(b, nomB), competition: 'Ligue Europa',
}));
const VENDREDI = Date.parse('2026-11-27T17:00:00Z');
// Pour chaque nom de la carte et de la bande : où est son texte (une plage par mot), par rapport à sa carte.
const lireLesNomsLongs = (page) => page.evaluate(() => {
  const mots = (element) => {
    const plage = document.createRange();
    const lus = [];
    const marche = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let n = marche.nextNode(); n; n = marche.nextNode()) {
      if (n.parentElement.closest('.visuellement-cache')) continue;
      for (const m of n.data.matchAll(/[^\s/-]+(?:[/-][^\s/-]+)*/g)) {
        plage.setStart(n, m.index);
        plage.setEnd(n, m.index + m[0].length);
        lus.push({ mot: m[0], rects: [...plage.getClientRects()].filter((r) => r.width > 0) });
      }
    }
    return lus;
  };
  const dedans = (element, carte) => {
    const style = getComputedStyle(carte);
    const bord = carte.getBoundingClientRect();
    const gauche = bord.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    const droite = bord.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
    const lus = mots(element);
    const tous = lus.flatMap((m) => m.rects);
    return {
      nom: element.textContent.trim().replace(/\s+/g, ' '),
      // Un mot sur deux lignes : une coupure au milieu d’un mot.
      coupes: lus.filter((m) => new Set(m.rects.map((r) => Math.round(r.top))).size > 1).map((m) => m.mot),
      dehorsGauche: Math.round(gauche - Math.min(...tous.map((r) => r.left))),
      dehorsDroite: Math.round(Math.max(...tous.map((r) => r.right)) - droite),
    };
  };
  const noms = [dedans(document.querySelector('.coup__titre a'), document.querySelector('.coup'))];
  for (const puce of document.querySelectorAll('.bande .puce')) noms.push(dedans(puce.querySelector('.puce__nom'), puce));
  return { noms, defile: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});

test.describe('les noms longs du prochain match et de la bande, à 100 et 200 %', () => {
  for (const largeur of [320, 360, 390, 412]) {
    test(`à ${largeur} px : aucun mot coupé, aucun nom hors de sa carte, la page ne défile pas de côté`, async ({ context }) => {
      test.setTimeout(90_000);
      const lus = [];
      for (let tour = 0; tour < PAIRES_LONGUES.length; tour += 1) {
        // Une page par soir : l’horloge simulée ne s’installe qu’une fois par page.
        const page = await context.newPage();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: largeur, height: 800 });
        await ouvrirLAccueil(page, { maintenant: VENDREDI, instant: VENDREDI, matchs: matchsAuxNomsLongs(tour) });
        await page.evaluate(() => document.fonts.ready);
        for (const pourcent of [100, 200]) {
          await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
          lus.push({ cas: `tour ${tour}, ${pourcent} %`, ...await lireLesNomsLongs(page) });
        }
        await page.close();
      }
      // La carte et la bande portent bien les noms attendus (les plus longs de la liste, dans les deux).
      const vus = new Set(lus.flatMap((l) => l.noms.map((n) => n.nom)));
      for (const attendu of ['Werder Bremen – Borussia Mönchengladbach', 'OM – 1. Heidenheim 1846', 'Fenerbahçe – Heart of Midlothian', 'Olympiacos – Nordsjælland']) expect([...vus], attendu).toContain(attendu);
      for (const l of lus) {
        expect(l.noms.flatMap((n) => n.coupes.map((m) => `${n.nom} : « ${m} » coupé`)), l.cas).toEqual([]);
        expect(l.noms.filter((n) => n.dehorsGauche > 0 || n.dehorsDroite > 0).map((n) => `${n.nom} : +${n.dehorsGauche} px à gauche, +${n.dehorsDroite} px à droite`), l.cas).toEqual([]);
        expect(l.defile, `${l.cas} : la page défile de côté`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('sans JavaScript, à 320 px et 200 % : le générateur a déjà réglé la taille des noms', async ({ browser }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 }, locale: 'fr-FR' });
    const page = await contexte.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const html = accueilAvecLaSemaine(ACCUEIL, bloc({ maintenant: VENDREDI, matchs: matchsAuxNomsLongs(PAIRES_LONGUES.length - 1) }));
    await page.route((adresse) => adresse.pathname === '/', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto('/');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const l = await lireLesNomsLongs(page);
    expect(l.noms[0].nom).toBe('Werder Bremen – Borussia Mönchengladbach');
    expect(l.noms.flatMap((n) => n.coupes)).toEqual([]);
    expect(l.noms.filter((n) => n.dehorsGauche > 0 || n.dehorsDroite > 0)).toEqual([]);
    expect(l.defile).toBeLessThanOrEqual(0);
    await contexte.close();
  });
});

test.describe('axe, avec le bloc du passage', () => {
  for (const [largeur, hauteur] of [[390, 664], [390, 844], [1440, 900]]) {
    test(`à ${largeur} × ${hauteur} : aucune violation, la carte fermée puis la réponse ouverte`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ouvrirLAccueil(page, { instant: Date.parse('2026-11-25T18:30:00Z') });
      await page.clock.resume();
      await page.waitForLoadState('networkidle');
      expect(await violationsAxe(page)).toEqual([]);
      await page.locator('.faire__bouton').click();
      await expect(page.locator('.faire__titre')).toBeVisible();
      expect(await violationsAxe(page)).toEqual([]);
    });
  }
});

// Le contraste de chaque ligne de texte, mesuré sur ce que le navigateur peint : la carte de nuit et sa lumière aux couleurs
// des deux clubs (des halos flous, des dégradés : aucun n’est une couleur de fond), la réponse ouverte, la bande et le
// texte d’ouverture. Les écrans du téléphone de démo (une réplique décorative) et les sections de nuit, qui ont leurs
// propres mesures, sont laissés de côté, avec le menu (le bandeau du bas : tests/bandeau-du-bas.spec.mjs) ; l’étiquette « Démo » et
// la légende du téléphone, elles, sont mesurées.
test.describe('le contraste du prochain match, mesuré au pixel', () => {
  for (const [largeur, hauteur] of [[390, 844], [1440, 900]]) {
    test(`à ${largeur} × ${hauteur} : chaque ligne de texte à 4,5:1 au moins, la réponse fermée puis ouverte`, async ({ page }, infos) => {
      test.setTimeout(90_000);
      const html = accueilAvecLaSemaine(ACCUEIL, bloc({ maintenant: Date.parse('2026-11-25T18:30:00Z') }));
      await page.route((adresse) => adresse.pathname === '/', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.clock.setFixedTime(new Date('2026-11-25T18:30:00Z'));
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const NUIT = '.g-ecran, .pied, .film, .bars, .appli, .testeurs-accueil, .attente__piege, .menu';
      for (const ouverte of [false, true]) {
        if (ouverte) await page.locator('.faire__bouton').click();
        const mesures = (await mesurerAuPixel(page, NUIT)).filter((m) => /geste|prochain|coup|faire|msg|prevenir|puce|bande|etiquette|g-tel/.test(m.quoi) || true);
        expect(mesures.length).toBeGreaterThan(ouverte ? 12 : 6);
        infos.annotations.push({ type: 'contraste peint', description: `${ouverte ? 'ouverte' : 'fermée'} : ${mesures.length} lignes ; les plus faibles : ${decrireLesPlusFaibles(mesures, 6)}` });
        expect(lignesTropFaibles(mesures)).toEqual([]);
      }
    });
  }
});
