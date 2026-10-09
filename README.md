# Kaplanlar WebAR V60 — Embedded Concepts

Bu sürüm konsept ve maskot listesini GitHub API, GitHub Action veya mascots.json üzerinden okumaz.

Doğrudan aşağıdaki dosyaları kontrol eder:

Kurumsal:
- assets/mascots/kurumsal/mascot_01.png
- ...
- assets/mascots/kurumsal/mascot_11.png

90's Party:
- assets/mascots/90lar/mascot_90_01.png

Davranış:
- Dosya gerçekten mevcutsa maskot gösterilir.
- Konseptte tek bir geçerli görsel bile yoksa konsept gizlenir.
- Kurumsal klasöründe 11 dosyanın hepsi mevcutsa 11 seçenek görünür.
- GitHub API / Actions / JSON parse / cache sorunları devreden çıkarılmıştır.

Yeni maskot eklerken bu sürümde app.js içindeki EMBEDDED_CONCEPTS listesine yol eklemek gerekir.
Bu sürüm öncelikle mevcut konsept ekranını kararlı şekilde çalıştırmak için hazırlanmıştır.
