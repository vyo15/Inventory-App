import { describe, expect, it } from 'vitest';
import {
  calculateSupplierMaterialRestockMetrics,
  doesSupplierProvideItem,
  getSupplierCatalogOffers,
  getSupplierDisplayName,
} from './suppliersService';

describe('suppliersService catalog', () => {
  it('menghitung harga per unit dari harga, biaya, diskon, dan konversi', () => {
    expect(calculateSupplierMaterialRestockMetrics({
      purchaseType: 'online',
      purchaseQty: 2,
      conversionValue: 10,
      supplierItemPrice: 20000,
      estimatedShippingCost: 5000,
      serviceFee: 1000,
      discount: 2000,
    })).toMatchObject({
      totalStockQty: 20,
      totalEstimatedSupplier: 44000,
      estimatedUnitPrice: 2200,
    });
  });

  it('memisahkan penawaran tidak tersedia dan mengurutkan pilihan utama lebih dulu', () => {
    const supplier = {
      catalogOffers: [
        {
          id: 1,
          itemType: 'raw_material',
          itemId: 'material-1',
          supplierItemPrice: 18000,
          conversionValue: 10,
          availabilityStatus: 'available',
        },
        {
          id: 2,
          itemType: 'raw_material',
          itemId: 'material-1',
          supplierItemPrice: 20000,
          conversionValue: 10,
          availabilityStatus: 'available',
          isPrimary: true,
        },
        {
          id: 3,
          itemType: 'raw_material',
          itemId: 'material-1',
          supplierItemPrice: 15000,
          conversionValue: 10,
          availabilityStatus: 'stock_unavailable',
        },
      ],
    };

    const offers = getSupplierCatalogOffers(supplier, {
      itemType: 'raw_material',
      itemId: 'material-1',
      availableOnly: true,
    });
    expect(offers.map((offer) => offer.id)).toEqual([2, 1]);
    expect(doesSupplierProvideItem(supplier, 'raw_material', 'material-1')).toBe(true);
  });

  it('tidak memakai kode atau ID sebagai fallback nama UI', () => {
    expect(getSupplierDisplayName({ code: 'SUP-27062026-001', id: 99 })).toBe('Supplier tanpa nama');
  });
});
