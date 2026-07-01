import { describe, expect, it, vi } from "vitest";
import StockAdjustmentFormModal from "./StockAdjustmentFormModal";

describe("StockAdjustmentFormModal", () => {
  it("memakai reset resmi saat modal ditutup", () => {
    const resetAdjustmentFormState = vi.fn();
    const modal = StockAdjustmentFormModal({
      formState: {
        form: { submit: vi.fn(), setFieldsValue: vi.fn() },
        isModalOpen: true,
        isSubmitting: false,
      },
      selectionState: {
        availableItems: [],
        selectedAdjustmentType: "increase",
        selectedCurrentUnitCost: 0,
        selectedItem: null,
        selectedItemHasVariants: false,
        selectedStockSnapshot: null,
        selectedVariant: null,
        variantOptions: [],
      },
      quantityState: {
        formatQuantityId: (value) => String(value ?? 0),
        needsUnitCostGuard: false,
        quantityUnitLabel: "pcs",
        quantityUsesWholeNumber: true,
      },
      actions: {
        handleSubmitStockAdjustment: vi.fn(),
        resetAdjustmentFormState,
      },
    });

    modal.props.onCancel();
    expect(resetAdjustmentFormState).toHaveBeenCalledTimes(1);
  });
});
