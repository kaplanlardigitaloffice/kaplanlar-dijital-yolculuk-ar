# Kaplanlar Dijital Dönüşüm Yolculuğu — WebAR MVP

Bu proje, QR kod ile açılabilecek mobil WebAR deneyimidir. Uygulama yüklemeden çalışır.

## Deneyim
1. Kullanıcı QR kodu telefon kamerasıyla okutur.
2. HTTPS üzerinden bu web sayfası açılır.
3. `AR DENEYİMİNİ BAŞLAT` düğmesine dokunur ve kamera izni verir.
4. Kamerada masa/zemin üzerinde bir noktaya dokunur.
5. Kaplanlar maskotu 6 karelik yürüyüş animasyonuyla belirir, ardından el sallama pozuna geçer.
6. `Kaplanlar Dijital Dönüşüm Yolculuğu` holografik başlığı ve dijital rota düğmesi görünür.
7. Maskot sürüklenebilir; iki parmakla ölçeklenebilir.

## Yayına alma
Kamera erişimi için site HTTPS olmalıdır. GitHub Pages veya Cloudflare Pages uygundur.

### GitHub Pages
- Yeni bir repository oluşturun.
- Bu klasörün içeriğini repository köküne yükleyin.
- Settings > Pages > Deploy from a branch > main / root seçin.
- Oluşan `https://<kullanici>.github.io/<repo>/` adresini QR koda dönüştürün.

## Önemli teknik not
Bu MVP "camera-overlay WebAR" yaklaşımıdır: maskot canlı kamera görüntüsünün üzerine yerleştirilir ve kullanıcı dokunarak konumlandırır. Gerçek yüzey algılama / SLAM / world tracking isteyen ikinci sürüm için WebXR hit-test (desteklenen Android cihazlarda) veya 8th Wall / ZapWorks / AR.js-MindAR gibi bir AR katmanı entegre edilmelidir.

## Dosyalar
- `index.html` — uygulama yapısı
- `styles.css` — arayüz ve holografik AR görünümü
- `app.js` — kamera, yerleştirme, animasyon, sürükleme ve pinch-scale
- `assets/mascot_1..7.png` — maskot animasyon kareleri
- `manifest.webmanifest`, `sw.js` — PWA/offline önbellek
