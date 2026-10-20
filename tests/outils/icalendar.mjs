// Un validateur iCalendar (RFC 5545) strict, pour les agendas que le générateur écrit (generateur/agenda.mjs). Il lit
// les octets du fichier et rend la liste de ses erreurs (vide : le fichier est bon) :
//  - l’UTF-8 valide, sans BOM, chaque ligne finie par CRLF (ni LF ni CR seuls), le fichier fini par CRLF ;
//  - chaque ligne de 75 octets au plus, et UTF-8 valide à elle seule (un pli ne coupe jamais un caractère) ; une ligne
//    de suite commence par une espace ou une tabulation ;
//  - chaque ligne dépliée de la forme NOM *(;PARAM=valeur) : valeur, sans caractère de contrôle ;
//  - un seul VCALENDAR, des BEGIN et END qui se répondent ; dans VCALENDAR, VERSION:2.0 et PRODID une fois chacun ;
//  - dans chaque VEVENT, UID, DTSTAMP (un instant UTC) et DTSTART une fois chacun (le fichier n’a pas de METHOD), pas
//    de DTEND avec DURATION, une fin après le début et de la même sorte (jour ou instant), les propriétés uniques une
//    fois au plus, STATUS, TRANSP et SEQUENCE bien formés, une URL absolue, des UID tous différents ;
//  - un texte (SUMMARY, DESCRIPTION, LOCATION, X-WR-CALNAME…) n’a que des échappements permis (\\ \; \, \n) et aucun
//    point-virgule ni virgule sans le sien ;
//  - un TZID nommé par une date a son VTIMEZONE (avec STANDARD ou DAYLIGHT, et leurs DTSTART, TZOFFSETFROM, TZOFFSETTO).
// lireLeCalendrier rend aussi ce qu’il a lu (les composants et leurs propriétés, textes déséchappés), pour les tests.

const PROPRIETES_TEXTE = new Set(['SUMMARY', 'DESCRIPTION', 'LOCATION', 'COMMENT', 'CONTACT', 'CATEGORIES', 'RESOURCES', 'X-WR-CALNAME', 'X-WR-CALDESC', 'NAME']);
const UNIQUES_VEVENT = ['UID', 'DTSTAMP', 'DTSTART', 'DTEND', 'DURATION', 'CLASS', 'CREATED', 'DESCRIPTION', 'GEO', 'LAST-MODIFIED', 'LOCATION', 'ORGANIZER', 'PRIORITY', 'SEQUENCE', 'STATUS', 'SUMMARY', 'TRANSP', 'URL', 'RECURRENCE-ID'];
const CONNUES_VCALENDAR = new Set(['VERSION', 'PRODID', 'CALSCALE', 'METHOD', 'X-WR-CALNAME', 'X-WR-CALDESC', 'X-WR-TIMEZONE', 'X-PUBLISHED-TTL', 'REFRESH-INTERVAL', 'NAME', 'DESCRIPTION', 'URL', 'SOURCE', 'COLOR', 'LAST-MODIFIED', 'UID']);
const CONNUES_VEVENT = new Set([...UNIQUES_VEVENT, 'ATTACH', 'ATTENDEE', 'CATEGORIES', 'COMMENT', 'CONTACT', 'EXDATE', 'RSTATUS', 'RELATED-TO', 'RESOURCES', 'RDATE', 'RRULE']);
const NOM = /^(?:[A-Za-z0-9-]+)$/;
const DATE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_HEURE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

const dateValide = (annee, mois, jour) => {
  const d = new Date(Date.UTC(Number(annee), Number(mois) - 1, Number(jour)));
  return d.getUTCFullYear() === Number(annee) && d.getUTCMonth() === Number(mois) - 1 && d.getUTCDate() === Number(jour);
};

// Une valeur DATE ou DATE-TIME → { jour: true|false, instant (ms, UTC ou heure flottante lue comme UTC), utc }, ou null.
export const lireUneDate = (valeur, typeDate) => {
  if (typeDate) {
    const m = valeur.match(DATE);
    if (!m || !dateValide(m[1], m[2], m[3])) return null;
    return { jour: true, instant: Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])), utc: false };
  }
  const m = valeur.match(DATE_HEURE);
  if (!m || !dateValide(m[1], m[2], m[3]) || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 60) return null;
  return { jour: false, instant: Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])), utc: m[7] === 'Z' };
};

// Un texte iCalendar → le texte qu’il dit, ou null si un échappement est interdit ou un « ; » ou « , » est nu.
export const desechapper = (valeur) => {
  let texte = '';
  for (let i = 0; i < valeur.length; i += 1) {
    const c = valeur[i];
    if (c === '\\') {
      const suivant = valeur[i + 1];
      if (suivant === 'n' || suivant === 'N') texte += '\n';
      else if (suivant === '\\' || suivant === ';' || suivant === ',') texte += suivant;
      else return null;
      i += 1;
    } else if (c === ';' || c === ',') {
      return null;
    } else {
      texte += c;
    }
  }
  return texte;
};

// Une ligne dépliée → { nom, parametres: { NOM: valeur }, valeur }, ou null si elle n’a pas la forme d’une propriété.
const lireUneLigne = (ligne) => {
  const nom = ligne.match(/^[A-Za-z0-9-]+/)?.[0];
  if (!nom) return null;
  let i = nom.length;
  const parametres = {};
  while (ligne[i] === ';') {
    const cle = ligne.slice(i + 1).match(/^[A-Za-z0-9-]+/)?.[0];
    if (!cle || ligne[i + 1 + cle.length] !== '=') return null;
    i += 2 + cle.length;
    let valeur;
    if (ligne[i] === '"') {
      const fin = ligne.indexOf('"', i + 1);
      if (fin === -1) return null;
      valeur = ligne.slice(i + 1, fin);
      i = fin + 1;
    } else {
      valeur = ligne.slice(i).match(/^[^";:,]*/)[0];
      i += valeur.length;
    }
    parametres[cle.toUpperCase()] = valeur;
  }
  if (ligne[i] !== ':') return null;
  return { nom: nom.toUpperCase(), parametres, valeur: ligne.slice(i + 1) };
};

export const lireLeCalendrier = (octets) => {
  const erreurs = [];
  const tampon = Buffer.isBuffer(octets) ? octets : Buffer.from(octets, 'utf8');
  if (tampon.length === 0) return { erreurs: ['fichier vide'], composants: [] };
  if (tampon[0] === 0xEF && tampon[1] === 0xBB && tampon[2] === 0xBF) erreurs.push('BOM en tête du fichier');
  let texte;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(tampon);
  } catch {
    return { erreurs: [...erreurs, 'UTF-8 invalide'], composants: [] };
  }
  if (!texte.endsWith('\r\n')) erreurs.push('le fichier ne finit pas par CRLF');
  if (/\r(?!\n)/.test(texte)) erreurs.push('un CR seul');
  if (/(?<!\r)\n/.test(texte)) erreurs.push('un LF seul (fin de ligne sans CR)');

  // Les lignes physiques : 75 octets au plus, chacune lisible seule.
  const physiques = texte.replace(/\r\n$/, '').split('\r\n');
  physiques.forEach((ligne, n) => {
    const taille = Buffer.byteLength(ligne, 'utf8');
    if (taille > 75) erreurs.push(`ligne ${n + 1} : ${taille} octets (75 au plus)`);
    if (ligne === '') erreurs.push(`ligne ${n + 1} : vide`);
  });
  // Un pli ne coupe pas un caractère : chaque ligne physique, en octets, se relit telle quelle.
  let debut = 0;
  for (const [n, ligne] of physiques.entries()) {
    const longueur = Buffer.byteLength(ligne, 'utf8');
    const morceau = tampon.subarray(debut, debut + longueur);
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(morceau);
    } catch {
      erreurs.push(`ligne ${n + 1} : un caractère coupé par le pli`);
    }
    debut += longueur + 2;
  }

  // Les lignes logiques (dépliées).
  const logiques = [];
  for (const [n, ligne] of physiques.entries()) {
    if (ligne.startsWith(' ') || ligne.startsWith('\t')) {
      if (!logiques.length) erreurs.push(`ligne ${n + 1} : une suite sans ligne avant elle`);
      else logiques[logiques.length - 1].texte += ligne.slice(1);
    } else {
      logiques.push({ texte: ligne, n: n + 1 });
    }
  }

  // La structure : les composants et leurs propriétés.
  const racines = [];
  const pile = [];
  for (const { texte: brute, n } of logiques) {
    if (/[\u0000-\u0008\u000A-\u001F\u007F]/.test(brute)) erreurs.push(`ligne ${n} : un caractère de contrôle`);
    const lue = lireUneLigne(brute);
    if (!lue || !NOM.test(lue.nom)) {
      erreurs.push(`ligne ${n} : pas une propriété « ${brute.slice(0, 40)} »`);
      continue;
    }
    if (lue.nom === 'BEGIN') {
      const composant = { nom: lue.valeur.toUpperCase(), proprietes: [], enfants: [], n };
      (pile.at(-1)?.enfants ?? racines).push(composant);
      pile.push(composant);
    } else if (lue.nom === 'END') {
      const ouvert = pile.pop();
      if (!ouvert || ouvert.nom !== lue.valeur.toUpperCase()) erreurs.push(`ligne ${n} : END:${lue.valeur} sans son BEGIN`);
    } else if (!pile.length) {
      erreurs.push(`ligne ${n} : ${lue.nom} hors de tout composant`);
    } else {
      pile.at(-1).proprietes.push({ ...lue, n });
    }
  }
  for (const ouvert of pile) erreurs.push(`BEGIN:${ouvert.nom} (ligne ${ouvert.n}) sans son END`);
  if (racines.length !== 1 || racines[0].nom !== 'VCALENDAR') {
    erreurs.push(`un seul VCALENDAR attendu, trouvé : ${racines.map((r) => r.nom).join(', ') || 'rien'}`);
    return { erreurs, composants: racines };
  }
  const calendrier = racines[0];
  const toutes = (composant, nom) => composant.proprietes.filter((p) => p.nom === nom);
  const une = (composant, nom) => toutes(composant, nom)[0];

  // Le calendrier.
  for (const nom of ['VERSION', 'PRODID']) {
    if (toutes(calendrier, nom).length !== 1) erreurs.push(`VCALENDAR : ${nom} ${toutes(calendrier, nom).length} fois (1 attendu)`);
  }
  if (une(calendrier, 'VERSION') && une(calendrier, 'VERSION').valeur !== '2.0') erreurs.push('VCALENDAR : VERSION n’est pas 2.0');
  if (une(calendrier, 'CALSCALE') && une(calendrier, 'CALSCALE').valeur !== 'GREGORIAN') erreurs.push('VCALENDAR : CALSCALE n’est pas GREGORIAN');
  const sansMethode = !une(calendrier, 'METHOD');
  for (const p of calendrier.proprietes) {
    if (!CONNUES_VCALENDAR.has(p.nom) && !p.nom.startsWith('X-')) erreurs.push(`VCALENDAR : propriété inconnue ${p.nom}`);
  }

  // Les fuseaux décrits (VTIMEZONE) : chaque TZID nommé doit en avoir un.
  const fuseaux = new Set();
  for (const vt of calendrier.enfants.filter((c) => c.nom === 'VTIMEZONE')) {
    const tzid = une(vt, 'TZID')?.valeur;
    if (!tzid) erreurs.push(`VTIMEZONE (ligne ${vt.n}) sans TZID`);
    else fuseaux.add(tzid);
    const regles = vt.enfants.filter((c) => c.nom === 'STANDARD' || c.nom === 'DAYLIGHT');
    if (!regles.length) erreurs.push(`VTIMEZONE ${tzid} sans STANDARD ni DAYLIGHT`);
    for (const regle of regles) {
      for (const nom of ['DTSTART', 'TZOFFSETFROM', 'TZOFFSETTO']) if (toutes(regle, nom).length !== 1) erreurs.push(`VTIMEZONE ${tzid} : ${regle.nom} sans ${nom}`);
      for (const nom of ['TZOFFSETFROM', 'TZOFFSETTO']) if (une(regle, nom) && !/^[+-]\d{4}(?:\d{2})?$/.test(une(regle, nom).valeur)) erreurs.push(`VTIMEZONE ${tzid} : ${nom} illisible`);
    }
  }

  const textes = (composant) => {
    for (const p of composant.proprietes) {
      if ((PROPRIETES_TEXTE.has(p.nom)) && desechapper(p.valeur) === null) erreurs.push(`${composant.nom} : ${p.nom} (ligne ${p.n}) mal échappé`);
      if (p.parametres.TZID && !fuseaux.has(p.parametres.TZID)) erreurs.push(`${composant.nom} : ${p.nom} nomme le fuseau ${p.parametres.TZID}, sans VTIMEZONE`);
    }
  };
  textes(calendrier);

  // Les évènements.
  const uids = new Set();
  const evenements = calendrier.enfants.filter((c) => c.nom === 'VEVENT');
  for (const autre of calendrier.enfants.filter((c) => !['VEVENT', 'VTIMEZONE'].includes(c.nom))) erreurs.push(`composant inattendu ${autre.nom}`);
  for (const ev of evenements) {
    const ici = `VEVENT ligne ${ev.n}`;
    textes(ev);
    for (const nom of UNIQUES_VEVENT) if (toutes(ev, nom).length > 1) erreurs.push(`${ici} : ${nom} plusieurs fois`);
    for (const nom of ['UID', 'DTSTAMP', ...(sansMethode ? ['DTSTART'] : [])]) if (!une(ev, nom)) erreurs.push(`${ici} : ${nom} manque`);
    for (const p of ev.proprietes) if (!CONNUES_VEVENT.has(p.nom) && !p.nom.startsWith('X-')) erreurs.push(`${ici} : propriété inconnue ${p.nom}`);
    for (const enfant of ev.enfants) if (enfant.nom !== 'VALARM') erreurs.push(`${ici} : composant inattendu ${enfant.nom}`);
    const uid = une(ev, 'UID')?.valeur;
    if (uid !== undefined) {
      if (!uid || /[\s;,\\]/.test(uid)) erreurs.push(`${ici} : UID « ${uid} » illisible`);
      if (uids.has(uid)) erreurs.push(`${ici} : UID ${uid} en double`);
      uids.add(uid);
    }
    const stamp = une(ev, 'DTSTAMP');
    if (stamp) {
      const lu = lireUneDate(stamp.valeur, false);
      if (!lu || !lu.utc || Object.keys(stamp.parametres).length) erreurs.push(`${ici} : DTSTAMP « ${stamp.valeur} » n’est pas un instant UTC`);
    }
    const dates = {};
    for (const nom of ['DTSTART', 'DTEND']) {
      const p = une(ev, nom);
      if (!p) continue;
      const type = p.parametres.VALUE ?? 'DATE-TIME';
      if (type !== 'DATE' && type !== 'DATE-TIME') erreurs.push(`${ici} : ${nom} de type ${type}`);
      if (type === 'DATE' && p.parametres.TZID) erreurs.push(`${ici} : ${nom} un jour avec un fuseau`);
      const lu = lireUneDate(p.valeur, type === 'DATE');
      if (!lu) erreurs.push(`${ici} : ${nom} « ${p.valeur} » illisible`);
      else dates[nom] = lu;
    }
    if (une(ev, 'DTEND') && une(ev, 'DURATION')) erreurs.push(`${ici} : DTEND et DURATION ensemble`);
    if (dates.DTSTART && dates.DTEND) {
      if (dates.DTSTART.jour !== dates.DTEND.jour) erreurs.push(`${ici} : DTSTART et DTEND de sortes différentes`);
      else if (dates.DTSTART.utc === dates.DTEND.utc && dates.DTEND.instant <= dates.DTSTART.instant) erreurs.push(`${ici} : DTEND avant DTSTART`);
    }
    const sequence = une(ev, 'SEQUENCE')?.valeur;
    if (sequence !== undefined && !/^\d+$/.test(sequence)) erreurs.push(`${ici} : SEQUENCE « ${sequence} »`);
    const statut = une(ev, 'STATUS')?.valeur;
    if (statut !== undefined && !['TENTATIVE', 'CONFIRMED', 'CANCELLED'].includes(statut)) erreurs.push(`${ici} : STATUS « ${statut} »`);
    const transp = une(ev, 'TRANSP')?.valeur;
    if (transp !== undefined && !['OPAQUE', 'TRANSPARENT'].includes(transp)) erreurs.push(`${ici} : TRANSP « ${transp} »`);
    const url = une(ev, 'URL')?.valeur;
    if (url !== undefined) {
      try {
        if (!/^https?:$/.test(new URL(url).protocol)) erreurs.push(`${ici} : URL « ${url} » pas en http(s)`);
      } catch {
        erreurs.push(`${ici} : URL « ${url} » illisible`);
      }
    }
  }

  // Ce qui a été lu, pour les tests : chaque évènement, ses propriétés (les textes déséchappés).
  const lire = (composant) => Object.fromEntries(composant.proprietes.map((p) => [p.nom, PROPRIETES_TEXTE.has(p.nom) ? desechapper(p.valeur) : p.valeur]));
  return {
    erreurs,
    calendrier: lire(calendrier),
    proprietes: calendrier.proprietes,
    evenements: evenements.map((ev) => ({ ...lire(ev), parametres: Object.fromEntries(ev.proprietes.map((p) => [p.nom, p.parametres])) })),
  };
};

export const erreursDuCalendrier = (octets) => lireLeCalendrier(octets).erreurs;
