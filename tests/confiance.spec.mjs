// Les pages de confiance : « À propos » (pourquoi Baromatch existe, où il en est, qui le publie) et « Comment on choisit
// les bars » (d’où viennent les matchs, qui tient les places, quand un bar apparaît sur le site, ce qu’on refuse).
// Écrites pour être citées telles quelles : un h1, des intertitres qui posent la question, des phrases datées. Rien n’y
// est inventé : ni le mot du fondateur (ses mots à lui, mot pour mot, rien d’écrit à sa place, pas même un emplacement),
// ni un bar publié (aucune phrase datée sur les bars publiés : une page de match sans vrai bar le dit, avec les mots du
// générateur).
// Le reste (référencement, liens, accessibilité, contraste, cibles, texte agrandi, politique de sécurité, pied de page)
// vient de tests/outils/pages.mjs.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { MOT_DU_FONDATEUR, motPourMot, SIGNATURE_DU_FONDATEUR } from './outils/fondateur.mjs';
import { PIED } from './outils/pied.mjs';
import { contenuDuScenario, MAINTENANT_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';

const ORIGINE = 'https://baromatch.fr';
const A_PROPOS = '/a-propos.html';
const CONFIANCE = '/comment-on-choisit-les-bars.html';
const lireJson = (...morceaux) => JSON.parse(readFileSync(path.join(racine, ...morceaux), 'utf8'));
const MARQUE = lireJson('marque.json');
const TEXTES = lireJson('generateur', 'contenu', 'textes.json');
const MENTION_SANTE = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
const TEXTES_ATTENTE_NOTE = 'On t’écrit seulement quand Baromatch ouvre dans ta ville, et pour les premiers tests.';
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// « Mise à jour le 19 octobre 2026 » → « 2026-10-19 ».
const dateIso = (texte) => {
  const [, jour, mois, annee] = normaliser(texte).match(/(\d{1,2})(?:er)? ([a-zéû]+) (\d{4})/);
  return `${annee}-${String(MOIS.indexOf(mois) + 1).padStart(2, '0')}-${jour.padStart(2, '0')}`;
};
const graphe = async (page) => JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];

test.use({ javaScriptEnabled: false });

for (const chemin of [A_PROPOS, CONFIANCE]) {
  test(`${chemin} : rien d’inventé ni d’inachevé, aucun point d’exclamation`, async ({ page }) => {
    await page.goto(chemin);
    const texte = normaliser(await page.locator('main').textContent());
    expect(texte).not.toContain('!');
    // Ni emplacement à remplir, ni crochets à compléter, ni brouillon : la page se lit telle quelle.
    expect(texte).not.toMatch(/à écrire|à compléter|à préciser|\[|\]|TODO|lorem/i);
    await expect(page.locator('.presse__a-ecrire, #histoire')).toHaveCount(0);
    // Aucune phrase qui pousse à boire.
    expect(texte).not.toMatch(/happy[\s-]*hour|tournée|verre offert/i);
  });

  test(`${chemin} : données structurées reliées à l’Organization de l’accueil, datées comme la page`, async ({ page }) => {
    await page.goto('/');
    const organisation = (await graphe(page)).find((n) => n['@type'] === 'Organization');
    await page.goto(chemin);
    const noeuds = await graphe(page);
    // La page se suffit : elle recopie l’Organization complète de l’accueil, sous le même @id.
    expect(noeuds.find((n) => n['@type'] === 'Organization')).toEqual(organisation);
    const fiche = noeuds.find((n) => n['@id'] === `${ORIGINE}${chemin}#page`);
    const fil = noeuds.find((n) => n['@type'] === 'BreadcrumbList');
    expect(fiche.about['@id']).toBe(organisation['@id']);
    expect(fiche.isPartOf['@id']).toBe(`${ORIGINE}/#site`);
    expect(fiche.breadcrumb['@id']).toBe(fil['@id']);
    expect(fiche.inLanguage).toBe('fr-FR');
    expect(fiche.description).toBe(await page.locator('meta[name="description"]').getAttribute('content'));
    expect(fiche.dateModified).toBe(dateIso(await page.locator('.document__date').textContent()));
    expect(fil.itemListElement.map((e) => [e.position, e.item])).toEqual([[1, `${ORIGINE}/`], [2, `${ORIGINE}${chemin}`]]);
  });
}

test('à propos : ce qu’est Baromatch avec les mots de marque.json, où il en est, et qui le publie', async ({ page }) => {
  await page.goto(A_PROPOS);
  const texte = normaliser(await page.locator('main').textContent());
  expect(normaliser(await page.locator('.apropos__chapo').textContent())).toBe(normaliser(MARQUE.description));
  const titres = (await page.locator('main h2').allTextContents()).map(normaliser);
  expect(titres).toEqual(['Pourquoi Baromatch existe', 'Le mot du fondateur', 'Ce que fait l’appli', 'Ce qu’on refuse', 'Où va Baromatch', 'Et maintenant', 'Qui publie Baromatch']);
  if (!MARQUE.appli.ouverte) expect(texte).toContain('Elle n’est pas encore ouverte au public, ni sur iPhone');
  // L’éditeur, comme les mentions légales le nomment ; ailleurs, le fondateur ne signe que de son prénom (son mot).
  await page.goto('/mentions-legales.html');
  const editeur = normaliser(await page.locator('h2:has-text("Directeur de la publication") + p').textContent());
  expect(texte).toContain(`Baromatch est édité par ${editeur}, son fondateur, à titre personnel pour le moment.`);
  expect(texte.match(new RegExp(editeur, 'g'))).toHaveLength(1);
});

// Ses mots à lui, écrits le 26 octobre 2026 : publiés tels quels, avec la typographie du site (l’apostrophe ’, une
// espace insécable avant « : » et « ? »), signés, juste après « Pourquoi Baromatch existe » : un patron de bar qui se
// demande qui est derrière l’appli a la réponse dès le troisième écran du téléphone.
test('à propos : le mot du fondateur, mot pour mot, signé, juste après « Pourquoi Baromatch existe »', async ({ page }) => {
  await page.goto(A_PROPOS);
  const ids = await page.locator('main h2').evaluateAll((h) => h.map((e) => e.id));
  expect(ids[ids.indexOf('pourquoi') + 1]).toBe('mot-du-fondateur');
  const mot = page.locator('#mot-du-fondateur + figure');
  const cite = await mot.locator('blockquote').textContent();
  expect(motPourMot(cite)).toBe(MOT_DU_FONDATEUR);
  expect(cite).not.toMatch(/'| [:;?!]/);
  expect(cite).toContain('simple\u00a0: où');
  expect(cite).toContain('de la place\u00a0? Je');
  expect(normaliser(await mot.locator('figcaption').textContent())).toBe(SIGNATURE_DU_FONDATEUR);
});

test('à propos : les règles renvoient au détail, aux CGU et à la confidentialité', async ({ page }) => {
  await page.goto(A_PROPOS);
  const regles = page.locator('section[aria-labelledby="regles"]');
  const liens = await regles.locator('.apropos__suite a').evaluateAll((a) => a.map((l) => l.getAttribute('href')));
  expect(liens).toEqual([CONFIANCE, '/cgu.html', '/confidentialite.html']);
  expect(normaliser(await regles.locator('.apropos__suite').textContent())).toBe('Le détail, et ce qu’on refuse de montrer : comment on choisit les bars. Les règles de l’appli sont dans les CGU, et ce qu’on fait de tes données dans la page Confidentialité.');
  await expect(page.locator('section[aria-labelledby="qui"] a[href^="mailto:"]')).toHaveAttribute('href', `mailto:${MARQUE.contact}`);
});

// Ce qu’on refuse, en grand : chaque phrase déjà publiée sur le site. « Aucun bar sans son accord » dit ce que le site
// garantit (« sur ce site », avec son accord écrit) : un bar entre dans l’appli après un échange par e-mail ou par
// téléphone. Puis les règles de la page d’avant, mot pour mot : gratuit pour les fans, pas de paris, ni écusson ni
// logo, 18 ans et plus.
test('à propos : ce qu’on refuse, des phrases déjà publiées, et les règles d’avant mot pour mot', async ({ page }) => {
  await page.goto(A_PROPOS);
  const refus = await page.locator('.apropos__refus > li').evaluateAll((li) => li.map((l) => [l.querySelector('h3').textContent, l.querySelector('p').textContent].map((t) => t.replace(/[\s\u00a0]+/g, ' ').trim())));
  expect(refus).toEqual([
    ['Aucun bar ne paie pour passer devant un autre.', 'Sur ce site, les bars sont rangés par ville, par arrondissement, puis par nom. Rien d’autre ne change cet ordre : ni une note, ni un avis, ni de l’argent.'],
    ['Aucun bar sans son accord.', 'Un bar n’apparaît sur ce site qu’avec son accord écrit. Il peut partir quand il veut.'],
    ['Rien qui pousse à boire.', 'Baromatch ne vend pas d’alcool, n’en fait pas la promotion et n’en donne jamais en récompense.'],
    ['Pas de faux avis. Pas de faux bar.', 'Pas de chiffre sorti de nulle part. Ce site n’affiche ni note ni avis, et Baromatch n’en écrit pas à la place des fans.'],
    ['Sans l’appli, on entre comme d’habitude.', 'Les places de l’appli sont celles que le bar met de côté pour Baromatch. Le reste de la salle est pour ceux qui passent la porte sans avoir réservé.'],
  ]);
  const aussi = (await page.locator('.apropos__aussi > li').allTextContents()).map(normaliser);
  expect(aussi).toEqual([
    'Gratuit pour les fans. Tu ne paies rien à Baromatch. Ce que tu prends au bar, tu le paies au bar.',
    'Pas de paris. Ni mise, ni cote, ni argent en jeu.',
    'Ni écusson, ni logo. Les clubs et les compétitions sont écrits en toutes lettres.',
    '18 ans et plus. Les soirées se passent dans des bars.',
  ]);
  // Ce que ces phrases promettent est déjà publié sur les autres pages, avec les mêmes mots.
  const ailleurs = ['comment-on-choisit-les-bars.html', 'pour-les-bars.html', 'cgu.html']
    .map((f) => normaliser(readFileSync(path.join(racine, f), 'utf8').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')))
    .join(' ');
  for (const phrase of [
    'Aucun bar ne paie pour passer devant un autre.',
    'Rien d’autre ne change cet ordre : ni une note, ni un avis, ni de l’argent.',
    'Un bar peut partir quand il veut.',
    'Ce site n’affiche ni note ni avis, et Baromatch n’en écrit pas à la place des fans.',
    'Les places de l’appli sont celles que le bar met de côté pour Baromatch. Le reste de la salle est pour ceux qui passent la porte sans avoir réservé.',
    'Sans l’appli, ils entrent comme d’habitude.',
  ]) expect(ailleurs, phrase).toContain(phrase);
});

// Une entrée pour chaque visiteur, dès l’ouverture, qui dit où elle mène ; et en bas, une carte pour chacun, avec ce qui
// rassure (déjà publié) et le seul bouton ambre de la page, pour les bars.
test('à propos : une entrée pour le bar, le fan et la presse, en haut comme en bas', async ({ page }) => {
  await page.goto(A_PROPOS);
  const entrees = await page.locator('.apropos__entrees a').evaluateAll((a) => a.map((l) => [l.textContent.replace(/[\s\u00a0]+/g, ' ').trim(), l.getAttribute('href')]));
  expect(entrees).toEqual([
    ['Tu tiens un bar : Proposer mon bar', '/pour-les-bars.html#proposer'],
    ['Tu es fan : Me prévenir', '/#attente'],
    ['Presse ou partenaire : Logos, écrans et contact', '/presse.html'],
  ]);
  const cartes = await page.locator('.apropos__carte').evaluateAll((li) => li.map((c) => ({
    titre: c.querySelector('h3').textContent.trim(),
    bouton: [c.querySelector('.apropos__action a').className, c.querySelector('.apropos__action a').textContent.trim(), c.querySelector('.apropos__action a').getAttribute('href')],
    rassure: c.querySelector('.apropos__rassure').textContent.replace(/[\s\u00a0]+/g, ' ').trim(),
  })));
  expect(cartes.map((c) => [c.titre, ...c.bouton])).toEqual([
    ['Tu tiens un bar', 'capsule', 'Proposer mon bar', '/pour-les-bars.html#proposer'],
    ['Tu es fan', 'apropos__bouton', 'Me prévenir', '/#attente'],
    ['Presse, partenaire, club ou ville', 'apropos__bouton', 'Écrire à Baromatch', `mailto:${MARQUE.contact}?subject=Partenariat%20ou%20presse%20%E2%80%93%20Baromatch`],
  ]);
  expect(cartes[0].rassure).toContain('Une personne lit chaque demande et te répond sous 48 h.');
  expect(cartes[1].rassure).toContain(TEXTES_ATTENTE_NOTE);
  // « Me prévenir » : les mots du bouton de la liste d’attente de l’accueil, où il mène.
  await page.goto('/');
  await expect(page.locator('#attente button[type="submit"]')).toHaveText('Me prévenir');
  expect(normaliser(await page.locator('#attente-usage').textContent())).toContain(TEXTES_ATTENTE_NOTE);
});

// Ce que fait l’appli : trois écrans de l’accueil, chacun marqué « Écran de démonstration », et sous chacun, ce qui se
// passe côté bar, avec les mots de « Pour les bars ». La bande dit aussi que les fans ne réservent pas encore.
test('à propos : trois écrans de démonstration, ce qui se passe côté bar, et les fans qui ne réservent pas encore', async ({ page }) => {
  await page.goto(A_PROPOS);
  const ecrans = await page.locator('.apropos__ecran').evaluateAll((li) => li.map((e) => [
    e.querySelector('img').getAttribute('src'), e.querySelector('.exemple').textContent.trim(), e.querySelector('.apropos__cote-bar').textContent.replace(/[\s\u00a0]+/g, ' ').trim(),
  ]));
  expect(ecrans).toEqual([
    ['/img/appli/ce-soir-300.webp', 'Écran de démonstration', 'Côté bar : chaque bar choisit ses matchs et combien de places il ouvre.'],
    ['/img/appli/ta-soiree-300.webp', 'Écran de démonstration', 'Côté bar : à la porte, le pseudo et le nombre de personnes.'],
    ['/img/appli/tu-y-es-300.webp', 'Écran de démonstration', 'Côté bar : après, l’Historique fait les comptes : réservations, arrivées, absents.'],
  ]);
  expect(normaliser(await page.locator('.apropos__note').textContent())).toBe('Sur ces écrans, les bars, les clubs et les pseudos sont inventés. Les fans ne réservent pas encore : on prépare l’ouverture avec les premiers bars.');
  const bars = normaliser(readFileSync(path.join(racine, 'pour-les-bars.html'), 'utf8').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '));
  expect(bars).toContain('À la porte : le pseudo et le nombre de personnes.');
  expect(bars).toContain('l’Historique fait les comptes : réservations, arrivées, absents');
  expect(bars).toContain('Les fans ne réservent pas encore : on prépare l’ouverture avec les premiers bars.');
});

test('comment on choisit les bars : un h1, et chaque intertitre pose la question à laquelle il répond', async ({ page }) => {
  await page.goto(CONFIANCE);
  await expect(page.locator('h1')).toHaveText('Comment on choisit les bars et les matchs');
  const titres = (await page.locator('main h2').allTextContents()).map(normaliser);
  expect(titres[0]).toBe('En bref');
  expect(titres.slice(1)).toEqual([
    'Quels bars sont sur Baromatch ?',
    'Quand un bar apparaît-il sur ce site ?',
    'Dans quel ordre les bars s’affichent-ils ?',
    'D’où viennent les matchs ?',
    'Qui met à jour les places ?',
    'Qu’est-ce que Baromatch refuse ?',
    'Une erreur, un souci avec un bar ?',
  ]);
});

// L’ordre dit ici est celui que le générateur applique (tests/generateur.spec.mjs, « l’ordre annoncé ») ; aucun
// classement payant n’existe, et la page ne parle pas du tarif des bars (leurs conditions sont sur « Pour les bars »).
test('comment on choisit les bars : l’ordre d’affichage (ville, arrondissement, nom), et aucun bar ne paie sa place', async ({ page }) => {
  await page.goto(CONFIANCE);
  const ordre = normaliser(await page.locator('h2#ordre + p').textContent());
  expect(ordre).toContain('les bars sont rangés par ville, puis par arrondissement');
  expect(ordre).toContain('puis par ordre alphabétique de leur nom');
  expect(ordre).toContain('Aucun bar ne paie pour passer devant un autre.');
  expect(normaliser(await page.locator('h2#en-bref + ul').textContent())).toContain('Aucun bar ne paie pour passer devant un autre.');
});

test('comment on choisit les bars : l’accord écrit, et la phrase d’une page de match sans bar, mot pour mot', async ({ page }) => {
  await page.goto(CONFIANCE);
  const accord = normaliser(await page.locator('#accord + ul').textContent());
  expect(accord).toContain('Après son accord écrit, pas avant.');
  // Le texte d’un bar parti, mot pour mot comme le générateur l’écrit sur sa page.
  expect(accord).toContain(`Sa page dit alors « ${TEXTES.bar.parti} » pendant 30 jours, puis disparaît.`);
  // La phrase d’une page de match sans bar, mot pour mot comme le générateur l’écrit : vraie avec ou sans bar publié.
  expect(normaliser(await page.locator('#match-sans-bar').textContent())).toContain(`« ${TEXTES.match.sansBar} »`);
});

test('comment on choisit les bars : les matchs, les places tenues par le bar, et ce qu’on refuse', async ({ page }) => {
  await page.goto(CONFIANCE);
  const matchs = normaliser(await page.locator('#matchs ~ p').first().textContent());
  expect(matchs).toMatch(/^Des calendriers officiels des compétitions/);
  await expect(page.locator('main')).toContainText('Un bar ne crée pas de match');
  const places = normaliser(await page.locator('#places + p + ul').textContent());
  expect(places).toContain('le coup d’envoi, 15 ou 30 minutes après');
  const refus = (await page.locator('#refus + ul > li > strong').allTextContents()).map(normaliser);
  expect(refus).toEqual(['Les faux bars.', 'Les faux avis.', 'Les chiffres inventés.', 'Ce qui pousse à boire.', 'Les écussons et les logos.', 'Le direct du match.', 'Les paris.']);
  expect(normaliser(await page.locator('#refus + ul').textContent())).toContain(`« ${MENTION_SANTE} »`);
});

// Le pied de page des pages générées (matchs, villes, bars) : le même que celui des pages fixes, les deux pages de
// confiance comprises. Le générateur écrit son pied lui-même (generateur/gabarits.mjs) : il ne le lit pas dans l’accueil.
test('les pages générées ont le pied de page commun, avec « À propos » et « Comment on choisit les bars »', async () => {
  const { pages } = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario() });
  expect(pages.length).toBeGreaterThan(0);
  const decoder = (texte) => texte.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/[\s\u00a0]+/g, ' ').trim();
  for (const p of pages.filter((q) => q.chemin.endsWith('/'))) {
    const pied = p.contenu.match(/<ul class="pied__liens">([\s\S]*?)<\/ul>/)?.[1] ?? '';
    const liens = [...pied.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, texte]) => [href, decoder(texte)]);
    expect(liens, p.chemin).toEqual(PIED);
  }
});

// La FAQ des fans sur l’accueil : chaque question visible est dans la FAQ balisée (une seule FAQPage), mot pour mot et
// dans l’ordre ; chaque réponse dit la règle de l’appli à un niveau certain. Tant que l’appli n’est pas ouverte, la
// première réponse le dit, et mène à la liste d’attente.
test.describe('accueil : la FAQ des fans', () => {
  const lireLaFaq = async (page) => {
    await page.goto('/');
    const noeuds = await graphe(page);
    const faqs = noeuds.filter((n) => n['@type'] === 'FAQPage');
    const visibles = await page.$$eval('.questions-fans details', (liste) => liste.map((details) => ({
      question: details.querySelector('summary').textContent,
      reponse: [...details.children].filter((e) => e.tagName !== 'SUMMARY').map((e) => e.textContent).join(' '),
    })));
    return { faqs, visibles: visibles.map((v) => [v.question, v.reponse].map(normaliser)) };
  };

  test('une seule FAQPage, qui répète mot pour mot chaque question et chaque réponse de la page, dans l’ordre', async ({ page }) => {
    const { faqs, visibles } = await lireLaFaq(page);
    expect(faqs).toHaveLength(1);
    const [faq] = faqs;
    expect(faq.url).toBe(`${ORIGINE}/`);
    expect(faq.name).toBe(await page.title());
    expect(faq.isPartOf['@id']).toBe(`${ORIGINE}/#site`);
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text].map(normaliser))).toEqual(visibles);
    expect(visibles.map(([question]) => question)).toEqual([
      'Je peux déjà garder une place ?',
      'C’est gratuit ?',
      'Il faut un compte ?',
      'Je peux venir avec des potes ?',
      'Ma place est vraiment gardée ?',
      'Et si j’arrive en retard ?',
      'Comment j’annule ma place ?',
      'Dans quelles villes ?',
    ]);
    for (const [, reponse] of visibles) expect(reponse).not.toContain('!');
  });

  test('les réponses disent les règles de l’appli : gratuit, code de 6 chiffres, 1 à 8, 30 minutes au plus, Paris', async ({ page }) => {
    const { visibles } = await lireLaFaq(page);
    const reponse = (debut) => visibles.find(([question]) => question.startsWith(debut))[1];
    if (!MARQUE.appli.ouverte) {
      expect(reponse('Je peux déjà')).toMatch(/^Pas encore\. Baromatch est en test sur Android, à Paris/);
      // Le lien dans la réponse (le rappel « préviens-moi », sous les questions, est vérifié par accueil.spec.mjs).
      await expect(page.locator('.questions-fans details a[href="#attente"]')).toHaveText('Laisse ton adresse');
    }
    expect(reponse('C’est gratuit')).toMatch(/^Oui\..*Ce que tu prends au bar, tu le paies au bar\.$/);
    expect(reponse('Il faut un compte')).toContain('code de 6 chiffres, valable 10 minutes');
    expect(reponse('Il faut un compte')).toContain('18 ans ou plus');
    expect(reponse('Je peux venir')).toContain('de 1 à 8');
    expect(reponse('Et si j’arrive')).toContain('jusqu’à 30 minutes après le coup d’envoi au plus');
    expect(reponse('Et si j’arrive')).toContain('15 minutes après, ou le coup d’envoi lui-même');
    expect(reponse('Comment j’annule')).toContain('« Je ne viens plus », puis « Libérer »');
    expect(reponse('Dans quelles villes')).toMatch(/^À Paris/);
  });

  test('les questions se déplient au clavier, et la réponse se lit', async ({ page }) => {
    await page.goto('/');
    const premiere = page.locator('.questions-fans summary').nth(1);
    await premiere.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.questions-fans details').nth(1)).toHaveAttribute('open', '');
    await expect(page.locator('.questions-fans details').nth(1).locator('p')).toBeVisible();
  });
});
