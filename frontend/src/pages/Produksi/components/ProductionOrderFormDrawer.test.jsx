import { describe, expect, it, vi } from "vitest";
import ProductionOrderFormDrawer from "./ProductionOrderFormDrawer";

const createProps = () => {
  const form = {
    resetFields: vi.fn(),
    setFieldsValue: vi.fn(),
  };
  const actions = {
    closeFormDrawer: vi.fn(),
    handleSelectProductionTarget: vi.fn(),
    handleSubmit: vi.fn(),
    loadBomOptions: vi.fn(),
    loadGeneratedCode: vi.fn(),
    loadSemiFinishedReferences: vi.fn(),
    setFormVisible: vi.fn(),
    setSelectedProductionTargetKey: vi.fn(),
    setSemiCategoryFilter: vi.fn(),
    setSemiFamilyFilter: vi.fn(),
    setTargetVariantOptions: vi.fn(),
  };

  return {
    props: {
      formState: { form, formVisible: true, submitting: false },
      selectionState: {
        bomIdValue: undefined,
        orderQtyValue: 1,
        selectedProductionTargetKey: "",
        semiCategoryFilter: "all",
        semiFamilyFilter: "",
        targetTypeValue: "product",
        targetVariantKeyValue: undefined,
        targetVariantOptions: [],
      },
      referenceData: {
        recipeOptions: [],
        semiCategoryOptions: [],
        semiFamilyOptions: [],
        visibleProductionTargetGroups: [],
      },
      previewState: {
        requirementPreview: [],
        requirementPreviewError: "",
        requirementPreviewLoading: false,
      },
      uiState: {
        bomLoading: false,
        isSemiFinishedProduction: false,
        shouldShowRecipeSelect: true,
        targetSelectLabel: "Target",
        targetSelectPlaceholder: "Pilih target",
      },
      actions,
    },
    form,
    actions,
  };
};

describe("ProductionOrderFormDrawer", () => {
  it("membersihkan state form dan filter ketika drawer ditutup", () => {
    const { props, form, actions } = createProps();
    const drawer = ProductionOrderFormDrawer(props);

    expect(drawer.props.open).toBe(true);
    drawer.props.onClose();

    expect(actions.closeFormDrawer).toHaveBeenCalledTimes(1);
    expect(form.resetFields).not.toHaveBeenCalled();
  });
});
