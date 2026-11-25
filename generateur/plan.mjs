// Le plan « Paris, ce soir » : le programme du soir (un match à cocher, comme un guide télé) et, pour chaque match, un
// plan schématique de Paris dont les arrondissements s’allument là où des bars publiés le passent, leur liste en mots
// (« Les bars qui passent le match, par arrondissement »), le geste « Maintiens » à l’essai, l’heure qui avance avec le
// défilement (de 18:42 au coup d’envoi) et la lumière des deux clubs. Il sert l’accueil (accueil.mjs), « Ce soir »
// (ce-soir.mjs) et la page d’un match (pages.mjs).
// La vérité d’abord : tant qu’aucun bar n’est publié, la ligne « Aucun bar ne l’annonce encore sur Baromatch » est
// au-dessus du plan, et la démo (PLAN_DEMO) allume des arrondissements entiers, marqués « Démo » : JAMAIS un bar inventé
// posé à un point du plan, avec ou sans étiquette. Dès qu’un vrai bar est publié, la démo disparaît : le plan n’allume
// que les arrondissements de vrais bars (aucun niveau de remplissage : l’appli ne le donne pas).
// Rien ne dépend d’un script : le match coché allume son plan par du CSS seul (plan.css, frères d’un bouton radio) ;
// plan.js ajoute le geste, l’état de chaque match d’après l’horloge de Paris (« dans 1 h 42 », « Le match a commencé. » :
// jamais figé à la fabrication), l’heure qui avance et le sous-bock. Il ne sert que l’accueil : « Ce soir » et la page
// d’un match (planDeParis avec script: false) n’en chargent aucun, leur budget de vitesse ne l’admet pas ; leur plan
// s’y lit pareil, la lumière des deux clubs allumée par la feuille (.soir--sans-script), sans heure qui avance, sans
// état d’horloge, et le geste devient un lien vers la liste d’attente. Aucun style en ligne (politique de sécurité).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOSSIER_GENERATEUR } from './contenu.mjs';
import { heureDeParis } from './heure.mjs';
import { cheminDuBar, cheminDuMatch, debutDe } from './jsonld.mjs';
import { accorder, echapper as e, enumerer } from './texte.mjs';
import { dessinDe, paireDInsignes } from './insigne.mjs';

const lire = (fichier) => JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', fichier), 'utf8'));
export const GEO = lire('plan-paris.json');
export const TEXTES_DU_PLAN = lire('plan.json');
export const SCRIPT_DU_PLAN = '<script src="/plan.js" defer></script>';
export const FEUILLE_DU_PLAN = '/plan.css';
// Une page porte le plan quand elle contient sa racine : c’est elle, et non un script, qui rend l’action de l’en-tête ambre.
export const aLePlan = (html) => html.includes('<div class="soir ');
// Le choix du propriétaire, en attente : « arrondissements » (une démo marquée « Démo », à l’échelle des arrondissements,
// jamais à une adresse) ou « aucune » (le plan reste vide, avec la phrase vraie). Un seul interrupteur.
export const PLAN_DEMO = 'arrondissements';
// Au-delà, les matchs restent dans la liste des pages (le programme tient sur un écran de téléphone).
export const MATCHS_MAX = 10;
const VUE = '22 30 970 772';

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
const hachage = (texte) => {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
};
const arr = (n) => (n === 1 ? '1er' : `${n}e`);
const nomCourt = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
const centre = (n) => GEO.labels[String(n)];

// Les symboles du dessin : la jauge de verre de l’appli et le plan (arrondissements, Seine, îles, noms).
const defs = () => {
  const cellules = Object.entries(GEO.cells).map(([k, d]) => `<path id="pl-a${k}" d="${d}"/>`).join('');
  const etiquettes = Object.entries(GEO.labels).map(([k, [x, y]]) => `<text id="pl-l${k}" x="${x}" y="${y + 9}">${arr(Number(k))}</text>`).join('');
  const s = '<clipPath id="pl-bol"><circle cx="100" cy="100" r="64"/></clipPath>'
    + '<symbol id="pl-verre" viewBox="0 0 200 200"><path d="M68.3 28.7A78 78 0 1 0 131.7 28.7" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/></symbol>'
    + `<g id="pl-base"><path class="paris" d="${GEO.bound}"/><g class="arrs">${cellules}</g><path class="seine" d="${GEO.seineExt}"/><path class="ile" d="${GEO.cite}"/><path class="ile" d="${GEO.stlouis}"/></g><g id="pl-noms">${etiquettes}</g>`;
  return `<svg class="plan-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${s}</defs></svg>`;
};

const jauge = (classe) => `<svg class="${classe}" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><use class="jauge__verre" href="#pl-verre"/></svg>`;

// Les deux couleurs d’un club, celles de son insigne (le générateur de l’appli) ; à défaut un gris neutre : jamais l’ambre
// (l’ambre est pour l’action).
const couleursDuClub = (club) => {
  const d = dessinDe(club);
  const bandes = Array.isArray(d.bandes) ? d.bandes.map((b) => b?.colour ?? b?.couleur ?? b).filter((c) => typeof c === 'string') : [];
  if (bandes.length) return [bandes[0], bandes.at(-1)];
  const c = d.fiche?.colours;
  return c ? [c.primary, c.secondary] : ['#8A8F9C', '#C9CCD6'];
};

const SPREAD = [[0, 54], [-50, -34], [50, -34], [0, -58], [-58, 30], [58, 30]];

// La démo d’un match : de 5 à 7 arrondissements entiers, toujours les mêmes pour un même match (le hachage de son adresse).
const arrondissementsDeLaDemo = (match) => {
  const n = 5 + (hachage(match.slug) % 3);
  return Array.from({ length: 20 }, (_, i) => i + 1)
    .map((a) => ({ a, h: hachage(`${match.slug}|${a}`) }))
    .sort((x, y) => x.h - y.h)
    .slice(0, n)
    .map(({ a }) => a)
    .sort((x, y) => x - y);
};

// Les vrais bars de Paris d’un match, chacun posé autour du centre de son arrondissement (jamais à son adresse).
const vraisBarsDuMatch = (match) => {
  const parArr = new Map();
  const lignes = [];
  for (const s of match.soirees) {
    const bar = s.bar;
    if (bar.ville?.cle !== 'paris' || !bar.arrondissement) continue;
    const rang = parArr.get(bar.arrondissement.numero) ?? 0;
    parArr.set(bar.arrondissement.numero, rang + 1);
    const [dx, dy] = SPREAD[rang % SPREAD.length];
    lignes.push({ id: bar.id, nom: bar.nom, arr: bar.arrondissement.numero, dx, dy, bar });
  }
  return lignes.sort((x, y) => x.arr - y.arr || x.nom.localeCompare(y.nom, 'fr'));
};

const atoutsDe = (bar) => [
  ...(Number.isInteger(bar.atouts.screens) && bar.atouts.screens > 0 ? [bar.atouts.screens > 1 ? `${bar.atouts.screens} écrans` : 'Grand écran'] : []),
  ...(bar.atouts.sound === true ? ['Son du match'] : []),
  ...(bar.atouts.bothCamps === true ? ['Les deux camps'] : []),
  ...(bar.atouts.outdoor === true ? ['Terrasse'] : []),
  ...(bar.atouts.standing === true ? ['Debout'] : []),
];

const pin = (b, i, k) => {
  const [cx, cy] = centre(b.arr);
  const x = cx + b.dx;
  const y = cy + b.dy;
  const tw = b.nom.length * 19 + 44;
  const tx = x < 600 ? -6 : 6 - tw;
  return `<a class="pin pi${i % 8}" href="#b${k}-${b.id}" data-b="${k}-${b.id}" transform="translate(${x} ${y})" aria-label="${e(`${b.nom}, ${arr(b.arr)}`)}">`
    + `<g class="pin__g"><circle class="pin__hit" r="78"/><circle class="pin__fond" r="40"/><g transform="translate(-34 -34) scale(.34)"><use class="jauge__verre" href="#pl-verre" width="200" height="200"/></g></g>`
    + `<g class="pin__tag"><rect x="${tx}" y="-104" rx="22" height="44" width="${tw}"/><text x="${tx + 20}" y="-74">${e(b.nom)}</text></g></a>`;
};

const ligneDuBar = (b, k, T) => {
  const atouts = atoutsDe(b.bar).map((a) => `<li>${e(a)}</li>`).join('');
  const lien = b.bar.slug ? `<p class="bar__page"><a class="lien" href="${cheminDuBar(b.bar)}">${e(T.fiche.voirLeBar)}</a></p>\n` : '';
  return `<li class="bar" id="b${k}-${b.id}" data-arr="${b.arr}">
<a class="bar__ligne" href="#b${k}-${b.id}" data-b="${k}-${b.id}">${jauge('jauge bar__jauge')}<span class="bar__nom">${e(b.nom)}</span><span class="bar__arr">${arr(b.arr)}</span><span class="bar__statut">${e(b.bar.quartier)}</span></a>
<div class="bar__fiche">
${atouts ? `<ul class="bar__atouts">${atouts}</ul>\n` : ''}${lien}<p class="bar__partage"><a class="lien" href="https://wa.me/?text=${encodeURIComponent(`${T.fiche.partageTexte} ${b.nom}`)}" rel="noopener">${e(T.fiche.partage)}</a></p>
</div>
</li>`;
};

// La lumière des deux clubs, sur le plan : deux halos (des dégradés SVG, aucune image ni style en ligne), que plan.js
// fait monter avec le défilement ; sans script (« Ce soir », la page d’un match), plan.css les allume (.soir--sans-script).
const lueur = (match, k) => {
  const [a, b] = couleursDuClub(match.domicile);
  const [c] = couleursDuClub(match.exterieur);
  const halo = (id, couleur) => `<radialGradient id="${id}"><stop offset="0" stop-color="${couleur}" stop-opacity="0.5"/><stop offset="1" stop-color="${couleur}" stop-opacity="0"/></radialGradient>`;
  void b;
  return `<svg class="lueur" viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${halo(`lu-${k}-a`, a)}${halo(`lu-${k}-b`, c)}</defs><ellipse cx="14" cy="22" rx="46" ry="42" fill="url(#lu-${k}-a)"/><ellipse cx="90" cy="30" rx="46" ry="42" fill="url(#lu-${k}-b)"/></svg>`;
};

// Une scène : le plan et la liste d’un match.
const scene = (match, k, { donnees, T, avecPage, fixe, script }) => {
  const sansBarPublie = donnees.bars.length === 0;
  const demo = sansBarPublie && PLAN_DEMO === 'arrondissements';
  const vrais = sansBarPublie ? [] : vraisBarsDuMatch(match);
  const ailleurs = match.soirees.length > vrais.length;
  const allumes = demo ? arrondissementsDeLaDemo(match) : [...new Set(vrais.map((b) => b.arr))];
  const pins = vrais.map((b, i) => pin(b, i, k));
  const vue = `<use class="base" href="#pl-base"/>${allumes.map((a) => `<use class="allume" href="#pl-a${a}"/>`).join('')}<g class="noms" aria-hidden="true"><use class="nom" href="#pl-noms"/>${allumes.map((a) => `<use class="nom nom--allume" href="#pl-l${a}"/>`).join('')}</g>`;
  const legende = demo ? T.plan.legendeDemo : vrais.length ? T.plan.legendeBars : T.plan.legendeVide;
  const nom = nomCourt(match);
  // La vérité, au-dessus du plan : aucun bar ne l’annonce encore.
  const verite = vrais.length ? '' : `<p class="soir__verite"><strong>${e(T.verite.sansBar)}</strong></p>`;
  let liste;
  if (vrais.length) {
    liste = `<p class="liste__compte">${e(remplir(T.compte.bars, { bars: accorder(vrais.length, 'bar'), match: nom }))}</p>\n<ol class="bars">\n${vrais.map((b) => ligneDuBar(b, k, T)).join('\n')}\n</ol>\n`;
  } else if (demo) {
    // Une seule ligne, honnête : les arrondissements allumés et ce qui viendra, jamais une rangée de lignes toutes pareilles.
    liste = `<p class="liste__compte liste__compte--demo">${e(remplir(T.verite.demoScene, { arrondissements: enumerer(allumes.map(arr)) }))}</p>\n`;
  } else {
    liste = `<p class="liste__compte">${e(T.liste.aucun)}</p>\n`;
  }
  const page = avecPage ? `<p class="liste__page"><a class="lien" href="${cheminDuMatch(match)}">${e(T.pageDuMatch)}<span class="visuellement-cache"> : ${e(nom)}</span></a></p>` : '';
  const hors = ailleurs && avecPage && vrais.length ? `<p class="liste__ailleurs"><a class="lien" href="${cheminDuMatch(match)}">${e(T.verite.ailleurs)}</a></p>\n` : '';
  const heure = script && match.heureConfirmee ? heureDeParis(match.debut - 138 * 60000) : '';
  return `<div class="scene" data-i="${k}">
${verite}
<div class="soir__grille">
<figure class="plan${demo ? ' plan--demo' : ''}">
<div class="plan__cadre">${demo ? `<p class="plan__demo">${e(T.exemple)}</p>` : ''}${heure ? `<p class="plan__heure" aria-hidden="true" data-debut="${debutDe(match)}">${heure}</p>` : ''}
<svg class="plan__svg" viewBox="${VUE}" role="group" aria-labelledby="pl-leg-${k}"><g class="monde">${vue}<g class="pins">${pins.join('')}</g></g></svg>
${lueur(match, k)}
</div>
<figcaption id="pl-leg-${k}">${e(legende)}</figcaption>
</figure>
<div class="liste">
<div class="liste__entete"><h3 class="liste__titre">${e(T.liste.titre)}</h3>${demo ? `<span class="etiquette-demo">${e(T.exemple)}</span>` : ''}</div>
${liste}${hors}${page}
</div>
</div>
</div>`;
};

// Le programme et ses scènes. matchs : ceux à montrer (déjà triés par heure), au plus MATCHS_MAX ; jour : « ce soir »,
// « aujourd’hui » ou le jour écrit ; guide : la page « Ce soir » (programme de haut en bas) ; fixe : la page d’un match
// (un seul, sans programme à choisir). aUnePage(match) : le match a sa page. script : la page charge plan.js (l’accueil) ;
// sans lui (« Ce soir », la page d’un match), ni heure qui avance, ni état d’horloge, ni geste : un lien vers la liste d’attente.
export const planDeParis = ({ matchs, donnees, marque, chemin, maintenant, jour = 'ce soir', guide = false, fixe = false, script = true, aUnePage = () => true, niveau = 'h2' }) => {
  const T = TEXTES_DU_PLAN;
  const liste = matchs.slice(0, MATCHS_MAX);
  if (!liste.length) return '';
  const groupes = [];
  for (const [i, m] of liste.entries()) {
    const heure = m.heureConfirmee ? heureDeParis(m.debut) : T.heureAConfirmer;
    const dernier = groupes.at(-1);
    if (dernier && dernier.heure === heure) dernier.matchs.push([m, i + 1]); else groupes.push({ heure, matchs: [[m, i + 1]] });
  }
  const radios = liste.map((m, i) => `<input class="prog__radio" type="radio" name="match" id="m-${i + 1}" data-i="${i + 1}" value="${e(m.slug)}"${i === 0 ? ' checked' : ''}>`).join('\n');
  const cellule = (m, k, heure) => {
    const fin = new Date(m.debut + 3 * 3_600_000).toISOString();
    const lien = guide && aUnePage(m)
      ? `<a class="prog__page" href="${cheminDuMatch(m)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="visuellement-cache">${e(T.pageDuMatch)} : ${e(nomCourt(m))}</span></a>`
      : '';
    return `<div class="prog" data-i="${k}"><label class="prog__l" for="m-${k}"><span class="visuellement-cache">${e(heure)}, </span><span class="lockup">${paireDInsignes(m.domicile, m.exterieur, { fond: 'light', maintenant })}<span class="lockup__t">${e(nomCourt(m))}</span></span><span class="prog__c">${e(m.competition)}</span>${script ? `<span class="prog__etat" data-debut="${debutDe(m)}" data-fin="${fin}"></span>` : ''}</label>${lien}</div>`;
  };
  const colonnes = groupes.map((g) => `<div class="guide__col" role="group" aria-label="${e(remplir(T.coup, { heure: g.heure }))}"><p class="guide__heure" aria-hidden="true"><span>${e(g.heure)}</span></p><div class="guide__cells">${g.matchs.map(([m, k]) => cellule(m, k, g.heure)).join('')}</div></div>`).join('\n');
  const titre = (n, id, a, suite) => `<${niveau} class="etape" id="${id}"><span class="etape__n" aria-hidden="true">${n}</span> ${e(a)}${suite ? ` <span class="etape__q">· ${e(suite)}</span>` : ''}</${niveau}>`;
  const haut = !fixe && donnees.bars.length === 0
    ? `<p class="soir__verite soir__verite--haut">${PLAN_DEMO === 'arrondissements' ? `<span class="etiquette-demo etiquette-demo--grand">${e(T.exemple)}</span> ` : ''}${e(T.verite.haut)}</p>\n`
    : '';
  const etape1 = fixe ? '' : `${titre(1, 'soir-etape1', T.etape1, remplir(T.etape1Suite, { moment: jour }))}\n`;
  const programme = fixe ? '' : `${radios}\n<div class="guide" role="radiogroup" aria-labelledby="soir-etape1"><div class="guide__rail" tabindex="0" role="group" aria-label="${e(T.programme)}">\n${colonnes}\n</div></div>\n`;
  const fixeRadio = fixe ? `<input class="prog__radio" type="radio" name="match" id="m-1" data-i="1" value="${e(liste[0].slug)}" checked hidden>\n` : '';
  const etape2 = `<div class="soir__tete">${titre(2, 'soir-etape2', T.etape2, T.etape2Suite)}</div>`;
  const scenes = liste.map((m, i) => scene(m, i + 1, { donnees, T, avecPage: aUnePage(m) && !fixe, fixe, script })).join('\n');
  const racine = chemin === '/' ? '' : '/';
  const essai = marque.appli?.ouverte ? '' : `<div class="essai-place">${titre(3, 'soir-etape3', T.etape3, '')}
<p class="essai-place__texte">${e(T.essai.texte)}</p>
<div class="tenir">
${script
    ? `<a class="tenir__btn" href="${racine}#attente" data-hold><span class="tenir__liq" aria-hidden="true"></span><span class="tenir__txt">${e(T.fiche.tenir)}</span><span class="tenir__ok" aria-hidden="true">${e(T.fiche.ok)}</span></a>
<p class="tenir__note">${e(T.fiche.demo)}</p>
<p class="tenir__suite" role="status" data-attente="${racine}#attente"></p>`
    : `<a class="tenir__btn" href="${racine}#attente"><span class="tenir__txt">${e(T.fiche.tenirSansScript)}</span></a>
<p class="tenir__note">${e(T.fiche.demo)}</p>`}
</div>
</div>
`;
  return `<div class="soir soir--${guide ? 'guide' : fixe ? 'fixe' : 'rail'}${script ? '' : ' soir--sans-script'}" data-n="${liste.length}">
${defs()}
${haut}${etape1}${fixeRadio}${programme}${etape2}
<div class="scenes">
${scenes}
</div>
${essai}</div>`;
};

// Ce que le plan ne fait jamais : un style en ligne, un script, un bar posé en un point du plan quand aucun bar n’est publié.
export const controlerLePlan = (html) => {
  const erreurs = [];
  if (/\sstyle\s*=/i.test(html)) erreurs.push('un style en ligne dans le plan');
  if (/<script\b/i.test(html)) erreurs.push('un script dans le plan');
  return erreurs;
};
