// Direction C, « La salle » : l’histoire d’abord. Une salle de bar dessinée reste à l’écran pendant qu’on descend ; la
// page fait l’heure, de 18:42 au coup d’envoi, et la salle se remplit. Ta place passe à l’ambre quand tu la gardes.
import { CE_SOIR, PAR_JOUR, MATCHS, echapper, enMots, symbole, pose, jourEnLettres } from './donnees.mjs';
import { tete, entete, formulaire, pied, bandeauApercu } from './commun.mjs';
import { salle } from './salle.mjs';

const HEURES = ['18:42', '19:30', '20:15', '20:55', '21:00'];
const cle = (h) => h.replace(':', '');

export const pageC = () => {
  const symboles = new Map();
  const ids = (club) => {
    const id = `c-${club.cle}`;
    if (!symboles.has(id)) symboles.set(id, symbole(id, club, 40, 'light'));
    return id;
  };
  const soir = CE_SOIR.map((m) => `<li><a class="match" href="${m.adresse}" aria-label="${echapper(enMots(m))}"><span class="match__heure">${m.heure}</span><span class="match__paire">${pose(ids(m.domicile), 'insigne', 28)}${pose(ids(m.exterieur), 'insigne', 28)}</span><span class="match__nom">${echapper(m.titre)}</span></a></li>`).join('');
  const semaine = `<a class="semaine" href="/matchs/" aria-label="La semaine : ${MATCHS.length} matchs, de ${PAR_JOUR[0].nom} ${PAR_JOUR[0].numero} à ${PAR_JOUR[6].nom} ${PAR_JOUR[6].numero}. Voir tous les matchs.">${PAR_JOUR.map((j) => `<span class="semaine__jour"><svg viewBox="0 0 24 60" width="24" height="60" aria-hidden="true" focusable="false">${Array.from({ length: j.matchs.length }, (_, k) => `<rect x="3" y="${(57.5 - (k + 1) * 3).toFixed(1)}" width="18" height="2.2" rx="1"/>`).join('')}<rect class="sol" x="0" y="58.6" width="24" height="1.4"/></svg><span>${j.nom.slice(0, 3)}</span></span>`).join('')}<span class="semaine__texte"><b>La semaine : ${MATCHS.length} matchs</b><span>Tous les matchs, clubs et villes</span></span></a>`;

  const corps = `<body class="c">
<a class="evitement" href="#contenu">Aller au contenu</a>
${entete()}
<main id="contenu" class="soiree">
<div class="salle" data-salle data-etat="1842">
<figure class="salle__cadre">
${salle()}
<p class="salle__heure" aria-hidden="true">${HEURES.map((h) => `<span class="h${cle(h)}">${h}</span>`).join('')}</p>
<figcaption class="salle__legende">Exemple : une salle de 42 places, deux clubs inventés.</figcaption>
</figure>
</div>
<div class="moments">
<section class="moment moment--ouverture" data-heure="1842" aria-labelledby="titre">
<p class="moment__heure"><time>18:42</time></p>
<h1 class="titre-1" id="titre"><span>Ton match.</span> <span>Ton bar.</span> <span>Ce soir.</span></h1>
<p class="chapo">Baromatch trouve un bar qui passe ton match, et t’y garde une place. L’appli arrive à Paris.</p>
${formulaire('liste')}
</section>
<section class="moment" data-heure="1930" aria-labelledby="titre-choisis">
<p class="moment__heure"><time>19:30</time></p>
<h2 class="titre-2" id="titre-choisis">Choisis ton match</h2>
<p class="chapo">Ce soir, ${jourEnLettres(CE_SOIR[0].debut)}. Aucun bar ne les annonce encore sur Baromatch : chaque match a déjà sa page.</p>
<ul class="soir">${soir}</ul>
${semaine}
</section>
<section class="moment" data-heure="2015" aria-labelledby="titre-garde">
<p class="moment__heure"><time>20:15</time></p>
<h2 class="titre-2" id="titre-garde">Garde ta place</h2>
<p class="chapo">Les bars disent quels matchs ils passent et combien de places ils ouvrent. Tu maintiens le bouton : ta place est gardée, si le bar dit oui.</p>
<div class="essai" data-essai>
<button class="tenir" type="button" aria-describedby="essai-aide" data-maintiens><span class="tenir__niveau" aria-hidden="true"></span><span class="tenir__mot">Maintiens · 2 places jusqu’à 21:30</span></button>
<p class="essai__aide" id="essai-aide">Au doigt, à la souris ou avec la barre d’espace. Démo : rien n’est réservé.</p>
<p class="essai__statut" role="status" aria-live="polite" data-statut></p>
</div>
</section>
<section class="moment" data-heure="2055" aria-labelledby="titre-arrive">
<p class="moment__heure"><time>20:55</time></p>
<h2 class="titre-2" id="titre-arrive">Tu y es</h2>
<p class="chapo">À la porte, le bar scanne ton pass. Ta soirée se colle dans ton album, en sous-bock.</p>
</section>
<section class="moment moment--fin" data-heure="2100" aria-labelledby="titre-bars">
<p class="moment__heure"><time>21:00</time> · coup d’envoi</p>
<h2 class="titre-2" id="titre-bars">Cette salle, c’est peut-être la tienne</h2>
<p class="chapo">Ton bar passe les matchs&nbsp;? Dis-nous lesquels. Les fans te trouvent, gardent leur place, et tu sais qui vient. Gratuit pendant le lancement, sans engagement.</p>
<p class="bars__action"><a class="bouton-trait" href="/pour-les-bars.html">Proposer mon bar</a></p>
</section>
</div>
</main>
${pied()}
${bandeauApercu('La salle')}
<svg class="planche" width="0" height="0" aria-hidden="true" focusable="false"><defs>${[...symboles.values()].join('')}</defs></svg>
<script src="../commun.js" defer></script>
</body>
</html>
`;
  return `${tete({ titre: 'Baromatch · aperçu C, la salle', description: 'Aperçu de travail : la direction « La salle » de l’accueil de Baromatch, avec les vrais matchs du 25 novembre. Pas en ligne.', css: 'c.css' })}\n${corps}`;
};
