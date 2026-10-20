// Le pied de page commun à toutes les pages, dans cet ordre : chaque lien [adresse, texte]. « Où regarder le match »
// mène aux matchs de la semaine (/matchs/), « Presse » à la page presse, puis les deux pages de confiance. Les tests le
// comparent mot pour mot, sur les pages fixes comme sur les pages générées.
export const PIED = [
  ['/pour-les-bars.html', 'Pour les bars'],
  ['/matchs/', 'Où regarder le match'],
  ['/boutique.html', 'Boutique'],
  ['/presse.html', 'Presse'],
  ['/a-propos.html', 'À propos'],
  ['/comment-on-choisit-les-bars.html', 'Comment on choisit les bars'],
  ['/mentions-legales.html', 'Mentions légales'],
  ['/cgu.html', 'Règles de l’appli (CGU)'],
  ['/confidentialite.html', 'Confidentialité'],
  ['/supprimer-mon-compte.html', 'Supprimer mon compte'],
  ['https://x.com/baromatchapp', 'X : @baromatchapp'],
  ['mailto:contact@baromatch.fr', 'contact@baromatch.fr'],
];
