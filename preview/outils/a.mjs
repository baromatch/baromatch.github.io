// Direction A, « La nuit » : l’objet d’abord. Le sous-bock, l’objet de Baromatch, porte la page comme le produit porte
// la page d’une grande marque : une image, une phrase, une action. Puis ce soir, la semaine en piles, le geste, les bars.
import { CE_SOIR, PAR_JOUR, PROCHAIN, MATCHS, couleursDe, dans, echapper, enMots, symbole, pose, jourEnLettres } from './donnees.mjs';
import { tete, entete, formulaire, pied, verre, bandeauApercu } from './commun.mjs';

const IMAGE = { src: 'img/sous-bocks-720.webp', srcset: 'img/sous-bocks-720.webp 720w, img/sous-bocks-1080.webp 1080w', sizes: '(min-width: 960px) 50vw, 100vw' };

// Une pile de sous-bocks : un par match du jour, de la couleur du club qui reçoit, cerclé de la couleur de celui qui
// se déplace. La hauteur de la pile dit le jour.
const pile = (matchs) => {
  const pas = 5;
  const haut = 12 + Math.max(matchs.length, 1) * pas + 8;
  const couches = matchs.map((m, i) => {
    const y = haut - 10 - i * pas;
    const { a } = couleursDe(m.domicile);
    const { a: b } = couleursDe(m.exterieur);
    return `<rect x="3" y="${y}" width="38" height="4" rx="1" fill="${a}"/><ellipse cx="22" cy="${y}" rx="19" ry="5.5" fill="${a}"/><ellipse cx="22" cy="${y}" rx="11" ry="3.2" fill="none" stroke="${b}" stroke-width="1.6"/>`;
  }).join('');
  const vide = matchs.length ? '' : `<ellipse cx="22" cy="${haut - 10}" rx="19" ry="5.5" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="3 3"/>`;
  return `<svg class="pile__tas" width="44" height="${haut}" viewBox="0 0 44 ${haut}" aria-hidden="true" focusable="false">${couches}${vide}</svg>`;
};

const ligne = (m, ids) => `<li><a class="match" href="${m.adresse}" aria-label="${echapper(enMots(m))}"><span class="match__paire">${pose(ids(m.domicile), 'insigne', 32)}${pose(ids(m.exterieur), 'insigne', 32)}</span><span class="match__nom">${echapper(m.titre)}</span><span class="match__heure">${m.heure}</span></a></li>`;

export const pageA = () => {
  // Les insignes de la page, dessinés une fois chacun (symboles), posés ensuite.
  const symboles = new Map();
  const ids = (club, taille = 32) => {
    const id = `a-${club.cle}-${taille > 64 ? 'g' : 'p'}`;
    if (!symboles.has(id)) symboles.set(id, symbole(id, club, taille > 64 ? 96 : 40, 'night'));
    return id;
  };
  const vedette = PROCHAIN;
  const puis = CE_SOIR.filter((m) => m !== vedette);
  const heurePuis = [...new Set(puis.map((m) => m.heure))];
  const lignesSoir = puis.map((m) => ligne(m, ids)).join('');
  const nbSemaine = MATCHS.length;

  const radios = PAR_JOUR.map((j, i) => `<input class="visuellement-cache" type="radio" name="jour" id="a-j${i}" value="${j.jour}"${i === 1 ? ' checked' : ''}>`).join('');
  const piles = PAR_JOUR.map((j, i) => `<label class="pile" for="a-j${i}"><span class="pile__compte">${j.matchs.length}</span>${pile(j.matchs)}<span class="pile__jour"><span>${j.nom}</span> <span>${j.numero}</span></span><span class="visuellement-cache">, ${j.matchs.length > 1 ? `${j.matchs.length} matchs` : `${j.matchs.length} match`}</span></label>`).join('');
  const jours = PAR_JOUR.map((j, i) => `<div class="jour" id="a-jour-${i}"><p class="jour__titre">${jourEnLettres(j.matchs[0]?.debut ?? `${j.jour}T12:00:00Z`)}</p>${j.matchs.length ? `<ul class="jour__liste">${j.matchs.map((m) => `<li><a href="${m.adresse}"><span class="jour__heure">${m.heure}</span><span>${echapper(m.titre)}</span><span class="jour__compet">${echapper(m.competition)}</span></a></li>`).join('')}</ul>` : '<p class="jour__vide">Pas de match annoncé ce jour-là.</p>'}</div>`).join('');

  const corps = `<body class="a">
<a class="evitement" href="#contenu">Aller au contenu</a>
${entete('entete--nuit')}
<main id="contenu">
<section class="ouverture" aria-labelledby="titre">
<picture class="ouverture__image"><source type="image/webp" srcset="${IMAGE.srcset}" sizes="${IMAGE.sizes}"><img src="${IMAGE.src}" width="1080" height="1350" alt="Deux sous-bocks Baromatch sur un comptoir, le soir : Alvène et Orvèle, deux clubs inventés." fetchpriority="high" decoding="async"></picture>
<div class="ouverture__texte">
<h1 class="titre-1" id="titre"><span>Ton match.</span> <span>Ton bar.</span> <span>Ce soir.</span></h1>
<p class="chapo">L’appli qui trouve un bar pour ton match et t’y garde une place. Chaque soirée devient un sous-bock. Elle arrive à Paris.</p>
${formulaire('liste')}
</div>
<p class="ouverture__legende">Image : deux sous-bocks de l’album, clubs inventés.</p>
</section>

<section class="soir" aria-labelledby="titre-soir">
<div class="soir__tete"><h2 class="titre-2" id="titre-soir">Ce soir</h2><p class="date">${jourEnLettres(vedette.debut)}, à l’heure de Paris</p></div>
<a class="vedette" href="${vedette.adresse}" aria-label="${echapper(enMots(vedette))}">
<span class="vedette__disques">${pose(ids(vedette.domicile, 96), 'insigne insigne--g', 96)}<span class="vedette__heure">${vedette.heure}</span>${pose(ids(vedette.exterieur, 96), 'insigne insigne--g', 96)}</span>
<span class="vedette__titre">${echapper(vedette.titre)}</span>
<span class="vedette__info">${echapper(vedette.competition)} · ${dans(vedette.debut)}</span>
</a>
${puis.length ? `<p class="soir__puis">Puis à ${heurePuis.join(', ')}</p><ul class="soir__liste">${lignesSoir}</ul>` : ''}
<p class="soir__verite">Aucun bar ne les annonce encore sur Baromatch. Chaque match a déjà sa page.</p>
</section>

<section class="semaine" aria-labelledby="titre-semaine">
<h2 class="titre-2" id="titre-semaine">La semaine</h2>
<p class="chapo chapo--court">${nbSemaine} matchs, une pile par jour. Touche un jour.</p>
<div class="semaine__choix">${radios}
<div class="piles" role="presentation">${piles}</div>
<div class="jours">${jours}</div>
</div>
<p class="semaine__tout"><a href="/matchs/">Tous les matchs, clubs et villes</a></p>
</section>

<section class="garde" aria-labelledby="titre-garde">
<div class="garde__texte">
<h2 class="titre-2" id="titre-garde">Garde ta place</h2>
<p class="chapo">Dans l’appli, tu maintiens le bouton. Le verre se remplit : ta place est gardée, si le bar dit oui.</p>
<p class="garde__suite">À la porte, le bar scanne ton pass. Ta soirée se colle dans ton album, en sous-bock.</p>
</div>
<div class="essai">
<button class="verre-essai" type="button" aria-describedby="essai-aide" data-maintiens>${verre('ve')}<span class="verre-essai__mot">Maintiens</span></button>
<p class="essai__aide" id="essai-aide">Au doigt, à la souris ou avec la barre d’espace. Démo : rien n’est réservé.</p>
<p class="essai__statut" role="status" aria-live="polite" data-statut></p>
</div>
</section>

<section class="bars" aria-labelledby="titre-bars">
<h2 class="titre-2" id="titre-bars">Ton bar passe les matchs&nbsp;?</h2>
<p class="chapo">Dis-nous lesquels. Les fans te trouvent, gardent leur place, et tu sais qui vient avant le coup d’envoi.</p>
<p class="bars__action"><a class="bouton-trait" href="/pour-les-bars.html">Proposer mon bar</a><span>Gratuit pendant le lancement, sans engagement.</span></p>
</section>
</main>
${pied('pied--nuit')}
${bandeauApercu('La nuit')}
<svg class="planche" width="0" height="0" aria-hidden="true" focusable="false"><defs>${[...symboles.values()].join('')}</defs></svg>
<script src="../commun.js" defer></script>
</body>
</html>
`;
  return `${tete({ titre: 'Baromatch · aperçu A, la nuit', description: 'Aperçu de travail : la direction « La nuit » de l’accueil de Baromatch, avec les vrais matchs du 25 novembre. Pas en ligne.', classe: 'nuit', css: 'a.css', image: IMAGE })}\n${corps}`;
};
