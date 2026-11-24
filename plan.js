(() => {
const doc = document;
doc.body.classList.add('js');
const calme = window.matchMedia('(prefers-reduced-motion: reduce)');
const $ = (s, r = doc) => r.querySelector(s);
const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
const vibre = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {   } };
const doux = () => (calme.matches ? 'auto' : 'smooth');
const dire = (debut, maintenant) => {
if (maintenant >= debut) return 'Le match a commencé.';
const min = Math.round((debut - maintenant) / 60000);
if (min > 720) return '';
if (min < 1) return 'Le match a commencé.';
const h = Math.floor(min / 60);
const m = min % 60;
return `dans ${h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`}`;
};
const rafraichir = () => {
const t = Date.now();
$$('.prog__etat').forEach((n) => {
const texte = dire(Date.parse(n.dataset.debut), t);
if (n.textContent !== texte) n.textContent = texte;
});
};
if ($('.prog__etat')) {
rafraichir();
setInterval(rafraichir, 30000);
}
const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const AVANCE_MS = 138 * 60000;
const PORTEE = 800;
let attente = 0;
let dernier = '';
const lumiere = () => {
attente = 0;
const p = calme.matches ? 1 : Math.min(1, Math.max(0, (window.pageYOffset || 0) / PORTEE));
const r = $('.prog__radio:checked');
const sc = r ? $(`.scene[data-i="${r.dataset.i}"]`) : $('.scene');
if (!sc) return;
const cle = `${Math.round(p * 200)}-${r ? r.dataset.i : 0}`;
if (cle === dernier) return;
dernier = cle;
const lu = $('.lueur', sc);
if (lu) lu.style.opacity = (p * 0.95).toFixed(3);
const h = $('.plan__heure', sc);
if (h) {
const texte = HEURE.format(new Date(Date.parse(h.dataset.debut) - (1 - p) * AVANCE_MS));
if (h.textContent !== texte) h.textContent = texte;
}
};
if ($('.plan__heure')) {
lumiere();
if (!calme.matches) {
window.addEventListener('scroll', () => { if (!attente) attente = requestAnimationFrame(lumiere); }, { passive: true });
}
}
const soir = $('.soir');
if (soir) {
soir.classList.add('js-ok');
const choisir = (id, defiler) => {
$$('.pin.est-choisi, .bar.est-choisi', soir).forEach((n) => n.classList.remove('est-choisi'));
if (!id) return;
const li = doc.getElementById(id);
const pin = $(`.pin[data-b="${id}"]`, soir);
if (!li) return;
li.classList.add('est-choisi');
if (pin) { pin.classList.add('est-choisi'); pin.parentNode.appendChild(pin); }
if (defiler) li.scrollIntoView({ behavior: doux(), block: 'nearest' });
};
soir.addEventListener('click', (ev) => {
const a = ev.target.closest('.pin, .bar__ligne');
if (!a) return;
ev.preventDefault();
const id = a.getAttribute('data-b');
const deja = doc.getElementById(id).classList.contains('est-choisi');
choisir(deja && a.classList.contains('bar__ligne') ? null : id, a.classList.contains('pin'));
});
const m = /^#(b\d+-[a-z0-9-]+)$/i.exec(location.hash);
if (m) {
const li = doc.getElementById(m[1]);
const sc = li && li.closest('.scene');
const radio = sc && $(`.prog__radio[data-i="${sc.dataset.i}"]`, soir);
if (radio) radio.checked = true;
choisir(m[1], false);
}
soir.addEventListener('change', (ev) => {
if (ev.target.name !== 'match') return;
const carton = $(`.prog[data-i="${ev.target.dataset.i}"]`, soir);
if (carton && carton.scrollIntoView) carton.scrollIntoView({ behavior: doux(), block: 'nearest', inline: 'center' });
choisir(null);
$$('.tenir.est-garde', soir).forEach((t) => { t.classList.remove('est-garde'); $('.tenir__suite', t).innerHTML = ''; });
$$('.pin.est-garde', soir).forEach((p) => p.classList.remove('est-garde'));
dernier = '';
lumiere();
});
$$('.tenir', soir).forEach((t) => {
const btn = $('[data-hold]', t);
const liq = $('.tenir__liq', t);
const suite = $('.tenir__suite', t);
const DUREE = 1100;
let debut = 0; let niveau = 0; let raf = 0; let tient = false;
btn.setAttribute('role', 'button');
btn.setAttribute('aria-label', 'Maintiens pour garder ta place, en démo');
const peins = () => { liq.style.transform = `translateY(${(101 - niveau * 101).toFixed(1)}%)`; };
const fini = () => {
tient = false; cancelAnimationFrame(raf); liq.style.transform = '';
t.classList.add('est-garde');
const pin = $(`.pin[data-b="${t.dataset.b}"]`, soir);
if (pin) { pin.classList.remove('est-garde'); void pin.getBoundingClientRect(); pin.classList.add('est-garde'); }
vibre(18);
suite.innerHTML = `Place gardée, en démo. Pour de vrai, l’appli arrive bientôt : <a href="${suite.dataset.attente}">préviens-moi</a>.`;
};
const monte = (now) => {
if (!tient) return;
niveau = Math.min(1, (now - debut) / DUREE);
peins();
if (niveau >= 1) { fini(); return; }
raf = requestAnimationFrame(monte);
};
const vide = () => {
if (!tient) return;
tient = false; cancelAnimationFrame(raf);
const depart = niveau; const t0 = performance.now();
const descend = (now) => {
if (tient) return;
niveau = Math.max(0, depart * (1 - (now - t0) / 280));
peins();
if (niveau > 0) raf = requestAnimationFrame(descend);
};
raf = requestAnimationFrame(descend);
};
const commence = () => {
if (t.classList.contains('est-garde')) return;
if (calme.matches) { fini(); return; }
tient = true; cancelAnimationFrame(raf);
debut = performance.now() - niveau * DUREE;
raf = requestAnimationFrame(monte);
};
btn.addEventListener('click', (ev) => { ev.preventDefault(); if (calme.matches || ev.detail === 0) commence(); });
btn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); try { btn.setPointerCapture(ev.pointerId); } catch (e) {   } commence(); });
btn.addEventListener('pointerup', vide);
btn.addEventListener('pointercancel', vide);
btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
btn.addEventListener('keydown', (ev) => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); commence(); } });
btn.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') vide(); });
});
}
$$('[data-copier]').forEach((b) => {
if (!(navigator.clipboard && navigator.clipboard.writeText)) return;
b.hidden = false;
const statut = $('.partage-site__statut', b.parentNode) || $('.partage-site__statut');
b.addEventListener('click', () => {
navigator.clipboard.writeText('https://baromatch.fr/').then(
() => { if (statut) statut.textContent = 'Lien copié.'; },
() => { if (statut) statut.textContent = 'Copie impossible : l’adresse est baromatch.fr.'; },
);
});
});
const album = $('.album');
if (album) {
if (calme.matches || !('IntersectionObserver' in window)) album.classList.add('est-pose');
else {
const o = new IntersectionObserver((es) => {
if (es.some((x) => x.isIntersecting)) { album.classList.add('est-pose'); o.disconnect(); }
}, { threshold: 0.6 });
o.observe(album);
}
}
})();
