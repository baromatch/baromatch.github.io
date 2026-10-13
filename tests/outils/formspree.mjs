// Formspree simulé, pour la liste d’attente (index.html) et la sélection de la boutique : rien ne part vers le vrai
// service. Chaque envoi est gardé (son corps multipart) ; la réponse est choisie par le test :
// - un statut (200 → {"ok":true} ; 422 → le refus d’une adresse, tel que Formspree l’écrit ; sinon {}),
// - { statut, corps } pour un corps précis (un objet est envoyé en JSON, une chaîne telle quelle),
// - 'silence' : aucune réponse, jamais ; 'coupure' : un échec réseau.
export const FORMSPREE = /formspree\.io/;

export const REFUS_DE_L_ADRESSE = { errors: [{ code: 'TYPE_EMAIL', field: 'email', message: 'should be an email' }] };

const corpsPar = (statut) => {
  if (statut === 200) return { ok: true };
  if (statut === 422) return REFUS_DE_L_ADRESSE;
  return {};
};

export const simulerFormspree = async (onglet, reponse = 200) => {
  const envois = [];
  await onglet.route(FORMSPREE, async (route) => {
    envois.push(route.request().postData() ?? '');
    if (reponse === 'silence') return;
    if (reponse === 'coupure') return route.abort('failed');
    const { statut, corps } = typeof reponse === 'number' ? { statut: reponse, corps: corpsPar(reponse) } : reponse;
    await route.fulfill({
      status: statut,
      contentType: 'application/json',
      body: typeof corps === 'string' ? corps : JSON.stringify(corps),
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  return envois;
};

// La valeur d’un champ dans un corps multipart, ou null s’il n’y est pas.
export const champDe = (corps, nom) => corps.match(new RegExp(`name="${nom}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ?? null;
