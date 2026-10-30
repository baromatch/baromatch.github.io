// Le pied de page commun à toutes les pages, dans cet ordre : chaque lien [adresse, texte]. En haut, les deux actions
// (les seuls liens ambre), « Presse et partenariats » (la page Presse) et son adresse, X ; puis le plan du site : les
// matchs, les clubs (un disque à leurs couleurs devant le nom), les compétitions, les villes, Baromatch ; en bas, les
// pages légales. Les tests le comparent mot pour mot, sur les pages fixes comme sur les pages générées.
export const PIED = [
  ['/#attente', 'Préviens-moi quand Baromatch arrive'],
  ['/pour-les-bars.html#proposer', 'Proposer mon bar'],
  ['/presse.html', 'Presse et partenariats'],
  ['mailto:contact@baromatch.fr', 'contact@baromatch.fr'],
  ['https://x.com/baromatchapp', 'X : @baromatchapp'],
  ['/ce-soir/', 'Ce soir'],
  ['/matchs/', 'La semaine'],
  ['/agenda/', 'Ton club dans ton agenda'],
  ['/matchs/club/psg/', 'PSG'],
  ['/matchs/club/om/', 'OM'],
  ['/matchs/club/ol/', 'OL'],
  ['/matchs/club/lille/', 'Lille'],
  ['/matchs/club/lens/', 'Lens'],
  ['/matchs/club/monaco/', 'Monaco'],
  ['/matchs/club/nice/', 'Nice'],
  ['/matchs/club/rennes/', 'Rennes'],
  ['/matchs/competition/ligue-1/', 'Ligue 1'],
  ['/matchs/competition/ligue-des-champions/', 'Ligue des champions'],
  ['/matchs/competition/ligue-europa/', 'Ligue Europa'],
  ['/matchs/competition/ligue-conference/', 'Ligue Conférence'],
  ['/matchs/competition/premier-league/', 'Premier League'],
  ['/matchs/competition/liga/', 'LaLiga'],
  ['/matchs/competition/serie-a/', 'Serie A'],
  ['/matchs/competition/bundesliga/', 'Bundesliga'],
  ['/regarder-le-match/paris/', 'Paris'],
  ['/regarder-le-match/lyon/', 'Lyon'],
  ['/regarder-le-match/marseille/', 'Marseille'],
  ['/regarder-le-match/lille/', 'Lille'],
  ['/regarder-le-match/', 'Toutes les villes'],
  ['/pour-les-bars.html', 'Pour les bars'],
  ['/a-propos.html', 'À propos'],
  ['/presse.html', 'Presse et partenariats'],
  ['/comment-on-choisit-les-bars.html', 'Comment on choisit les bars'],
  ['/trouver-un-bar-qui-diffuse-le-match.html', 'Comment trouver un bar qui diffuse le match'],
  ['/testeurs-android.html', 'Testeurs Android'],
  ['/boutique.html', 'Boutique'],
  ['/mentions-legales.html', 'Mentions légales'],
  ['/cgu.html', 'Règles de l’appli (CGU)'],
  ['/confidentialite.html', 'Confidentialité'],
  ['/supprimer-mon-compte.html', 'Supprimer mon compte'],
];

// Les deux seuls liens ambre du pied de page.
export const ACTIONS_DU_PIED = ['/#attente', '/pour-les-bars.html#proposer'];

// Les liens d’un pied de page écrit (son HTML), [adresse, texte] : le texte sans balises, entités et blancs ramenés à
// une espace (l’espace insécable comprise).
export const liensDuPied = (html) => {
  const pied = html.match(/<footer class="pied page"[^>]*>([\s\S]*?)<\/footer>/)?.[1] ?? '';
  const texte = (t) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/[\s ]+/g, ' ').trim();
  return [...pied.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, t]) => [href, texte(t)]);
};
