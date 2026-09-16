# Matematik Takımadaları — 3B ada sayfaları

Blender sahnelerinden (`../matematik-kademe-sayfalari/*.blend`) dışa aktarılan modellerle çalışan,
Three.js tabanlı tam sayfa ada seçimi.

| Sayfa | Blender kaynağı | İçerik |
| --- | --- | --- |
| `index.html` | `ana-sayfa.blend` | Üç ada; adaya tıklayınca kademe sayfası açılır |
| `ilkokul.html` | `ilkokul-ada.blend` | 1–4. sınıf binaları |
| `ortaokul.html` | `ortaokul-ada.blend` | 5–8. sınıf binaları |
| `lise.html` | `lise-ada.blend` | Hazırlık ve 9–12. sınıf binaları |

## Çalıştırma

ES modülleri ve GLB dosyaları `file://` üzerinden yüklenemez; klasörü bir yerel sunucuyla açın:

```bash
python -m http.server 5180 --directory matematik-adalar-3d
```

Ardından `http://localhost:5180` adresini açın. Three.js ve Draco çözücü `vendor/` klasöründedir;
internet yalnız Google Fonts için kullanılır (bağlantı yoksa sistem yazı tiplerine düşer).

## Etkileşim

- **Ana sayfa:** Adanın üzerine gelmek adayı ve alttaki kartı vurgular; tıklamak kamerayı adaya yaklaştırıp kademe sayfasını açar.
- **Kademe sayfası:** Bina veya alttaki sınıf düğmesi aynı seçimi yapar. `GRADE_URLS` içinde adres varsa o sayfaya gidilir; yoksa “İçerik bağlantısı henüz eklenmedi.” paneli açılır.
- Sürükle: çevir · Tekerlek / iki parmak: yakınlaş · Sağ tık: kaydır · Esc: paneli kapat.
- `?kalite=dusuk` veya `?kalite=yuksek` ile görüntü kalitesi zorlanabilir. Kare hızı düşükse ortam kapatması (AO) ve piksel oranı kendiliğinden düşürülür.

## Ders bağlantıları

`grade-urls.js` dosyasını düzenleyin. Anahtarlar `1`–`12` ve Hazırlık için `hazirlik`:

```js
window.GRADE_URLS = {
  1: '../dersler/1-sinif.html',
  hazirlik: '../dersler/hazirlik.html',
};
```

Kendi yönlendiricinizi kullanmak için iptal edilebilir `grade-select` olayını dinleyin.
`event.detail`: `{ grade, label, group, stage, building }`.

```js
window.addEventListener('grade-select', (event) => {
  event.preventDefault();
  router.push(`/matematik/${event.detail.grade}`);
});
```

## Modelleri Blender'dan yeniden üretme

Sahneler değişirse (Blender 4.4):

```bash
blender -b ../matematik-kademe-sayfalari/ana-sayfa.blend --python blender/web_aktar.py -- assets ana-sayfa
blender -b ../matematik-kademe-sayfalari/ilkokul-ada.blend --python blender/web_aktar.py -- assets ilkokul
blender -b ../matematik-kademe-sayfalari/ortaokul-ada.blend --python blender/web_aktar.py -- assets ortaokul
blender -b ../matematik-kademe-sayfalari/lise-ada.blend --python blender/web_aktar.py -- assets lise
```

Betik `.blend` dosyasını kaydetmez. Yaptıkları:

1. Render'da görünen tüm geometriyi değiştiricileri uygulanmış hâliyle alır; eğri/yazı çözünürlüğünü ve çok ince pahları web için azaltır.
2. Nesneleri tıklanabilir gruplara göre birleştirir: ana sayfada `ADA_*` kökleri (`stage:*`), kademe sayfalarında `ERISIM_*` kökleri (`grade:*`), yelkenli ve şamandıralar (`float:*`), geri kalanı `static`.
3. Prosedürel Cycles malzemelerini renk rampası ortalamasıyla düz PBR değerlerine çevirir (`kind`: glass, metal, foliage, emissive, water, solid).
4. Deniz malzemesinin kıyıdan derine renk geçişini `assets/textures/deniz-*.png` dokusuna pişirir; dalgalar tarayıcıda gölgelendiricide üretilir.
5. Kamera, ışıklar, grup sınırları ve tabela konumlarını `assets/data/*.json` dosyasına yazar.

## Dosyalar

```
index.html, ilkokul.html, ortaokul.html, lise.html
grade-urls.js           Sınıf ders bağlantıları
css/adalar.css          Arayüz
js/arayuz.js            Başlık, rıhtım, etiketler, panel, sayfa geçişleri
js/sahne.js             Three.js sahnesi: yükleme, ışık, deniz, seçim, kamera
js/sayfalar.js          Kademe/sınıf metinleri ve renkleri
assets/models/*.glb     Draco sıkıştırılmış sahneler
assets/textures/*.png   Pişirilmiş deniz renkleri
assets/data/*.json      Kamera, ışık ve grup verisi
blender/web_aktar.py    Blender → web dışa aktarım betiği
vendor/three/           Three.js r170 ve gerekli eklentiler
```
