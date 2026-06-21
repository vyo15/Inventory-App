import { describe, expect, it } from 'vitest';
import { normalizeProductRecord } from '../../data/adapters/sqlite/sqliteProductsAdapter';
import { normalizeRawMaterialRecord } from '../../data/adapters/sqlite/sqliteRawMaterialsAdapter';
import { normalizeSemiFinishedMaterialRecord } from '../../data/adapters/sqlite/sqliteSemiFinishedMaterialsAdapter';
import { normalizeStockReadModelRecord } from '../../data/adapters/sqlite/sqliteStockReadModelsAdapter';
import {
  inferVariantMode,
  resolveVariantSourceList,
  stripGuardedInventoryUpdateFields,
} from './variantStockNormalizer';

describe('stripGuardedInventoryUpdateFields', () => {
  it('menghapus stok dan valuation dari payload edit tetapi mempertahankan metadata/variantKey', () => {
    const result = stripGuardedInventoryUpdateFields({
      name: 'Produk Baru',
      currentStock: 99,
      stock: 99,
      reservedStock: 4,
      availableStock: 95,
      hppPerUnit: 9000,
      variants: [{
        variantKey: 'red',
        color: 'Merah Baru',
        currentStock: 99,
        reservedStock: 4,
        availableStock: 95,
        hppPerUnit: 9500,
      }],
      variantOptions: [{
        variantKey: 'red',
        name: 'Merah Baru',
        currentStock: 99,
        averageActualUnitCost: 7000,
      }],
    }, {
      protectedFields: ['hppPerUnit'],
      protectedVariantFields: ['hppPerUnit', 'averageActualUnitCost'],
    });

    expect(result).toEqual({
      name: 'Produk Baru',
      variants: [{ variantKey: 'red', color: 'Merah Baru' }],
      variantOptions: [{ variantKey: 'red', name: 'Merah Baru' }],
    });
  });
});

describe('resolveVariantSourceList', () => {
  it('memakai variantOptions legacy ketika variants tersedia tetapi kosong', () => {
    const legacyVariants = [{ variantKey: 'red', variantLabel: 'Merah' }];
    const item = {
      hasVariants: false,
      variants: [],
      variantOptions: legacyVariants,
    };

    expect(resolveVariantSourceList(item)).toBe(legacyVariants);
    expect(inferVariantMode(item)).toBe(true);
  });

  it('tidak menganggap array variants kosong sebagai mode varian', () => {
    expect(inferVariantMode({ hasVariants: false, variants: [] })).toBe(false);
    expect(resolveVariantSourceList({ hasVariants: false, variants: [] })).toEqual([]);
  });
});


describe('adapter compatibility varian legacy', () => {
  const legacyRecord = {
    hasVariants: false,
    variants: [],
    variantOptions: [{
      variantKey: 'red',
      variantLabel: 'Merah',
      currentStock: 3,
      reservedStock: 1,
    }],
  };

  it.each([
    ['Product', normalizeProductRecord],
    ['Raw Material', normalizeRawMaterialRecord],
    ['Semi Finished', normalizeSemiFinishedMaterialRecord],
    ['Stock Read Model', normalizeStockReadModelRecord],
  ])('%s tetap menampilkan variantOptions legacy', (_label, normalizeRecord) => {
    const result = normalizeRecord(legacyRecord);
    expect(result.hasVariants).toBe(true);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].variantKey).toBe('red');
  });
});
