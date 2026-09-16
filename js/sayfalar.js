/**
 * Sayfa ve kademe tanımları. 3B sahne verisi (konumlar, kamera, ışık) Blender'dan
 * üretilen assets/data/<sayfa>.json dosyalarından okunur; burada yalnız metinler,
 * renkler ve sayfa bağlantıları bulunur.
 */

export const KADEMELER = [
  {
    id: 'ilkokul',
    ad: 'İlkokul',
    baslik: 'İlkokul Adası',
    aralik: '1–4. sınıf',
    href: 'ilkokul.html',
    renk: '#d9805f',
    ozet: 'Sayma atölyesi, geometrik galeri, üçgen stüdyo ve saat kulesi.',
  },
  {
    id: 'ortaokul',
    ad: 'Ortaokul',
    baslik: 'Ortaokul Adası',
    aralik: '5–8. sınıf',
    href: 'ortaokul.html',
    renk: '#2a9d94',
    ozet: 'Kesir rotundası, geometrik sera, veri terasları ve pergel kemerleri.',
  },
  {
    id: 'lise',
    ad: 'Lise',
    baslik: 'Lise Adası',
    aralik: 'Hazırlık + 9–12. sınıf',
    href: 'lise.html',
    renk: '#7f88c4',
    ozet: 'Açık kitap atölyesi, parabol salonu, sinüs stüdyosu, gözlemevi ve spiral kule.',
  },
];

/** Sınıf yapılarının adları; Blender'daki ERISIM_* köklerinin temsil ettiği binalar. */
export const SINIF_YAPILARI = {
  1: 'Sayma Atölyesi',
  2: 'Geometrik Galeri',
  3: 'Üçgen Stüdyo',
  4: 'Saat ve Abaküs Kulesi',
  5: 'Kesir Rotundası',
  6: 'Geometrik Sera',
  7: 'Veri Terasları',
  8: 'Pergel Kemerleri',
  hazirlik: 'Açık Kitap Atölyesi',
  9: 'Parabol Salonu',
  10: 'Sinüs Stüdyosu',
  11: 'Gözlemevi',
  12: 'Spiral Kule',
};

export const SINIF_SIRASI = {
  ilkokul: [1, 2, 3, 4],
  ortaokul: [5, 6, 7, 8],
  lise: ['hazirlik', 9, 10, 11, 12],
};

export function kademe(id) {
  return KADEMELER.find((k) => k.id === id) || null;
}

export function sinifAdi(grade) {
  return grade === 'hazirlik' ? 'Hazırlık' : `${grade}. Sınıf`;
}
