// Ce qui dépasse à gauche ou à droite de l’écran, et la page qui défile de côté (texte agrandi : tests/texte-agrandi.spec.mjs,
// et l’accueil sans bar : tests/accueil-sans-bar.spec.mjs). À passer à page.evaluate.
//
// Hors jeu : le verre et son halo (coupés exprès par leur section), les lumières floues de la carte du prochain match et du
// téléphone de démo et leurs halos (des décors aria-hidden que leur cadre rogne exprès : .coup, .g-ecran), les dessins, le
// lien d’évitement (posé hors de l’écran exprès) et les champs pièges des robots.
// (Et le contenu des deux rangées qui défilent de côté exprès, avec leur propre barre : le programme du soir, et les
// moments de la soirée au téléphone ; la page, elle, ne défile pas de côté : `defile`.)
export const lireLesDebordements = (onglet) => onglet.evaluate(() => {
  const largeur = document.documentElement.clientWidth;
  const dehors = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!e.getClientRects().length) continue;
    if (e.closest('.verre, svg, .lien-evitement, .attente__piege, .formulaire__piege, .visuellement-cache, .guide__rail, .instants, .geste__lumiere, .coup__lumiere, .g-ecran__halo, .g-verre__vague')) continue;
    const r = e.getBoundingClientRect();
    if (r.right > largeur + 0.5 || r.left < -0.5) {
      dehors.push(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : ''} « ${e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)} » de ${Math.round(r.left)} à ${Math.round(r.right)} px`);
    }
  }
  return { defile: document.documentElement.scrollWidth > largeur, dehors };
});
