/**
 * Matematik Takımadaları — sayfa arayüzü.
 * <body data-sayfa="ana-sayfa|ilkokul|ortaokul|lise"> değerine göre başlık, kademe/sınıf
 * rıhtımı, 3B etiketler, sınıf paneli ve sayfa geçişlerini kurar.
 */
import { AdaSahnesi } from './sahne.js';
import { KADEMELER, FENER, SINIF_YAPILARI, SINIF_SIRASI, kademe, sinifAdi } from './sayfalar.js';

// HTML'deki yedek uyarı, modül hiç çalışmazsa (file://, import map desteği yok) gösterilir
window.adalarBasladi = true;

const SAYFA = document.body.dataset.sayfa || 'ana-sayfa';
const ANA = SAYFA === 'ana-sayfa';
const KADEME = ANA ? null : kademe(SAYFA);
const DOKUNMATIK = matchMedia('(pointer: coarse)').matches;
const AZ_HAREKET = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sec, kok = document) => kok.querySelector(sec);

function el(etiket, ozellik = {}, ...cocuklar) {
  const e = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') {
      // Özel CSS değişkenleri Object.assign ile atanamaz; setProperty gerekir
      for (const [ad, deger] of Object.entries(v)) {
        if (ad.startsWith('--')) e.style.setProperty(ad, deger);
        else e.style[ad] = deger;
      }
    } else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of cocuklar.flat()) if (c != null) e.append(c);
  return e;
}

const ikon = {
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  geri: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H5m4.5-4.5L5 10l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sifirla: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  kapat: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  marka: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#f6efe0"/><path d="M6 20.5c3-1.6 6.5-1.6 10 0s7 1.6 10 0" fill="none" stroke="#2a8f8f" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 18l4.2-8.2 3.4 5.6 1.9-2.6 3.5 5.2" fill="none" stroke="#1d3a37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21.5" cy="9.5" r="1.8" fill="#c99a52"/></svg>',
};

// ---------------------------------------------------------------------------
// İskelet
// ---------------------------------------------------------------------------
const kok = document.body;
kok.classList.add('js');
if (KADEME) kok.style.setProperty('--vurgu', KADEME.renk);

const sahneKap = $('#sahne');
const etiketKatmani = el('div', { class: 'etiketler', 'aria-hidden': 'true' });
const canli = el('p', { class: 'gorunmez', 'aria-live': 'polite' });

const ustAlan = el(
  'header',
  { class: 'ust' },
  el(
    'div',
    { class: 'ust-sol' },
    ANA
      ? el('p', { class: 'marka' }, el('span', { class: 'marka-ikon', html: ikon.marka }), el('span', { text: 'GeoEBA' }))
      : el('a', { class: 'geri-baglanti', href: 'index.html', 'data-gecis': '' }, el('span', { html: ikon.geri }), el('span', { text: 'Tüm adalar' })),
    el('p', { class: 'ust-yazi', text: ANA ? 'Matematik · Kademe seçimi' : `GeoEBA · ${KADEME.ad}` }),
    el('h1', { class: 'baslik', text: ANA ? 'Matematik Takımadaları' : KADEME.baslik }),
    el('p', {
      class: 'aciklama',
      text: ANA ? 'Kademeni seç, adasına geç.' : `${KADEME.aralik} · Girmek istediğin sınıfın binasını seç.`,
    })
  ),
  ANA
    ? null
    : el(
        'nav',
        { class: 'sekmeler', 'aria-label': 'Kademeler' },
        KADEMELER.map((k) =>
          el(
            'a',
            {
              class: 'sekme',
              href: k.href,
              'data-gecis': '',
              'aria-current': k.id === SAYFA ? 'page' : null,
              style: { '--sekme-renk': k.renk },
            },
            el('span', { class: 'sekme-nokta' }),
            el('span', { text: k.ad })
          )
        )
      )
);

const rihtim = el('nav', {
  class: `rihtim ${ANA ? 'rihtim--kademe' : 'rihtim--sinif'}`,
  'aria-label': ANA ? 'Kademe adaları' : `${KADEME.baslik} sınıfları`,
});

const kontroller = el(
  'div',
  { class: 'kontroller' },
  el('p', {
    class: 'ipucu',
    text: DOKUNMATIK ? 'Tek parmak: çevir · İki parmak: yakınlaş' : 'Sürükle: çevir · Tekerlek: yakınlaş · Sağ tık: kaydır',
  }),
  el('button', { class: 'yuvarlak-dugme', type: 'button', 'aria-label': 'Görünümü sıfırla', title: 'Görünümü sıfırla', html: ikon.sifirla })
);

const yukleyici = el(
  'div',
  { class: 'yukleyici', role: 'status' },
  el(
    'div',
    { class: 'yukleyici-ic' },
    el('span', { class: 'yukleyici-ikon', html: ikon.marka }),
    el('p', { class: 'yukleyici-baslik', text: ANA ? 'Matematik Takımadaları' : KADEME.baslik }),
    el('p', { class: 'yukleyici-durum', text: 'Adalar hazırlanıyor…' }),
    el('div', { class: 'ilerleme', 'aria-hidden': 'true' }, el('span', { class: 'ilerleme-dolgu' }))
  )
);
const perde = el('div', { class: 'perde', 'aria-hidden': 'true' });

const panel = el(
  'aside',
  { class: 'panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'panel-baslik', hidden: true, tabindex: '-1' },
  el('button', { class: 'panel-kapat', type: 'button', 'aria-label': 'Kapat', html: ikon.kapat }),
  el('p', { class: 'ust-yazi panel-kademe' }),
  el('div', { class: 'panel-ust' }, el('span', { class: 'rozet panel-rozet' }), el('h2', { id: 'panel-baslik', class: 'panel-baslik' })),
  el('p', { class: 'panel-not' }),
  el(
    'div',
    { class: 'panel-eylemler' },
    el('button', { class: 'dugme dugme--birincil panel-don', type: 'button', text: 'Adaya dön' })
  )
);

const icerik = el(
  'main',
  { class: 'icerik', 'aria-labelledby': 'sayfa-basligi' },
  el('p', { class: 'gorunmez', text: sahneKap.dataset.aciklama || '' }),
  rihtim,
  kontroller,
  panel,
  canli
);
$('h1', ustAlan).id = 'sayfa-basligi';

sahneKap.after(etiketKatmani);
kok.append(el('div', { class: 'ust-golge', 'aria-hidden': 'true' }), ustAlan, icerik, yukleyici, perde);

// Sahne hazır olana kadar görünmeyen arayüz klavyeyle de erişilemesin
ustAlan.inert = rihtim.inert = kontroller.inert = true;

// ---------------------------------------------------------------------------
// Sahne
// ---------------------------------------------------------------------------
const renkler = { ...Object.fromEntries(KADEMELER.map((k) => [k.id, k.renk])), [FENER.id]: FENER.renk };
let sahne = null;
let hazir = false;
let gecisSuruyor = false;
/** Her yeni seçimde artar; bekleyen bir gidiş daha yeni bir seçim yapıldıysa iptal edilir. */
let secimNo = 0;
/** Ana sayfada kamera Matematik Feneri'ne yaklaşmışken true. */
let fenerOdakta = false;

function bosluklar() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ust = ustAlan.getBoundingClientRect();
  const alt = rihtim.getBoundingClientRect();
  // Geniş ekranda başlık sol üst köşede kalır; adalar ortada olduğundan üst boşluk küçük tutulur
  const genis = w >= 1100 && h >= 560;
  const ustBosluk = genis ? (ANA ? 24 : Math.min(ust.bottom, 110) + 8) : ust.bottom + 8;
  return {
    top: ustBosluk,
    // Ana sayfada kademe kartları görünmez (yalnız klavye odağında belirir); alt boşluk gerekmez
    bottom: ANA ? 16 : Math.max(0, h - alt.top) + 10,
    left: 0,
    right: 0,
  };
}

function webglVar() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

async function baslat() {
  rihtimKur();
  if (!webglVar()) {
    yukleyiciHata('Bu tarayıcı 3B görünümü desteklemiyor. Aşağıdaki bağlantılarla devam edebilirsin.', false);
    return;
  }
  sahne = new AdaSahnesi(sahneKap, { sayfa: SAYFA, renkler, bosluklar });
  window.adalarSahnesi = sahne;
  const dolgu = $('.ilerleme-dolgu', yukleyici);
  try {
    await sahne.yukle((oran) => {
      dolgu.style.transform = `scaleX(${Math.max(0.04, oran).toFixed(3)})`;
    });
  } catch (hata) {
    console.error(hata);
    yukleyiciHata('Sahne yüklenemedi. Bağlantını kontrol edip yeniden dene.', true);
    return;
  }
  dolgu.style.transform = 'scaleX(1)';
  sahneOlaylari();
  etiketleriKur();
  hazir = true;
  ustAlan.inert = rihtim.inert = kontroller.inert = false;
  kok.classList.add('hazir');
  yukleyici.classList.add('yukleyici--kapan');
  setTimeout(() => {
    if (yukleyici.classList.contains('yukleyici--kapan')) yukleyici.remove();
  }, 900);
  await sahne.giris();
  sahne.tanit();
}

function yukleyiciHata(mesaj, tekrar) {
  // Sahne yüklendikten sonra (ör. grafik bağlamı kaybı) yükleyici kaldırılmış olabilir
  yukleyici.classList.remove('yukleyici--kapan');
  if (!yukleyici.isConnected) kok.append(yukleyici);
  $('.yukleyici-durum', yukleyici).textContent = mesaj;
  yukleyici.classList.add('yukleyici--hata');
  if (tekrar && !$('.dugme', yukleyici)) {
    $('.yukleyici-ic', yukleyici).append(
      el('button', { class: 'dugme dugme--birincil', type: 'button', text: 'Yeniden dene', onclick: () => location.reload() })
    );
  }
  canli.textContent = mesaj;
  // 3B olmadan da gezinilebilsin: başlık ve rıhtım yükleyicinin üstünde, normal akışta
  ustAlan.inert = rihtim.inert = false;
  kontroller.hidden = true;
  etiketKatmani.hidden = true;
  kok.classList.add('sahnesiz');
}

function sahneOlaylari() {
  sahne.addEventListener('uzerinde', (e) => {
    const g = e.detail.giris;
    rihtim.querySelectorAll('[data-id]').forEach((b) => b.classList.toggle('aktif', !!g && String(g.id) === b.dataset.id));
  });
  sahne.addEventListener('sec', (e) => {
    const g = e.detail.giris;
    if (g.tur === 'landmark') fenerSec();
    else if (ANA) kademeyeGit(kademe(g.id));
    else sinifSec(g.id, null);
  });
  // Fenere yaklaşılmışken boş denize tıklamak genel görünüme döndürür
  sahne.addEventListener('bosluk', () => {
    if (fenerOdakta) fenerdenDon();
  });
  sahne.addEventListener('etkilesim', () => kok.classList.add('etkilesildi'));
  sahne.addEventListener('hata', (e) => yukleyiciHata(e.detail.mesaj, true));
  $('.yuvarlak-dugme', kontroller).addEventListener('click', () => {
    secimNo += 1;
    fenerOdakta = false;
    panelKapat(false);
    secimiTemizle();
    sahne.sifirla();
  });
}

// ---------------------------------------------------------------------------
// Rıhtım (alt gezinti) ve etiketler
// ---------------------------------------------------------------------------
function vurguBagla(oge, id) {
  const ac = () => hazir && sahne.vurgula(id);
  const kapa = () => hazir && sahne.vurgula(null);
  oge.addEventListener('pointerenter', ac);
  oge.addEventListener('pointerleave', kapa);
  oge.addEventListener('focus', ac);
  oge.addEventListener('blur', kapa);
}

function rihtimKur() {
  // Dar ekranda yatay kayan rıhtımda klavye odağı görünür alana gelsin
  rihtim.addEventListener('focusin', (e) => {
    e.target.closest('.kart, .sinif')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });
  if (ANA) {
    for (const k of KADEMELER) {
      const kart = el(
        'a',
        { class: 'kart', href: k.href, 'data-id': k.id, style: { '--kart-renk': k.renk } },
        el('span', { class: 'kart-serit', 'aria-hidden': 'true' }),
        el(
          'span',
          { class: 'kart-govde' },
          el('span', { class: 'kart-baslik', text: k.baslik }),
          el('span', { class: 'kart-aralik', text: k.aralik }),
          el('span', { class: 'kart-ozet', text: k.ozet })
        ),
        el('span', { class: 'kart-ok', html: ikon.ok })
      );
      kart.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        kademeyeGit(k);
      });
      vurguBagla(kart, k.id);
      rihtim.append(kart);
    }
    return;
  }
  const liste = el('ul', { class: 'sinif-listesi' });
  for (const g of SINIF_SIRASI[SAYFA]) {
    const dugme = el(
      'button',
      { class: 'sinif', type: 'button', 'data-id': String(g), 'aria-pressed': 'false' },
      el('span', { class: 'rozet', text: g === 'hazirlik' ? 'H' : String(g), 'aria-hidden': 'true' }),
      el('span', { class: 'sinif-ad', text: sinifAdi(g) })
    );
    dugme.addEventListener('click', () => sinifSec(g, dugme));
    vurguBagla(dugme, g);
    liste.append(el('li', {}, dugme));
  }
  rihtim.append(liste);
}

function etiketleriKur() {
  // Ana sayfada etiket yok: adaların adları sahnedeki tabelalarda yazılı
  if (ANA) return;
  for (const g of SINIF_SIRASI[SAYFA]) {
    const etiket = el(
      'div',
      { class: 'etiket etiket--sinif' },
      el(
        'button',
        { class: 'etiket-ic', type: 'button', tabindex: '-1', onclick: () => sinifSec(g, null) },
        el('span', { class: 'etiket-ad', text: sinifAdi(g) }),
        el('span', { class: 'etiket-ok', html: ikon.ok })
      ),
      el('span', { class: 'etiket-sap' })
    );
    etiketKatmani.append(etiket);
    sahne.etiketBagla(g, etiket);
  }
}

// ---------------------------------------------------------------------------
// Gezinti
// ---------------------------------------------------------------------------
function gecisYap(adres) {
  if (gecisSuruyor) return;
  const hedef = new URL(adres, location.href);
  // Aynı belge içinde yalnız çapa değişiyorsa perde açılmaz (belge boşaltılmaz)
  if (hedef.hash && hedef.href.split('#')[0] === location.href.split('#')[0]) {
    location.href = hedef.href;
    return;
  }
  gecisSuruyor = true;
  perde.classList.add('perde--acik');
  setTimeout(() => {
    location.href = hedef.href;
    // Gezinme gerçekleşmezse (indirme, engelleme) arayüz kilitli kalmasın
    setTimeout(() => {
      gecisSuruyor = false;
      perde.classList.remove('perde--acik');
    }, 5000);
  }, AZ_HAREKET ? 0 : 420);
}

/** En fazla `ms` kadar bekler; kamera odaklanması bitmese de gezinti ilerler. */
const enFazla = (soz, ms) => Promise.race([soz, new Promise((r) => setTimeout(r, ms))]);

async function kademeyeGit(k) {
  if (!k || gecisSuruyor) return;
  const no = ++secimNo;
  canli.textContent = `${k.baslik} açılıyor.`;
  if (hazir) {
    sahne.kilitle(k.id);
    await enFazla(sahne.odaklan(k.id, { sure: 950 }), 1000);
    if (no !== secimNo) return;
  }
  gecisYap(k.href);
}

/** Matematik Feneri bir sayfa açmaz; kamera fenere yaklaşır, boş denize tıklayınca ya da Esc ile geri döner. */
function fenerSec() {
  if (!hazir || gecisSuruyor) return;
  if (fenerOdakta) {
    fenerdenDon();
    return;
  }
  secimNo += 1;
  fenerOdakta = true;
  sahne.kilitle(FENER.id);
  sahne.odaklan(FENER.id, { sure: 1200 });
  canli.textContent = `${FENER.ad}. Genel görünüme dönmek için Escape tuşuna bas.`;
}

function fenerdenDon() {
  fenerOdakta = false;
  secimNo += 1;
  sahne.kilitle(null);
  sahne.sifirla();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-gecis]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  if (a.getAttribute('aria-current') === 'page') {
    secimNo += 1;
    panelKapat(false);
    secimiTemizle();
    if (hazir) sahne.sifirla();
    return;
  }
  gecisYap(a.href);
});

function gecerliAdres(deger) {
  if (typeof deger !== 'string' || !deger.trim()) return null;
  try {
    const url = new URL(deger.trim(), location.href);
    const izinli = location.protocol === 'file:' ? ['http:', 'https:', 'file:'] : ['http:', 'https:'];
    return izinli.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

let panelAcan = null;

function secimiTemizle() {
  rihtim.querySelectorAll('.sinif').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (hazir) sahne.kilitle(null);
}

async function sinifSec(grade, acan) {
  if (gecisSuruyor) return;
  const detay = {
    grade,
    label: sinifAdi(grade),
    group: KADEME.ad,
    stage: KADEME.id,
    building: SINIF_YAPILARI[grade],
  };
  const devam = window.dispatchEvent(new CustomEvent('grade-select', { detail: detay, cancelable: true }));
  // Olay iptal edildiyse yönlendirmeyi uygulama üstlenir; sahne ve düğme durumu değişmez
  if (!devam) return;
  const no = ++secimNo;
  rihtim.querySelectorAll('.sinif').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === String(grade))));
  if (hazir) sahne.kilitle(grade);

  const baglantilar = window.GRADE_URLS || {};
  const adres = gecerliAdres(baglantilar[grade] ?? baglantilar[String(grade)]);
  if (adres) {
    canli.textContent = `${detay.label} açılıyor.`;
    if (hazir) {
      await enFazla(sahne.odaklan(grade, { sure: 900 }), 950);
      if (no !== secimNo) return;
    }
    gecisYap(adres);
    return;
  }
  panelAc(grade, acan || document.activeElement);
  if (hazir) sahne.odaklan(grade, { kaymaPx: panelKaymasi() });
}

/** Açık panelin kapattığı alanı hesaba katarak binanın görüneceği ekran kayması. */
function panelKaymasi() {
  const r = panel.getBoundingClientRect();
  // Panel sağ kenardaysa (geniş ya da alçak ekran) bina sola, alttaysa yukarı kaydırılır
  const yanda = r.left > window.innerWidth * 0.3;
  if (yanda) return { x: -(r.width + 24) / 2, y: 0 };
  return { x: 0, y: -Math.min(r.height, window.innerHeight * 0.5) / 2 };
}

function panelAc(grade, acan) {
  if (acan instanceof HTMLElement && acan !== document.body && !panel.contains(acan)) panelAcan = acan;
  panel.style.setProperty('--vurgu', KADEME.renk);
  $('.panel-kademe', panel).textContent = KADEME.baslik;
  $('.panel-rozet', panel).textContent = grade === 'hazirlik' ? 'H' : String(grade);
  $('.panel-baslik', panel).textContent = sinifAdi(grade);
  $('.panel-not', panel).textContent = 'İçerik bağlantısı henüz eklenmedi.';
  panel.hidden = false;
  kok.classList.add('panel-acik');
  requestAnimationFrame(() => panel.classList.add('panel--acik'));
  panel.focus({ preventScroll: true });
  canli.textContent = `${sinifAdi(grade)} seçildi. İçerik bağlantısı henüz eklenmedi.`;
}

function panelKapat(odakDon = true) {
  if (panel.hidden) return;
  panel.classList.remove('panel--acik');
  kok.classList.remove('panel-acik');
  secimiTemizle();
  setTimeout(() => {
    // Bu arada panel yeniden açıldıysa gizleme
    if (!kok.classList.contains('panel-acik')) panel.hidden = true;
  }, 320);
  if (odakDon && panelAcan && document.contains(panelAcan)) panelAcan.focus({ preventScroll: true });
  panelAcan = null;
}

function paneliKapatVeDon() {
  secimNo += 1;
  panelKapat();
  if (hazir) sahne.sifirla();
}

$('.panel-kapat', panel).addEventListener('click', paneliKapatVeDon);
$('.panel-don', panel).addEventListener('click', paneliKapatVeDon);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!panel.hidden) paneliKapatVeDon();
  else if (fenerOdakta) fenerdenDon();
});

// Geri tuşuyla önbellekten (bfcache) dönüldüğünde geçiş ve seçim durumunu temizle
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  gecisSuruyor = false;
  secimNo += 1;
  fenerOdakta = false;
  perde.classList.remove('perde--acik');
  panelKapat(false);
  secimiTemizle();
  canli.textContent = '';
  if (hazir) {
    sahne.vurgula(null);
    sahne.fareUzerindeAyarla(null);
    sahne.sifirla(10);
  }
});

baslat();
