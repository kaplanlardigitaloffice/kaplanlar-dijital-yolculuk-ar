# Kaplanlar WebAR V45 — Stable Launch

Bu sürüm ana sayfadaki çalışmama sorununu sadeleştirerek çözer:
- Deneyimi Başlat yalnızca standart `click` olayı kullanır.
- Pointer/touch çift event mantığı kaldırıldı.
- CSS / JS / video URL'lerine `?v=45` cache-busting eklendi.
- Service worker geçici olarak devre dışı bırakıldı; eski sürümün tarayıcıda kalması engellenir.
- Video sesli başlatılır; olmazsa muted, o da olmazsa native controls fallback çalışır.
