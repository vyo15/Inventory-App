import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usePurchaseReferenceData from "./usePurchaseReferenceData";

const listenerMocks = vi.hoisted(() => ({
  purchases: vi.fn(),
  products: vi.fn(),
  materials: vi.fn(),
  suppliers: vi.fn(),
}));

vi.mock("../../../services/Transaksi/purchasesService", () => ({
  listenPurchaseRecords: listenerMocks.purchases,
  listenPurchaseProducts: listenerMocks.products,
  listenPurchaseRawMaterials: listenerMocks.materials,
}));

vi.mock("../../../services/MasterData/suppliersService", () => ({
  listenSupplierCatalog: listenerMocks.suppliers,
}));

const installListener = (mock, rows) => {
  const unsubscribe = vi.fn();
  mock.mockImplementation((onData) => {
    onData(rows);
    return unsubscribe;
  });
  return unsubscribe;
};

describe("usePurchaseReferenceData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menyatukan subscription read-only dan membersihkannya saat unmount", () => {
    const unsubPurchases = installListener(listenerMocks.purchases, [{ id: "PUR-1" }]);
    const unsubProducts = installListener(listenerMocks.products, [{ id: "PRD-1" }]);
    const unsubMaterials = installListener(listenerMocks.materials, [{ id: "RAW-1" }]);
    const unsubSuppliers = installListener(listenerMocks.suppliers, [{ id: "SUP-1" }]);
    const message = { error: vi.fn() };

    const { result, unmount } = renderHook(() => usePurchaseReferenceData({ message, revision: 0 }));

    expect(result.current.data.purchaseRecords).toEqual([{ id: "PUR-1" }]);
    expect(result.current.data.products).toEqual([{ id: "PRD-1" }]);
    expect(result.current.data.materials).toEqual([{ id: "RAW-1" }]);
    expect(result.current.data.suppliers).toEqual([{ id: "SUP-1" }]);
    expect(result.current.data.isLoading).toBe(false);

    act(() => unmount());
    expect(unsubPurchases).toHaveBeenCalledTimes(1);
    expect(unsubProducts).toHaveBeenCalledTimes(1);
    expect(unsubMaterials).toHaveBeenCalledTimes(1);
    expect(unsubSuppliers).toHaveBeenCalledTimes(1);
  });
});
