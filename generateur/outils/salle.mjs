// La salle de l’accueil, dessinée en axonométrie : l’exemple d’un bar de 42 places (neuf tables rondes de quatre, six
// places debout au comptoir) et de deux clubs inventés, Alvène et Orvèle. Le dessin est écrit dans index.html entre
// <!-- salle:debut --> et <!-- salle:fin --> ; ce fichier le fabrique, tests/accueil.spec.mjs vérifie que la page
// porte exactement ce qu’il écrit. Pour le refaire : node generateur/outils/salle.mjs --ecrire
//
// Ce qui se voit, et l’heure où cela se voit (le style de la page, accueil.css, lit l’état de la soirée) :
// - des gens, tête et épaules, assis aux tables ou debout au comptoir, aux couleurs de leur club (maillot, écharpe) ;
//   chacun se pose à son heure (s1 à s4), de 18:42 au coup d’envoi ;
// - une salle du soir posée sur le papier comme une maquette : des murs sombres et chauds, un plancher de bois, un socle
//   et une ombre douce ; c’est le seul point fort du premier écran ;
// - la lumière : des appliques au blanc chaud (jamais l’ambre, réservé à l’action et à la place du visiteur), dont la
//   lueur reste sur les murs et les flaques sur le sol ; au coup d’envoi les lumières baissent, celles du comptoir
//   restent en veilleuse (une lumière chaude à gauche, celle de l’écran, froide, à droite), l’écran du fond s’allume aux couleurs des deux clubs, sa lumière coule sur le sol,
//   douce et sans mélange (chaque club garde sa teinte, de son côté), et découpe les silhouettes d’un liseré blanc
//   chaud (le « contre-jour ») ;
// - ta place : plus grande qu’une chaise, en pointillé tant qu’elle n’est pas gardée ; à l’ambre et cerclée d’ambre
//   quand tu la gardes, cochée quand tu es arrivé.
// Rien d’un verre ni d’une bouteille : le comptoir est un plan de bois, des gens y sont debout.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const A = 15.5; // demi-largeur d’une unité au sol
const B = 8.9; // demi-hauteur d’une unité au sol
const C = 17; // une unité de hauteur
const OX = 168;
const OY = 52;
const p = (u, v, z = 0) => [OX + (u - v) * A, OY + (u + v) * B - z * C];
const f = (n) => Number(n.toFixed(1));
const pt = ([x, y]) => `${f(x)} ${f(y)}`;
const poly = (pts, attrs) => `<path d="M${pts.map(pt).join('L')}Z" ${attrs}/>`;

const U = 10;
const V = 7.4;
const HAUTEUR = 3.4;

export const REPERES_DE_LA_SALLE = { debut: '<!-- salle:debut -->', fin: '<!-- salle:fin -->' };

// Une graine fixe : le dessin est le même à chaque passage.
const graine = (n) => { let x = n * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); };

const TABLES = [];
for (const u of [3.1, 5.6, 8.1]) for (const v of [2.3, 4.4, 6.4]) TABLES.push([u, v]);
const COMPTOIR = [1.4, 2.4, 3.4, 4.4, 5.4, 6.4].map((v) => [1.55, v]);

// Les places : les quatre chaises de chaque table, puis le comptoir. Chaque place a son heure (1 à 4 : 18:42, 19:30,
// 20:15, 20:55 ; 0 : vide toute la soirée), son club (a, b) et une teinte de tête (t1 à t3).
export const places = () => {
  const hasard = graine(11);
  const liste = [];
  for (const [u, v] of TABLES) {
    for (const [du, dv] of [[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]]) liste.push({ u: u + du, v: v + dv, table: [u, v] });
  }
  for (const [u, v] of COMPTOIR) liste.push({ u, v, debout: true });
  const toi = liste.findIndex((q) => q.table && q.table[0] === 5.6 && q.table[1] === 4.4 && q.u > 5.6 && q.v < 4.4);
  liste.forEach((q, i) => {
    const procheEcran = q.v < 3.4;
    const r = hasard();
    // À 18:42 la salle a déjà ses habitués (une dizaine, au comptoir et aux tables du fond) : elle vit avant de se remplir.
    q.pas = q.debout ? (r < 0.55 ? 1 : 2) : procheEcran ? (r < 0.12 ? 1 : r < 0.35 ? 2 : r < 0.8 ? 3 : 4) : (r < 0.26 ? 1 : r < 0.4 ? 2 : r < 0.66 ? 3 : r < 0.92 ? 4 : 0);
    // Le club se lit sur la place : à gauche de l’écran Alvène, à droite Orvèle, et un voisin sur quatre de l’autre côté.
    const cote = (q.table ? q.table[0] : 5.1 + (hasard() - 0.5)) < 5.1 ? 'a' : 'b';
    q.camp = hasard() < 0.22 ? (cote === 'a' ? 'b' : 'a') : cote;
    q.teinte = 1 + Math.floor(hasard() * 3);
    q.retard = 1 + Math.floor(hasard() * 3);
    if (i === toi) { q.pas = 0; q.toi = true; }
  });
  return liste;
};

const PERSONNES = `<symbol id="gens" viewBox="0 0 12 17"><path d="M.8 17C.8 11.2 3 8.6 6 8.6s5.2 2.6 5.2 8.4z" class="g-corps"/><path d="M3 9.1C4 10.7 8 10.7 9 9.1l.7 1.3C8.4 12.1 3.6 12.1 2.3 10.4z" class="g-echarpe"/><circle cx="6" cy="4.3" r="3.3" class="g-tete"/></symbol>`
  + `<symbol id="gens-debout" viewBox="0 0 12 30"><path d="M2.2 21.6h3.4V30H2.2zM6.4 21.6h3.4V30H6.4z" class="g-jambes"/><path d="M.8 22C.8 11.4 3 8.6 6 8.6s5.2 2.8 5.2 13.4z" class="g-corps"/><path d="M3 9.1C4 10.7 8 10.7 9 9.1l.7 1.3C8.4 12.1 3.6 12.1 2.3 10.4z" class="g-echarpe"/><circle cx="6" cy="4.3" r="3.3" class="g-tete"/></symbol>`
  + `<symbol id="liseret" viewBox="0 0 12 17"><path d="M.8 17C.8 11.2 3 8.6 6 8.6s5.2 2.6 5.2 8.4M2.7 4.3a3.3 3.3 0 0 1 6.6 0" class="g-liseret"/></symbol>`
  + `<symbol id="liseret-debout" viewBox="0 0 12 30"><path d="M.8 22C.8 11.4 3 8.6 6 8.6s5.2 2.8 5.2 13.4M2.7 4.3a3.3 3.3 0 0 1 6.6 0" class="g-liseret"/></symbol>`;

const LUMIERES = `<radialGradient id="s-chaud"><stop offset="0" stop-color="#FFF4DC" stop-opacity=".95"/><stop offset=".45" stop-color="#FFF1D2" stop-opacity=".4"/><stop offset="1" stop-color="#FFF1D2" stop-opacity="0"/></radialGradient>`
  + `<radialGradient id="s-halo-a"><stop offset="0" stop-color="#7DB5AC" stop-opacity=".95"/><stop offset="1" stop-color="#7DB5AC" stop-opacity="0"/></radialGradient>`
  + `<radialGradient id="s-halo-b"><stop offset="0" stop-color="#9A9CC8" stop-opacity=".95"/><stop offset="1" stop-color="#9A9CC8" stop-opacity="0"/></radialGradient>`
  + `<linearGradient id="s-coule-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7DB5AC" stop-opacity=".9"/><stop offset="1" stop-color="#7DB5AC" stop-opacity="0"/></linearGradient>`
  + `<radialGradient id="s-ombre-sol"><stop offset="0" stop-color="#0A0B10" stop-opacity=".34"/><stop offset=".6" stop-color="#0A0B10" stop-opacity=".12"/><stop offset="1" stop-color="#0A0B10" stop-opacity="0"/></radialGradient>`
  + `<linearGradient id="s-coule-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A9CC8" stop-opacity=".9"/><stop offset="1" stop-color="#9A9CC8" stop-opacity="0"/></linearGradient>`;

export const salle = () => {
  const sol = poly([p(0, 0), p(U, 0), p(U, V), p(0, V)], 'class="s-sol"');
  const murD = poly([p(0, 0), p(U, 0), p(U, 0, HAUTEUR), p(0, 0, HAUTEUR)], 'class="s-mur-d"');
  const murG = poly([p(0, 0), p(0, V), p(0, V, HAUTEUR), p(0, 0, HAUTEUR)], 'class="s-mur-g"');
  const plinthe = poly([p(0, 0), p(U, 0), p(U, 0, 0.18), p(0, 0, 0.18)], 'class="s-plinthe"');
  const porte = poly([p(U - 1.7, 0, 0), p(U - 0.6, 0, 0), p(U - 0.6, 0, 2.2), p(U - 1.7, 0, 2.2)], 'class="s-porte"');

  // Les appliques : une lampe blanc chaud sur chaque mur, et sa lueur.
  // La lumière reste dans la salle : la lueur des appliques ne déborde pas des murs, ni les flaques du sol.
  const coin = (pts) => `M${pts.map(pt).join('L')}Z`;
  const lieux = [[1.7, 0, 2.15], [8.7, 0, 2.15], [0, 1.6, 2.15], [0, 5.6, 2.15]].map(([u, v, z]) => p(u, v, z));
  const lampes = `<clipPath id="s-murs-clip"><path d="${coin([p(0, 0), p(U, 0), p(U, 0, HAUTEUR), p(0, 0, HAUTEUR)])}"/><path d="${coin([p(0, 0), p(0, V), p(0, V, HAUTEUR), p(0, 0, HAUTEUR)])}"/></clipPath>`
    + `<g clip-path="url(#s-murs-clip)">${lieux.map(([x, y]) => `<ellipse class="s-lueur" cx="${f(x)}" cy="${f(y + 4)}" rx="40" ry="32" fill="url(#s-chaud)"/>`).join('')}</g>`
    + lieux.map(([x, y]) => `<rect class="s-lampe" x="${f(x - 2)}" y="${f(y - 3)}" width="4" height="6" rx="1.6"/>`).join('');
  const sousLeSol = `<clipPath id="s-sol-clip"><path d="${coin([p(0, 0), p(U, 0), p(U, V), p(0, V)])}"/></clipPath><g clip-path="url(#s-sol-clip)">${[[2.6, 3.4], [7.4, 3.4], [3.2, 6.2], [7.6, 6.2]].map(([u, v]) => {
    const [x, y] = p(u, v);
    return `<ellipse class="s-flaque" cx="${f(x)}" cy="${f(y)}" rx="46" ry="23" fill="url(#s-chaud)"/>`;
  }).join('')}</g>`;
  // Le socle : la salle est posée sur le papier comme une maquette, avec l’épaisseur de son plancher et une ombre douce.
  // La veilleuse du comptoir : au coup d’envoi, quand la salle s’éteint, les deux appliques du comptoir restent en
  // veilleuse. Un calque posé sur la nuit : une lumière chaude à gauche, celle de l’écran, froide, à droite.
  const veilleuse = `<g class="s-veilleuse"><g clip-path="url(#s-murs-clip)">${lieux.slice(2).map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y + 4)}" rx="40" ry="32" fill="url(#s-chaud)"/>`).join('')}</g>`
    + lieux.slice(2).map(([x, y]) => `<rect class="s-lampe" x="${f(x - 2)}" y="${f(y - 3)}" width="4" height="6" rx="1.6"/>`).join('') + '</g>';
  const EP = 0.32;
  const [ox, oy] = p(U * 0.55, V * 0.6);
  const socle = `<ellipse class="s-ombre" cx="${f(ox)}" cy="${f(oy + 4)}" rx="150" ry="64" fill="url(#s-ombre-sol)"/>`
    + poly([p(U, 0), p(U, V), p(U, V, -EP), p(U, 0, -EP)], 'class="s-socle-d"')
    + poly([p(0, V), p(U, V), p(U, V, -EP), p(0, V, -EP)], 'class="s-socle-g"');

  // Le comptoir, le long du mur de gauche : un plan de bois, rien dessus.
  const comptoir = [
    poly([p(0.25, 0.8, 1.05), p(0.95, 0.8, 1.05), p(0.95, 6.9, 1.05), p(0.25, 6.9, 1.05)], 'class="s-comptoir-dessus"'),
    poly([p(0.95, 0.8, 0), p(0.95, 6.9, 0), p(0.95, 6.9, 1.05), p(0.95, 0.8, 1.05)], 'class="s-comptoir-face"'),
    poly([p(0.25, 6.9, 0), p(0.95, 6.9, 0), p(0.95, 6.9, 1.05), p(0.25, 6.9, 1.05)], 'class="s-comptoir-bout"'),
  ].join('');

  const liste = places();
  const toi = liste.find((q) => q.toi);
  const dessinTable = ([u, v]) => {
    const [x, y] = p(u, v, 0.78);
    return `<ellipse class="s-table" cx="${f(x)}" cy="${f(y)}" rx="${f(A * 0.62)}" ry="${f(B * 0.62)}"/><path class="s-pied" d="M${f(x)} ${f(y)}v${f(0.78 * C)}"/>`;
  };
  const largeur = 11;
  const dessinPlace = (q) => {
    const [x, y] = p(q.u, q.v, q.debout ? 0 : 0.5);
    if (q.toi) return '';
    if (!q.debout) {
      const chaise = `<ellipse class="s-chaise" cx="${f(x)}" cy="${f(y)}" rx="4.6" ry="2.8"/>`;
      return q.pas ? `${chaise}<use class="gens ${q.camp} t${q.teinte} s${q.pas} r${q.retard}" href="#gens" x="${f(x - largeur / 2)}" y="${f(y - 14.4)}" width="${largeur}" height="15.6"/>` : chaise;
    }
    return `<use class="gens ${q.camp} t${q.teinte} s${q.pas} r${q.retard}" href="#gens-debout" x="${f(x - largeur / 2)}" y="${f(y - 27.5)}" width="${largeur}" height="27.5"/>`;
  };
  const contre = (q) => {
    const [x, y] = p(q.u, q.v, q.debout ? 0 : 0.5);
    return q.debout
      ? `<use class="${q.camp} s${q.pas}" href="#liseret-debout" x="${f(x - largeur / 2)}" y="${f(y - 27.5)}" width="${largeur}" height="27.5"/>`
      : `<use class="${q.camp} s${q.pas}" href="#liseret" x="${f(x - largeur / 2)}" y="${f(y - 14.4)}" width="${largeur}" height="15.6"/>`;
  };
  // De l’arrière vers l’avant : tables et places triées par profondeur (u + v).
  const objets = [
    ...TABLES.map((t) => ({ prof: t[0] + t[1], svg: dessinTable(t) })),
    ...liste.map((q) => ({ prof: q.u + q.v + (q.table ? (q.u + q.v < q.table[0] + q.table[1] ? -0.4 : 0.4) : 0.2), svg: dessinPlace(q) })),
  ].sort((a, b) => a.prof - b.prof).map((o) => o.svg).join('');
  const contreJour = liste.filter((q) => q.pas && !q.toi).map(contre).join('');

  const noir = [poly([p(0, 0), p(U, 0), p(U, 0, HAUTEUR), p(0, 0, HAUTEUR)], 'class="s-nuit"'), poly([p(0, 0), p(0, V), p(0, V, HAUTEUR), p(0, 0, HAUTEUR)], 'class="s-nuit"'), poly([p(0, 0), p(U, 0), p(U, V), p(0, V)], 'class="s-nuit"')].join('');

  // L’écran du fond : éteint, puis aux couleurs des deux clubs (Alvène à gauche, Orvèle à droite).
  // La lumière de l'écran sur les murs, avant l'écran lui-même : un halo vert d'un côté, indigo de l'autre.
  const [ax, ay] = p(4.2, 0, 2);
  const [bx, by] = p(6.0, 0, 2);
  const halo = `<clipPath id="s-mur-clip"><path d="M${[p(0, 0), p(U, 0), p(U, 0, HAUTEUR), p(0, 0, HAUTEUR)].map(pt).join('L')}Z"/></clipPath><g class="s-halo" clip-path="url(#s-mur-clip)"><ellipse cx="${f(ax)}" cy="${f(ay)}" rx="46" ry="30" fill="url(#s-halo-a)"/><ellipse cx="${f(bx)}" cy="${f(by)}" rx="46" ry="30" fill="url(#s-halo-b)"/></g>`;
  const ecran = poly([p(3.3, 0, 1.25), p(6.9, 0, 1.25), p(6.9, 0, 2.75), p(3.3, 0, 2.75)], 'class="s-ecran"');
  const reflet = poly([p(3.4, 0, 1.3), p(4.3, 0, 1.3), p(3.9, 0, 2.7), p(3.4, 0, 2.7)], 'class="s-reflet"');
  const moitie = (u0, u1, classe) => poly([p(u0, 0, 1.38), p(u1, 0, 1.38), p(u1, 0, 2.62), p(u0, 0, 2.62)], `class="${classe}"`);
  const bandes = (u0, classe) => [0, 1].map((k) => { const d = u0 + 0.3 + k * 0.5; return poly([p(d, 0, 1.38), p(d + 0.22, 0, 1.38), p(d + 0.22, 0, 2.62), p(d, 0, 2.62)], `class="${classe}"`); }).join('');
  const match = `${moitie(3.45, 5.1, 's-jeu-a')}${bandes(3.45, 's-jeu-a2')}${moitie(5.1, 6.75, 's-jeu-b')}${bandes(5.1, 's-jeu-b2')}${poly([p(5.08, 0, 1.38), p(5.12, 0, 1.38), p(5.12, 0, 2.62), p(5.08, 0, 2.62)], 'class="s-jeu-ligne"')}`;
  const coule = `${poly([p(3.1, 0), p(5.1, 0), p(5.2, 4.4), p(2.0, 4.4)], 'class="s-coule" fill="url(#s-coule-a)"')}${poly([p(5.1, 0), p(7.1, 0), p(8.4, 4.4), p(5.2, 4.4)], 'class="s-coule" fill="url(#s-coule-b)"')}`;

  // Ta place : une chaise de plus, plus grande que les autres, la seule à l’ambre ; un anneau d’ambre quand elle est gardée.
  const [tx, ty] = p(toi.u, toi.v, 0.5);
  const maPlace = `<g class="s-toi"><ellipse class="toi-anneau" cx="${f(tx)}" cy="${f(ty)}" rx="12.2" ry="7.6"/><ellipse class="toi" cx="${f(tx)}" cy="${f(ty)}" rx="9.4" ry="5.7"/><ellipse class="toi-plein" cx="${f(tx)}" cy="${f(ty)}" rx="9.4" ry="5.7"/><path class="toi-coche" d="M${f(tx - 4.4)} ${f(ty + 0.3)}l2.9 2.7 5.9-6"/></g>`;

  return `<svg class="salle__dessin" viewBox="40 -12 298 232" width="298" height="232" aria-hidden="true" focusable="false"><defs>${PERSONNES}${LUMIERES}</defs>${socle}${murD}${murG}${sol}${sousLeSol}${plinthe}${lampes}${porte}${comptoir}${objets}<g class="s-nuits">${noir}</g>${veilleuse}${halo}${ecran}${reflet}<g class="s-jeu">${match}</g>${coule}<g class="s-contre">${contreJour}</g>${maPlace}</svg>`;
};

// Le dessin tel qu’il s’écrit dans la page, entre ses repères.
export const salleDeLaPage = () => `${REPERES_DE_LA_SALLE.debut}\n${salle()}\n${REPERES_DE_LA_SALLE.fin}`;

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--ecrire')) {
  const chemin = path.join(racine, 'index.html');
  const html = readFileSync(chemin, 'utf8');
  const d = html.indexOf(REPERES_DE_LA_SALLE.debut);
  const fin = html.indexOf(REPERES_DE_LA_SALLE.fin);
  if (d < 0 || fin < d) throw new Error('index.html : les repères de la salle manquent');
  writeFileSync(chemin, `${html.slice(0, d)}${salleDeLaPage()}${html.slice(fin + REPERES_DE_LA_SALLE.fin.length)}`);
}
