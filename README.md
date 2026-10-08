# Kaplanlar WebAR V58 — Doğru Konsept Klasör Yapısı

Bu paket V57'nin düzenlenmiş halidir.

## Hazır klasör yapısı

assets/
└─ mascots/
   ├─ kurumsal/
   │  ├─ mascot_01.png
   │  ├─ mascot_02.png
   │  └─ mascot_03.png
   ├─ 90lar/
   │  └─ .gitkeep
   ├─ lansman/
   │  └─ .gitkeep
   └─ ofis/
      └─ .gitkeep

## Davranış
- Mevcut 3 maskot artık **Kurumsal** konseptindedir.
- `90lar`, `lansman`, `ofis` klasörleri boş olduğu için uygulamada görünmez.
- Bu klasörlerden birine PNG/JPG/JPEG/WEBP eklediğin anda ilgili konsept görünür.
- `.gitkeep` dosyaları uygulamada maskot sayılmaz.
- `assets/mascots/` kökünde maskot kalmadığı için **Genel** konsepti görünmez.

Örnek:
`assets/mascots/90lar/dj.png` eklenirse uygulamada **90'lar** konsepti görünür.
