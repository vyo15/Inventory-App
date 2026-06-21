import { describe, expect, it } from 'vitest';
import { stripGuardedInventoryUpdateFields } from './variantStockNormalizer';

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
