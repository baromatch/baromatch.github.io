// Le QR code des affiches (affiche.mjs) : une adresse du site devient un dessin SVG écrit dans la page, au passage du
// générateur. Rien n’est chargé par le visiteur : ni bibliothèque, ni image, ni service tiers.
// L’encodeur est qrcode-generator (Kazuhiko Arase, licence MIT, version exacte dans generateur/images/package.json),
// installé par l’Action avec le rendu des images de partage (npm ci dans generateur/images) : rien n’en est servi aux
// visiteurs. Sans lui, chargerLeQr rend null avec la raison, et les affiches ne sont pas écrites (le journal le dit) ;
// l’Action, elle, s’arrête (--images=exiger).
// Le code se lit à 4 modules de marge blanche (la « zone calme » que demande la norme), correction d’erreur M (15 %).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { DOSSIER_GENERATEUR } from './contenu.mjs';
import { echapper as e } from './texte.mjs';

export const MARGE_DU_QR = 4;
export const NIVEAU_DU_QR = 'M';

// La matrice d’une adresse : une ligne par rangée de modules, « X » pour un module noir, « . » pour un blanc, sans la
// marge. Seulement une adresse écrite en ASCII (celles du site le sont toutes) : l’encodeur lit un octet par caractère.
const matriceAvec = (qrcode) => (texte) => {
  if (!/^[\x21-\x7E]+$/.test(texte)) throw new Error(`QR code : adresse illisible (ASCII seulement) : ${texte}`);
  const qr = qrcode(0, NIVEAU_DU_QR);
  qr.addData(texte, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, ligne) => Array.from({ length: n }, (__, colonne) => (qr.isDark(ligne, colonne) ? 'X' : '.')).join(''));
};

export const chargerLeQr = () => {
  try {
    const exiger = createRequire(path.join(DOSSIER_GENERATEUR, 'images', 'package.json'));
    const qrcode = exiger('qrcode-generator');
    // Le paquet n’exporte que son code : sa version se lit dans son package.json, à côté de dist/.
    const { version } = JSON.parse(readFileSync(path.join(path.dirname(exiger.resolve('qrcode-generator')), '..', 'package.json'), 'utf8'));
    return { qr: { matrice: matriceAvec(qrcode), signature: `qrcode-generator ${version}` }, raison: null };
  } catch (erreur) {
    return { qr: null, raison: `l’encodeur des QR codes n’est pas installé (cd generateur/images && npm ci) : ${erreur.code ?? erreur.message}` };
  }
};

// Le dessin : un carré blanc (la marge comprise), puis chaque suite de modules noirs d’une rangée en un seul trait.
// Le carré blanc est peint (pas un fond CSS) : il s’imprime même quand le navigateur n’imprime pas les fonds.
// etiquette : ce que lit un lecteur d’écran (l’adresse, en clair).
export const svgDuQr = (matrice, { etiquette, classe = 'affiche-qr__code' }) => {
  const cote = matrice.length + 2 * MARGE_DU_QR;
  const traits = [];
  matrice.forEach((rangee, y) => {
    for (const suite of rangee.matchAll(/X+/g)) traits.push(`M${suite.index + MARGE_DU_QR} ${y + MARGE_DU_QR}h${suite[0].length}v1h-${suite[0].length}z`);
  });
  return `<svg class="${classe}" viewBox="0 0 ${cote} ${cote}" role="img" aria-label="${e(etiquette)}" shape-rendering="crispEdges"><rect width="${cote}" height="${cote}" fill="#FFFFFF"/><path d="${traits.join('')}" fill="#000000"/></svg>`;
};
