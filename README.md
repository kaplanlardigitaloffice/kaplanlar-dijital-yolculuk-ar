# Kaplanlar WebAR V47 — Direct Onclick

Bu sürümde video başlatma için event listener zinciri tamamen kaldırıldı.

- Ana butonda doğrudan HTML `onclick` kullanılır.
- Başlatma fonksiyonu `<head>` içinde global olarak tanımlıdır.
- `app.js` video başlatma işine artık karışmaz.
- Kapaktaki ikinci maskot kaldırıldı; videodaki ana maskot görüntüsü kullanılır.
- Mobil kapak daha temiz ve tek kolonlu hale getirildi.
- Sesli -> sessiz -> native controls fallback sırası korunur.
