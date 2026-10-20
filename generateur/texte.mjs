// Les petits outils de texte du générateur : comparer sans accents ni capitales, fabriquer une adresse (slug),
// échapper ce qui va dans le HTML ou le SVG, et accorder un nombre.

// Les lettres que la décomposition Unicode ne sépare pas de leur accent (ø, æ, ß…) : écrites à la main.
const LETTRES = { ø: 'o', Ø: 'O', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ß: 'ss', ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ı: 'i' };

// Le texte sans accents ni capitales : « Démo » et « demo » se comparent égaux.
export const sansAccents = (texte) => String(texte ?? '')
  .replace(/[øØæÆœŒßłŁđĐı]/g, (lettre) => LETTRES[lettre])
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

export const pourComparer = (texte) => sansAccents(texte).toLowerCase();

// Une adresse lisible : minuscules sans accents, mots liés par des tirets (« Bodø/Glimt » → « bodo-glimt »).
export const slug = (texte) => pourComparer(texte)
  .replace(/['’]/g, '-')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// Ce qui s’écrit dans le HTML ou le SVG, échappé : un nom de bar ne peut pas y ouvrir une balise.
export const echapper = (texte) => String(texte ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// « 1 bar », « 2 bars » ; « aucun bar » pour zéro si on le demande.
export const accorder = (nombre, singulier, pluriel = `${singulier}s`) => `${nombre} ${nombre > 1 ? pluriel : singulier}`;

// Une liste lue à voix haute : « A », « A et B », « A, B et C ».
export const enumerer = (elements) => {
  if (elements.length <= 1) return elements.join('');
  return `${elements.slice(0, -1).join(', ')} et ${elements.at(-1)}`;
};

// La première lettre en capitale (« dimanche » → « Dimanche »).
export const capitale = (texte) => (texte ? texte[0].toLocaleUpperCase('fr-FR') + texte.slice(1) : texte);

// La typographie française : une espace insécable à l’intérieur des guillemets « », et avant « ? », « ! », « : » et
// « ; », pour que le signe ne parte jamais seul à la ligne. Sur une page entière (gabarits.mjs), un agenda (agenda.mjs)
// ou une ligne d’image de partage (partage.mjs) : les balises, les adresses et les commentaires n’ont jamais ces
// espaces-là.
export const insecables = (texte) => texte.replace(/ ([?!:;»])/g, '\u00A0$1').replace(/« /g, '«\u00A0');

// Les caractères de contrôle et invisibles (catégories Unicode Cc et Cf) retirés d’un texte venu des données, avant
// tout usage : un retour à la ligne ou une tabulation devient une espace, le reste disparaît. Le XML du badge ne casse
// jamais, et aucun mot interdit ne se cache derrière un caractère invisible (« happy​hour »).
export const nettoyer = (texte) => String(texte ?? '')
  .replace(/[\t\n\v\f\r\u0085]+/g, ' ')
  .replace(/[\p{Cc}\p{Cf}]/gu, '')
  .replace(/ {2,}/g, ' ')
  .trim();
