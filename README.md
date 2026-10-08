# Kaplanlar WebAR V54 — Live Assets

Bu sürüm manifest bağımlılığını kaldırır.

Uygulama her açılışta doğrudan public GitHub repository içeriğini okur:
- `assets/mascots/` içindeki tüm PNG/JPG/JPEG/WEBP dosyaları otomatik seçenek olur.
- `assets/` kökünde adı `mascot_` veya `maskot_` ile başlayan görseller de otomatik seçenek olur.
- Dosya SHA'sı URL'e eklenerek browser cache'i kırılır.
- GitHub API geçici olarak erişilemezse `assets/mascots.json` fallback'i kullanılır.
- O da yoksa ilk 3 maskot gösterilir.

En sorunsuz kullanım:
Yeni maskotları doğrudan `assets/mascots/` klasörüne atın.
Dosya adının ne olduğu önemli değildir.
GitHub Pages deployment tamamlandıktan sonra uygulamada Yenile'ye basın.
