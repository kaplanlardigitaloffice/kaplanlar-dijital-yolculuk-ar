# Kaplanlar WebAR V41 — Gateway Center Fix

Bu sürümde video sonrası açılan artırılmış gerçeklik geçiş ekranındaki sola kayma problemi düzeltildi.

Kök neden:
Eski `enter-ar-panel` stillerinden kalan `left:50%` ve `transform:translateX(-50%)` kuralları,
V40 tam ekran gateway tasarımıyla çakışıyordu.

Düzeltme:
- panel `inset:0` ile viewport'a sabitlendi
- legacy `left / bottom / transform` kuralları hard reset edildi
- desktop ve mobile için merkezleme yeniden tanımlandı
- mobilde yatay taşma kapatıldı
