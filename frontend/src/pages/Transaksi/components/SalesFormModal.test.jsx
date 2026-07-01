import { describe, expect, it, vi } from "vitest";
import SalesFormModal from "./SalesFormModal";

const createProps = (isSubmittingSale) => {
  const setIsModalOpen = vi.fn();
  return {
    setIsModalOpen,
    props: {
      formState: {
        form: { submit: vi.fn() },
        isModalOpen: true,
        isSubmittingSale,
      },
      referenceData: {
        customers: [],
        onlineStatuses: [],
        salesChannels: [],
        sellableItemTypeOptions: [],
      },
      channelState: {
        isOfflineChannel: true,
        isReferenceNumberEnabledChannel: false,
      },
      defaults: { defaultSaleLineItemType: "product" },
      actions: {
        findSellableItem: vi.fn(),
        getSellableItemsByType: vi.fn(() => []),
        handleAddSale: vi.fn(),
        handleSaleItemChange: vi.fn(),
        handleSaleItemTypeChange: vi.fn(),
        handleSalesChannelChange: vi.fn(),
        setIsModalOpen,
      },
    },
  };
};

describe("SalesFormModal", () => {
  it("tidak menutup modal saat submit masih berjalan", () => {
    const { props, setIsModalOpen } = createProps(true);
    SalesFormModal(props).props.onCancel();
    expect(setIsModalOpen).not.toHaveBeenCalled();
  });

  it("menutup modal saat tidak ada submit aktif", () => {
    const { props, setIsModalOpen } = createProps(false);
    SalesFormModal(props).props.onCancel();
    expect(setIsModalOpen).toHaveBeenCalledWith(false);
  });
});
