import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCustomers: vi.fn(),
}));

vi.mock("../MasterData/customersService", () => ({
  getCustomers: mocks.getCustomers,
}));

import {
  getSalesCustomerReferences,
  resolveSalesCustomerReference,
} from "./salesCustomerReferenceService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("salesCustomerReferenceService", () => {
  it("membaca customer melalui service master dan menormalisasi kode referensi", async () => {
    mocks.getCustomers.mockResolvedValue([
      { id: "customer-1", name: "Toko Mawar", code: "CUS-001" },
      { id: "customer-2", name: "Toko Melati", customerCode: "CUS-002" },
      { id: "customer-3" },
    ]);

    await expect(getSalesCustomerReferences()).resolves.toEqual([
      expect.objectContaining({
        id: "customer-1",
        name: "Toko Mawar",
        code: "CUS-001",
        customerCode: "CUS-001",
        source: "local_database_service",
      }),
      expect.objectContaining({
        id: "customer-2",
        code: "CUS-002",
        customerCode: "CUS-002",
      }),
      expect.objectContaining({
        id: "customer-3",
        name: "",
        code: "customer-3",
        customerCode: "customer-3",
      }),
    ]);
    expect(mocks.getCustomers).toHaveBeenCalledTimes(1);
  });

  it("mengembalikan array kosong bila service tidak mempunyai data", async () => {
    mocks.getCustomers.mockResolvedValue(null);
    await expect(getSalesCustomerReferences()).resolves.toEqual([]);
  });

  it("mencari customer dengan perbandingan ID yang konsisten", () => {
    const customers = [{ id: 10, name: "Customer A" }, { id: "20", name: "Customer B" }];

    expect(resolveSalesCustomerReference(customers, "10")).toEqual(customers[0]);
    expect(resolveSalesCustomerReference(customers, 20)).toEqual(customers[1]);
    expect(resolveSalesCustomerReference(customers, "")).toBeNull();
    expect(resolveSalesCustomerReference(customers, "missing")).toBeNull();
  });
});
