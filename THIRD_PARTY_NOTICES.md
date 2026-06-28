# Third-Party Notices

IMS Bunga Flanel menggunakan paket open-source pihak ketiga pada aplikasi backend dan frontend.
Hak cipta dan lisensi setiap paket tetap dimiliki oleh pemegang hak masing-masing.

## Font Inter

- Package: `@fontsource-variable/inter`
- Fungsi: menyediakan font Inter Variable sebagai asset lokal/self-hosted untuk frontend IMS.
- Lisensi: SIL Open Font License 1.1 (`OFL-1.1`).
- Runtime: dibundel oleh Vite dan tidak mengambil font dari Google Fonts/CDN.

Inventaris dependency yang dapat diaudit dihasilkan dari lockfile dengan:

```bash
npm run sbom
```

Perintah tersebut membuat CycloneDX SBOM untuk backend dan frontend di `.artifacts/sbom/`.
Folder tersebut merupakan artifact build/audit dan tidak dimasukkan ke source ZIP.

Lisensi proyek IMS sendiri belum ditetapkan dalam source ini. Distribusi publik atau open-source
harus menunggu keputusan lisensi eksplisit dari pemilik proyek; dokumen ini tidak memberikan
lisensi atas source IMS.
