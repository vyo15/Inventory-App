import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyPricingRuleBatch: vi.fn(),
  listPricingRules: vi.fn(),
  createPricingRule: vi.fn(),
  updatePricingRule: vi.fn(),
  deletePricingRule: vi.fn(),
  subscribePricingRules: vi.fn(),
}));

vi.mock('../../data/adapters/sqlite/sqlitePricingRulesAdapter', () => mocks);

import { applyPricingRuleToItems } from './pricingService';

describe('applyPricingRuleToItems SQLite atomic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyPricingRuleBatch.mockResolvedValue({ updatedCount: 1 });
  });

  it('mengirim seluruh perubahan harga melalui satu batch backend', async () => {
    const rule = {
      id: 'pricing-1',
      name: 'Markup 100%',
      targetType: 'products',
      isActive: true,
      baseCostSource: 'hppPerUnit',
      marginType: 'percent',
      marginValue: 100,
      includeMarketplaceBuffer: false,
      roundingType: 'nearest',
      roundingUnit: 1,
    };
    const items = [
      {
        id: 'product-1',
        name: 'Produk 1',
        pricingMode: 'rule',
        pricingRuleId: 'pricing-1',
        hppPerUnit: 1000,
        price: 1500,
        versionToken: 'version-1',
      },
      {
        id: 'product-2',
        name: 'Produk 2',
        pricingMode: 'manual',
        hppPerUnit: 1000,
        price: 1500,
        versionToken: 'version-2',
      },
    ];

    const result = await applyPricingRuleToItems({
      items,
      rule,
      targetType: 'products',
      changeSource: 'pricing_rule_apply',
      notes: 'Apply rule: Markup 100%',
    });

    expect(mocks.applyPricingRuleBatch).toHaveBeenCalledTimes(1);
    expect(mocks.applyPricingRuleBatch).toHaveBeenCalledWith('pricing-1', {
      targetType: 'products',
      updates: [{
        itemId: 'product-1',
        expectedVersion: 'version-1',
        newPrice: 2000,
      }],
      changeSource: 'pricing_rule_apply',
      notes: 'Apply rule: Markup 100%',
    });
    expect(result.summary.updatedCount).toBe(1);
    expect(result.summary.skippedManualCount).toBe(1);
  });

  it('tidak memanggil endpoint bila seluruh harga tidak berubah', async () => {
    const rule = {
      id: 'pricing-1',
      name: 'Markup 100%',
      targetType: 'products',
      isActive: true,
      baseCostSource: 'hppPerUnit',
      marginType: 'percent',
      marginValue: 100,
      includeMarketplaceBuffer: false,
      roundingType: 'nearest',
      roundingUnit: 1,
    };

    const result = await applyPricingRuleToItems({
      items: [{
        id: 'product-1',
        pricingMode: 'rule',
        pricingRuleId: 'pricing-1',
        hppPerUnit: 1000,
        price: 2000,
        versionToken: 'version-1',
      }],
      rule,
      targetType: 'products',
    });

    expect(mocks.applyPricingRuleBatch).not.toHaveBeenCalled();
    expect(result.summary.updatedCount).toBe(0);
    expect(result.summary.unchangedCount).toBe(1);
  });
});
