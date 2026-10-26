// Les pages en anglais, pour qui vient voir un match à Paris (touristes, expatriés) : faites au même passage, des mêmes
// données, par le même gabarit que les pages en français, avec leurs textes à elles (contenu/en.json).
//   /en/                    Where to watch football in Paris : la jumelle de /regarder-le-match/paris/.
//   /en/premier-league/     Premier League in Paris bars.
//   /en/champions-league/   Champions League nights in Paris, puis la Ligue Europa et la Ligue Conférence.
//   /en/matches/<slug>/     la version anglaise d’une page de match (la jumelle de /matchs/<slug>/), seulement pour la
//                           Premier League, les coupes d’Europe et les matchs du PSG (en.json : selection, clubsSuivis).
// Paris seulement : une page en anglais ne montre que les vrais bars publiés de Paris. Une page de match en anglais est
// faite de sa jumelle française et vit comme elle : les 14 prochains jours, puis « This match has been played » 30 jours
// en noindex, puis plus rien (construire.mjs efface ce que l’état connaît et que le passage n’écrit plus).
// L’index : une page de match, avec au moins 2 vrais bars de Paris (la règle des pages de match, SEUILS.barsParMatch) ;
// /en/, dès que Paris a un vrai bar publié (la règle de sa jumelle, la page de Paris : pages.mjs), qu’il montre un match
// choisi ou pas ; le guide d’une compétition, tant qu’un vrai bar de Paris montre un de ses matchs à venir, puis 30 jours
// encore après le coup d’envoi du dernier (l’état le garde : memoire.derniereSoiree), tant que Paris a un vrai bar.
// Aucun n’entre ni ne sort de l’index d’un soir à l’autre, et jamais un guide sans bar à Paris dans l’index. hreflang
// (fr ↔ en, x-default vers le français) seulement entre deux jumelles indexables qui passent le contrôle, et le lien
// visible « English » / « Version française » dès qu’elles le passent (lierLesLangues, appelé par site.mjs après le
// contrôle).
// Ni offre de bar, ni mot de boisson (loi Evin), ni score ; l’heure de Paris écrite à l’anglaise (« Sat 24 Oct, 9:00 pm
// (Paris time) ») ; les clubs sous leur nom des données ; l’état de l’appli dit dès la tête de chaque page.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cheminDuFichierDuMatch } from './agenda.mjs';
import { ENVOI_DE_LA_LISTE } from './attente.mjs';
import { DOSSIER_GENERATEUR } from './contenu.mjs';
import { DUREE_MATCH_MS, JOUR_MS } from './donnees.mjs';
import { ligneDeListe, page } from './gabarits.mjs';
import { jourDeParis } from './heure.mjs';
import { adresseDe, cheminDuBar, debutDe, filDAriane, IMAGE, listeDesBars, pageWeb } from './jsonld.mjs';
import { couper, SEUILS } from './pages.mjs';
import { capitale, echapper as e } from './texte.mjs';

export const TEXTES_EN = JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', 'en.json'), 'utf8'));
export const CHEMINS_EN = { paris: '/en/', premierLeague: '/en/premier-league/', championsLeague: '/en/champions-league/' };
export const cheminEnAnglais = (slug) => `/en/matches/${slug}/`;
// La ville des pages en anglais, et sa page en français.
const VILLE = 'paris';
const PARIS_EN_FRANCAIS = '/regarder-le-match/paris/';
// Le championnat dont les clubs sont « les clubs français » (pour dire que le calendrier européen les suit).
const CHAMPIONNAT_FRANCAIS = 'Ligue 1';
// Le guide d’une compétition reste indexable 30 jours après le dernier de ses matchs qu’un vrai bar de Paris a montré.
export const GRACE_DES_GUIDES_MS = 30 * JOUR_MS;

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');

// ---------- L’heure de Paris, à l’anglaise ----------

const morceaux = (instant, fuseau, options) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: fuseau, ...options })
  .formatToParts(new Date(instant)).filter((m) => m.type !== 'literal').map((m) => [m.type, m.value]));
// « 9:00 pm », à Paris (ou au Royaume-Uni : fuseau « Europe/London »).
export const heureALAnglaise = (instant, fuseau = 'Europe/Paris') => {
  const { hour, minute } = morceaux(instant, fuseau, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const heure = Number(hour);
  return `${heure % 12 || 12}:${minute} ${heure < 12 ? 'am' : 'pm'}`;
};
// « Sat 24 Oct ».
export const jourALAnglaise = (instant) => {
  const { weekday, day, month } = morceaux(instant, 'Europe/Paris', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${weekday} ${day} ${month}`;
};
// « Saturday 24 October ».
export const jourEntierALAnglaise = (instant) => {
  const { weekday, day, month } = morceaux(instant, 'Europe/Paris', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${weekday} ${day} ${month}`;
};
// « Sat 24 Oct, 9:00 pm (Paris time) » ; sans heure fixée : « Sat 31 Oct, kick-off time to be confirmed ».
export const quandALAnglaise = (match, t = TEXTES_EN) => (match.heureConfirmee
  ? `${jourALAnglaise(match.debut)}, ${heureALAnglaise(match.debut)} ${t.quand.heureDeParis}`
  : `${jourALAnglaise(match.debut)}, ${t.quand.aConfirmer}`);

// ---------- Les matchs choisis ----------

// La sorte d’un match qui a sa page en anglais (« premier-league », « champions-league », « europe », « club » pour un
// match du PSG dans une autre compétition), ou null.
export const sorteDuMatch = (match, { competitions = {}, t = TEXTES_EN } = {}) => {
  const nom = competitions[match.competition] ?? match.competition;
  if (t.selection[nom]) return t.selection[nom];
  return t.clubsSuivis.some((cle) => cle === match.domicile.cle || cle === match.exterieur.cle) ? 'club' : null;
};

// Les clubs sous leur nom des données, à l’anglaise : « Paris Saint-Germain v FC Barcelona ».
const nomDuMatch = (m) => `${m.domicile.nom} v ${m.exterieur.nom}`;
const nombreOrdinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')}`;
const quartierDe = (bar) => (bar.arrondissement ? `${nombreOrdinal(bar.arrondissement.numero)} arrondissement` : bar.ville.nom);
const parLieu = (a, b) => (a.arrondissement?.numero ?? 0) - (b.arrondissement?.numero ?? 0) || a.nom.localeCompare(b.nom, 'fr');

// Le premier texte dont la longueur va (un titre de 15 à 60 caractères, une description de 70 à 160) ; sinon le dernier,
// coupé proprement : les bornes que le contrôle vérifie.
const choisir = (candidats, min, max, suite) => {
  const juste = candidats.find((texte) => texte.length >= min && texte.length <= max);
  if (juste) return juste;
  const dernier = candidats.at(-1);
  return couper(dernier.length < min ? `${dernier}${suite}` : dernier, max);
};
const titre = (...candidats) => choisir(candidats, 15, 60, ' — Baromatch');
const description = (...candidats) => choisir(candidats, 70, 160, ' Paris bars showing the match, on Baromatch.');

// ---------- Les pages ----------

// pages : celles du passage en français (les pages de matchs, dont celles des matchs passés) ; images : le rendu des
// images de partage est là (une page de match reprend alors l’image de sa jumelle) ; anciens : ce que l’état garde des
// guides (anciensDe, etat.mjs).
export const fabriquerLesPagesAnglaises = ({ donnees, contenu, cadre, avecPresse = false, pages = [], images = false, anciens = {} }) => {
  const t = contenu.anglais ?? TEXTES_EN;
  const { marque, textes, competitions = {} } = contenu;
  const { maintenant } = donnees;
  const ouverte = Boolean(marque.appli?.ouverte);
  const enCoursOuAVenir = (m) => m.debut + DUREE_MATCH_MS > maintenant;
  const deParis = (s) => s.bar.ville.cle === VILLE;
  const sorte = (m) => sorteDuMatch(m, { competitions, t });
  const competitionDe = (m) => t.competitions[m.competition] ?? m.competition;
  const sortie = [];

  // Les matchs choisis qui ont leur page en français : leur page en anglais. Un match encore au programme garde son objet
  // (ses soirées) ; un match passé ou retiré, ce que l’état en garde.
  const jumelles = pages.filter((p) => p.type === 'match')
    .map((fr) => ({ fr, match: fr.partage?.match ?? { ...fr.memoire, debut: Date.parse(fr.memoire.debut), soirees: [] } }))
    .filter(({ match }) => sorte(match));
  const avecPage = new Set(jumelles.map(({ match }) => match.slug));
  // Les matchs à venir qui ont leur page, dans l’ordre du coup d’envoi.
  const aVenir = jumelles.filter(({ fr }) => fr.partage).map(({ match }) => match).sort((a, b) => a.debut - b.debut || a.slug.localeCompare(b.slug));
  // Les vrais bars de Paris qui montrent un de ces matchs (un match reporté ou annulé ne compte pas).
  const barsDe = (matchs) => [...new Map(matchs.filter((m) => !m.statut).flatMap((m) => m.soirees.filter(deParis)).map((s) => [s.bar.id, s.bar])).values()].sort(parLieu);

  // ---------- Les morceaux ----------
  const accueil = { nom: t.fil.accueil, chemin: '/' };
  const paris = { nom: t.fil.paris, chemin: CHEMINS_EN.paris };
  const fil = (etapes) => `<nav class="regarder-fil" aria-label="${e(t.fil.ariane)}">
  <ol>
${etapes.map((etape, i) => (i === etapes.length - 1
    ? `    <li aria-current="page">${e(etape.nom)}</li>`
    : `    <li><a href="${etape.chemin}">${e(etape.nom)}</a></li>`)).join('\n')}
  </ol>
</nav>`;
  // majuscule : en tête de ligne (« Time to be confirmed »).
  const temps = (m, { heureSeule = false, majuscule = false } = {}) => {
    const texte = heureSeule ? (m.heureConfirmee ? heureALAnglaise(m.debut) : t.quand.aConfirmerCourt) : quandALAnglaise(m, t);
    return `<time datetime="${debutDe(m)}">${e(majuscule ? capitale(texte) : texte)}</time>`;
  };
  // Une ligne d’une liste de matchs : le match seul sur sa ligne, ses détails dessous (gabarits.mjs).
  const ligneDuMatch = (m, infos) => ligneDeListe(e(nomDuMatch(m)), avecPage.has(m.slug) ? cheminEnAnglais(m.slug) : null, infos);
  const lienDuMatch = (m) => (avecPage.has(m.slug) ? `<a href="${cheminEnAnglais(m.slug)}">${e(nomDuMatch(m))}</a>` : e(nomDuMatch(m)));
  const compte = (n) => remplir(n > 1 ? t.bars.comptePluriel : t.bars.compte, { n });
  // Un match reporté ou annulé le dit partout où il est listé : « · Match postponed » après son jour et son heure.
  const statut = (m) => (m.statut ? ` · <strong>${e(t.match[m.statut])}</strong>` : '');
  // Ce qu’on sait d’un match dans une liste : ses bars de Paris, ou son statut.
  const etatDuMatch = (m) => (m.statut
    ? `<strong>${e(t.match[m.statut])}</strong>`
    : `<span class="regarder-compte">${e(barsDe([m]).length ? compte(barsDe([m]).length) : t.bars.pasDeBar)}</span>`);
  const atouts = (bar) => {
    const liste = [];
    if (Number.isInteger(bar.atouts.screens) && bar.atouts.screens > 0) liste.push(remplir(bar.atouts.screens > 1 ? t.atouts.screensPluriel : t.atouts.screens, { n: bar.atouts.screens }));
    for (const cle of ['sound', 'bothCamps', 'outdoor', 'food', 'standing']) if (bar.atouts[cle] === true) liste.push(t.atouts[cle]);
    return liste.length ? `\n      <ul class="regarder-atouts">${liste.map((a) => `<li>${e(a)}</li>`).join('')}</ul>` : '';
  };
  // La carte d’un bar : son nom (vers sa page, en français), son quartier et son adresse, ce qu’il dit de lui ; jamais
  // son offre.
  const carteDuBar = (bar, { niveau = 3, suite = '' } = {}) => `<li class="regarder-carte">
      <h${niveau} class="regarder-carte__nom"><a href="${cheminDuBar(bar)}" hreflang="fr">${e(bar.nom)}</a></h${niveau}>
      <p class="regarder-carte__lieu">${e(quartierDe(bar))} · ${e(bar.adresse)}</p>${atouts(bar)}${suite}
    </li>`;
  const cartes = (bars, options) => `  <ul class="regarder-cartes">
    ${bars.map((bar) => carteDuBar(bar, options)).join('\n    ')}
  </ul>
  <p class="regarder-note">${e(t.bars.enFrancais)}</p>`;
  const tuTiensUnBar = `<div class="regarder-bars-pro">
    <p><strong>${e(t.bars.tuTiensUnBar)}</strong> ${e(t.bars.tuTiensUnBarSuite)}</p>
    <a class="regarder-bars-pro__bouton" href="/pour-les-bars.html#proposer" hreflang="fr">${e(t.bars.proposerMonBar)}</a>
  </div>`;
  // Les matchs, sous le titre de leur jour à Paris : la ligne ne donne que l’heure.
  const parJour = (matchs) => [...new Set(matchs.map((m) => jourDeParis(m.debut)))].map((jour) => `  <h3 class="regarder-jour">${e(jourEntierALAnglaise(Date.parse(`${jour}T12:00:00Z`)))}</h3>
  <ul class="regarder-matchs">
${matchs.filter((m) => jourDeParis(m.debut) === jour).map((m) => `    ${ligneDuMatch(m, `${temps(m, { heureSeule: true, majuscule: true })} · ${e(competitionDe(m))} · ${etatDuMatch(m)}`)}`).join('\n')}
  </ul>`).join('\n');
  const listeDesMatchs = (nom, matchs) => ({
    '@type': 'ItemList',
    name: nom,
    numberOfItems: matchs.length,
    itemListElement: matchs.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: nomDuMatch(m), url: adresseDe(cheminEnAnglais(m.slug)) })),
  });
  // L’état de l’appli, dès la tête de la page : en test, Android seulement, à Paris (marque.json).
  const plateformes = [marque.appli?.android && 'Android', marque.appli?.iphone && 'iPhone'].filter(Boolean).join(' and ');
  const noteDeLAppli = `  <p class="regarder-note">${e(ouverte ? remplir(t.appli.ouverte, { plateformes }) : t.appli.fermee)}</p>`;
  // Être prévenu : tant que l’appli n’est pas ouverte, la liste d’attente de Paris (l’adresse et la ville, comme sur
  // l’accueil, rien d’autre) ; ensuite, les magasins.
  // L’essentiel de la confidentialité de la liste d’attente, en anglais (la page Confidentialité est en français) :
  // qui, pourquoi, quoi, le prestataire, combien de temps, les droits et l’adresse à qui écrire.
  const contact = `<a href="mailto:${e(t.attente.viePriveeContact)}">${e(t.attente.viePriveeContact)}</a>`;
  const viePrivee = `<ul class="attente__vie-privee">
${t.attente.viePrivee.map(([titre, texte]) => `    <li><strong>${e(titre)}</strong> ${texte.split('{contact}').map(e).join(contact)}</li>`).join('\n')}
  </ul>`;
  const appel = ouverte
    ? `<div class="regarder-appel">
  ${[['Android', marque.appli.android], ['iPhone', marque.appli.iphone]].filter(([, lien]) => lien).map(([nom, lien]) => `<a class="capsule" href="${e(lien)}">${e(t.appel.ouverte)} · ${nom}</a>`).join('\n  ')}
  <p>${e(t.appel.ouverteNote)}</p>
</div>`
    : `<section class="regarder-section regarder-attente" aria-labelledby="titre-attente">
  <h2 id="titre-attente">${e(t.attente.titre)}</h2>
  <form class="attente" id="attente" action="${ENVOI_DE_LA_LISTE}" method="POST">
    <label class="attente__etiquette" for="attente-mail">${e(t.attente.etiquette)}</label>
    <div class="attente__ligne">
      <input class="attente__champ" id="attente-mail" name="email" type="email" inputmode="email" autocomplete="email" placeholder="${e(t.attente.exemple)}" aria-describedby="attente-usage" required>
      <button class="attente__bouton" type="submit">${e(t.attente.bouton)}</button>
    </div>
    <div class="attente__piege" aria-hidden="true"><label for="attente-piege">Leave this field empty</label><input id="attente-piege" type="text" name="_gotcha" tabindex="-1" autocomplete="off"></div>
    <input type="hidden" name="_subject" value="${e(textes.attente.sujet)}">
    <input type="hidden" name="ville" value="Paris">
    <p class="attente__note" id="attente-usage">${e(t.attente.note)} <a href="/confidentialite.html#liste-attente" hreflang="fr">${e(t.attente.lienNote)}</a>.</p>
  </form>
  ${viePrivee}
</section>`;
  const commentCaMarche = () => {
    const { intro, etapes } = t.commentCaMarche[ouverte ? 'ouverte' : 'fermee'];
    return `<section class="regarder-section" aria-labelledby="titre-comment">
  <h2 id="titre-comment">${e(t.commentCaMarche.titre)}</h2>
${intro ? `  <p>${e(intro)}</p>\n` : ''}  <ol class="regarder-etapes">
${etapes.map((etape) => `    <li><strong>${e(etape.titre)}</strong> ${e(etape.texte)}</li>`).join('\n')}
  </ol>
</section>`;
  };
  const retour = `<p class="regarder-retour"><a href="${CHEMINS_EN.paris}">${e(t.retour)}</a></p>`;
  const imageGenerale = { adresse: IMAGE, alt: t.imageAlt };
  const ajouter = (p) => {
    const rendue = { ...p, langue: 'en', partage: p.partage ?? false };
    sortie.push({ ...rendue, contenu: page({ cadre, marque, avecPresse, textesDuPartage: { bouton: t.partage }, ...rendue, image: p.image ?? imageGenerale }) });
    // L’image de la jumelle française n’existe que si sa page passe le contrôle : la version avec l’image générale est
    // prête (lierLesLangues la prend sinon).
    if (p.image) sortie.at(-1).sansImageDeLaJumelle = page({ cadre, marque, avecPresse, textesDuPartage: { bouton: t.partage }, ...rendue, image: imageGenerale });
  };

  // ---------- Les pages des matchs ----------
  for (const { fr, match } of jumelles) {
    const chemin = cheminEnAnglais(match.slug);
    const nom = nomDuMatch(match);
    const competition = competitionDe(match);
    const vivant = Boolean(fr.partage);
    const passe = !enCoursOuAVenir(match);
    const guide = { 'premier-league': { nom: t.fil.premierLeague, chemin: CHEMINS_EN.premierLeague }, 'champions-league': { nom: t.fil.championsLeague, chemin: CHEMINS_EN.championsLeague } }[sorte(match)];
    const etapes = [accueil, paris, ...(guide ? [guide] : []), { nom, chemin }];
    const quand = quandALAnglaise(match, t);
    const clubs = [match.domicile.cle, match.exterieur.cle];
    const prochains = donnees.matchs.filter((m) => m.slug !== match.slug && m.debut > Math.max(match.debut, maintenant - DUREE_MATCH_MS) && enCoursOuAVenir(m)
      && [m.domicile.cle, m.exterieur.cle].some((cle) => clubs.includes(cle))).sort((a, b) => a.debut - b.debut);
    const enTete = `<header class="regarder-tete">
  <p class="regarder-surtitre">${e(competition)}</p>
  <h1 class="regarder-titre">${e(vivant ? remplir(t.match.titreH1, { match: nom }) : nom)}</h1>
  <p class="regarder-quand">${temps(match)}</p>
${vivant && match.heureConfirmee ? `  <p class="regarder-note">${e(remplir(t.quand.royaumeUni, { heure: heureALAnglaise(match.debut, 'Europe/London') }))}</p>\n` : ''}${vivant && !match.heureConfirmee ? `  <p class="regarder-note">${e(t.match.heureAConfirmer)}</p>\n` : ''}${vivant && match.statut ? `  <p class="regarder-note"><strong>${e(t.match[match.statut])}.</strong> ${e(t.match.statutSuite)}</p>\n` : ''}${vivant && fr.evenement ? `  <div class="regarder-agenda">
    <a class="regarder-agenda__bouton" href="${cheminDuFichierDuMatch(match)}" type="text/calendar">${e(t.match.agenda)}</a>
  </div>\n` : ''}${vivant ? `${noteDeLAppli}\n` : ''}</header>`;

    if (!vivant) {
      // Passé, ou plus au programme : la page le dit, sans score, et mène au prochain match d’un des deux clubs.
      const suivant = prochains[0];
      const etat = passe ? t.match.passe : t.match.plusAnnonce;
      const club = suivant && ([suivant.domicile.cle, suivant.exterieur.cle].includes(match.domicile.cle) ? match.domicile.nom : match.exterieur.nom);
      const suite = suivant
        ? `<p>${e(remplir(t.match.passeSuite, { club }))} ${lienDuMatch(suivant)}, ${temps(suivant)}${statut(suivant)}.</p>`
        : `<p>${e(t.match.passeSansSuite)} <a href="${CHEMINS_EN.paris}">${e(t.retour)}</a></p>`;
      const titrePage = titre(`${nom}, ${jourALAnglaise(match.debut)}: match played — Baromatch`, `${nom}: match played`, nom);
      const desc = description(
        remplir(t.match.descriptionPasse, { match: `${nom} (${competition})`, quand, etat }),
        remplir(t.match.descriptionPasse, { match: nom, quand, etat }),
        remplir(t.match.descriptionPasse, { match: nom, quand: jourALAnglaise(match.debut), etat }),
      );
      ajouter({
        type: 'match-en', cle: match.slug, jumelle: fr.chemin, date: new Date(match.debut).toISOString(), chemin, indexable: false, titre: titrePage, description: desc,
        jsonld: [pageWeb({ chemin, titre: titrePage, description: desc, inLanguage: 'en' }), filDAriane(etapes)],
        corps: `${fil(etapes)}
${enTete}
<section class="regarder-section regarder-passe" aria-labelledby="titre-passe">
  <h2 id="titre-passe">${e(etat)}</h2>
  ${suite}
</section>
${retour}`,
      });
      continue;
    }

    const soirees = match.soirees.filter(deParis);
    const bars = soirees.map((s) => s.bar).sort(parLieu);
    const ailleurs = match.soirees.length > soirees.length
      ? `\n  <p>${e(t.match.ailleurs)} <a href="${fr.chemin}" hreflang="fr">${e(t.match.ailleursLien)}</a>.</p>` : '';
    const indexable = bars.length >= SEUILS.barsParMatch;
    const titrePage = titre(`${remplir(t.match.titreH1, { match: nom })} — Baromatch`, remplir(t.match.titreH1, { match: nom }), `${nom}: where to watch in Paris`, `${nom} in Paris`, nom);
    const valeurs = { bars: compte(bars.length), verbe: bars.length > 1 ? 'are' : 'is' };
    const modele = bars.length ? t.match.descriptionAvecBars : t.match.descriptionSansBar;
    const desc = description(
      remplir(modele, { ...valeurs, match: `${nom} (${competition})`, quand }),
      remplir(modele, { ...valeurs, match: nom, quand }),
      remplir(modele, { ...valeurs, match: nom, quand: jourALAnglaise(match.debut) }),
    );
    const sectionBars = `<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(t.match.titreBars)}</h2>
${bars.length ? `  <p class="regarder-compte">${e(compte(bars.length))}</p>\n${cartes(bars)}${ailleurs}` : `  <p class="regarder-vide">${e(t.match.sansBar)}</p>${ailleurs}
  ${tuTiensUnBar}`}
</section>`;
    const sectionProchains = `<section class="regarder-section" aria-labelledby="titre-prochains">
  <h2 id="titre-prochains">${e(remplir(t.match.prochains, { clubs: `${match.domicile.nom} and ${match.exterieur.nom}` }))}</h2>
${prochains.length ? `  <ul class="regarder-matchs">
${prochains.slice(0, 6).map((m) => `    ${ligneDuMatch(m, `${temps(m, { majuscule: true })} · ${e(competitionDe(m))}${statut(m)}`)}`).join('\n')}
  </ul>` : `  <p>${e(t.match.aucunProchain)}</p>`}
</section>`;
    // L’image de la jumelle (sa carte), quand le rendu des images est là : celle que montre WhatsApp à côté du lien.
    const image = images && fr.imageDePartage ? { adresse: fr.imageDePartage.adresse, alt: remplir(t.match.alt, { match: nom, quand }) } : null;
    ajouter({
      type: 'match-en', cle: match.slug, jumelle: fr.chemin, date: new Date(match.debut).toISOString(), chemin, indexable, horsPlan: Boolean(match.statut),
      titre: titrePage, description: desc, barsNommes: bars.map((b) => b.id), partage: true, image,
      jsonld: [pageWeb({ chemin, titre: titrePage, description: desc, inLanguage: 'en' }), filDAriane(etapes), ...(bars.length ? [listeDesBars(t.match.titreBars, bars)] : [])],
      corps: `${fil(etapes)}
${enTete}
${sectionBars}
${sectionProchains}
${commentCaMarche()}
${appel}
${retour}`,
    });
  }

  // ---------- Les guides : Paris, la Premier League, la Ligue des champions ----------
  // bars : les vrais bars de Paris qui montrent un match à venir du guide (son index, sa description) ; cartes : les bars
  // montrés, chacun avec sa prochaine soirée du guide.
  const prochaineLigne = (soiree) => (soiree
    ? `\n      <p class="regarder-carte__suite">${e(t.bars.prochaine)} ${lienDuMatch(soiree.match)}, ${temps(soiree.match)}${statut(soiree.match)}.</p>`
    : `\n      <p class="regarder-carte__suite">${e(t.bars.sansSoiree)}</p>`);
  const soireeDuGuide = (bar, matchs) => bar.soirees.find((s) => enCoursOuAVenir(s.match) && (!matchs || matchs.includes(s.match)));
  const ajouterUnGuide = ({ cle, chemin, jumelle, tg, matchs, sections, apres = '', bars, cartes: cartesDuGuide, sansBar, indexable, memoire = null }) => {
    const titrePage = `${tg.titre} — Baromatch`;
    const desc = description(bars.length ? remplir(tg.descriptionAvecBars, { bars: compte(bars.length), verbe: bars.length > 1 ? 'are' : 'is' }) : tg.descriptionSansBar);
    const etapes = chemin === CHEMINS_EN.paris ? [accueil, paris] : [accueil, paris, { nom: tg.titre, chemin }];
    ajouter({
      type: 'guide-en', cle, ...(jumelle ? { jumelle } : {}), chemin, indexable, ...(memoire ? { memoire } : {}), titre: titrePage, description: desc,
      barsNommes: cartesDuGuide.map((c) => c.bar.id), partage: true,
      jsonld: [
        pageWeb({ type: 'CollectionPage', chemin, titre: titrePage, description: desc, inLanguage: 'en' }),
        filDAriane(etapes),
        ...(matchs.length ? [listeDesMatchs(tg.titreMatchs, matchs)] : []),
        ...(cartesDuGuide.length ? [listeDesBars(tg.titreBars, cartesDuGuide.map((c) => c.bar))] : []),
      ],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(tg.titre)}</h1>
  <p class="regarder-chapeau">${e(tg.chapeau)}</p>
${noteDeLAppli}
</header>
${sections}
<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(tg.titreBars)}</h2>
${cartesDuGuide.length ? `  <ul class="regarder-cartes">
    ${cartesDuGuide.map((c) => carteDuBar(c.bar, { suite: prochaineLigne(c.soiree) })).join('\n    ')}
  </ul>
  <p class="regarder-note">${e(t.bars.enFrancais)}</p>` : `  <p class="regarder-vide">${e(sansBar)}</p>
  ${tuTiensUnBar}`}
</section>${apres}
${appel}
${commentCaMarche()}${chemin === CHEMINS_EN.paris ? '' : `\n${retour}`}`,
    });
  };
  const sectionDesMatchs = (id, titreSection, matchs, vide, suite = '') => `<section class="regarder-section" aria-labelledby="${id}">
  <h2 id="${id}">${e(titreSection)}</h2>
${matchs.length ? parJour(matchs) : `  <p>${e(vide)}</p>`}${suite}
</section>`;

  // Les vrais bars publiés de Paris. Le guide d’une compétition : indexable tant que l’un d’eux montre un de ses matchs à
  // venir, puis 30 jours après le coup d’envoi du dernier (gardé dans l’état), et jamais sans vrai bar à Paris.
  const barsDeParis = donnees.bars.filter((b) => b.ville.cle === VILLE).sort(parLieu);
  const indexDuGuide = (cle, matchs) => {
    const reperes = [...matchs.filter((m) => barsDe([m]).length).map((m) => m.debut), Date.parse(anciens.guides?.[cle]?.derniereSoiree ?? '')].filter(Number.isFinite);
    const derniere = reperes.length ? Math.max(...reperes) : null;
    return {
      indexable: barsDeParis.length > 0 && derniere !== null && derniere + GRACE_DES_GUIDES_MS > maintenant,
      memoire: derniere === null ? null : { derniereSoiree: new Date(derniere).toISOString() },
    };
  };

  // Paris : tous ses vrais bars, chacun avec sa prochaine soirée ; les matchs choisis à venir ; ce qu’il faut savoir.
  // Indexable comme sa jumelle, la page de Paris (pages.mjs) : avec son guide écrit, dès son premier vrai bar.
  {
    const tp = t.paris;
    const sections = `${sectionDesMatchs('titre-matchs', tp.titreMatchs, aVenir, tp.sansMatch, `
  <p class="regarder-suite"><a href="${CHEMINS_EN.premierLeague}">${e(t.premierLeague.titre)}</a></p>
  <p class="regarder-suite"><a href="${CHEMINS_EN.championsLeague}">${e(t.championsLeague.titre)}</a></p>`)}`;
    const apres = `
<section class="regarder-section regarder-guide" aria-labelledby="titre-conseils">
  <h2 id="titre-conseils">${e(tp.titreConseils)}</h2>
${tp.conseils.map((conseil) => `  <p>${e(conseil)}</p>`).join('\n')}
</section>`;
    ajouterUnGuide({
      cle: VILLE, chemin: CHEMINS_EN.paris, jumelle: PARIS_EN_FRANCAIS, tg: tp, matchs: aVenir, sections, apres, bars: barsDe(aVenir), sansBar: tp.sansBar,
      indexable: barsDeParis.length >= (contenu.villes?.[VILLE] ? SEUILS.barsParVilleAvecGuide : SEUILS.barsParVilleSansGuide),
      cartes: barsDeParis.map((bar) => ({ bar, soiree: soireeDuGuide(bar) })),
    });
  }

  // La Premier League : une sélection de ses matchs (jamais « tous »), une heure de plus qu’au Royaume-Uni.
  {
    const tp = t.premierLeague;
    const matchs = aVenir.filter((m) => sorte(m) === 'premier-league');
    const bars = barsDe(matchs);
    ajouterUnGuide({
      cle: 'premier-league', chemin: CHEMINS_EN.premierLeague, tg: tp, matchs, bars, sansBar: tp.sansBar, ...indexDuGuide('premier-league', matchs),
      sections: sectionDesMatchs('titre-matchs', tp.titreMatchs, matchs, tp.sansMatch, `
  <p class="regarder-note">${e(tp.selection)}</p>
  <p class="regarder-note">${e(tp.heure)}</p>`),
      cartes: bars.map((bar) => ({ bar, soiree: soireeDuGuide(bar, matchs) })),
    });
  }

  // La Ligue des champions, puis la Ligue Europa et la Ligue Conférence. Une sélection elle aussi ; quand chaque match
  // européen des données a un club du championnat de France, la page le dit.
  {
    const tp = t.championsLeague;
    const ligue = aVenir.filter((m) => sorte(m) === 'champions-league');
    const autres = aVenir.filter((m) => sorte(m) === 'europe');
    const francais = new Set(donnees.matchs.filter((m) => m.competition === CHAMPIONNAT_FRANCAIS).flatMap((m) => [m.domicile.cle, m.exterieur.cle]));
    const europeens = donnees.matchs.filter((m) => ['champions-league', 'europe'].includes(sorte(m)));
    const toutFrancais = europeens.length > 0 && europeens.every((m) => francais.has(m.domicile.cle) || francais.has(m.exterieur.cle));
    const bars = barsDe(ligue);
    const montres = barsDe([...ligue, ...autres]);
    ajouterUnGuide({
      cle: 'champions-league', chemin: CHEMINS_EN.championsLeague, tg: tp, matchs: [...ligue, ...autres], bars, sansBar: tp.sansBar, ...indexDuGuide('champions-league', ligue),
      sections: `${sectionDesMatchs('titre-matchs', tp.titreMatchs, ligue, tp.sansMatch, `
  <p class="regarder-note">${e(tp.selection)}${toutFrancais ? ` ${e(tp.clubsFrancais)}` : ''}</p>`)}${autres.length ? `
${sectionDesMatchs('titre-autres', tp.titreAutres, autres, '')}` : ''}`,
      cartes: montres.map((bar) => ({ bar, soiree: soireeDuGuide(bar, [...ligue, ...autres]) })),
    });
  }
  return sortie;
};

// ---------- Les liens entre les deux langues ----------

const MAIN = '<main id="contenu" class="regarder page">\n';

// Les liens de langue d’une page déjà écrite (et contrôlée) : hreflang après son adresse canonique (alternatives, vide
// tant qu’une des deux jumelles est en noindex), et le lien visible vers sa jumelle en haut de son contenu.
export const avecLesLangues = (html, { autre, alternatives = [] }) => {
  const canonique = html.match(/<link rel="canonical" href="[^"]*">\n/)?.[0];
  if (!canonique || !html.includes(MAIN)) throw new Error('Une page sans adresse canonique ou sans <main> : le gabarit a changé, les liens de langue ne trouvent pas leur place.');
  const liens = alternatives.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${adresseDe(a.chemin)}">\n`).join('');
  const lien = `<p class="regarder-langue"><a href="${autre.chemin}" hreflang="${autre.langue}" lang="${autre.langue}">${e(autre.texte)}</a></p>\n`;
  return html.replace(canonique, () => `${canonique}${liens}`).replace(MAIN, () => `${MAIN}${lien}`);
};

// Après le contrôle (site.mjs) : chaque page en anglais et sa jumelle française, si les deux le passent, reçoivent le
// lien « English » / « Version française », et hreflang dans les deux sens (fr, en, x-default vers le français) si les
// deux sont indexables. Une page en anglais dont la jumelle est refusée (une page neutre la remplace, sans image de
// partage) ne garde ni lien ni son image. Les deux pages liées repassent le contrôle ; refusées, elles restent sans lien.
// pages : les pages du passage qui ont passé le contrôle. Rend ce que le journal doit dire.
export const lierLesLangues = (pages, controler, t = TEXTES_EN) => {
  const parChemin = new Map(pages.map((p) => [p.chemin, p]));
  const messages = [];
  for (const en of pages.filter((p) => p.langue === 'en' && p.jumelle)) {
    const fr = parChemin.get(en.jumelle);
    if (!fr) {
      if (en.sansImageDeLaJumelle) en.contenu = en.sansImageDeLaJumelle;
      continue;
    }
    const alternatives = en.indexable && fr.indexable
      ? [{ hreflang: 'fr', chemin: fr.chemin }, { hreflang: 'en', chemin: en.chemin }, { hreflang: 'x-default', chemin: fr.chemin }]
      : [];
    const versionFr = avecLesLangues(fr.contenu, { autre: { chemin: en.chemin, langue: 'en', texte: t.langue.anglais }, alternatives });
    const versionEn = avecLesLangues(en.contenu, { autre: { chemin: fr.chemin, langue: 'fr', texte: t.langue.francais }, alternatives });
    const erreurs = [...controler({ ...fr, contenu: versionFr }), ...controler({ ...en, contenu: versionEn })];
    if (erreurs.length) {
      messages.push(`Pages jumelles laissées sans lien de langue : ${fr.chemin} et ${en.chemin} (${erreurs.join(' ; ')})`);
      continue;
    }
    fr.contenu = versionFr;
    en.contenu = versionEn;
  }
  return messages;
};
