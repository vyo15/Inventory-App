# BACKEND ERROR CONTRACT — IMS Bunga Flanel

Status: **AKTIF / SOURCE-VERIFIED / COMPATIBILITY-SAFE**
Tanggal validasi: **2026-06-29**

## Tujuan

Seluruh error HTTP harus membedakan kesalahan input/domain dari kegagalan internal tanpa membocorkan SQL, path file, stack, token, atau payload sensitif.

## Error canonical

Gunakan `backend/src/utils/httpError.js`:

```js
throw createHttpError(
  "Jumlah mutasi stok tidak boleh 0.",
  "STOCK_QUANTITY_ZERO",
  400,
);
```

Property canonical:

- `publicMessage`: pesan aman untuk pengguna;
- `errorCode`: kode stabil untuk UI/test/log;
- `statusCode`: status HTTP;
- `details`: detail yang sudah disanitasi;
- `exposeDetails`: wajib `true` agar details dapat dikirim;
- `cause`: penyebab internal, hanya untuk log.

Compatibility reader sementara tetap menerima `code`, `message`, `isServiceError`, dan `statusCode` dari helper lama. Helper legacy dimigrasikan bertahap; jangan dihapus sebelum seluruh import diaudit.

## Status HTTP

| Kondisi | Status |
|---|---:|
| payload/field/qty tidak valid | 400 |
| auth/session tidak valid | 401 |
| role tidak berhak | 403 |
| record tidak ditemukan | 404 |
| duplicate/stale/lifecycle conflict | 409 |
| write lock/operasi lain aktif | 423 |
| rate limit | 429 |
| invariant internal, corrupt state, atau error tidak dikenal | 500 |

Plain `Error` hanya untuk invariant internal. Validasi pengguna pada Stock, Finance, Transaction, Production, Auth, dan Maintenance harus memakai AppError/canonical factory.

## Response

```json
{
  "ok": false,
  "message": "Jumlah mutasi stok tidak boleh 0.",
  "data": null,
  "errorCode": "STOCK_QUANTITY_ZERO",
  "details": null
}
```

`details` hanya boleh dikirim bila service telah menandainya aman. SQL, stack, path runtime, checksum internal, session token, dan secret tidak boleh menjadi public details.

## Controller

Target akhir:

```text
service/domain throws AppError
→ controller next(error)
→ global errorHandler
→ response dan logging konsisten
```

Controller tidak membuat ulang business message. `respondIfServiceError()` hanya compatibility selama migrasi controller lama.

## Logging

- HTTP 400–499: `warn` dengan method, path, actor, status, dan errorCode.
- HTTP 500+: `error` dengan stack/cause internal.
- Audit log transaksi tetap terpisah dari HTTP request logger.
- Error normal 4xx tidak boleh terlihat sebagai server crash.

## SQLite constraint

Gunakan mapper canonical `isSqliteUniqueError()` sebagai compatibility. Domain yang mengetahui field duplicate tetap harus menerjemahkan ke kode domain yang spesifik. Parsing teks message SQLite bukan authority utama.

## Test wajib

- `errorHandler.unit.test.js` untuk public/internal/details/logging.
- route integration test untuk Stock/Finance/Transaction/Production mutation.
- failure harus membuktikan rollback dan tidak menerbitkan realtime event palsu.
- OpenAPI harus memakai status aktual controller, termasuk HTTP 201 untuk commit create.
