---
title: Known Issues Produksi
sidebar_label: Known Issues Produksi
---


# Tujuan

Halaman ini khusus untuk known issues di area produksi, agar tidak bercampur dengan known issues umum.

## Known Issues Saat Ini

### 1. Validasi Variant Belum Final
Semua skenario variant pada:
- BOM,
- Production Orders,
- Work Log,
belum tervalidasi penuh.

### 2. Rollback dan Cancel Belum Lengkap
Flow cancel / rollback untuk order atau work log belum sepenuhnya tervalidasi di semua skenario.

### 3. Logic Produksi Masih Aktif Bergerak
Beberapa file produksi masih aktif berubah, sehingga dokumentasi implementasi detail perlu diperiksa berkala.

### 4. Potensi Sisa Flow Legacy
Project sempat punya jalur lama dan jalur baru hidup bersamaan. Walau sudah diarahkan untuk cleanup, perlu cek berkala agar tidak ada fungsi lama yang diam-diam masih terpakai. Hal ini sebelumnya memang sudah diidentifikasi pada handoff project. fileciteturn14file10L11-L24

### 5. Import / Mismatch Pernah Muncul
Pernah muncul error import pada helper produksi terhadap `productionWorkLogOptions`, sehingga file helper produksi perlu terus dijaga sinkron dengan constants terbaru. fileciteturn14file4L17-L22
