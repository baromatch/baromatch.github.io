// Le mot du fondateur, tel qu’il l’a écrit le 26 octobre 2026, mot pour mot, pour « À propos » et « Presse ». Les pages
// le publient avec la typographie du site (l’apostrophe ’, une espace insécable avant « : » et « ? ») : rien d’autre ne
// change, ni un mot, ni une phrase. motPourMot() remet un texte lu sur la page dans la forme écrite par le fondateur.
export const MOT_DU_FONDATEUR = 'Baromatch est né d\'une question simple : où voir le match ce soir, et est-ce qu\'il reste de la place ? Je m\'appelle Skander, je suis fan de foot et je construis Baromatch à Paris. Le bar garde la main sur ses places, le fan sait avant de partir s\'il y a de la place pour lui. On commence à Paris, bar par bar, avec ceux qui veulent le lancer avec nous.';
export const SIGNATURE_DU_FONDATEUR = 'Skander, fondateur de Baromatch';

export const motPourMot = (texte) => texte.replace(/’/g, '\'').replace(/[\s  ]+/g, ' ').trim();
