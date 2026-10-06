# Kaplanlar WebAR V46 — Direct Launch

Bu sürümde ana sayfadaki video başlatma, app.js'den bağımsız hale getirildi.

- “Deneyimi Başlat” butonu doğrudan index.html içindeki küçük inline controller ile çalışır.
- app.js yüklenmese veya cache problemi yaşansa bile kapak kapanır ve video oynatma denenir.
- Önce sesli, sonra sessiz oynatma denenir.
- Son fallback olarak native video kontrolleri görünür.
- Video bitince AR geçiş ekranı doğrudan açılır.
