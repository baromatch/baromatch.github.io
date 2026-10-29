// « Pour les bars » en clair (<html class="jour">, styles.css, pour-les-bars.css) : le crème, le bleu nuit, l’ambre aux seuls
// boutons « Proposer mon bar » et à l’envoi ; la carte « Ta salle, ce soir », les écrans de démonstration dans leurs
// cadres et le pied de page restent de nuit. Ce qu’on vérifie ici, peint tel qu’il est : le contraste de chaque petit texte
// sur le clair (4,5:1, mesuré par tests/outils/textes-peints.mjs, comme l’accueil), la page au repos et chacun de ses
// états ; le bord des champs (3:1) ; le focus, bleu nuit sur le clair et ambre sur la nuit ; l’étiquette « Écran de
// démonstration » ; la carte du formulaire blanche dès le premier affichage, avant l’arrivée de pour-les-bars.css ; et
// CLS 0. Le texte agrandi, axe et la politique de sécurité ont leurs tests (texte-agrandi, accessibilite et
// pour-les-bars.spec.mjs, qui donne l’empreinte du style de la tête : le style en ligne n’a pas d’attribut style).
// Le serveur est simulé (page.route) : aucun test n’écrit à l’API de production.
import { test, expect } from '@playwright/test';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { lireCouleur, poser, rapport } from './outils/contraste.mjs';
import { arreterLHorloge } from './outils/horloge.mjs';
import { decrireLesCouples, lesCouples, mesurerLesTextes, textesTropFaibles } from './outils/textes-peints.mjs';

const PAGE = '/pour-les-bars.html';
const ADRESSE = 'https://api-production-8ce4.up.railway.app/api/public/bar-contact';
const LARGEURS = [390, 1280];
const DEBUT = new Date('2026-10-29T16:00:00Z').getTime();

const NUIT = 'rgb(10, 11, 16)';
const CREME = 'rgb(250, 247, 241)';
const AMBRE = 'rgb(255, 177, 61)';

// Les moments de nuit de la page : la carte de la salle, le pied de page, les écrans de démonstration (la Console, les
// téléphones, et leur pastille « Écran de démonstration » : sa couleur est vérifiée plus bas, sur sa pastille).
const NUIT_DES_BARS = '.nuit, .pied, .capture, .telephone, .exemple, .formulaire__piege';

const hex = (texte) => lireCouleur(`rgb(${[1, 3, 5].map((i) => parseInt(texte.slice(i, i + 2), 16)).join(', ')})`);

const SAISIE = { '#demande-bar': 'Le Zinc des Amis', '#demande-ville': 'Paris', '#demande-nom': 'Camille Martin', '#demande-email': 'camille@lezinc.fr' };

const reponse = (status, json = {}) => ({ status, json });

// Ouvre la page comme les tests du formulaire : horloge arrêtée (les 3 s avant l’envoi se font passer d’un coup),
// serveur simulé (`reponses` : une réponse, 'silence' pour ne jamais répondre, ou 'coupure'), sans animation (une
// couleur lue est celle de l’état posé, jamais celle d’une transition). Rend la page quand le formulaire et sa feuille sont là.
async function ouvrir(page, largeur, reponses = reponse(201, { ok: true })) {
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(ADRESSE, (route) => {
    if (reponses === 'silence') return undefined;
    if (reponses === 'coupure') return route.abort('failed');
    return route.fulfill({ status: reponses.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reponses.json) });
  });
  await arreterLHorloge(page, DEBUT);
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await attendreLaPageFinie(page);
}

const remplir = async (page) => {
  for (const [champ, valeur] of Object.entries(SAISIE)) await page.fill(champ, valeur);
  await page.check('#demande-accord');
};
const envoyer = async (page) => {
  await page.clock.fastForward(3000);
  await page.click('#demande-envoyer');
};

// Tout le texte de la page est lu, réponses des questions comprises (les <details> fermés ne se mesurent pas).
const toutOuvrir = (page) => page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));

// Les états du formulaire, chacun avec ce qui l’amène : de quoi mesurer chaque texte et chaque fond qu’il peint.
const ETATS = [
  { nom: 'au repos', amener: async () => {} },
  {
    nom: 'des informations à corriger (résumé, erreurs sous les champs)',
    amener: async (page) => { await page.fill('#demande-email', 'camille@'); await envoyer(page); await expect(page.locator('#demande-resume')).toBeVisible(); },
    reponses: reponse(201, { ok: true }),
  },
  {
    nom: 'envoi en cours (le petit verre dans le bouton)',
    amener: async (page) => { await remplir(page); await envoyer(page); await expect(page.locator('#demande-envoyer')).toHaveAttribute('aria-disabled', 'true'); },
    reponses: 'silence',
  },
  {
    nom: 'trop d’envois (le message, l’e-mail en geste principal)',
    amener: async (page) => { await remplir(page); await envoyer(page); await expect(page.locator('#demande-alerte .message')).toBeVisible(); },
    reponses: reponse(429),
  },
  {
    nom: 'l’étape e-mail (le texte à copier, la capsule de verre)',
    amener: async (page) => { await remplir(page); await envoyer(page); await expect(page.locator('#demande-courriel')).toBeVisible(); },
    reponses: reponse(404),
  },
  {
    nom: 'hors ligne (l’e-mail en second choix)',
    amener: async (page) => { await page.context().setOffline(true); await remplir(page); await envoyer(page); await expect(page.locator('#demande-courriel.courriel--second')).toBeVisible(); },
    reponses: 'coupure',
  },
  {
    nom: 'envoyé (« C’est envoyé. », le verre plein)',
    amener: async (page) => { await remplir(page); await envoyer(page); await expect(page.locator('#demande-envoyee')).toBeVisible(); },
    reponses: reponse(201, { ok: true }),
  },
];

// La lumière du match, au plus fort (la page descendue jusqu’en bas : --h à 1), en couches de couleur translucide : ce que
// ses halos ajoutent, au pire, à ce qui est peint dessous. Sous une carte blanche, ils ne se voient pas : prendre le pire
// partout, c’est pencher du côté de la prudence.
const lireLaLumiere = (page) => page.evaluate(() => {
  const lumiere = document.querySelector('.lumiere');
  lumiere.style.setProperty('--h', '1');
  const boite = Number(getComputedStyle(lumiere).opacity);
  const couches = [];
  for (const pseudo of ['::before', '::after']) {
    const style = getComputedStyle(lumiere, pseudo);
    for (const [, r, v, b, a] of style.backgroundImage.matchAll(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g)) {
      const alpha = (a === undefined ? 1 : Number(a)) * Number(style.opacity) * boite;
      if (alpha > 0) couches.push({ r: Number(r), v: Number(v), b: Number(b), a: alpha });
    }
  }
  return couches;
});

test.describe('le contraste de chaque texte sur le clair, mesuré', () => {
  for (const largeur of LARGEURS) {
    for (const etat of ETATS) {
      test(`à ${largeur} px, ${etat.nom} : chaque texte à 4,5:1 au moins`, async ({ page }, infos) => {
        await ouvrir(page, largeur, etat.reponses);
        await etat.amener(page);
        await toutOuvrir(page);
        const mesures = await mesurerLesTextes(page, NUIT_DES_BARS);
        expect(mesures.length).toBeGreaterThan(etat.nom === 'au repos' ? 100 : 40);
        // Le rapport de la PR : chaque couple de couleurs des petits textes, et son contraste le plus faible.
        infos.annotations.push({ type: 'contraste', description: decrireLesCouples(mesures) });
        expect(textesTropFaibles(mesures)).toEqual([]);

        // Au repos, la lumière du match (des halos teal, indigo et ambre derrière la page) au plus fort : chaque couple,
        // posé sur le pire de ce qu’elle ajoute, tient encore 4,5:1.
        if (etat.nom !== 'au repos') return;
        const couches = await lireLaLumiere(page);
        expect(couches, 'les halos de la lumière du match').toHaveLength(3);
        const force = couches.reduce((somme, c) => somme + c.a, 0);
        // Un lavis : tous les halos ensemble ne teintent pas de 25 % ce qui est dessous.
        expect(force).toBeLessThan(0.25);
        const sousLaLumiere = lesCouples(mesures).map(([cle, m]) => {
          const fond = couches.reduce((dessous, couche) => poser(couche, dessous), hex(m.fond));
          return { cle, quoi: m.quoi, rapport: Math.round(rapport(hex(m.texte), fond) * 100) / 100 };
        }).sort((a, b) => a.rapport - b.rapport);
        infos.annotations.push({ type: 'contraste, la lumière au plus fort', description: `force cumulée ${force.toFixed(3)} | ${sousLaLumiere.map((c) => `${c.rapport}:1 ${c.cle}`).join(' | ')}` });
        expect(sousLaLumiere.filter((c) => c.rapport < 4.5).map((c) => `${c.cle} : ${c.rapport}:1 (${c.quoi})`)).toEqual([]);
      });
    }
  }
});

test.describe('le jour posé', () => {
  test('le crème et le bleu nuit ; la salle, les écrans et le pied de page restent de nuit, sans bande pleine largeur', async ({ page }) => {
    await ouvrir(page, 1280);
    const lu = await page.evaluate(() => {
      const style = (selecteur) => getComputedStyle(document.querySelector(selecteur));
      const salle = style('.salle-soir');
      return {
        classe: document.documentElement.className,
        couleurDeLaBarre: document.querySelector('meta[name="theme-color"]').content,
        page: style('body').backgroundColor,
        texte: style('.ouverture-bars__titre').color,
        salle: { fond: salle.backgroundColor, texte: salle.color, decoupe: salle.clipPath, ombre: salle.boxShadow, classe: document.querySelector('.salle-soir').className },
        pied: style('.pied').backgroundColor,
        capture: style('.capture').backgroundColor,
        telephone: style('.telephone__ecran').backgroundColor,
        etiquettes: [...document.querySelectorAll('.moment__visuel > .exemple')].map((e) => e.textContent),
        carte: style('.carte-formulaire').backgroundColor,
        conditions: [...document.querySelectorAll('.conditions__liste li')].map((e) => getComputedStyle(e).backgroundColor),
        etapes: [...document.querySelectorAll('.marche__etape')].map((e) => getComputedStyle(e).backgroundColor),
      };
    });
    expect(lu.classe).toBe('jour');
    expect(lu.couleurDeLaBarre).toBe('#FAF7F1');
    expect(lu.page).toBe(CREME);
    expect(lu.texte).toBe(NUIT);
    // La salle : une carte de nuit, qui garde ses coins et ses ombres (la bande pleine largeur de « nuit » est faite pour
    // les sections : une ombre étalée sur 100vmax et une découpe de 100vmax de chaque côté).
    expect(lu.salle.classe).toContain('nuit');
    expect(lu.salle.fond).toBe(NUIT);
    expect(lu.salle.texte).toBe('rgb(247, 247, 249)');
    expect(lu.salle.decoupe).toBe('none');
    expect(lu.salle.ombre).not.toMatch(/0px 0px 0px \d{3,}px/);
    expect([lu.pied, lu.capture, lu.telephone]).toEqual([NUIT, NUIT, NUIT]);
    expect(lu.etiquettes).toEqual(Array(4).fill('Écran de démonstration'));
    // La carte du formulaire, les conditions et les trois étapes : des cartes blanches sur le crème.
    expect(lu.carte).toBe('rgb(255, 255, 255)');
    expect(lu.conditions).toEqual(Array(6).fill('rgb(255, 255, 255)'));
    expect(lu.etapes).toEqual(Array(3).fill('rgb(255, 255, 255)'));
  });

  test('l’ambre n’est qu’aux boutons : aucun fond ambre ailleurs que sur un bouton, aucun texte ambre sur le clair', async ({ page }) => {
    await ouvrir(page, 1280);
    const lu = await page.evaluate((ambre) => {
      // Le lien d’évitement est ambre (l’action du clavier), et caché hors de l’écran tant qu’il n’a pas le focus.
      const hors = '.nuit, .pied, .bouton-nuit, .capture, .telephone, .lien-evitement';
      const fonds = [];
      const textes = [];
      for (const e of document.querySelectorAll('body *')) {
        if (e.closest(hors) || !e.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
        const style = getComputedStyle(e);
        if (style.backgroundColor === ambre) fonds.push(`${e.tagName.toLowerCase()}.${e.className}`);
        if (style.color === ambre && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) textes.push(`${e.tagName.toLowerCase()}.${e.className}`);
      }
      return { fonds, textes };
    }, AMBRE);
    // « Proposer mon bar » (en haut, après ce que ça change), et « Envoyer ma demande ».
    expect(lu.fonds).toEqual(['a.capsule', 'a.capsule', 'button.panier__envoyer']);
    expect(lu.textes).toEqual([]);
  });

  test('l’étiquette « Écran de démonstration » se lit : du texte clair sur sa pastille de nuit, 4,5:1 au moins', async ({ page }) => {
    await ouvrir(page, 1280);
    const etiquettes = await page.locator('.moment__visuel > .exemple').evaluateAll((liste) => liste.map((e) => {
      const style = getComputedStyle(e);
      return { texte: style.color, fond: style.backgroundColor, taille: parseFloat(style.fontSize), visible: e.checkVisibility() };
    }));
    expect(etiquettes).toHaveLength(4);
    for (const e of etiquettes) {
      expect(e.visible).toBe(true);
      expect(rapport(lireCouleur(e.texte), lireCouleur(e.fond)), `${e.texte} sur ${e.fond}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // La carte du formulaire et le bord des champs se peignent dans le style de la tête : le formulaire s’affiche dès que son
  // script a tourné, sans attendre pour-les-bars.css. Sans eux, il paraîtrait le temps de cette feuille en bleu nuit sur du
  // bleu nuit (la carte et le fond des champs de la nuit, le texte du jour).
  test('avant l’arrivée de pour-les-bars.css, la carte du formulaire est blanche, ses champs bordés, et la salle est de nuit', async ({ page }) => {
    let lacher;
    const retenue = new Promise((resoudre) => { lacher = resoudre; });
    await page.route('**/pour-les-bars.css', async (route) => { await retenue; await route.continue(); });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#demande')).toBeVisible();
    expect(await page.evaluate(() => [...document.styleSheets].some((f) => f.href?.endsWith('/pour-les-bars.css')))).toBe(false);
    const lu = await page.evaluate(() => {
      const style = (selecteur) => getComputedStyle(document.querySelector(selecteur));
      return {
        carte: style('.carte-formulaire').backgroundColor,
        champ: { fond: style('#demande-bar').backgroundColor, bord: style('#demande-bar').borderTopColor, texte: style('#demande-bar').color },
        salle: style('.salle-soir').backgroundColor,
        souligne: style('.lien-fleche').textDecorationColor,
      };
    });
    expect(lu.carte).toBe('rgb(255, 255, 255)');
    expect(lu.champ).toEqual({ fond: 'rgb(255, 255, 255)', bord: 'rgba(10, 11, 16, 0.5)', texte: NUIT });
    expect(lu.salle).toBe(NUIT);
    expect(lu.souligne).toBe('rgba(10, 11, 16, 0.4)');
    lacher();
    await attendreLaPageFinie(page);
  });
});

test.describe('le bord des champs, le focus', () => {
  // WCAG 1.4.11 : le bord d’un champ se voit à 3:1 au moins contre ce qui l’entoure (la carte) et contre son fond.
  test('le bord de chaque champ, et du texte à copier, se voit à 3:1 au moins contre la carte et contre son propre fond', async ({ page }) => {
    await ouvrir(page, 1280, reponse(404));
    await remplir(page);
    await envoyer(page);
    await expect(page.locator('#demande-courriel')).toBeVisible();
    const champs = await page.evaluate(() => [...document.querySelectorAll('#demande .panier__champ, #demande-courriel-texte')]
      .filter((c) => c.checkVisibility()).map((c) => ({
        nom: c.id,
        bord: getComputedStyle(c).borderTopColor,
        largeur: getComputedStyle(c).borderTopWidth,
        fond: getComputedStyle(c).backgroundColor,
        carte: getComputedStyle(c.closest('.carte-formulaire')).backgroundColor,
      })));
    expect(champs.map((c) => c.nom)).toEqual(['demande-bar', 'demande-ville', 'demande-nom', 'demande-email', 'demande-telephone', 'demande-message', 'demande-courriel-texte']);
    for (const c of champs) {
      expect(c.largeur, c.nom).toBe('1px');
      const carte = lireCouleur(c.carte);
      const bord = poser(lireCouleur(c.bord), carte);
      expect(rapport(bord, carte), `${c.nom} : ${c.bord} sur la carte ${c.carte}`).toBeGreaterThanOrEqual(3);
      expect(rapport(bord, lireCouleur(c.fond)), `${c.nom} : ${c.bord} sur son fond ${c.fond}`).toBeGreaterThanOrEqual(3);
    }
  });

  // Le contour du focus (2 px, décalé de 3) se voit à 3:1 au moins contre le fond qui l’entoure : bleu nuit sur le clair,
  // ambre sur la nuit (la carte de la salle, le pied de page).
  test('le focus au clavier se voit : du bleu nuit sur le clair, de l’ambre sur la nuit, à 3:1 au moins', async ({ page }) => {
    await ouvrir(page, 1280, reponse(201, { ok: true }));
    await expect(page.locator('#salle-jouer')).toBeEnabled();
    const lire = async (selecteur) => {
      const lu = await page.locator(selecteur).first().evaluate((e) => {
        e.focus();
        const style = getComputedStyle(e);
        // Ce qui est peint autour de l’élément : les fonds de ses parents, jusqu’au premier fond plein.
        const fonds = [];
        for (let x = e.parentElement; x; x = x.parentElement) {
          const f = getComputedStyle(x).backgroundColor;
          if (!/, 0\)$/.test(f)) fonds.push(f);
          if (!/^rgba\(.*, 0\.\d+\)$/.test(f) && !/, 0\)$/.test(f)) break;
        }
        return { visible: e.matches(':focus-visible'), couleur: style.outlineColor, style: style.outlineStyle, largeur: parseFloat(style.outlineWidth), fonds };
      });
      const fond = lu.fonds.reverse().reduce((dessous, dessus) => poser(lireCouleur(dessus), dessous), { r: 255, v: 255, b: 255, a: 1 });
      return { ...lu, fond: `rgb(${Math.round(fond.r)}, ${Math.round(fond.v)}, ${Math.round(fond.b)})` };
    };
    const CLAIR = ['.ouverture-bars .capsule', '.lien-fleche', '.entete__lien', '#demande-bar', '#demande-message', '#demande-accord', '.questions summary', '.conditions__liste a', '.formulaire__ailleurs a'];
    const SOMBRE = ['#salle-jouer', '#salle-places .pas__bouton--plus', '#salle-curseur', '.bars .bouton-nuit', '.pied__liens a'];
    for (const selecteur of CLAIR) {
      const lu = await lire(selecteur);
      expect(lu.visible, `${selecteur} : :focus-visible`).toBe(true);
      expect([lu.style, lu.largeur, lu.couleur], selecteur).toEqual(['solid', 2, NUIT]);
      expect(rapport(lireCouleur(lu.couleur), lireCouleur(lu.fond)), `${selecteur} sur ${lu.fond}`).toBeGreaterThanOrEqual(3);
    }
    for (const selecteur of SOMBRE) {
      const lu = await lire(selecteur);
      expect(lu.visible, `${selecteur} : :focus-visible`).toBe(true);
      expect([lu.style, lu.largeur], selecteur).toEqual(['solid', 2]);
      expect(lu.couleur, selecteur).toBe(selecteur === '.bars .bouton-nuit' ? NUIT : AMBRE);
      expect(rapport(lireCouleur(lu.couleur), lireCouleur(lu.fond)), `${selecteur} sur ${lu.fond}`).toBeGreaterThanOrEqual(3);
    }
  });

  test('le résumé des erreurs, qui prend le focus à l’envoi, a un contour bleu nuit sur la carte blanche', async ({ page }) => {
    await ouvrir(page, 1280);
    await page.fill('#demande-email', 'camille@');
    await page.clock.fastForward(3000);
    // Entrée dans un champ : l’envoi au clavier, donc un focus qui se voit.
    await page.press('#demande-email', 'Enter');
    await expect(page.locator('#demande-resume')).toBeFocused();
    const contour = await page.locator('#demande-resume').evaluate((e) => ({ visible: e.matches(':focus-visible'), couleur: getComputedStyle(e).outlineColor, style: getComputedStyle(e).outlineStyle }));
    expect(contour).toEqual({ visible: true, couleur: NUIT, style: 'solid' });
  });
});

// Le CLS de la page elle-même, pas celui de sa police. Quand la machine est chargée, Bricolage Grotesque arrive après le
// premier affichage, et son remplacement du texte de secours (font-display: swap) décale la page (environ 0,04 à 390 px,
// 0,03 à 1280 px : le bloc de texte et la légende de la salle) : un décalage de la page d’aujourd’hui, qui existait avant
// le jour, et qui aura son correctif (les métriques de la police de secours) et son test dans une autre PR. Ce test-ci
// refuse donc la police : le texte de secours est là du premier affichage à la fin, et seuls les décalages de la page
// comptent (les couleurs du jour n’en font aucun). Sans cela il échouait au hasard, selon l’instant d’arrivée de la police.
const POLICE = '/fonts/bricolage-grotesque.woff2';

test.describe('rien ne bouge au chargement', () => {
  for (const largeur of LARGEURS) {
    test(`à ${largeur} px, avec les animations et le texte de secours : CLS 0`, async ({ page }) => {
      const refusees = [];
      page.on('requestfailed', (requete) => refusees.push(new URL(requete.url()).pathname));
      await page.route(`**${POLICE}`, (route) => route.abort());
      await page.addInitScript(() => {
        window.decalages = 0;
        new PerformanceObserver((liste) => { for (const e of liste.getEntries()) if (!e.hadRecentInput) window.decalages += e.value; })
          .observe({ type: 'layout-shift', buffered: true });
      });
      await page.setViewportSize({ width: largeur, height: 900 });
      await page.goto(PAGE);
      await attendreLaPageFinie(page);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      // La police a bien été refusée (sinon ce test ne protégerait plus de rien : le chemin de la police aurait changé).
      expect(refusees, 'la police demandée par la page').toContain(POLICE);
      expect(await page.evaluate(() => window.decalages), `${largeur} px`).toBe(0);
    });
  }
});
