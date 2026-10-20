// Un PNG opaque (rouge, vert, bleu sur 8 bits, sans couche d’opacité), écrit avec Node seul : chaque octet noté par
// son écart avec le pixel de gauche (le filtre PNG « Sub », le meilleur sur ces dégradés horizontaux doux, mesuré contre
// les quatre autres), puis compressé. Les images de partage y pèsent près de deux fois moins que le PNG du rendu, et
// le même dessin donne toujours le même fichier, octet pour octet.
import { crc32, deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const morceau = (type, donnees) => {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const typeEtDonnees = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(typeEtDonnees));
  return Buffer.concat([longueur, typeEtDonnees, controle]);
};

// rgba : les pixels (4 octets chacun ; l’opacité est ignorée, l’image est opaque). Rend le fichier PNG.
export const pngOpaque = (rgba, largeur, hauteur) => {
  const parLigne = largeur * 3;
  const lignes = Buffer.alloc((parLigne + 1) * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    const debut = y * (parLigne + 1);
    lignes[debut] = 1; // le filtre Sub
    for (let x = 0; x < largeur; x += 1) {
      const pixel = (y * largeur + x) * 4;
      for (let k = 0; k < 3; k += 1) lignes[debut + 1 + x * 3 + k] = (rgba[pixel + k] - (x ? rgba[pixel - 4 + k] : 0)) & 0xFF;
    }
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete.set([8, 2, 0, 0, 0], 8); // 8 bits, rouge-vert-bleu, compression, filtre et entrelacement standard
  return Buffer.concat([SIGNATURE, morceau('IHDR', entete), morceau('IDAT', deflateSync(lignes, { level: 6 })), morceau('IEND', Buffer.alloc(0))]);
};

