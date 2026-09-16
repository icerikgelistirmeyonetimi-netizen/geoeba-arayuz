/* Sınıf ders bağlantıları. Tüm ada sayfaları bu ortak dosyayı okur.
   Anahtarlar: 1–12 arası sınıf numaraları ve Hazırlık için 'hazirlik'.
   Göreli adresler veya http(s) adresleri kullanılabilir. Bağlantısı olmayan
   sınıf seçildiğinde "İçerik bağlantısı henüz eklenmedi." paneli açılır.

   Örnek:
   window.GRADE_URLS = {
     1: '../dersler/1-sinif.html',
     hazirlik: '../dersler/hazirlik.html',
     9: 'https://ornek.org/matematik/9-sinif'
   };

   Kendi yönlendiricinizi kullanmak için iptal edilebilir 'grade-select' olayını dinleyin:
   window.addEventListener('grade-select', (e) => {
     e.preventDefault();
     const { grade, label, group, stage, building } = e.detail;
   });
*/
window.GRADE_URLS = window.GRADE_URLS || {};
