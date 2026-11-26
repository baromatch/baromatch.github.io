// L’accueil, « La salle » : la page fait l’heure, de 18:42 au coup d’envoi. Le moment de 19:30, « Choisis ton match », est
// la seule partie que le générateur écrit : les matchs du jour (ou du prochain jour de matchs), chacun avec ses deux
// insignes et le lien de sa page, puis la semaine dessinée (sept jours, de petites piles d’insignes) qui mène à
// « Tous les matchs ». L’accueil est écrit à la main (index.html) ; le générateur n’y écrit que ce bloc, entre ses deux
// repères, et rien d’autre : ecrireLAccueil vérifie, avant d’écrire, que tout ce qui est hors des repères est resté
// identique, octet pour octet. (Les repères gardent leur ancien nom, « semaine » : l’Action pages-des-matchs.yml les lit.)
// Le jour se dit comme on le dit : « Ce soir » (à partir de 17 h), « Aujourd’hui » avant, « Demain », ou la date ; un soir
// sans match, ce sont les matchs du prochain jour qui en a. La phrase sur les bars est celle des données : aujourd’hui,
// aucun bar publié ; dès qu’un match en a un, elle le dit et la ligne du match porte son compte.
// Les insignes sont ceux de l’appli (insigne.mjs), jamais un écusson : chaque club est dessiné une fois, dans une
// planche (<symbol>), et la liste et la semaine le reprennent (<use>).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { texteVisible } from './controle.mjs';
import { DUREE_MATCH_MS, MOTS_INTERDITS } from './donnees.mjs';
import { heureDeParis, isoDeParis, jourDeParis, jourEnLettres, joursEntre } from './heure.mjs';
import { insigne } from './insigne.mjs';
import { cheminDuMatch } from './jsonld.mjs';
import { accorder, capitale, echapper as e, insecables } from './texte.mjs';

export const ACCUEIL = 'index.html';
export const REPERES = { debut: '<!-- semaine:debut -->', fin: '<!-- semaine:fin -->' };

// Les matchs que la liste montre au plus (le reste est une ligne « Tous les matchs de ce soir »), et les insignes d’une
// pile de la semaine au plus.
export const MATCHS_DE_L_ACCUEIL = 6;
export const INSIGNES_PAR_PILE = 4;
export const SEMAINE_EN_JOURS = 7;
// La taille du dessin des insignes (px) : celle de la liste de l’appli ; l’accueil les montre à 28 px (la liste) et 20 px (la semaine).
export const TAILLE_DES_INSIGNES = 30;

const nomDe = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
// « 2 bars à Paris », ou le nombre seul quand ses bars sont dans plusieurs villes.
const lesBars = (m) => {
  const villes = [...new Set(m.soirees.map((s) => s.bar.ville.nom))];
  return `${accorder(m.soirees.length, 'bar')}${villes.length === 1 ? ` à ${villes[0]}` : ''}`;
};

// Le jour d’un match, dit comme on le dit : « ce soir » (à partir de 17 h, « aujourd’hui » avant), « demain », ou la date
// en toutes lettres.
export const jourDit = (debut, maintenant, t) => {
  const ecart = joursEntre(maintenant, debut);
  if (ecart <= 0) return Number(heureDeParis(debut).slice(0, 2)) >= 17 ? t.ceSoir : t.aujourdhui;
  return ecart === 1 ? t.demain : jourEnLettres(debut);
};

// Un match que l’accueil compte : ni reporté ni annulé, pas fini, à l’heure confirmée (sans elle, on ne peut dire ni
// « 21:00 » ni « ce soir »).
const aVenir = (m, maintenant) => m.debut + DUREE_MATCH_MS > maintenant && !m.statut && m.heureConfirmee !== false;
// À l’heure égale, un club de Paris d’abord (le site est celui de Paris), puis l’ordre des adresses.
const CLUBS_DE_PARIS = ['psg', 'paris-fc'];
const rangDeParis = (m) => (CLUBS_DE_PARIS.some((c) => m.domicile.cle === c || m.exterieur.cle === c) ? 0 : 1);
const dansLOrdre = (a, b) => a.debut - b.debut || rangDeParis(a) - rangDeParis(b) || a.slug.localeCompare(b.slug);

// Les matchs du jour que la page montre : ceux du premier jour qui n’a pas fini d’en jouer, du premier au dernier.
export const matchsDeLAccueil = (donnees, maintenant) => {
  const venir = donnees.matchs.filter((m) => m.debut > maintenant && aVenir(m, maintenant)).sort(dansLOrdre);
  if (!venir.length) return [];
  const jour = jourDeParis(venir[0].debut);
  return donnees.matchs.filter((m) => aVenir(m, maintenant) && jourDeParis(m.debut) === jour).sort(dansLOrdre);
};

// La planche : chaque club n’y est dessiné qu’une fois, sur fond clair (la page est le jour).
const planche = (clubs) => {
  const symboles = new Map();
  for (const club of clubs) {
    if (symboles.has(club.cle)) continue;
    const svg = insigne(club, { taille: TAILLE_DES_INSIGNES, fond: 'light' });
    const boite = /viewBox="([^"]+)"/.exec(svg)[1];
    symboles.set(club.cle, `<symbol id="p-${e(club.cle)}" viewBox="${boite}">${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</symbol>`);
  }
  return `<svg class="planche" width="0" height="0" aria-hidden="true" focusable="false"><defs>${[...symboles.values()].join('')}</defs></svg>`;
};
const disque = (club) => `<svg class="insigne" aria-hidden="true" focusable="false"><use href="#p-${e(club.cle)}"/></svg>`;

// La semaine : les sept jours de Paris à partir d’aujourd’hui, chacun en pile de ses matchs (leur club qui reçoit), au plus
// INSIGNES_PAR_PILE ; le jour de la semaine et le nombre de matchs dessous. Un seul lien, vers tous les matchs.
const PAS = 13;
const semaine = ({ donnees, t, maintenant }) => {
  const midi = Date.parse(`${jourDeParis(maintenant)}T12:00:00Z`);
  const jours = Array.from({ length: SEMAINE_EN_JOURS }, (_, i) => new Date(midi + i * 86_400_000).toISOString().slice(0, 10));
  const matchs = donnees.matchs.filter((m) => aVenir(m, maintenant) && jours.includes(jourDeParis(m.debut))).sort(dansLOrdre);
  if (!matchs.length) return { html: '', clubs: [] };
  const colonnes = jours.map((jour) => {
    const duJour = matchs.filter((m) => jourDeParis(m.debut) === jour);
    const date = new Date(`${jour}T12:00:00Z`);
    const nom = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', '');
    const lettres = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
    return { jour, duJour, nom, lettres };
  });
  const clubs = colonnes.flatMap((c) => c.duJour.slice(0, INSIGNES_PAR_PILE).map((m) => m.domicile));
  const hauteur = 20 + (INSIGNES_PAR_PILE - 1) * PAS + 2;
  const html = `<a class="sept" href="/matchs/">
<span class="sept__jours" aria-hidden="true">${colonnes.map((c) => `<span class="sept__jour${c.duJour.length ? '' : ' sept__jour--vide'}"><svg class="sept__pile" viewBox="0 0 24 ${hauteur}" width="24" height="${hauteur}" focusable="false">${c.duJour.slice(0, INSIGNES_PAR_PILE).map((m, k) => `<use href="#p-${e(m.domicile.cle)}" x="2" y="${hauteur - 22 - k * PAS}" width="20" height="20"/>`).join('')}<rect class="sept__sol" x="0" y="${hauteur - 1.4}" width="24" height="1.4"/></svg><span class="sept__nom">${e(c.nom)}</span><span class="sept__n">${c.duJour.length}</span></span>`).join('')}</span>
<span class="sept__texte"><b>${e(remplir(t.semaineTitre, { matchs: accorder(matchs.length, 'match') }))}</b><span class="sept__lien">${e(t.semaineLien)}</span></span>
<span class="visuellement-cache">${e(colonnes.filter((c) => c.duJour.length).map((c) => `${capitale(c.lettres)} : ${accorder(c.duJour.length, 'match')}`).join(' ; '))}.</span>
</a>`;
  return { html, clubs };
};

// Le bloc entier, pour l’instant « maintenant ».
export const blocDeLaSemaine = ({ donnees, textes, maintenant }) => {
  const t = textes.accueil;
  const duJour = matchsDeLAccueil(donnees, maintenant);
  if (!duJour.length) {
    return insecables(`<p class="chapo">${e(t.rien)}</p>
<p class="soir__suite"><a class="lien-trait" href="/matchs/">${e(t.rienLien)}</a></p>`);
  }
  const premier = duJour[0];
  const quand = jourDit(premier.debut, maintenant, t);
  const aujourdhui = jourDeParis(maintenant) === jourDeParis(premier.debut);
  const visibles = duJour.slice(0, MATCHS_DE_L_ACCUEIL);
  const avecBars = duJour.filter((m) => m.soirees.length > 0).length;
  const jour = quand === jourEnLettres(premier.debut) ? capitale(quand) : `${capitale(quand)}, ${jourEnLettres(premier.debut)}`;
  const phrase = `${jour} : ${accorder(duJour.length, 'match')}. ${avecBars
    ? remplir(avecBars > 1 ? t.barsPlusieurs : t.barsUn, { n: avecBars })
    : t.aucunBar}`;
  const ligne = (m) => `<li><a class="match" href="${cheminDuMatch(m)}"><time class="match__heure" datetime="${isoDeParis(m.debut)}">${heureDeParis(m.debut)}</time><span class="match__paire">${disque(m.domicile)}${disque(m.exterieur)}</span><span class="match__nom">${e(nomDe(m))}</span>${m.soirees.length ? `<span class="match__bars">${e(lesBars(m))}</span>` : ''}</a></li>`;
  const suite = duJour.length > visibles.length
    ? `\n<p class="soir__suite"><a class="lien-trait" href="${aujourdhui ? '/ce-soir/' : '/matchs/'}">${e(aujourdhui ? t.tous : t.tousSemaine)}</a></p>` : '';
  const sem = semaine({ donnees, t, maintenant });
  const clubs = [...visibles.flatMap((m) => [m.domicile, m.exterieur]), ...sem.clubs];
  return insecables(`${planche(clubs)}
<p class="chapo" data-soir-phrase>${e(phrase)}</p>
<ul class="soir">
${visibles.map(ligne).join('\n')}
</ul>${suite}
${sem.html}`);
};

// Ce que le bloc ne fait jamais : un style en ligne ou un script qui s’exécute (la politique de sécurité de l’accueil les
// refuse ; le JSON des données n’est pas un script), un attribut d’évènement, un « ! », un mot que le site ne publie pas,
// l’ancien nom. Une liste d’erreurs, vide si tout va.
export const controlerLaSemaine = (bloc) => {
  const erreurs = [];
  if (/\sstyle\s*=/i.test(bloc)) erreurs.push('un style en ligne');
  const sansDonnees = bloc;
  if (/<script\b/i.test(sansDonnees)) erreurs.push('un script');
  if ([...bloc.matchAll(/<[a-zA-Z][^>]*>/g)].some((m) => /\son[a-z]+\s*=/i.test(m[0].replace(/"[^"]*"/g, '""')))) erreurs.push('un attribut d’évènement');
  const texte = texteVisible(`<body>${sansDonnees}`);
  if (texte.includes('!')) erreurs.push('un point d’exclamation');
  const interdit = texte.match(MOTS_INTERDITS);
  if (interdit) erreurs.push(`un mot que le site ne publie pas : « ${interdit[0]} »`);
  if (/soir\s+de\s+match/i.test(texte)) erreurs.push('l’ancien nom');
  if (/<h[1-6][\s>]/.test(sansDonnees)) erreurs.push('aucun titre : le titre « Choisis ton match » est écrit à la main');
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
