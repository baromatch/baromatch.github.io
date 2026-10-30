// L’accueil, l’utile d’abord : « Les matchs de la semaine », sous l’ouverture. L’accueil est écrit à la main
// (index.html) ; le générateur n’y écrit que ce bloc, entre ses deux repères, et rien d’autre : ecrireLAccueil vérifie,
// avant d’écrire, que tout ce qui est hors des repères est resté identique, octet pour octet.
// Le bloc : une barre des sept jours de Paris (« Aujourd’hui », « Demain », « sam. 31 »…), des boutons radio qui
// marchent sans script (styles.css montre le jour choisi), puis une carte par match du jour : l’heure, la compétition,
// les deux clubs (un disque à leurs couleurs, jamais un écusson), et une action qui existe. Un match qu’un bar publié
// diffuse passe en tête de son jour, et sa carte dit combien de bars, avec « Voir les bars » ; les autres, plus
// discrètes, proposent l’agenda du match, et disent « Pas encore de bar » dès qu’un bar est publié ailleurs : tant
// qu’aucun ne l’est, la phrase sous le titre le dit une fois pour toutes (comme la semaine, /matchs/). Les données
// sont celles des pages des matchs (les mêmes matchs que la semaine), rien d’autre.
// Les mots « Aujourd’hui » et « Demain » valent pour le jour du passage (data-aujourdhui) : chacun porte sa date sans
// eux (data-date), que main.js remet, avec les jours passés retirés, si la page est lue un autre jour (un passage
// manqué).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { aSonFichier } from './agenda.mjs';
import { disque } from './cadre.mjs';
import { texteVisible } from './controle.mjs';
import { DUREE_MATCH_MS, JOUR_MS, MOTS_INTERDITS } from './donnees.mjs';
import { quand } from './gabarits.mjs';
import { jourDeParis, jourEnLettres } from './heure.mjs';
import { cheminDuMatch } from './jsonld.mjs';
import { SEMAINE_JOURS } from './pages.mjs';
import { accorder, capitale, echapper as e, insecables } from './texte.mjs';

export const ACCUEIL = 'index.html';
export const REPERES = { debut: '<!-- semaine:debut -->', fin: '<!-- semaine:fin -->' };

// Au-delà de ce nombre de matchs, un jour finit par un lien vers lui dans la semaine (/matchs/) : styles.css n’en montre
// que 4 au téléphone, 6 à partir de 720 px (les autres cartes restent dans la page).
const CARTES_AU_TELEPHONE = 4;
const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
const jourCourt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric' });

// Un club, un disque à ses deux couleurs (jamais un écusson) : le même que dans le pied de page de chaque page (cadre.mjs).
export { disque };

// Une carte : l’heure et la compétition, les deux clubs (le lien vers la page du match), puis ce qu’on peut faire.
const carte = (m, { textes, couleurs, maintenant, sansAucunBar }) => {
  const t = textes.accueil;
  const chemin = cheminDuMatch(m);
  const nom = `${m.domicile.court} – ${m.exterieur.court}`;
  const pour = `<span class="visuellement-cache"> : ${e(nom)}</span>`;
  const villes = [...new Set(m.soirees.map((s) => s.bar.ville.nom))];
  let bas;
  if (m.statut) {
    bas = `<strong class="carte-match__statut">${e(textes.match[m.statut])}</strong>`;
  } else if (m.soirees.length) {
    bas = `<span class="carte-match__bars">${e(accorder(m.soirees.length, 'bar'))}${villes.length === 1 ? ` à ${e(villes[0])}` : ''}</span><a class="carte-match__voir" href="${chemin}#titre-bars">${e(t.voirLesBars)}${pour}</a>`;
  } else {
    bas = `${sansAucunBar ? '' : `<span class="carte-match__etat">${e(t.pasDeBar)}</span>`}${aSonFichier(m, maintenant) ? `<a class="carte-match__agenda" href="${chemin}match.ics" type="text/calendar">${e(t.agenda)}${pour}</a>` : ''}`;
  }
  const club = (c) => `<span class="carte-match__club">${disque(couleurs[c.cle])}${e(c.court)}</span>`;
  return `<li class="carte-match${m.soirees.length && !m.statut ? ' carte-match--bars' : ''}">
<p class="carte-match__haut"><span class="carte-match__heure">${quand(m, { heureSeule: true })}</span><span class="carte-match__compet">${e(m.competition)}</span></p>
<a class="carte-match__clubs" href="${chemin}">${club(m.domicile)}<span class="visuellement-cache"> – </span>${club(m.exterieur)}</a>
${bas ? `<p class="carte-match__bas">${bas}</p>\n` : ''}</li>`;
};

// Le bloc entier, pour l’instant « maintenant » : le titre, la phrase vraie, la barre des jours et leurs cartes.
export const blocDeLaSemaine = ({ donnees, textes, couleurs = {}, maintenant }) => {
  const t = textes.accueil;
  const aujourdhui = jourDeParis(maintenant);
  // Les sept jours de Paris, comptés sur les dates (comme la semaine, pages.mjs : un jour de changement d’heure dure 23
  // ou 25 heures).
  const midi = Date.parse(`${aujourdhui}T12:00:00Z`);
  const jours = Array.from({ length: SEMAINE_JOURS }, (_, i) => new Date(midi + i * JOUR_MS).toISOString().slice(0, 10));
  const enCoursOuAVenir = (m) => m.debut + DUREE_MATCH_MS > maintenant;
  // Dans chaque jour : les matchs qu’un bar diffuse d’abord (ni reportés ni annulés), puis les autres, à l’heure.
  const avecBars = (m) => Boolean(m.soirees.length && !m.statut);
  const duJour = (jour) => donnees.matchs.filter((m) => enCoursOuAVenir(m) && jourDeParis(m.debut) === jour)
    .sort((a, b) => Number(avecBars(b)) - Number(avecBars(a)) || a.debut - b.debut || a.slug.localeCompare(b.slug));
  const semaine = jours.map((jour, i) => ({ jour, i, matchs: duJour(jour) }));
  const choisi = semaine.find((j) => j.matchs.length)?.jour ?? aujourdhui;
  const sansAucunBar = donnees.bars.length === 0;
  // Sans bar publié : la phrase vraie, puis ce que chacun peut faire, le fan (la liste d’attente) et le bar.
  const chapo = `<p class="semaine__chapo">${e(sansAucunBar ? t.sansBar : t.avecBars)}</p>${sansAucunBar
    ? `\n<p class="semaine__liens"><a href="#attente">${e(t.sansBarLien)}</a><a href="/pour-les-bars.html#proposer">${e(t.sansBarProposer)}</a></p>` : ''}`;

  const nomDuJour = ({ jour, i }) => (i === 0 ? t.aujourdhui : i === 1 ? t.demain : jourCourt.format(new Date(`${jour}T12:00:00Z`)));
  // La puce d’un jour dit combien de matchs ; s’il y en a qu’un bar diffuse, un point ambre devant, et leur nombre pour
  // le lecteur d’écran.
  const compte = (j) => {
    const avec = j.matchs.filter(avecBars).length;
    if (!j.matchs.length) return e(t.aucunMatch);
    if (!avec) return e(accorder(j.matchs.length, 'match'));
    return `<span class="semaine__point" aria-hidden="true"></span>${e(accorder(j.matchs.length, 'match'))}<span class="visuellement-cache">${e(remplir(t.dontAvecBars, { nombre: avec }))}</span>`;
  };
  const dates = semaine.map((j) => `<label class="semaine__date"><input type="radio" name="semaine-jour" value="${j.jour}"${j.jour === choisi ? ' checked' : ''}><span><b data-date="${e(jourCourt.format(new Date(`${j.jour}T12:00:00Z`)))}">${e(nomDuJour(j))}</b><small>${compte(j)}</small></span></label>`).join('\n');
  const enLettres = (jour) => capitale(jourEnLettres(Date.parse(`${jour}T12:00:00Z`)));
  // Un long jour : son lien vers la semaine, qui ouvre aujourd’hui sous « titre-ce-soir » et chaque autre jour sous
  // « jour-AAAA-MM-JJ » (pages.mjs). « Aujourd’hui » et « Demain » portent aussi leur date (data-date), pour main.js.
  const tous = (j) => {
    if (j.matchs.length <= CARTES_AU_TELEPHONE) return '';
    const date = remplir(t.tousLesMatchs, { jour: jourEnLettres(Date.parse(`${j.jour}T12:00:00Z`)) });
    const texte = j.i === 0 ? t.tousLesMatchsAujourdhui : j.i === 1 ? remplir(t.tousLesMatchs, { jour: t.demain.toLowerCase() }) : date;
    return `\n<p class="semaine__tous"><a href="/matchs/#${j.i === 0 ? 'titre-ce-soir' : `jour-${j.jour}`}"${j.i < 2 ? ` data-date="${e(date)}"` : ''}>${e(texte)}</a></p>`;
  };
  const panneaux = semaine.map((j) => `<div class="semaine__jour" data-jour="${j.jour}">
<h3 class="semaine__titre-jour"${j.i < 2 ? ` data-date="${e(enLettres(j.jour))}">${e(`${nomDuJour(j)}, ${jourEnLettres(Date.parse(`${j.jour}T12:00:00Z`))}`)}` : `>${e(enLettres(j.jour))}`}</h3>
${j.matchs.length ? `<ul class="semaine__cartes">\n${j.matchs.map((m) => carte(m, { textes, couleurs, maintenant, sansAucunBar })).join('\n')}\n</ul>${tous(j)}` : `<p class="semaine__rien">${e(t.rienCeJour)}</p>`}
</div>`).join('\n');
  const rien = semaine.every((j) => !j.matchs.length);
  return insecables(`<div class="semaine__tete">
<h2 class="titre-section" id="titre-semaine">${e(t.titre)}</h2>
<a class="semaine__toute" href="/matchs/">${e(t.toute)}</a>
</div>
${chapo}
${rien ? `<p class="semaine__rien">${e(t.rienCetteSemaine)}</p>` : `<div class="semaine__jours" data-aujourdhui="${aujourdhui}">
<fieldset class="semaine__dates">
<legend class="visuellement-cache">${e(t.jours)}</legend>
${dates}
</fieldset>
${panneaux}
</div>`}`);
};

// Ce que le bloc ne fait jamais : un style en ligne ou un script (la politique de sécurité de l’accueil les refuse),
// un attribut d’évènement, un « ! », un mot que le site ne publie pas, l’ancien nom. Une liste d’erreurs, vide si tout va.
export const controlerLaSemaine = (bloc) => {
  const erreurs = [];
  if (/\sstyle\s*=/i.test(bloc)) erreurs.push('un style en ligne');
  if (/<script\b/i.test(bloc)) erreurs.push('un script');
  if ([...bloc.matchAll(/<[a-zA-Z][^>]*>/g)].some((m) => /\son[a-z]+\s*=/i.test(m[0].replace(/"[^"]*"/g, '""')))) erreurs.push('un attribut d’évènement');
  const texte = texteVisible(`<body>${bloc}`);
  if (texte.includes('!')) erreurs.push('un point d’exclamation');
  const interdit = texte.match(MOTS_INTERDITS);
  if (interdit) erreurs.push(`un mot que le site ne publie pas : « ${interdit[0]} »`);
  if (/soir\s+de\s+match/i.test(texte)) erreurs.push('l’ancien nom');
  if ((bloc.match(/<h2[\s>]/g) ?? []).length !== 1) erreurs.push('un seul titre h2 attendu');
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
  if (horsDuBloc(apres) !== horsDuBloc(avant)) throw new Error(`${ACCUEIL} : le générateur ne change que le bloc des matchs de la semaine`);
  writeFileSync(path.join(sortie, ACCUEIL), apres);
};
