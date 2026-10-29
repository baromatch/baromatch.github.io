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
  expect(plantages).toContain('dans la région Europe de Sentry (Francfort, en Allemagne). Sentry garde les rapports 30 jours avec son offre gratuite (90 jours avec une offre payante), puis les efface.');
  expect(plantages).toContain('le code enlève ton adresse mail, ton pseudo, un prénom, l’identifiant de ton compte');
  expect(plantages).toContain('Avant de l’allumer, on règle notre compte Sentry pour qu’il ne la garde pas.');
  // Ce que le kit de Sentry de l’appli peut envoyer de lui-même : la page le dit.
  expect(plantages).toContain('un signal sans compte qui compte les ouvertures sans plantage');
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

// La recherche de la carte (le besoin n° 40 de l’appli, 27 octobre 2026) : tout ce que le fan tape, dès 3 caractères,
// part vers l’IGN, même un nom de bar ou de club ; la réponse reste 5 minutes, sans le compte. Et les messages de Baromatch
// sur un match (le besoin n° 41) : à qui, combien, et comment les couper ; aucun ne part tant que les notifications du
// serveur n’arrivent pas sur le téléphone.
test('la page Confidentialité : tout texte de la recherche part vers l’IGN, et les messages de Baromatch sur un match', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const ligneRecherche = page.locator('#position + ul > li', { hasText: 'La recherche de la carte' });
  await expect(ligneRecherche).toHaveCount(1);
  await expect(page.locator('#messages-match')).toHaveCount(1);
  const recherche = normaliser(await ligneRecherche.innerText());
  expect(recherche).toContain('tout ce que tu tapes dans la recherche, dès 3 caractères, part de notre serveur vers la Géoplateforme de l’IGN');
  expect(recherche).toContain('Pas seulement une adresse : un nom de bar, de club ou de quartier part aussi.');
  expect(recherche).toContain('L’IGN ne reçoit que ce texte : ni ton compte, ni ton adresse IP.');
  expect(recherche).toContain('Notre serveur garde les adresses trouvées 5 minutes, sans ton compte');
  const texte = await texteDe(page, '/confidentialite.html');
  expect(texte).not.toContain('recherche d’adresse');
  const messages = normaliser(await page.locator('#messages-match').innerText());
  expect(messages).toContain('quand les notifications de notre serveur arriveront sur ton téléphone, Baromatch pourra t’envoyer de temps en temps un message sur un match : un match qui approche, ou la mi-temps.');
  expect(messages).toContain('Seulement si tu as allumé « Messages de Baromatch » dans Réglages (il est coupé au départ) : c’est ton accord, et notre serveur garde la date où tu l’as donné.');
  expect(messages).toContain('Et seulement si une de tes arrivées a été validée dans un bar ces 7 derniers jours');
  expect(messages).toContain('Par match, au plus une de ces notifications : ton club qui joue, une soirée qui ouvre, ou ce message. Aucune pour un match où tu as déjà ta place.');
  expect(messages).not.toContain('Offres des bars');
  expect(messages).toContain('Pour ne plus les recevoir, coupe « Messages de Baromatch » dans Réglages : ton accord est retiré.');
  // Couper les notifications du téléphone les cache, sans retirer l’accord gardé par le serveur (soir-de-match #143).
  expect(messages).toContain('Couper les notifications de Baromatch dans les réglages de ton téléphone les cache aussi, sans retirer ton accord.');
  // Aujourd’hui, rien ne part encore du serveur : la page le dit toujours, juste avant.
  await expect(page.locator('#notifications + ul > li').nth(1)).toContainText('Notre serveur n’envoie aucune notification sur ton téléphone pour l’instant');
  // Sa base est écrite, et le résumé « en clair » des intérêts légitimes, auquel renvoie le droit de s’opposer, la compte.
  const base = page.locator('#pourquoi + p + ul > li', { hasText: 'T’envoyer de temps en temps un message sur un match' });
  await expect(base).toHaveCount(1);
  // Depuis soir-de-match #143 : un accord, coupé au départ, plus notre intérêt légitime.
  await expect(base).toContainText('ton accord, donné en allumant « Messages de Baromatch » dans Réglages (il est coupé au départ), quand les notifications de notre serveur arriveront sur ton téléphone');
  await expect(base).not.toContainText('intérêt légitime');
  await expect(base).toContainText('ou qu’il arrive à la mi-temps');
  await expect(page.locator('#pourquoi ~ p', { hasText: 'Nos intérêts légitimes, en clair' })).not.toContainText('mi-temps');
  expect(await texteDe(page, '/confidentialite.html')).toContain('« Messages de Baromatch », coupé tant que tu ne l’allumes pas ;');
  expect(await texteDe(page, '/confidentialite.html')).not.toContain('Offres des bars');
  await expect(page.locator('#pourquoi + p + ul a[href="#messages-match"]')).toHaveCount(1);
});

// Les sauvegardes : faites par nous, chiffrées, effacées une fois leurs 28 jours passés, à la sauvegarde suivante
// (5 semaines au plus avec une sauvegarde par semaine), jamais chez Railway ; un compte supprimé y reste autant. Et chaque durée de conservation de l’appli a sa ligne dans « Combien de temps ».
test('la page Confidentialité : les sauvegardes chiffrées, 5 semaines au plus, et une ligne par durée', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const sauvegardes = normaliser(await page.locator('#sauvegardes + ul').innerText());
  expect(sauvegardes).toContain('Qui les fait : nous, pas Railway.');
  expect(sauvegardes).toContain('chaque copie est chiffrée avec une phrase de passe que seul le responsable de Baromatch connaît');
  expect(sauvegardes).toContain('Jamais chez Railway.');
  expect(sauvegardes).toContain('une sauvegarde est effacée une fois ses 28 jours passés, au moment de la sauvegarde suivante');
  expect(sauvegardes).toContain('une copie vit donc 5 semaines au plus');
  expect(sauvegardes).toContain('par exemple OneDrive, de Microsoft, une société américaine');
  expect(sauvegardes).not.toContain('effacée au bout de 28 jours');
  expect(sauvegardes).toContain('il reste dans les sauvegardes faites avant, jusqu’à ce qu’elles soient effacées : 5 semaines au plus.');
  await expect(page.locator('#suppression + p + ul')).toContainText('ton compte reste dans les sauvegardes faites avant ta suppression, jusqu’à ce qu’elles soient effacées : 5 semaines au plus');
  await expect(page.locator('#prestataires + ul > li', { hasText: /^Railway/ })).toContainText('Railway ne fait pas de sauvegarde de notre base : c’est nous qui les faisons');
  const texte = await texteDe(page, '/confidentialite.html');
  expect(texte).not.toMatch(/sauvegarde de notre base, chez Railway|copies de sauvegarde de notre base, chez Railway/);
  await page.goto('/confidentialite.html');
  const durees = (await page.locator('#combien-de-temps ~ ul').first().locator('> li').allInnerTexts()).map(normaliser);
  for (const ligne of [
    'L’heure à laquelle tu dis arriver avec « Je suis en retard », et l’heure jusqu’à laquelle ta place est alors gardée : aujourd’hui, avec ta place. Prévu : effacées un jour après le coup d’envoi.',
    'L’attente après des mauvais mots de passe, pour l’équipe des bars : 24 heures après le dernier mauvais mot de passe.',
    'La case « mot de passe à changer » d’un compte de bar : jusqu’à ce que la personne choisisse son propre mot de passe.',
    'Les sauvegardes chiffrées de notre base : effacées une fois leurs 28 jours passés, à la sauvegarde suivante (5 semaines au plus).',
    'Les rapports d’erreurs chez Sentry, une fois allumé : 30 jours avec son offre gratuite, 90 avec une offre payante.',
    'Nos mails d’alerte, sans donnée personnelle : dans notre boîte mail tant qu’on les garde, et chez Resend selon ses conditions.',
    'Les compteurs du service (des nombres par tranche de 5 minutes, sans personne) : 2 heures.',
    'La demande d’un bar envoyée par le formulaire du site : 12 mois, puis on l’efface nous-mêmes (voir « Les demandes des bars »).',
  ]) expect(durees).toContain(ligne);
});

// Ce qui a changé pour les fans en octobre 2026 : « Je suis en retard », les places en direct (des chiffres), « Je veux
// le voir » pour tout Paris, la confirmation des 18 ans redemandée après une déconnexion, et ce que la déconnexion et la
// suppression effacent du téléphone. Ce qui vient avec l’appli le dit (« Avec la mise à jour d’octobre 2026 de l’appli »).
test('la page Confidentialité : le retard annoncé, les places en direct, tout Paris, la déconnexion', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const retard = normaliser(await page.locator('#retard + ul').innerText());
  expect(retard).toContain('tu peux prévenir le bar que tu arrives dans 10, 20 ou 30 minutes, une fois par place');
  expect(retard).toContain('Ni ta position, ni un message.');
  expect(retard).toContain('toi, et le bar de cette soirée, pendant la soirée');
  expect(retard).toContain('aujourd’hui, avec ta place. Prévu : effacées un jour après le coup d’envoi. Si tu supprimes ton compte, elles sont effacées tout de suite.');
  expect(retard).toContain('La trace de sécurité (que tu as prévenu, et de combien de minutes) suit la durée des traces de sécurité');
  await expect(page.locator('#qui-voit-quoi + ul')).toContainText('se mettent à jour en direct sur les téléphones : ce sont des chiffres seulement, jamais qui a pris ou rendu une place');
  const notifications = normaliser(await page.locator('#notifications + ul').innerText());
  expect(notifications).toContain('« Je veux le voir », dit sans choisir de quartier, compte pour tout Paris : il entre dans les chiffres des bars de Paris, des nombres sans ton pseudo');
  expect(notifications).toContain('quand un bar ouvre une soirée pour ce match en réponse à ces envies');
  expect(notifications).toContain('ils quittent l’écran verrouillé dès que tu te déconnectes, que tu supprimes ton compte ou que tu coupes « Mes soirées »');
  await expect(page.locator('#collecte + ul')).toContainText('elle est effacée du téléphone quand tu te déconnectes : la personne qui se connecte ensuite sur ce téléphone confirme pour elle-même');
  await expect(page.locator('#collecte + ul')).toContainText('notre serveur le vérifie seul, avec cette liste, sans l’envoyer à aucun autre service');
  const deconnexion = normaliser(await page.locator('#deconnexion + p + ul').innerText());
  expect(deconnexion).toContain('ta confirmation d’avoir 18 ans : la personne qui se connecte ensuite confirme pour elle-même');
  expect(deconnexion).toContain('les rappels de tes places sur l’écran verrouillé');
  expect(deconnexion).toContain('le fichier de tes données et les images de story ou de badge');
  await expect(page.locator('#deconnexion + p')).toContainText('Avec la mise à jour d’octobre 2026 de l’appli');
  // Le jeton n’est retiré que par « Me déconnecter » : pas quand le serveur ferme la session.
  await expect(page.locator('#deconnexion + p + ul + p')).toContainText('Si c’est notre serveur qui a fermé la session, le jeton reste enregistré avec ton compte.');
  const suppression = normaliser(await page.locator('#suppression + p + ul').innerText());
  expect(suppression).toContain('elle retire aussi de l’écran verrouillé les rappels de tes places, et efface le fichier de tes données et les images de story ou de badge');
  expect(suppression).toContain('l’heure à laquelle tu avais dit arriver avec « Je suis en retard »');
});

// L’équipe des bars : l’attente après des mauvais mots de passe (par réseau, ce qui est gardé, 24 heures), le
// changement de mot de passe qui ferme les autres sessions, le premier mot de passe à changer, le code de porte, et la
// copie hors ligne de la console qui ne garde plus les réservations. Plus la phrase d’avant (« tu ne peux pas encore le
// changer toi-même »), devenue fausse.
test('la page Confidentialité : l’équipe des bars, ses mots de passe et le code de porte', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const equipe = normaliser(await page.locator('#equipe-des-bars + p + ul').innerText());
  expect(equipe).toContain('le prochain essai pour cette adresse, depuis le même réseau, doit attendre');
  expect(equipe).toContain('C’est compté par réseau, pas pour tout le compte');
  expect(equipe).toContain('une empreinte de l’adresse mail tapée (pas l’adresse elle-même), le réseau d’où l’essai est parti (son adresse IP), le nombre de mauvais mots de passe d’affilée, l’heure du dernier et la fin de l’attente');
  expect(equipe).toContain('Chaque réseau est oublié 24 heures après son dernier mauvais mot de passe');
  expect(equipe).toContain('Aujourd’hui, pour une connexion par la console, ce réseau est celui de notre serveur de console');
  expect(equipe).toContain('Changer ton mot de passe ferme tout de suite tes autres sessions');
  expect(equipe).toContain('si c’est le patron qui a choisi ton mot de passe en t’ajoutant, tu en choisis un à toi à ta première connexion');
  expect(equipe).toContain('un QR à usage unique, valable 10 minutes');
  expect(equipe).toContain('On ne garde pas ce code lui-même, seulement une empreinte');
  expect(equipe).toContain('jamais les réservations, l’équipe ni les arrivées. Cette copie est vidée quand la session se termine sur ce navigateur.');
  expect(equipe).not.toMatch(/tu ne peux pas encore le changer|cette copie reste après la déconnexion/);
});

// Ce que voit le bar, et l’indice anti-triche : les pseudos pendant la soirée seulement, plus l’identifiant du compte,
// un indice tiré des seules arrivées dans ce bar ; l’indice complet reste dans notre journal. Le code d’arrivée ne
// retrouve à la porte que les fans que ce bar connaît ce jour-là. Plus aucune des phrases d’avant, devenues fausses.
test('la page Confidentialité : ce que voit le bar, l’indice anti-triche et la portée du code d’arrivée', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const bar = normaliser(await page.locator('#qui-voit-quoi + ul > li', { hasText: /^Le bar où tu réserves/ }).innerText());
  expect(bar).toContain('voit dans ses listes, le soir du match (de 3 heures avant le coup d’envoi à 3 heures après), ton pseudo');
  expect(bar).toContain('Pour ses autres soirées, avant comme après, il ne voit que des chiffres. Il ne reçoit pas l’identifiant de ton compte.');
  expect(bar).toContain('cet indice ne tient compte que des arrivées dans ce bar, jamais de tes arrivées dans d’autres bars');
  expect(bar).toContain('combien de fans sont revenus chez lui (au moins deux arrivées sur la période qu’il choisit)');
  await expect(page.locator('#qui-voit-quoi + ul > li', { hasText: /^Notre journal de sécurité/ })).toContainText('tient compte aussi de ta dernière arrivée dans un autre bar. Il sert à repérer la triche, et aucun bar ne le reçoit.');
  await expect(page.locator('#pass + ul')).toContainText('il ne retrouve que les fans que ce bar connaît ce jour-là');
  const texte = await texteDe(page, '/confidentialite.html');
  expect(texte).not.toMatch(/jusqu’à 3 jours avant, dans sa console|Il reçoit aussi un identifiant technique de ton compte|Aujourd’hui, cet indice tient compte de ta dernière arrivée|l’équipe de n’importe quel bar Baromatch peut s’en servir|dans un bar Baromatch dans les 7 jours/);
});

// La modération des pseudos : ce qui est gardé d’un signalement, ce que voit la plateforme (des nombres, jamais qui),
// aucun bar, et le renommage décidé par une personne, jamais par les signalements seuls.
test('la page Confidentialité : les pseudos signalés, ce que voit la plateforme, et le renommage', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const signalements = normaliser(await page.locator('#signalements + ul').innerText());
  expect(signalements).toContain('qui signale (ton compte), le compte signalé, la raison choisie et la date');
  expect(signalements).toContain('La personne signalée n’en voit rien, et aucun bar ne voit les signalements de pseudos.');
  expect(signalements).toContain('le pseudo d’aujourd’hui, le nombre de personnes qui l’ont signalé, les raisons, et les dates du premier et du dernier signalement. Jamais qui a signalé, jamais une adresse mail.');
  expect(signalements).toContain('un signalement n’agit jamais tout seul');
  expect(signalements).toContain('qui reçoit alors un pseudo tiré au hasard');
  expect(signalements).toContain('L’ancien pseudo n’est pas gardé.');
  expect(signalements).toContain('n’est pas enregistré avant 30 jours après le sien');
  await expect(page.locator('#pourquoi + p + ul')).toContainText('Refuser un pseudo insultant, traiter les signalements et bannir un compte qui triche');
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
