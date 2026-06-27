import { describe, expect, it } from 'vitest';
import {
  compareRecordsByDateDesc,
  compareRecordsByNameAsc,
  mergeRecordsById,
  removeRecordById,
  upsertRecordById,
  upsertRecordsById,
} from './recordCollectionState';

describe('recordCollectionState', () => {
  it('menambahkan record baru tanpa membuat duplikasi id', () => {
    expect(upsertRecordById([{ id: 'a', name: 'A' }], { id: 'b', name: 'B' }))
      .toEqual([{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }]);
  });

  it('mengganti record lama dengan record final dari server', () => {
    expect(upsertRecordById(
      [{ id: 'a', name: 'Lama', versionToken: 'v1' }],
      { id: 'a', name: 'Baru', versionToken: 'v2' },
    )).toEqual([{ id: 'a', name: 'Baru', versionToken: 'v2' }]);
  });

  it('menggabungkan beberapa hasil mutation dan menjaga urutan nama', () => {
    const result = upsertRecordsById(
      [{ id: 'a', name: 'Zinnia' }],
      [{ id: 'b', name: 'Anggrek' }, { id: 'a', name: 'Mawar' }],
      { comparator: compareRecordsByNameAsc },
    );

    expect(result.map((item) => item.name)).toEqual(['Anggrek', 'Mawar']);
  });

  it('mengurutkan transaksi terbaru berdasarkan date atau transactionDate', () => {
    const result = upsertRecordById(
      [{ id: 'old', date: '2026-06-01T00:00:00.000Z' }],
      { id: 'new', transactionDate: '2026-06-27T00:00:00.000Z' },
      { comparator: compareRecordsByDateDesc },
    );

    expect(result.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('menggabungkan patch tanpa membuang field record yang tidak berubah', () => {
    const result = mergeRecordsById(
      [{ id: 'a', name: 'Bunga', currentStock: 10, price: 1000 }],
      [{ id: 'a', price: 1500, versionToken: 'v2' }],
    );

    expect(result).toEqual([{
      id: 'a',
      name: 'Bunga',
      currentStock: 10,
      price: 1500,
      versionToken: 'v2',
    }]);
  });

  it('menghapus record berdasarkan id', () => {
    expect(removeRecordById([{ id: 'a' }, { id: 'b' }], 'a')).toEqual([{ id: 'b' }]);
  });
});
