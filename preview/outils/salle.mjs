// La salle d’un bar, dessinée en axonométrie : un exemple, 42 places, des clubs inventés (Alvène, Orvèle). Chaque
// place porte l’heure où elle se prend (s1 à s4) ; la tienne (toi) passe à l’ambre quand tu la gardes.
const A = 15.5;   // demi-largeur d’une unité au sol
const B = 8.9;    // demi-hauteur d’une unité au sol
const C = 17;     // une unité de hauteur
const OX = 168;
const OY = 52;
const p = (u, v, z = 0) => [OX + (u - v) * A, OY + (u + v) * B - z * C];
const pt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
const poly = (pts, attrs) => `<path d="M${pts.map(pt).join('L')}Z" ${attrs}/>`;

const U = 10;
const V = 7.4;

// Les places : neuf tables rondes de quatre, et six tabourets au comptoir.
const TABLES = [];
for (const u of [3.1, 5.6, 8.1]) for (const v of [2.3, 4.4, 6.4]) TABLES.push([u, v]);
const TABOURETS = [1.4, 2.4, 3.4, 4.4, 5.4, 6.4].map((v) => [1.55, v]);

// L’heure où chaque place se prend : un ordre fixe, qui remplit la salle par grappes (les habitués au comptoir, puis
// les tables proches de l’écran). Une graine fixe : le dessin est le même à chaque passage.
const graine = (n) => { let x = n * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); };
const hasard = graine(7);

export const salle = () => {
  const sol = poly([p(0, 0), p(U, 0), p(U, V), p(0, V)], 'class="salle__sol"');
  const murD = poly([p(0, 0), p(U, 0), p(U, 0, 3.4), p(0, 0, 3.4)], 'class="salle__mur salle__mur--d"');
  const murG = poly([p(0, 0), p(0, V), p(0, V, 3.4), p(0, 0, 3.4)], 'class="salle__mur salle__mur--g"');
  // L’écran, sur le mur du fond : éteint à 18:42, aux couleurs des deux clubs au coup d’envoi.
  const ecran = [p(3.3, 0, 1.25), p(6.9, 0, 1.25), p(6.9, 0, 2.75), p(3.3, 0, 2.75)];
  const ecranCadre = poly(ecran, 'class="salle__ecran"');
  const moitie1 = poly([p(3.45, 0, 1.38), p(5.1, 0, 1.38), p(5.1, 0, 2.62), p(3.45, 0, 2.62)], 'class="salle__match salle__match--a"');
  const moitie2 = poly([p(5.1, 0, 1.38), p(6.75, 0, 1.38), p(6.75, 0, 2.62), p(5.1, 0, 2.62)], 'class="salle__match salle__match--b"');
  const lueur = poly([p(2.4, 0.05), p(7.8, 0.05), p(7.2, 3.6), p(3.0, 3.6)], 'class="salle__lueur"');
  // Le comptoir, le long du mur de gauche.
  const comptoir = [
    poly([p(0.25, 0.8, 1.05), p(0.95, 0.8, 1.05), p(0.95, 6.9, 1.05), p(0.25, 6.9, 1.05)], 'class="salle__comptoir-dessus"'),
    poly([p(0.95, 0.8, 0), p(0.95, 6.9, 0), p(0.95, 6.9, 1.05), p(0.95, 0.8, 1.05)], 'class="salle__comptoir-face"'),
    poly([p(0.25, 6.9, 0), p(0.95, 6.9, 0), p(0.95, 6.9, 1.05), p(0.25, 6.9, 1.05)], 'class="salle__comptoir-bout"'),
  ].join('');
  // La porte, sur le mur de droite, près de l’angle.
  const porte = poly([p(U - 1.7, 0, 0), p(U - 0.6, 0, 0), p(U - 0.6, 0, 2.2), p(U - 1.7, 0, 2.2)], 'class="salle__porte"');

  // Les places, de l’arrière vers l’avant (l’ordre du dessin).
  const places = [];
  for (const [u, v] of TABLES) {
    for (const [du, dv] of [[0, -0.62], [-0.62, 0], [0.62, 0], [0, 0.62]]) places.push({ u: u + du, v: v + dv, table: [u, v] });
  }
  for (const [u, v] of TABOURETS) places.push({ u, v, tabouret: true });
  const toi = places.findIndex((q) => q.table && q.table[0] === 5.6 && q.table[1] === 4.4 && q.u > 5.6);
  places.forEach((q, i) => {
    const procheEcran = q.v < 3.4;
    const r = hasard();
    q.pas = q.tabouret ? (r < 0.6 ? 1 : 2) : procheEcran ? (r < 0.35 ? 2 : r < 0.85 ? 3 : 4) : (r < 0.25 ? 2 : r < 0.6 ? 3 : r < 0.92 ? 4 : 0);
    q.camp = hasard() < 0.5 ? 'a' : 'b';
    if (i === toi) { q.pas = 0; q.toi = true; }
  });

  const dessinTable = ([u, v]) => {
    const [x, y] = p(u, v, 0.78);
    return `<ellipse class="salle__table" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(A * 0.62).toFixed(1)}" ry="${(B * 0.62).toFixed(1)}"/><line class="salle__pied" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 0.78 * C).toFixed(1)}"/>`;
  };
  const dessinPlace = (q) => {
    const [x, y] = p(q.u, q.v, q.tabouret ? 0.7 : 0.45);
    const e = `cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5.4" ry="3.4"`;
    const et = `cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6.6" ry="4.2"`;
    if (q.toi) return `<ellipse class="place toi" ${et}/><ellipse class="toi__plein" ${et}/><path class="toi__coche" d="M${(x - 3.2).toFixed(1)} ${(y + 0.2).toFixed(1)}l2.1 2 4.3-4.4"/>`;
    return `<ellipse class="place" ${e}/>${q.pas ? `<ellipse class="plein s${q.pas} c${q.camp}" ${e}/>` : ''}`;
  };
  // Dessinées de l’arrière vers l’avant : tables et places triées par profondeur (u + v).
  const objets = [
    ...TABLES.map((t) => ({ prof: t[0] + t[1], svg: dessinTable(t) })),
    ...places.map((q) => ({ prof: q.u + q.v + (q.table && q.v > q.table[1] ? 0.2 : -0.2), svg: dessinPlace(q) })),
  ].sort((a, b) => a.prof - b.prof).map((o) => o.svg).join('');

  const nuit = `${poly([p(0, 0), p(U, 0), p(U, 0, 3.4), p(0, 0, 3.4)], 'class="salle__nuit"')}${poly([p(0, 0), p(0, V), p(0, V, 3.4), p(0, 0, 3.4)], 'class="salle__nuit"')}${poly([p(0, 0), p(U, 0), p(U, V), p(0, V)], 'class="salle__nuit"')}`;
  return `<svg class="salle__dessin" viewBox="46 -12 286 224" width="286" height="224" aria-hidden="true" focusable="false">${murD}${murG}${sol}${nuit}${lueur}${porte}${ecranCadre}${moitie1}${moitie2}${comptoir}${objets}</svg>`;
};
