// Les pages « Où regarder les matchs de … dans un bar » : une par club suivi (/matchs/club/<club>/) et une par
// compétition (/matchs/competition/<compétition>/), en français, de la liste de contenu/suivre.json et d’elle seule (les
// clubs les plus suivis en France, les championnats et les coupes d’Europe des données) : jamais une page par club des
// données. Chacune est faite des vraies données du passage : les matchs à venir (la compétition, le jour et l’heure de
// Paris, vers leur page quand ils en ont une), les vrais bars publiés qui en diffusent un (le nom vers sa page, sa
// prochaine soirée), et ce que le site sait faire pour ce club (son agenda, la page de sa ville, le guide). Aucune
// chaîne : les données n’en donnent pas, la page le dit. Aucune offre de bar, aucun score.
// L’index : une page avec au moins 2 matchs à venir au programme (ni reportés ni annulés, MATCHS_POUR_L_INDEX) est
// indexable, même sans vrai bar, comme l’affiche de la semaine : elle répond à une vraie question (quand joue ce club,
// à quelle heure, et où le voir) avec des données vraies, et elle le dit quand aucun bar ne diffuse encore ses matchs.
// Son titre ne promet un bar que si elle en montre un (« Où regarder les matchs du PSG dans un bar ») ; sans bar,
// « Matchs du PSG : quand et où les regarder ». En dessous de 2 matchs, la page reste à son adresse (aucun lien ne
// meurt), en noindex, et le dit.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cheminDuCalendrier, clubsDeLigue1, lienVersLAgenda, webcalDe } from './agenda.mjs';
import { DOSSIER_GENERATEUR } from './contenu.mjs';
import { DUREE_MATCH_MS } from './donnees.mjs';
import { appel, fil, ligneDeListe, ligneDeMatch, page, quand, statutDuMatch, tuTiensUnBar } from './gabarits.mjs';
import { heureDeParis, jourEnLettres } from './heure.mjs';
import { adresseDe, cheminDeLaVille, cheminDuBar, cheminDuMatch, filDAriane, listeDesBars, pageWeb } from './jsonld.mjs';
import { accorder, capitale, echapper as e, enumerer } from './texte.mjs';

export const TEXTES_SUIVRE = JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', 'suivre.json'), 'utf8'));
export const cheminDuClub = (cle) => `/matchs/club/${cle}/`;
export const cheminDeLaCompetition = (cle) => `/matchs/competition/${cle}/`;
// Le guide écrit à la main : comment trouver un bar qui diffuse le match.
export const CHEMIN_DU_GUIDE = '/trouver-un-bar-qui-diffuse-le-match.html';
// En dessous, une page mince : noindex.
export const MATCHS_POUR_L_INDEX = 2;

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
const clubsSuivis = (t) => Object.entries(t.clubs).filter(([cle]) => !cle.startsWith('_'));
const competitionsSuivies = (t) => Object.entries(t.competitions).filter(([nom]) => !nom.startsWith('_'));

// Le lien vers la page d’un club suivi, ou de la compétition d’un match (pages.mjs : la page d’un match y mène).
export const lienDuClub = (cle, t = TEXTES_SUIVRE) => (t.clubs[cle]
  ? `<a href="${cheminDuClub(cle)}">${e(remplir(t.lienDuClub, { de: t.clubs[cle].de }))}</a>` : null);
export const lienDeLaCompetition = (nom, t = TEXTES_SUIVRE) => (t.competitions[nom]
  ? `<a href="${cheminDeLaCompetition(t.competitions[nom].cle)}">${e(remplir(t.lienDeLaCompetition, { nom: t.competitions[nom].nom }))}</a>` : null);

// « Par club et par compétition » : chaque page de la liste, depuis la semaine (/matchs/) et le guide. Les pages
// existent toujours (une par entrée de la liste) : aucun de ces liens ne meurt.
// aVenir : les matchs à venir du passage (ni reportés ni annulés) ; chaque ligne dit combien en a la page.
const aVenirDe = (n, t) => (n ? accorder(n, 'match à venir', 'matchs à venir') : t.liens.aucun);
export const sectionDesPagesSuivies = ({ clubs, aVenir, t = TEXTES_SUIVRE }) => {
  const courts = new Map(Object.entries(clubs).filter(([cle]) => !cle.startsWith('_')).map(([cle, c]) => [cle, c.court]));
  const joues = aVenir.filter((m) => !m.statut);
  return `<section class="regarder-section" aria-labelledby="titre-suivre">
  <h2 id="titre-suivre">${e(t.liens.titre)}</h2>
  <h3 class="regarder-jour">${e(t.liens.clubs)}</h3>
  <ul class="regarder-matchs">
${clubsSuivis(t).map(([cle]) => `    ${ligneDeListe(e(courts.get(cle) ?? cle), cheminDuClub(cle), e(aVenirDe(joues.filter((m) => m.domicile.cle === cle || m.exterieur.cle === cle).length, t)))}`).join('\n')}
  </ul>
  <h3 class="regarder-jour">${e(t.liens.competitions)}</h3>
  <ul class="regarder-matchs">
${competitionsSuivies(t).map(([nom, c]) => `    ${ligneDeListe(e(nom), cheminDeLaCompetition(c.cle), e(aVenirDe(joues.filter((m) => m.competition === nom).length, t)))}`).join('\n')}
  </ul>
</section>`;
};

// pages : celles du passage (les pages de matchs : un match qui a la sienne y mène).
export const fabriquerLesPagesSuivies = ({ donnees, contenu, cadre, avecPresse = false, pages = [] }) => {
  const t = contenu.suivre ?? TEXTES_SUIVRE;
  const { marque, textes, villes = {}, clubs = {} } = contenu;
  const { maintenant } = donnees;
  const enCoursOuAVenir = (m) => m.debut + DUREE_MATCH_MS > maintenant;
  const aVenir = donnees.matchs.filter(enCoursOuAVenir).sort((a, b) => a.debut - b.debut || a.slug.localeCompare(b.slug));
  const avecPage = new Set(pages.filter((p) => p.type === 'match' && p.partage).map((p) => p.cle));
  const accueil = { nom: textes.fil.accueil, chemin: '/' };
  const semaine = { nom: textes.fil.matchs, chemin: '/matchs/' };
  const ligue1 = new Set(clubsDeLigue1(donnees.matchs).map((c) => c.cle));
  const sortie = [];
  // Les villes où Baromatch a de vrais bars publiés.
  const barsDeLaVille = new Set(donnees.bars.map((b) => b.ville.cle));

  const nomCourt = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
  const quandCourt = (m) => (m.heureConfirmee ? `${jourEnLettres(m.debut)} à ${heureDeParis(m.debut)}` : `${jourEnLettres(m.debut)}, heure à confirmer`);
  // Ce qu’on sait d’un match dans la liste : son statut, ou le vrai nombre de ses vrais bars (vers leurs villes).
  const etatDuMatch = (m) => statutDuMatch(m, textes) || ` · <span class="regarder-compte">${m.soirees.length ? e(accorder(m.soirees.length, 'bar')) : e(textes.semaine.pasDeBar)}</span>`;
  const ligne = (m) => `    ${ligneDeMatch(m, { avecPage: avecPage.has(m.slug), suite: etatDuMatch(m) })}`;
  // Les vrais bars publiés qui diffusent un de ces matchs, chacun avec sa prochaine soirée parmi eux (un match reporté
  // ou annulé ne compte pas), dans l’ordre annoncé : la ville, l’arrondissement, puis le nom.
  const barsDe = (matchs) => {
    const parBar = new Map();
    for (const m of matchs.filter((x) => !x.statut)) for (const s of m.soirees) if (!parBar.has(s.bar.id)) parBar.set(s.bar.id, s);
    return [...parBar.values()].sort((a, b) => a.bar.ville.nom.localeCompare(b.bar.ville.nom, 'fr')
      || (a.bar.arrondissement?.numero ?? 0) - (b.bar.arrondissement?.numero ?? 0) || a.bar.nom.localeCompare(b.bar.nom, 'fr'));
  };
  // de : « du PSG », « de la Ligue 1 ».
  const carte = (s, de) => `    <li class="regarder-carte">
      <h3 class="regarder-carte__nom"><a href="${cheminDuBar(s.bar)}">${e(s.bar.nom)}</a></h3>
      <p class="regarder-carte__lieu">${e(s.bar.quartier)} · ${e(s.bar.adresse)}</p>
      <p class="regarder-carte__suite">${e(remplir(t.prochaineSoiree, { de }))} ${avecPage.has(s.match.slug) ? `<a href="${cheminDuMatch(s.match)}">${e(nomCourt(s.match))}</a>` : e(nomCourt(s.match))}, ${quand(s.match)}.</p>
    </li>`;
  const sectionBars = (soirees, de) => `<section class="regarder-section" aria-labelledby="titre-bars">
  <h2 id="titre-bars">${e(t.titreBars)}</h2>
${soirees.length ? `  <p class="regarder-compte">${e(remplir(t.barsEnCompte, { bars: accorder(soirees.length, 'bar') }))}</p>
  <ul class="regarder-cartes">
${soirees.map((s) => carte(s, de)).join('\n')}
  </ul>` : `  <p class="regarder-vide">${e(t.sansBar)}</p>
  ${tuTiensUnBar(textes)}`}
  ${appel(marque, textes)}
</section>`;
  // Les heures de coup d’envoi confirmées, telles que les données les donnent (« 18:45 et 21:00 »).
  const coupsDEnvoi = (matchs) => {
    const heures = [...new Set(matchs.filter((m) => m.heureConfirmee && !m.statut).map((m) => heureDeParis(m.debut)))].sort();
    return heures.length ? `\n  <p class="regarder-note">${e(remplir(t.coupsDEnvoi, { heures: enumerer(heures) }))}</p>` : '';
  };
  // liens : les pages des compétitions de ces matchs (sur la page d’un club).
  const sectionMatchs = (titreSection, matchs, liens = []) => `<section class="regarder-section" aria-labelledby="titre-matchs">
  <h2 id="titre-matchs">${e(titreSection)}</h2>
${matchs.length ? `  <ul class="regarder-matchs">
${matchs.map(ligne).join('\n')}
  </ul>${coupsDEnvoi(matchs)}` : `  <p>${e(t.sansMatch)}</p>`}${liens.map((lien) => `\n  <p class="regarder-suite">${lien}</p>`).join('')}
</section>`;
  const listeDesMatchs = (nom, matchs) => {
    const listes = matchs.filter((m) => avecPage.has(m.slug));
    return listes.length ? [{
      '@type': 'ItemList', name: nom, numberOfItems: listes.length,
      itemListElement: listes.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: nomCourt(m), url: adresseDe(cheminDuMatch(m)) })),
    }] : [];
  };
  // Le nombre de matchs à venir et le dernier jour qu’ils atteignent : « 4 matchs au programme de Baromatch, jusqu’au
  // dimanche 8 novembre ».
  // matchs : ceux qui se jouent (ni reportés ni annulés), comme la description.
  const chapeau = (modele, matchs, soirees) => (matchs.length
    ? remplir(modele, { n: capitale(accorder(matchs.length, 'match', 'matchs')), jour: jourEnLettres(matchs.at(-1).debut), bars: soirees.length ? t.chapeauBars : '' })
    : t.chapeauSansMatch);
  const ajouter = (p) => sortie.push({ ...p, contenu: page({ cadre, marque, avecPresse, ...p }) });
  const titreDe = (texte) => (texte.length + ' — Baromatch'.length <= 60 ? `${texte} — Baromatch` : texte);
  // La première description de 70 à 160 caractères ; sinon la dernière (le contrôle des pages vérifie ces bornes).
  const description = (...candidats) => candidats.find((d) => d.length >= 70 && d.length <= 160) ?? candidats.at(-1);
  const nBars = (soirees) => accorder(soirees.length, 'bar');
  const sectionTrouver = (ville) => {
    const guide = ville && villes[ville] ? `  <p>${e(remplir(barsDeLaVille.has(ville) ? t.ville : t.villeSansBar, { ville: villes[ville].nom }))} <a href="${cheminDeLaVille({ cle: ville })}">${e(remplir(textes.ville.titre, { ville: villes[ville].nom }))}</a></p>\n` : '';
    return `<section class="regarder-section" aria-labelledby="titre-trouver">
  <h2 id="titre-trouver">${e(t.titreTrouver)}</h2>
${guide}  <p>${e(t.chaine)}</p>
  <p class="regarder-suite"><a href="${CHEMIN_DU_GUIDE}">${e(t.guide)}</a></p>
</section>`;
  };

  // ---------- Les clubs ----------
  for (const [cle, club] of clubsSuivis(t)) {
    const chemin = cheminDuClub(cle);
    const connu = clubs[cle] ?? {};
    const court = connu.court ?? cle;
    // Le nom complet du club, tel que les données le donnent (« Paris Saint-Germain »), sinon son nom court.
    const nomComplet = donnees.matchs.flatMap((m) => [m.domicile, m.exterieur]).find((c) => c.cle === cle)?.nom || court;
    const matchs = aVenir.filter((m) => m.domicile.cle === cle || m.exterieur.cle === cle);
    const joues = matchs.filter((m) => !m.statut);
    const indexable = joues.length >= MATCHS_POUR_L_INDEX;
    const soirees = barsDe(matchs);
    const h1 = remplir(soirees.length ? t.titre : t.titreSansBar, { de: club.de });
    const titrePage = titreDe(h1);
    const prochain = joues[0];
    const desc = prochain
      ? description(
        remplir(soirees.length ? t.description : t.descriptionSansBar, { n: capitale(accorder(joues.length, 'match', 'matchs')), de: club.de, bars: nBars(soirees), diffuse: soirees.length > 1 ? 'diffusent' : 'diffuse', prochain: `${nomCourt(prochain)}, ${quandCourt(prochain)}` }),
        remplir(soirees.length ? t.description : t.descriptionSansBar, { n: capitale(accorder(joues.length, 'match', 'matchs')), de: club.de, bars: nBars(soirees), diffuse: soirees.length > 1 ? 'diffusent' : 'diffuse', prochain: nomCourt(prochain) }),
        remplir(t.descriptionCourte, { de: club.de, prochain: nomCourt(prochain) }),
      )
      : remplir(t.descriptionSansMatch, { de: club.de });
    const etapes = [accueil, semaine, { nom: court, chemin }];
    const agenda = ligue1.has(cle) ? `<section class="regarder-section" aria-labelledby="titre-agenda">
  <h2 id="titre-agenda">${e(remplir(t.agenda, { de: club.de }))}</h2>
  <p>${e(remplir(t.agendaTexte, { de: club.de }))}</p>
  <p class="regarder-agenda"><a class="regarder-agenda__bouton" href="${webcalDe(cle)}">${e('S’abonner')}<span class="visuellement-cache"> : ${e(court)}</span></a></p>
  <p class="regarder-agenda__adresse"><a href="${adresseDe(cheminDuCalendrier(cle))}">${e(adresseDe(cheminDuCalendrier(cle)))}</a></p>
  ${lienVersLAgenda()}
</section>\n` : '';
    const competitions = [...new Set(matchs.map((m) => m.competition))].map((nom) => lienDeLaCompetition(nom, t)).filter(Boolean);
    ajouter({
      type: 'club', cle, date: null, chemin, indexable, titre: titrePage, description: desc, barsNommes: soirees.map((s) => s.bar.id),
      jsonld: [
        pageWeb({ type: 'CollectionPage', chemin, titre: titrePage, description: desc, about: { '@type': 'SportsTeam', name: nomComplet, sport: 'Football' } }),
        filDAriane(etapes),
        ...listeDesMatchs(remplir(t.titreMatchs, { de: club.de }), matchs),
        ...(soirees.length ? [listeDesBars(t.titreBars, soirees.map((s) => s.bar))] : []),
      ],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <p class="regarder-surtitre">${e(t.surtitreClub)}</p>
  <h1 class="regarder-titre">${e(h1)}</h1>
  <p class="regarder-chapeau">${e(chapeau(t.chapeauClub, joues, soirees))}</p>
${prochain ? `  <p class="regarder-quand">${e(remplir(t.prochain, { match: `${prochain.domicile.nom} – ${prochain.exterieur.nom}`, quand: quandCourt(prochain), competition: prochain.competition, lieu: prochain.domicile.cle === cle ? t.domicile : t.exterieur }))}</p>\n` : ''}</header>
${sectionMatchs(remplir(t.titreMatchs, { de: club.de }), matchs, competitions)}
${sectionBars(soirees, club.de)}
${agenda}${sectionTrouver(club.ville)}
<p class="regarder-retour"><a href="/matchs/">${e(textes.villes.voirLaSemaine)}</a></p>`,
    });
  }

  // ---------- Les compétitions ----------
  for (const [nom, competition] of competitionsSuivies(t)) {
    const chemin = cheminDeLaCompetition(competition.cle);
    const matchs = aVenir.filter((m) => m.competition === nom);
    const joues = matchs.filter((m) => !m.statut);
    const indexable = joues.length >= MATCHS_POUR_L_INDEX;
    const soirees = barsDe(matchs);
    const h1 = remplir(soirees.length ? t.titreCompetition : t.titreCompetitionSansBar, { nom: competition.nom, competition: nom });
    const titrePage = titreDe(h1);
    const desc = joues.length
      ? remplir(soirees.length ? t.descriptionCompetition : t.descriptionCompetitionSansBar, { n: capitale(accorder(joues.length, 'match', 'matchs')), nom: competition.nom, bars: nBars(soirees), diffuse: soirees.length > 1 ? 'diffusent' : 'diffuse' })
      : remplir(t.descriptionCompetitionSansMatch, { nom: competition.nom });
    const etapes = [accueil, semaine, { nom, chemin }];
    // Les clubs suivis de cette compétition, vers leur page.
    const suivis = clubsSuivis(t).filter(([cle]) => matchs.some((m) => m.domicile.cle === cle || m.exterieur.cle === cle));
    const sectionClubs = suivis.length ? `<section class="regarder-section" aria-labelledby="titre-clubs">
  <h2 id="titre-clubs">${e(remplir(t.titreClubs, { nom: competition.nom }))}</h2>
  <ul class="regarder-matchs">
${suivis.map(([cle]) => `    ${ligneDeListe(e(clubs[cle]?.court ?? cle), cheminDuClub(cle), e(remplir(t.clubDeLaCompetition, { n: aVenirDe(joues.filter((m) => m.domicile.cle === cle || m.exterieur.cle === cle).length, t), nom })))}`).join('\n')}
  </ul>
</section>\n` : '';
    ajouter({
      type: 'competition', cle: competition.cle, date: null, chemin, indexable, titre: titrePage, description: desc, barsNommes: soirees.map((s) => s.bar.id),
      jsonld: [
        pageWeb({ type: 'CollectionPage', chemin, titre: titrePage, description: desc }),
        filDAriane(etapes),
        ...listeDesMatchs(remplir(t.titreMatchsCompetition, { nom: competition.nom }), matchs),
        ...(soirees.length ? [listeDesBars(t.titreBars, soirees.map((s) => s.bar))] : []),
      ],
      corps: `${fil(etapes)}
<header class="regarder-tete">
  <p class="regarder-surtitre">${e(t.surtitreCompetition)}</p>
  <h1 class="regarder-titre">${e(h1)}</h1>
  <p class="regarder-chapeau">${e(chapeau(t.chapeauCompetition, joues, soirees))}</p>
  <p class="regarder-chapeau">${e(competition.phrase)}</p>
${joues[0] ? `  <p class="regarder-quand">${e(remplir(t.prochainCompetition, { match: `${joues[0].domicile.nom} – ${joues[0].exterieur.nom}`, quand: quandCourt(joues[0]) }))}</p>\n` : ''}</header>
${sectionMatchs(remplir(t.titreMatchsCompetition, { nom: competition.nom }), matchs)}
${sectionBars(soirees, `de ${competition.nom}`)}
${sectionClubs}${sectionTrouver(null)}
<p class="regarder-retour"><a href="/matchs/">${e(textes.villes.voirLaSemaine)}</a></p>`,
    });
  }
  return sortie;
};
