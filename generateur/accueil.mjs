// L’accueil, le prochain match d’abord : « Le prochain match », sous l’ouverture. L’accueil est écrit à la main
// (index.html) ; le générateur n’y écrit que ce bloc, entre ses deux repères, et rien d’autre : ecrireLAccueil vérifie,
// avant d’écrire, que tout ce qui est hors des repères est resté identique, octet pour octet. (Les repères gardent leur
// ancien nom, « semaine » : l’Action pages-des-matchs.yml les lit.)
// Le bloc : la carte du prochain match qui n’a pas commencé (la lumière de ses deux clubs, leurs deux insignes à la taille
// de la carte, l’heure du coup d’envoi, jamais celui d’un match déjà joué), le bouton « Que faire pour ce match » qui
// ouvre la réponse honnête (des bars qui le diffusent, ou « Aucun bar encore pour ce match » et trois gestes qui
// existent : deux messages WhatsApp que le visiteur écrit, l’agenda du match, « Préviens-moi » sur une ligne), puis une
// bande courte des autres matchs du même jour. Un soir sans match, ou quand tous ont commencé, la carte est celle du
// prochain match à venir, dit honnêtement (« demain », la date). La liste du soir (« Le guide du soir ») est sur la page
// « Ce soir », pas ici.
// Les matchs à venir sont aussi écrits en JSON dans la page (#donnees-ce-soir) : main.js y reprend le prochain match qui
// n’a pas commencé à l’heure où la page est lue (le bloc a au plus quelques heures), et tient le compte à rebours à la
// minute. Sans script, la page est complète : la carte du passage, avec l’heure du coup d’envoi.
// Les insignes sont ceux de l’appli (insigne.mjs), jamais un écusson : chaque club est dessiné une fois, dans une
// planche (<symbol>), et la carte, la bande et le script le reprennent (<use>).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { aSonFichier } from './agenda.mjs';
import { texteVisible } from './controle.mjs';
import { DUREE_MATCH_MS, MOTS_INTERDITS } from './donnees.mjs';
import { heureDeParis, isoDeParis, jourDeParis, jourEnLettres, joursEntre } from './heure.mjs';
import { dessinDe, insigne } from './insigne.mjs';
import { cheminDuMatch } from './jsonld.mjs';
import { accorder, echapper as e, insecables } from './texte.mjs';

export const ACCUEIL = 'index.html';
export const REPERES = { debut: '<!-- semaine:debut -->', fin: '<!-- semaine:fin -->' };

// Les matchs que la page porte : le prochain et ses suivants (le premier qui n’a pas commencé quand la page est lue en
// est l’un d’eux, même quelques heures après le passage). La bande ne montre que les autres matchs du même jour.
export const MATCHS_DE_L_ACCUEIL = 6;
export const MATCHS_DE_LA_BANDE = 4;
// La taille du dessin des insignes de la carte (px) : leur finesse se règle sur elle (insigne.mjs). Seuls les clubs du
// premier match ont ce grand dessin (d-…, 9 Ko chacun : un match plus loin, que la page prend si le premier a commencé
// quand elle est lue, a le petit, agrandi) ; la bande, et tout autre club, ont le petit (p-…, 30 px, comme la liste de
// l’appli) : la page ne porte pas une douzaine de grands insignes.
export const TAILLE_DES_DISQUES = 112;
export const TAILLE_DE_LA_BANDE = 30;
export const MATCHS_AU_GRAND_DESSIN = 1;

const NUIT = [10, 11, 16];
// La lumière d’un club ne dépasse jamais cette luminance relative : le texte blanc de la carte reste à plus de 4,5:1,
// même sur la lumière la plus claire.
const LUMIERE_MAX = 0.12;
const LUMIERE_MIN = 0.02;

const rvb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexDe = (couleur) => `#${couleur.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const luminance = (couleur) => {
  const [r, v, b] = couleur.map((c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
};

// La couleur de lumière d’un club : sa première couleur (ses bandes, pour une sélection) ni trop sombre ni trop claire,
// foncée vers la nuit jusqu’à la luminance qui garde le texte lisible.
export const lumiereDe = (club) => {
  const dessin = dessinDe(club);
  const couleurs = (dessin.bandes ? dessin.bandes.bands : [dessin.fiche.colours.primary, dessin.fiche.colours.secondary])
    .filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c)).map(rvb);
  let choisie = couleurs.find((c) => luminance(c) >= LUMIERE_MIN && luminance(c) <= 0.6) ?? couleurs.find((c) => luminance(c) >= LUMIERE_MIN) ?? [58, 63, 90];
  for (let pas = 0; luminance(choisie) > LUMIERE_MAX && pas < 40; pas += 1) choisie = choisie.map((c, i) => c * 0.95 + NUIT[i] * 0.05);
  return hexDe(choisie);
};

// Les espaces insécables du texte de la page, pas ceux des messages que le visiteur envoie (leurs champs) : un message
// part avec des espaces ordinaires, comme main.js l’écrit.
const sansLesChamps = (transformer, html) => html.split(/(<textarea[\s\S]*?<\/textarea>)/).map((morceau, i) => (i % 2 ? morceau : transformer(morceau))).join('');
const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
const nomDe = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
// « 2 bars à Paris », ou le nombre seul quand ses bars sont dans plusieurs villes.
const lesBars = (m) => {
  const villes = [...new Set(m.soirees.map((s) => s.bar.ville.nom))];
  return `${accorder(m.soirees.length, 'bar')}${villes.length === 1 ? ` à ${villes[0]}` : ''}`;
};

// Le jour d’un match, dit comme on le dit : « ce soir » (à partir de 17 h, « aujourd’hui » avant), « demain », ou la date
// en toutes lettres. main.js fait la même chose, à l’heure où la page est lue.
export const jourDit = (debut, maintenant, t) => {
  const ecart = joursEntre(maintenant, debut);
  if (ecart <= 0) return Number(heureDeParis(debut).slice(0, 2)) >= 17 ? t.ceSoir : t.aujourdhui;
  return ecart === 1 ? t.demain : jourEnLettres(debut);
};

// Le prochain match à venir : ni commencé, ni reporté ou annulé, à l’heure confirmée (sans elle, on ne peut dire ni
// « dans 1 h » ni « avant le coup d’envoi »).
// À l’heure égale, un club de Paris d’abord (le site est celui de Paris), puis l’ordre des adresses.
const CLUBS_DE_PARIS = ['psg', 'paris-fc'];
const rangDeParis = (m) => (CLUBS_DE_PARIS.some((c) => m.domicile.cle === c || m.exterieur.cle === c) ? 0 : 1);
export const matchsDeLAccueil = (donnees, maintenant) => donnees.matchs
  .filter((m) => m.debut > maintenant && !m.statut && m.heureConfirmee !== false)
  .sort((a, b) => a.debut - b.debut || rangDeParis(a) - rangDeParis(b) || a.slug.localeCompare(b.slug))
  .slice(0, MATCHS_DE_L_ACCUEIL);

// La planche : chaque club n’y est dessiné qu’une fois par taille. grands : les clubs de la carte ; petits : tous les autres.
const planche = (grands, petits) => {
  const symboles = new Map();
  const poser = (club, prefixe, taille) => {
    if (symboles.has(`${prefixe}${club.cle}`)) return;
    const svg = insigne(club, { taille, fond: 'night' });
    const boite = /viewBox="([^"]+)"/.exec(svg)[1];
    symboles.set(`${prefixe}${club.cle}`, `<symbol id="${prefixe}${club.cle}" viewBox="${boite}">${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</symbol>`);
  };
  for (const club of grands) poser(club, 'd-', TAILLE_DES_DISQUES);
  for (const club of petits) poser(club, 'p-', TAILLE_DE_LA_BANDE);
  return `<svg class="planche" width="0" height="0" aria-hidden="true" focusable="false"><defs>${[...symboles.values()].join('')}</defs></svg>`;
};
const disque = (club, classe = 'insigne', prefixe = 'd-') => `<svg class="${classe}" aria-hidden="true" focusable="false"><use href="#${prefixe}${e(club.cle)}"/></svg>`;

const adresse = (chemin) => `https://baromatch.fr${chemin}`;
const lienWhatsApp = (message) => `https://wa.me/?text=${encodeURIComponent(message)}`;

// Les données du script : un match par entrée, sans dessin (les insignes sont dans la planche).
const donneesDuMatch = (m, maintenant) => ({
  id: m.slug,
  coup: isoDeParis(m.debut),
  compet: m.competition,
  a: { cle: m.domicile.cle, nom: m.domicile.court, lumiere: lumiereDe(m.domicile) },
  b: { cle: m.exterieur.cle, nom: m.exterieur.court, lumiere: lumiereDe(m.exterieur) },
  page: cheminDuMatch(m),
  ics: aSonFichier(m, maintenant),
  bars: m.soirees.length,
  barsTexte: m.soirees.length ? lesBars(m) : '',
  verbe: m.soirees.length > 1 ? 'diffusent' : 'diffuse',
});

// Le bloc entier, pour l’instant « maintenant ».
export const blocDeLaSemaine = ({ donnees, textes, maintenant }) => {
  const t = textes.accueil;
  const matchs = matchsDeLAccueil(donnees, maintenant);
  if (!matchs.length) {
    return sansLesChamps(insecables, `<section class="prochain page" id="ce-soir" aria-labelledby="soir-titre">
<h2 class="prochain__etiquette" id="soir-titre">${e(t.etiquette)}</h2>
<p class="prochain__rien">${e(t.rien)} <a href="/matchs/">${e(t.rienLien)}</a></p>
</section>`);
  }
  const hero = matchs[0];
  const jourHero = jourDeParis(hero.debut);
  const quand = jourDit(hero.debut, maintenant, t);
  const aujourdhui = jourDeParis(maintenant);
  const chemin = cheminDuMatch(hero);
  const heure = heureDeParis(hero.debut);
  const nom = nomDe(hero);
  const ceJour = (m) => jourDeParis(m.debut) === jourHero;
  const bande = donnees.matchs
    .filter((m) => m !== hero && ceJour(m) && m.debut + DUREE_MATCH_MS > maintenant && !m.statut && m.heureConfirmee !== false)
    .sort((a, b) => a.debut - b.debut || a.slug.localeCompare(b.slug)).slice(0, MATCHS_DE_LA_BANDE);
  const clubsDe = (liste) => liste.flatMap((m) => [m.domicile, m.exterieur]);
  const grands = clubsDe(matchs.slice(0, MATCHS_AU_GRAND_DESSIN));
  const petits = clubsDe([...matchs, ...bande]);
  const messageAmis = remplir(t.amisMessage, { match: nom, quand: `${quand} à ${heure}`, lien: adresse(chemin) });
  const messageBar = remplir(t.barMessage, { match: nom, quand: `${quand} à ${heure}`, lien: adresse('/pour-les-bars.html') });
  const donneesJson = {
    maintenant: isoDeParis(maintenant),
    matchs: matchs.map((m) => donneesDuMatch(m, maintenant)),
    t: {
      ceSoir: t.ceSoir, aujourdhui: t.aujourdhui, demain: t.demain, pasDeMatch: t.pasDeMatch, aucunBar: t.aucunBar, aucunBarSuite: t.aucunBarSuite,
      avecBars: t.avecBars, voirLesBars: t.voirLesBars, agenda: t.agenda, rien: t.rien, rienLien: t.rienLien, autres: t.autres, enCours: t.enCours, tous: t.tous, tousSemaine: t.tousSemaine, heureDeParis: t.heureDeParis,
      amisMessage: t.amisMessage, barMessage: t.barMessage,
    },
  };
  const puce = (m) => `<li><a class="puce" href="${cheminDuMatch(m)}">${disque(m.domicile, 'insigne', 'p-')}${disque(m.exterieur, 'insigne', 'p-')}<span class="puce__nom">${e(nomDe(m))}</span>${m.debut <= maintenant
    ? `<span class="puce__en-cours">${e(t.enCours)}</span>`
    : `<time class="puce__heure" datetime="${isoDeParis(m.debut)}">${heureDeParis(m.debut)}</time>`}</a></li>`;
  const avecBars = hero.soirees.length > 0;
  const entete = avecBars
    ? `<p class="faire__titre" data-faire-titre>${e(remplir(t.avecBars, { bars: lesBars(hero), verbe: hero.soirees.length > 1 ? 'diffusent' : 'diffuse' }))}</p>
<p class="faire__texte" data-faire-suite><a class="lien" data-voir-bars href="${chemin}#titre-bars">${e(t.voirLesBars)}<span class="visuellement-cache"> : ${e(nom)}</span></a></p>`
    : `<p class="faire__titre" data-faire-titre>${e(t.aucunBar)}</p>
<p class="faire__texte" data-faire-suite>${e(t.aucunBarSuite)}</p>`;
  const message = (cle, titre, texte) => `<div class="msg">
<label class="msg__etiquette" for="msg-${cle}"><strong>${e(titre)}</strong> <span>${e(t.messageEtiquette)}</span></label>
<textarea class="msg__champ" id="msg-${cle}" data-message="${cle}" rows="3" maxlength="500">${e(texte)}</textarea>
<a class="msg__envoi" data-wa="${cle}" href="${lienWhatsApp(texte)}" rel="noopener">${e(t.whatsapp)}<span class="visuellement-cache"> : ${e(titre.toLowerCase())}</span></a>
</div>`;
  // « Pas de match ce soir » : le prochain est un autre jour, et rien ne se joue aujourd’hui (ni à venir, ni en cours).
  const horsAujourdhui = jourHero !== aujourdhui && !donnees.matchs.some((m) => !m.statut && jourDeParis(m.debut) === aujourdhui && m.debut + DUREE_MATCH_MS > maintenant);
  return sansLesChamps(insecables, `<section class="prochain page" id="ce-soir" aria-labelledby="soir-titre">
${planche(grands, petits)}
<h2 class="prochain__etiquette" id="soir-titre">${e(t.etiquette)} <span class="prochain__quand" data-soir-quand>· ${e(quand)}</span></h2>
<div class="coup" data-coup="${isoDeParis(hero.debut)}">
<div class="coup__lumiere" aria-hidden="true"><i></i><i></i><i></i></div>
<p class="coup__ou"><span data-coup-compet>${e(hero.competition)}</span> · <time data-coup-heure datetime="${isoDeParis(hero.debut)}">${heure}</time></p>
<div class="coup__clubs">
${disque(hero.domicile, 'insigne coup__disque')}
<h3 class="coup__titre"><a href="${chemin}" data-coup-page>${e(hero.domicile.court)} <span class="coup__tiret">–</span> ${e(hero.exterieur.court)}</a></h3>
${disque(hero.exterieur, 'insigne coup__disque')}
</div>
<p class="coup__dans" data-dans aria-hidden="true" hidden></p>
<p class="coup__heure"><span data-coup-detail>${e(`${quand.charAt(0).toUpperCase()}${quand.slice(1)}, ${heure}`)}</span> · ${e(t.heureDeParis)}</p>
<p class="coup__nuit" data-pas-de-match${horsAujourdhui ? '' : ' hidden'}>${e(t.pasDeMatch)}</p>
<details class="faire" id="faire">
<summary class="capsule faire__bouton">${e(t.bouton)}<span class="visuellement-cache"> : ${e(nom)}</span></summary>
<div class="faire__corps">
${entete}
${message('amis', t.amis, messageAmis)}
${message('bar', t.bar, messageBar)}
<p class="faire__agenda">${aSonFichier(hero, maintenant) ? `<a class="lien-trait" data-agenda href="${chemin}match.ics" type="text/calendar">${e(t.agenda)}</a>` : ''}</p>
<form class="prevenir attente" id="attente-carte" data-attente action="https://formspree.io/f/mqpeedoj" method="POST" novalidate>
<label class="prevenir__etiquette" for="prevenir-mail">${e(t.prevenirEtiquette)}</label>
<div class="prevenir__ligne"><input class="prevenir__champ" id="prevenir-mail" name="email" type="email" inputmode="email" autocomplete="email" placeholder="ton@adresse.fr" required aria-describedby="prevenir-retour prevenir-note"><button class="prevenir__bouton" type="submit">${e(t.prevenir)}</button></div>
<input type="hidden" name="ville" value="Paris">
<input type="hidden" name="_subject" value="Nouvelle inscription à la liste d’attente Baromatch">
<div class="attente__piege" aria-hidden="true"><label for="prevenir-piege">Laisse ce champ vide</label><input id="prevenir-piege" type="text" name="_gotcha" tabindex="-1" autocomplete="off"></div>
<p class="attente__retour" id="prevenir-retour" role="status" aria-live="polite"></p>
<button class="attente__corriger" type="button" hidden>Corriger l’adresse</button>
<p class="prevenir__note" id="prevenir-note">${e(t.prevenirNote)} <a href="/confidentialite.html#liste-attente">Ce qu’on garde</a></p>
</form>
</div>
</details>
</div>
<div class="bande" data-bande${bande.length ? '' : ' hidden'}>
<p class="bande__titre" data-bande-titre>${e(remplir(t.autres, { quand }))}</p>
<ul class="bande__liste" data-bande-liste>
${bande.map(puce).join('\n')}
</ul>
</div>
<p class="prochain__suite"><a href="/ce-soir/" data-tous>${e(t.tous)}</a></p>
<script type="application/json" id="donnees-ce-soir">${JSON.stringify(donneesJson).replace(/</g, '\\u003c')}</script>
</section>`);
};

// Ce que le bloc ne fait jamais : un style en ligne ou un script qui s’exécute (la politique de sécurité de l’accueil les
// refuse ; le JSON des données n’est pas un script), un attribut d’évènement, un « ! », un mot que le site ne publie pas,
// l’ancien nom. Une liste d’erreurs, vide si tout va.
export const controlerLaSemaine = (bloc) => {
  const erreurs = [];
  if (/\sstyle\s*=/i.test(bloc)) erreurs.push('un style en ligne');
  const sansDonnees = bloc.replace(/<script type="application\/json" id="donnees-ce-soir">[\s\S]*?<\/script>/, '');
  if (/<script\b/i.test(sansDonnees)) erreurs.push('un script');
  if ([...bloc.matchAll(/<[a-zA-Z][^>]*>/g)].some((m) => /\son[a-z]+\s*=/i.test(m[0].replace(/"[^"]*"/g, '""')))) erreurs.push('un attribut d’évènement');
  const texte = texteVisible(`<body>${sansDonnees}`);
  if (texte.includes('!')) erreurs.push('un point d’exclamation');
  const interdit = texte.match(MOTS_INTERDITS);
  if (interdit) erreurs.push(`un mot que le site ne publie pas : « ${interdit[0]} »`);
  if (/soir\s+de\s+match/i.test(texte)) erreurs.push('l’ancien nom');
  if ((sansDonnees.match(/<h2[\s>]/g) ?? []).length !== 1) erreurs.push('un seul titre h2 attendu');
  return erreurs;
};

// L’accueil avec ce bloc entre ses repères : chaque repère une seule fois, dans l’ordre, sinon une erreur (et rien
// n’est écrit).
export const accueilAvecLaSemaine = (html, bloc) => {
  const debut = html.indexOf(REPERES.debut);
  const fin = html.indexOf(REPERES.fin);
  if (debut < 0 || fin < debut || html.indexOf(REPERES.debut, debut + 1) >= 0 || html.indexOf(REPERES.fin, fin + 1) >= 0) {
    throw new Error(`${ACCUEIL} : les repères ${REPERES.debut} et ${REPERES.fin} doivent y être une fois chacun, dans cet ordre`);
  }
  return `${html.slice(0, debut + REPERES.debut.length)}\n${bloc}\n${html.slice(fin)}`;
};

// Ce qui est hors du bloc : deux accueils qui ne diffèrent que par leur bloc donnent la même chose.
const horsDuBloc = (html) => html.slice(0, html.indexOf(REPERES.debut)) + html.slice(html.indexOf(REPERES.fin));

// L’accueil à écrire dans « sortie » : celui qui y est déjà (la mesure d’audience a pu le réécrire juste avant), sinon
// celui de la racine, avec le nouveau bloc. null si rien ne change.
export const preparerLAccueil = ({ racine, sortie, bloc }) => {
  const source = existsSync(path.join(sortie, ACCUEIL)) ? path.join(sortie, ACCUEIL) : path.join(racine, ACCUEIL);
  const avant = readFileSync(source, 'utf8');
  const apres = accueilAvecLaSemaine(avant, bloc);
  return apres === avant && source === path.join(sortie, ACCUEIL) ? null : { avant, apres };
};

// L’écriture, la seule que le générateur fasse hors de sa liste blanche (etat.mjs) : index.html, et seulement si tout
// ce qui est hors du bloc est identique à ce qui était là.
export const ecrireLAccueil = (sortie, { avant, apres }) => {
  if (horsDuBloc(apres) !== horsDuBloc(avant)) throw new Error(`${ACCUEIL} : le générateur ne change que le bloc du prochain match`);
  writeFileSync(path.join(sortie, ACCUEIL), apres);
};
