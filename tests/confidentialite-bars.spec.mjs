// La section « Les demandes des bars » de confidentialite.html, et ce que la page des bars en dit : le texte que
// promet la page Confidentialité sur une demande envoyée par le formulaire de pour-les-bars.html. Le formulaire
// lui-même est vérifié par pour-les-bars-formulaire.spec.mjs.
import { test, expect } from '@playwright/test';

const PAGE = '/pour-les-bars.html';

test('la section des bars dit la durée, le brouillon de l’onglet, à qui écrire, la CNIL et le prestataire qui envoie le mail', async ({ page }) => {
  await page.goto('/confidentialite.html#bars');
  await expect(page.locator('h2#bars')).toBeVisible();
  const section = await page.evaluate(() => {
    const morceaux = [];
    for (let e = document.getElementById('bars').nextElementSibling; e && e.tagName !== 'H2'; e = e.nextElementSibling) morceaux.push(e.textContent);
    return morceaux.join(' ').replace(/\s+/g, ' ');
  });
  for (const attendu of ['12 mois', 'onglet', 'contact@baromatch.fr', 'CNIL', 'sans ton adresse IP', 'export', 'Resend']) expect(section).toContain(attendu);
  // Une seule adresse pour toute demande sur ses données : l’ancienne adresse dédiée n’est plus nommée.
  expect(section).not.toContain('confidentialite@');
  // Le brouillon ne s’efface pas quand la demande part par la messagerie : la page ne le promet pas.
  expect(section).not.toContain('il s’efface quand ta demande part');
  expect(section).toContain('quand ta demande part depuis cette page');
  // Au bout de 12 mois, la demande et le mail qui nous a prévenus sont effacés à la main : la page ne promet pas
  // d’effacement automatique.
  expect(section).toMatch(/12 mois à partir de ta demande\. Au bout de ce délai, on efface nous-mêmes ta demande[^.]*mail qui nous a prévenus/);
  expect(section).not.toMatch(/automatique/);
  // Resend nommé, avec son pays, et un renvoi à la liste des prestataires. Aucune garantie de transfert n’est
  // annoncée tant qu’elle n’est pas établie.
  expect(section).toContain('Resend est l’un de nos prestataires techniques, établi aux États-Unis');
  expect(section).not.toMatch(/clauses contractuelles types|mécanisme équivalent/);
  const renvoi = page.locator('#bars ~ ul a[href="#prestataires"]');
  await expect(renvoi).toHaveCount(1);
  await expect(page.locator('#prestataires')).toHaveText('Nos prestataires');
  // La liste des prestataires dit que Resend envoie aussi le mail qui nous prévient d’une demande de bar.
  await expect(page.locator('#prestataires + ul')).toContainText('Resend envoie le mail avec ton code de connexion, et le mail qui nous prévient d’une demande de bar.');
});

// La section « Les demandes des bars » de la page Confidentialité dit le texte validé par le propriétaire, qui décrit
// ce que fait le serveur : ni plus, ni moins. Chaque point de la liste est comparé en entier à son texte attendu : une phrase en
// trop (une seconde raison, par exemple) ou en moins fait échouer le test, qui montre l’écart point par point.
// Le texte attendu est écrit avec des espaces ordinaires ; les espaces insécables ont leur propre test.
test.describe('la page Confidentialité dit, mot pour mot, le texte attendu sur le formulaire des bars', () => {
  const INTRO = 'Cette partie concerne les personnes qui proposent leur bar à Baromatch avec le formulaire de la page « Pour les bars ».';
  const POINTS = {
    // Ce qui est gardé d’une demande, et rien d’autre.
    'Ce qu’on collecte':
      'le nom du bar, sa ville, ton nom, ton adresse mail (gardée en minuscules), et ton téléphone et ton message si tu les donnes. '
      + 'On garde aussi l’heure à laquelle tu as coché la case qui dit que tu as lu cette page (c’est celle de ta demande), '
      + 'l’heure de ta demande, et l’heure à laquelle le mail qui nous prévient est parti. '
      + 'Rien d’autre : ta demande est enregistrée sans ton adresse IP, et sans rien sur ton appareil ou ton navigateur.',
    // Ce qui écarte les robots, et la cadence dite au visiteur.
    'Contre les envois en masse':
      'le formulaire a un champ caché, qui doit rester vide, et mesure le temps passé à le remplir. '
      + 'Notre serveur lit ces deux informations pour écarter les robots, puis il les jette : elles ne sont pas gardées avec ta demande. '
      + 'Il limite aussi les envois à 5 demandes par heure depuis un même réseau. '
      + 'Pour les compter, il garde le réseau de la connexion (une adresse IPv4, ou un bloc IPv6 /64) pendant une heure '
      + 'dans une mémoire temporaire, avec le même mécanisme que les autres limites du serveur. '
      + 'Il compte aussi, pour tout le service, les e-mails de la journée. '
      + 'Aucune adresse IP n’est écrite dans la base de données.',
    // Une seule raison.
    'Pourquoi':
      'te répondre, à toi qui as demandé à rejoindre Baromatch. Rien d’autre.',
    // La base légale et la case : pas le consentement.
    'Sur quelle base':
      'ce sont des démarches faites à ta demande avant de conclure un contrat, et non ton consentement : '
      + 'tu demandes à travailler avec Baromatch. '
      + 'La case à cocher est obligatoire : sans elle, le formulaire n’envoie rien et notre serveur ne garde aucune demande. '
      + 'Elle dit seulement que tu as lu cette page ; ce n’est pas un accord pour recevoir de la publicité, et on ne t’inscrit à aucune liste.',
    // Qui lit une demande, et ce qui arrive quand le mail ne part pas ; la règle de transfert de la page, en dernier.
    'Qui y a accès':
      'uniquement la personne qui gère Baromatch, par mail. '
      + 'Chaque demande lui est envoyée au plus une fois, par Resend, le prestataire qui envoie déjà les codes de connexion de l’appli. '
      + 'Quand on répond à ce mail, la réponse part à ton adresse. '
      + 'Le nombre de ces mails est limité sur 24 heures, pour tout le service, '
      + 'pour que les codes de connexion, qui passent par le même compte Resend, ne manquent jamais. '
      + 'Si l’envoi échoue, ou si cette limite est atteinte, ta demande est gardée mais jamais envoyée par mail : '
      + 'elle n’est que sur le serveur, sans heure d’envoi. '
      + 'Aucun écran de l’appli ni de la console des bars ne montre ta demande. '
      + 'Rien n’est vendu ni loué. '
      + 'Resend est l’un de nos prestataires techniques, établi aux États-Unis (voir « Nos prestataires »).',
    // Les journaux ne portent pas le contenu d’une demande ; aucun rapport d’erreurs ne part chez un service extérieur.
    'Journaux du serveur':
      'ils ne contiennent aucun champ du formulaire. '
      + 'Quand un envoi échoue, le journal reçoit seulement le numéro de la demande dans la base et le type d’échec.',
    // La page : le repli par la messagerie du visiteur.
    'Si le formulaire ne répond pas':
      'la page te propose d’envoyer ta demande depuis ta propre messagerie : elle arrive alors dans notre boîte contact@baromatch.fr.',
    // La durée, sur le serveur et dans la boîte mail : un effacement fait à la main, tant que l’effacement automatique
    // n’est pas en route.
    'Combien de temps':
      '12 mois à partir de ta demande. '
      + 'Au bout de ce délai, on efface nous-mêmes ta demande de notre serveur, '
      + 'et de notre boîte le mail qui nous a prévenus (ou ta demande, si elle est arrivée par mail). '
      + 'Resend garde ses propres journaux, selon ses propres conditions.',
    // La page : le brouillon de l’onglet (stockage de session), puis, une fois la demande partie, ce que pour-les-bars.js
    // garde de la dernière demande (baromatch-demande-bar-partie : l’adresse, le bar, l’heure ; 10 minutes).
    'Sur ton appareil':
      'ce que tu tapes est gardé dans cet onglet de ton navigateur, et seulement là (stockage de session), '
      + 'pour ne rien perdre si la page se recharge. La case à cocher n’est pas gardée. Ce brouillon n’est transmis à personne. '
      + 'Il est effacé quand ta demande part depuis cette page, ou quand tu fermes l’onglet ; '
      + 'si tu l’envoies depuis ta messagerie, il reste dans l’onglet jusqu’à ce que tu le fermes. '
      + 'Quand ta demande part depuis cette page, l’onglet garde seulement ton adresse mail, le nom du bar et l’heure de l’envoi, '
      + 'pour reconnaître une correction envoyée dans les 10 minutes et te la faire passer par ta messagerie. '
      + 'Passé ces 10 minutes, la page ne s’en sert plus et les efface ; au plus tard, ils disparaissent quand tu fermes l’onglet.',
    // Les droits, traités à la main ; « sous un mois » est aussi dans « Tes droits ».
    'Voir, corriger ou effacer ta demande':
      'écris à contact@baromatch.fr. C’est traité à la main, sous un mois. '
      + 'Une demande n’est reliée à aucun compte, et le formulaire ne vérifie aucune adresse : '
      + 'n’importe qui peut y taper celle d’un autre, ou se tromper dans la sienne. '
      + 'Aucun compte, quels que soient son rôle et son adresse, ne montre donc ni n’efface une demande tout seul : '
      + 'l’export de tes données dit qu’il ne les contient pas, et comment les demander, et la suppression d’un compte les laisse. '
      + 'On vérifie que ton message vient de l’adresse de la demande, puis on te répond : '
      + 'on te la montre, on la corrige, ou on l’efface avec le mail qui nous a prévenus. '
      + 'Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL sur cnil.fr.',
  };

  async function lireLesBars(page) {
    await page.goto('/confidentialite.html#bars');
    return page.evaluate(() => {
      const net = (texte) => texte.replace(/[ \t\r\n]+/g, ' ').trim();
      const points = {};
      const paragraphes = [];
      const liens = [];
      const brut = [];
      const balises = [];
      for (let e = document.getElementById('bars').nextElementSibling; e && e.tagName !== 'H2'; e = e.nextElementSibling) {
        brut.push(e.textContent);
        balises.push(e.tagName);
        if (e.tagName === 'P') paragraphes.push(net(e.textContent.replace(/ /g, ' ')));
        for (const a of e.querySelectorAll('a')) liens.push(a.getAttribute('href'));
        for (const li of e.querySelectorAll('li')) {
          const gras = li.querySelector('strong');
          const titre = net(gras.textContent.replace(/ /g, ' ')).replace(/ :$/, '');
          points[titre] = net(li.textContent.slice(gras.textContent.length).replace(/ /g, ' '));
        }
      }
      return { points, paragraphes, balises, liens, brut: brut.join('\n'), texte: net(brut.join(' ').replace(/ /g, ' ')) };
    });
  }

  test('la section a l’introduction et les points attendus, dans l’ordre, et rien d’autre : le texte entier est celui attendu', async ({ page }) => {
    const { points, paragraphes, balises, texte } = await lireLesBars(page);
    expect(paragraphes).toEqual([INTRO]);
    expect(Object.keys(points)).toEqual(Object.keys(POINTS));
    // Chaque point mot pour mot : en cas d’écart, la différence se lit point par point.
    expect(points).toEqual(POINTS);
    // Entre <h2 id="bars"> et le <h2> suivant : un paragraphe, une liste, et tout leur texte. Un <h3>, un <div> ou une
    // phrase de plus, où que ce soit dans la section, fait échouer ce test.
    expect(balises).toEqual(['P', 'UL']);
    expect(texte).toBe([INTRO, ...Object.entries(POINTS).map(([titre, attendu]) => `${titre} : ${attendu}`)].join(' '));
  });

  test('la section n’annonce qu’une raison, et aucun point ne dit « installer » ni « créer ton bar »', async ({ page }) => {
    const { texte } = await lireLesBars(page);
    expect(texte).not.toMatch(/install|créer ton bar|mettre en place|prospect|démarchage|si on avance/i);
  });

  test('aucun compte ne voit ni n’efface une demande, même avec la même adresse (plus de point « compte de fan »)', async ({ page }) => {
    const { points, texte } = await lireLesBars(page);
    expect(Object.keys(points).filter((titre) => /compte/i.test(titre))).toEqual([]);
    expect(texte).not.toMatch(/figurent dans l’export|effacées en même temps que ton compte|même adresse mail|majuscules ou minuscules/);
    // La base légale n’est pas le consentement, et la case dit seulement « j’ai lu cette page ».
    expect(points['Sur quelle base']).toMatch(/avant de conclure un contrat, et non ton consentement/);
  });

  test('les espaces insécables : avant « : », « ; », « ? », « ! » et « », jamais une espace ordinaire', async ({ page }) => {
    const { brut } = await lireLesBars(page);
    const lignes = brut.replace(/[ \t\r\n]+/g, ' ');
    expect(lignes.match(/\S [:;?!»]/g) ?? []).toEqual([]);
    expect(lignes.match(/« \S/g) ?? []).toEqual([]);
    expect(lignes.match(/\d mois/g) ?? []).toEqual([]);
    expect(brut).toContain('Ce qu’on collecte :');
  });

  test('les liens : contact@baromatch.fr pour voir ou effacer et pour le repli, Nos prestataires, la CNIL', async ({ page }) => {
    const { liens, texte } = await lireLesBars(page);
    // Une seule adresse pour les données : le lien pour voir, corriger ou effacer est contact@, et le repli la nomme aussi.
    const mails = liens.filter((href) => href.startsWith('mailto:'));
    expect(mails).toEqual(['mailto:contact@baromatch.fr']);
    expect(texte.match(/contact@baromatch\.fr/g)).toHaveLength(2);
    expect(texte).not.toContain('confidentialite@');
    // Un renvoi à « Nos prestataires » (Resend), la CNIL ; plus de renvoi aux rapports d’erreurs, qui ne partent nulle part.
    expect(liens.filter((href) => href === '#prestataires')).toHaveLength(1);
    expect(liens.filter((href) => href === '#plantages')).toHaveLength(0);
    expect(liens.filter((href) => href.startsWith('https://'))).toEqual(['https://www.cnil.fr']);
    await expect(page.locator('#plantages')).toHaveText('Les rapports d’erreurs');
    await expect(page.locator('#prestataires')).toHaveText('Nos prestataires');
    // « On te répond sous un mois » : la page s’y engage aussi dans « Tes droits ».
    await expect(page.locator('h2', { hasText: 'Tes droits' }).locator('xpath=following-sibling::p[1]')).toContainText('On te répond sous un mois.');
  });

  test('la page des bars annonce la même seule raison : la FAQ visible et la FAQ balisée disent « seulement à te répondre »', async ({ page }) => {
    await page.goto(PAGE);
    const { visible, balisee, phrases } = await page.evaluate(() => {
      const net = (texte) => texte.replace(/\s+/g, ' ').trim();
      const resume = [...document.querySelectorAll('details > summary')].find((s) => net(s.textContent) === 'Que deviennent les données ?');
      const visible = resume ? net(resume.parentElement.querySelector('p').textContent) : null;
      const questions = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .flatMap((s) => JSON.parse(s.textContent)['@graph'] ?? [JSON.parse(s.textContent)])
        .flatMap((n) => n.mainEntity ?? []);
      const question = questions.find((q) => net(q.name) === 'Que deviennent les données ?');
      const phrases = [...document.querySelectorAll('p, li, label, summary, dd, dt, h1, h2, h3')].map((e) => net(e.textContent))
        .concat(questions.map((q) => net(q.acceptedAnswer.text)));
      return { visible, balisee: question ? net(question.acceptedAnswer.text) : null, phrases };
    });
    const attendu = 'Celles des fans : tu ne vois jamais leur e-mail, et ton Historique ne garde que des totaux. Ce que tu écris dans le formulaire sert seulement à te répondre : tout est expliqué dans la page confidentialité.';
    expect(visible).toBe(attendu);
    expect(balisee).toBe(attendu);
    await expect(page.locator('details:has(summary:text("Que deviennent les données")) a')).toHaveAttribute('href', '/confidentialite.html#bars');
    // Aucune phrase de la page ne dit que ce qui est écrit dans le formulaire sert à créer le bar ou à autre chose.
    // (Ce qui se passe ensuite entre le bar et Baromatch — « on crée ton bar » — n’est pas un usage des données.)
    expect(phrases.filter((p) => /(sert|servent|serviront|utilis\w*)[^.]*(créer|crée|installer|prospect|démarch)/i.test(p))).toEqual([]);
    expect(phrases.filter((p) => /(écris|saisis|envoies|données)[^.]*à créer ton bar/i.test(p))).toEqual([]);
  });
});
