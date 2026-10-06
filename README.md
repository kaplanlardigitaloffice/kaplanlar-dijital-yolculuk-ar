# Kaplanlar WebAR V50 — Auto Asset Discovery

V49'daki sorun giderildi.

Neden:
- Eski sürüm `mascot_01.png`, `mascot_02.png`... sırasını tarıyordu.
- 4 ardışık dosya bulunamayınca taramayı kesiyordu.
- Bu nedenle örneğin mascot_08.png gibi arada boşluk olan yeni dosyalar görünmüyordu.
- Ayrıca statik GitHub Pages klasör içeriğini normal JavaScript ile listeleyemez.

V50:
- Public GitHub repository'nin `assets` klasörünü GitHub API üzerinden canlı okur.
- `mascot_` veya `maskot_` ile başlayan PNG/JPG/WebP dosyalarını otomatik seçiciye ekler.
- Dosya SHA'sını query string olarak kullanarak eski görsel cache'ini kırar.
- GitHub API erişilemezse mascot_01.png–mascot_60.png aralığının tamamını tarar.
- Kamera ekranında “Yenile” butonu vardır.

Yeni dosya örnekleri:
- assets/mascot_04.png
- assets/mascot_yapayzeka.png
- assets/maskot_selamlama.webp

GitHub Pages deploy tamamlandıktan sonra Yenile'ye basıldığında yeni maskot görünür.
