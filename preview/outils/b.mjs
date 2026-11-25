// Direction B, « Le programme » : l’utile d’abord, dessiné. Le jour, blanc et net ; la promesse et l’action, puis le
// programme de ce soir en grands chiffres, la semaine dessinée sur l’axe des heures, trois vrais écrans, les bars.
import { CE_SOIR, PAR_JOUR, MATCHS, couleursDe, echapper, enMots, symbole, pose, jourEnLettres } from './donnees.mjs';
import { tete, entete, formulaire, pied, bandeauApercu } from './commun.mjs';

// L’axe des heures de la semaine : de 12:00 à 22:00, heure de Paris.
const DEBUT = 12;
const FIN = 22;
const LARGEUR = 250;
const xDe = (heure) => {
  const [h, m] = heure.split(':').map(Number);
  return 8 + ((h + m / 60 - DEBUT) / (FIN - DEBUT)) * (LARGEUR - 26);
};

// Un match sur l’axe : deux petits disques côte à côte, chacun de la couleur de son club, cerclé de la seconde.
const point = (m, x, y) => {
  const d = couleursDe(m.domicile);
  const e = couleursDe(m.exterieur);
  return `<circle cx="${x.toFixed(1)}" cy="${y}" r="5.6" fill="${d.a}" stroke="${d.b}" stroke-width="1.4"/><circle cx="${(x + 9).toFixed(1)}" cy="${y}" r="5.6" fill="${e.a}" stroke="${e.b}" stroke-width="1.4"/>`;
};

// Chaque match prend la première place libre autour de la ligne du jour (0, +1, −1, +2…), sans toucher un voisin
// trop proche dans le temps : les créneaux serrés (15:00, 15:05, 15:30) se lisent sans se chevaucher.
const PAS = 13.5;
const rangee = (matchs) => {
  const poses = [];
  for (const m of matchs) {
    const x = xDe(m.heure);
    for (let k = 0; ; k += 1) {
      const rang = k === 0 ? 0 : (k % 2 ? (k + 1) / 2 : -k / 2);
      if (!poses.some((p) => p.rang === rang && Math.abs(p.x - x) < 21)) { poses.push({ m, x, rang }); break; }
    }
  }
  const rangs = poses.map((p) => p.rang);
  const bas = Math.min(0, ...rangs);
  const haut = Math.max(30, 16 + (Math.max(0, ...rangs) - bas) * PAS);
  const points = poses.map((p) => point(p.m, p.x, 8 + (p.rang - bas) * PAS + (haut - 16 - (Math.max(0, ...rangs) - bas) * PAS) / 2)).join('');
  const reperes = [14, 16, 18, 20].map((h) => `<line x1="${xDe(`${h}:00`).toFixed(1)}" x2="${xDe(`${h}:00`).toFixed(1)}" y1="0" y2="${haut}"/>`).join('');
  return `<svg class="rangee__axe" viewBox="0 0 ${LARGEUR} ${haut}" width="${LARGEUR}" height="${haut}" aria-hidden="true" focusable="false"><g class="reperes">${reperes}</g>${points}</svg>`;
};

const ECRANS = [
  ['ce-soir', 'Choisis ton match.', 'L’écran « Ce soir » de l’appli : le match de 21:00 entre Alvène et Orvèle, et les bars près de toi.'],
  ['bar', 'Garde ta place.', 'La page d’un bar dans l’appli : son ambiance ce soir et le bouton pour prendre sa place.'],
  ['tu-y-es', 'Scanne, tu y es.', 'L’écran d’arrivée : « Tu y es », l’arrivée validée et le sous-bock collé dans l’album.'],
];

export const pageB = () => {
  const symboles = new Map();
  const ids = (club) => {
    const id = `b-${club.cle}`;
    if (!symboles.has(id)) symboles.set(id, symbole(id, club, 40, 'light'));
    return id;
  };
  const heures = [...new Set(CE_SOIR.map((m) => m.heure))];
  const programme = heures.map((h) => `<div class="creneau"><p class="creneau__heure"><time datetime="${CE_SOIR.find((m) => m.heure === h).iso}">${h}</time></p><ul class="creneau__matchs">${CE_SOIR.filter((m) => m.heure === h).map((m) => `<li><a class="affiche" href="${m.adresse}" aria-label="${echapper(enMots(m))}"><span class="affiche__paire">${pose(ids(m.domicile), 'insigne', 30)}${pose(ids(m.exterieur), 'insigne', 30)}</span><span class="affiche__nom">${echapper(m.titre)}</span><span class="affiche__compet">${echapper(m.competition)}</span></a></li>`).join('')}</ul></div>`).join('');

  const radios = PAR_JOUR.map((j, i) => `<input class="visuellement-cache" type="radio" name="jour" id="b-j${i}" value="${j.jour}"${i === 1 ? ' checked' : ''}>`).join('');
  const rangees = PAR_JOUR.map((j, i) => `<label class="rangee" for="b-j${i}"><span class="rangee__jour"><b>${j.nom} ${j.numero}</b><span>${j.matchs.length || '–'}</span></span>${rangee(j.matchs)}<span class="visuellement-cache">, ${j.matchs.length > 1 ? `${j.matchs.length} matchs` : `${j.matchs.length} match`}</span></label>`).join('');
  const axe = `<span></span><svg class="grille__heures" viewBox="0 0 ${LARGEUR} 14" width="${LARGEUR}" height="14" aria-hidden="true" focusable="false">${[12, 14, 16, 18, 20, 22].map((h) => `<text x="${xDe(`${h}:00`).toFixed(1)}" y="10" text-anchor="${h === 12 ? 'start' : h === 22 ? 'end' : 'middle'}">${h}h</text>`).join('')}</svg>`;
  const jours = PAR_JOUR.map((j, i) => `<div class="jour" id="b-jour-${i}"><p class="jour__titre">${jourEnLettres(j.matchs[0]?.debut ?? `${j.jour}T12:00:00Z`)}</p>${j.matchs.length ? `<ul class="jour__liste">${j.matchs.map((m) => `<li><a href="${m.adresse}"><span class="jour__heure">${m.heure}</span><span class="jour__nom">${echapper(m.titre)}</span><span class="jour__compet">${echapper(m.competition)}</span></a></li>`).join('')}</ul>` : '<p class="jour__vide">Pas de match annoncé ce jour-là.</p>'}</div>`).join('');

  const ecrans = ECRANS.map(([nom, legende, alt], i) => `<figure class="ecran"><div class="ecran__cadre"><img src="/img/appli/${nom}-300.webp" srcset="/img/appli/${nom}-300.webp 300w, /img/appli/${nom}-600.webp 600w" sizes="(min-width: 960px) 260px, 62vw" width="300" height="649" loading="lazy" decoding="async" alt="${echapper(alt)}"><span class="ecran__etiquette">Écran de démonstration</span></div><figcaption><span class="ecran__numero">${i + 1}</span>${legende}</figcaption></figure>`).join('');

  const corps = `<body class="b">
<a class="evitement" href="#contenu">Aller au contenu</a>
${entete()}
<main id="contenu">
<section class="ouverture" aria-labelledby="titre">
<div class="ouverture__promesse">
<h1 class="titre-1" id="titre"><span>Ton match.</span> <span>Ton bar.</span> <span>Ce soir.</span></h1>
<p class="chapo">Baromatch trouve un bar qui passe ton match, et t’y garde une place. L’appli arrive à Paris.</p>
${formulaire('liste')}
</div>
<div class="programme" aria-labelledby="titre-soir">
<h2 class="programme__titre" id="titre-soir">Ce soir <span>${jourEnLettres(CE_SOIR[0].debut)}</span></h2>
${programme}
<p class="programme__verite">Aucun bar ne les annonce encore sur Baromatch. Chaque match a déjà sa page.</p>
</div>
</section>

<section class="semaine" aria-labelledby="titre-semaine">
<div class="semaine__tete">
<h2 class="titre-2" id="titre-semaine">La semaine</h2>
<p class="chapo">${MATCHS.length} matchs, chacun à son heure. Choisis un jour.</p>
</div>
<div class="semaine__choix">${radios}
<div class="grille"><div class="grille__axe" aria-hidden="true">${axe}</div>${rangees}</div>
<div class="jours">${jours}</div>
</div>
<p class="semaine__tout"><a href="/matchs/">Tous les matchs, clubs et villes</a></p>
</section>

<section class="appli" aria-labelledby="titre-appli">
<h2 class="titre-2" id="titre-appli">Dans l’appli</h2>
<p class="chapo">Trois gestes, du canapé à ta place. Bars et clubs inventés.</p>
<div class="ecrans">${ecrans}</div>
</section>

<section class="bars" aria-labelledby="titre-bars">
<h2 class="titre-2" id="titre-bars">Ton bar passe les matchs&nbsp;?</h2>
<p class="chapo">Dis-nous lesquels. Les fans te trouvent, gardent leur place, et tu sais qui vient avant le coup d’envoi.</p>
<ul class="bars__faits"><li>Gratuit pendant le lancement</li><li>Sans engagement</li><li>Une personne te répond sous 48&nbsp;h</li></ul>
<p class="bars__action"><a class="bouton-trait" href="/pour-les-bars.html">Proposer mon bar</a></p>
</section>
</main>
${pied()}
${bandeauApercu('Le programme')}
<svg class="planche" width="0" height="0" aria-hidden="true" focusable="false"><defs>${[...symboles.values()].join('')}</defs></svg>
<script src="../commun.js" defer></script>
</body>
</html>
`;
  return `${tete({ titre: 'Baromatch · aperçu B, le programme', description: 'Aperçu de travail : la direction « Le programme » de l’accueil de Baromatch, avec les vrais matchs du 25 novembre. Pas en ligne.', css: 'b.css' })}\n${corps}`;
};
