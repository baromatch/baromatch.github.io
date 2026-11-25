// Les aperçus : le formulaire ne part nulle part, le geste « maintiens » se joue sur la page.
(() => {
  const calme = matchMedia('(prefers-reduced-motion: reduce)');

  // La liste d’attente, en aperçu : l’adresse est vérifiée, rien n’est envoyé.
  for (const form of document.querySelectorAll('form[data-apercu]')) {
    const champ = form.querySelector('input[type=email]');
    const retour = form.querySelector('[role=status]');
    const ville = form.querySelector('[data-ville]');
    form.addEventListener('change', (e) => {
      if (e.target.name === 'ville' && ville) ville.textContent = e.target.value;
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!champ.value.trim() || !champ.checkValidity()) {
        retour.textContent = 'Vérifie ton adresse : il manque un « @ » ou un point.';
        champ.setAttribute('aria-invalid', 'true');
        champ.focus();
        return;
      }
      champ.removeAttribute('aria-invalid');
      retour.textContent = 'Aperçu : rien n’est envoyé. En ligne, tu serais sur la liste.';
    });
  }

  // Le geste : maintenir 1,4 s remplit le verre ; lâché avant, il se vide. Barre d’espace ou Entrée aussi. Avec
  // « réduire les animations », un appui suffit.
  const DUREE = 1400;
  for (const bouton of document.querySelectorAll('[data-maintiens]')) {
    const zone = bouton.closest('.essai, [data-essai]') || bouton.parentElement;
    const statut = zone.querySelector('[data-statut]');
    let minuteur = 0;
    let tenu = false;
    const fini = () => {
      tenu = false;
      bouton.classList.remove('se-remplit');
      bouton.classList.add('plein');
      document.documentElement.classList.add('place-gardee');
      statut.textContent = 'Place gardée.';
    };
    const commencer = () => {
      if (tenu || bouton.classList.contains('plein')) return;
      if (calme.matches) { fini(); return; }
      tenu = true;
      bouton.classList.add('se-remplit');
      minuteur = setTimeout(fini, DUREE);
    };
    const lacher = () => {
      if (!tenu) return;
      tenu = false;
      clearTimeout(minuteur);
      bouton.classList.remove('se-remplit');
      statut.textContent = 'Trop tôt : maintiens jusqu’en haut.';
    };
    bouton.addEventListener('pointerdown', (e) => { e.preventDefault(); bouton.setPointerCapture?.(e.pointerId); commencer(); });
    bouton.addEventListener('pointerup', lacher);
    bouton.addEventListener('pointercancel', lacher);
    bouton.addEventListener('lostpointercapture', lacher);
    bouton.addEventListener('contextmenu', (e) => e.preventDefault());
    bouton.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); commencer(); }
    });
    bouton.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') lacher(); });
    bouton.addEventListener('blur', lacher);
  }

  // Les moments qui suivent l’heure (direction C) : le moment à l’écran donne son heure à la salle.
  const salle = document.querySelector('[data-salle]');
  const moments = document.querySelectorAll('[data-heure]');
  if (salle && moments.length && 'IntersectionObserver' in window) {
    const voir = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (e.isIntersecting) salle.dataset.etat = e.target.dataset.heure;
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    moments.forEach((m) => voir.observe(m));
    salle.dataset.etat = moments[0].dataset.heure;
  }
})();
