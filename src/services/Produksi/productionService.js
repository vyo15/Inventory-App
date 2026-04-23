// =====================================================
// Production Legacy Service
//
// LEGACY / DEPRECATED
// File ini mewakili flow produksi lama berbasis collection `productions`.
// Flow operasional aktif payroll/produksi v1 tidak lagi memakai service ini
// sebagai source of truth utama.
//
// Aman dihapus nanti?
// - Belum langsung, karena masih bisa ada route/data lama yang belum dibersihkan.
// - Jika reset data produksi dipilih dan route lama sudah dipensiunkan, file ini
//   bisa masuk kandidat cleanup tahap berikutnya.
// =====================================================

import { collection, doc, increment, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";

// =========================
// SECTION: Helper - Format dokumen produksi
// =========================
const buildProductionDocumentData = ({
  values,
  rawMaterials,
  finishedProducts,
}) => {
  return {
    ...values,
    date: values.date.format("YYYY-MM-DD"),
    finishDate: values.finishDate
      ? values.finishDate.format("YYYY-MM-DD")
      : null,
    productResult: {
      ...values.productResult,
      name:
        finishedProducts.find(
          (product) => product.id === values.productResult.productId,
        )?.name || "N/A",
    },
    materials: (values.materials || []).map((material) => ({
      ...material,
      name:
        rawMaterials.find(
          (rawMaterial) => rawMaterial.id === material.productId,
        )?.name || "N/A",
    })),
  };
};

// =========================
// SECTION: Simpan / update transaksi produksi
// =========================
export const performProductionTransaction = async (productionData) => {
  const productionBatch = writeBatch(db);

  const {
    values,
    isEditing,
    editingId,
    productions,
    rawMaterials,
    finishedProducts,
  } = productionData;

  try {
    let existingProduction = null;

    // =========================
    // SECTION: Rollback stok lama saat edit
    // =========================
    if (isEditing) {
      existingProduction = productions.find(
        (production) => production.id === editingId,
      );

      if (!existingProduction) {
        throw new Error("Data produksi lama tidak ditemukan.");
      }

      for (const material of existingProduction.materials || []) {
        const materialReference = doc(db, "raw_materials", material.productId);

        productionBatch.update(materialReference, {
          stock: increment(material.quantity),
        });
      }

      if (existingProduction.status === "completed") {
        const previousFinishedProductReference = doc(
          db,
          "products",
          existingProduction.productResult.productId,
        );

        productionBatch.update(previousFinishedProductReference, {
          stock: increment(-existingProduction.productResult.quantity),
        });
      }
    }

    // =========================
    // SECTION: Kurangi bahan baku baru
    // =========================
    for (const material of values.materials || []) {
      const materialReference = doc(db, "raw_materials", material.productId);

      productionBatch.update(materialReference, {
        stock: increment(-material.quantity),
      });
    }

    // =========================
    // SECTION: Tambah produk jadi jika completed
    // =========================
    if (values.status === "completed") {
      const finishedProductReference = doc(
        db,
        "products",
        values.productResult.productId,
      );

      productionBatch.update(finishedProductReference, {
        stock: increment(values.productResult.quantity),
      });
    }

    // =========================
    // SECTION: Bangun payload dokumen produksi
    // =========================
    const productionDocumentData = buildProductionDocumentData({
      values,
      rawMaterials,
      finishedProducts,
    });

    // =========================
    // SECTION: Simpan dokumen produksi
    // =========================
    if (isEditing) {
      const productionReference = doc(db, "productions", editingId);
      productionBatch.update(productionReference, productionDocumentData);
    } else {
      const productionReference = doc(collection(db, "productions"));
      productionBatch.set(productionReference, productionDocumentData);
    }

    await productionBatch.commit();
    return true;
  } catch (error) {
    console.error("Gagal melakukan transaksi produksi:", error);
    return false;
  }
};

// =========================
// SECTION: Selesaikan produksi
// =========================
export const completeProductionTransaction = async ({
  productionId,
  productions,
}) => {
  const productionBatch = writeBatch(db);

  try {
    const selectedProduction = productions.find(
      (production) => production.id === productionId,
    );

    if (!selectedProduction) {
      throw new Error("Data produksi tidak ditemukan");
    }

    if (selectedProduction.status === "completed") {
      throw new Error("Produksi ini sudah selesai");
    }

    const finishedProductReference = doc(
      db,
      "products",
      selectedProduction.productResult.productId,
    );

    productionBatch.update(finishedProductReference, {
      stock: increment(selectedProduction.productResult.quantity),
    });

    const productionReference = doc(db, "productions", productionId);

    productionBatch.update(productionReference, {
      status: "completed",
      finishDate: new Date().toISOString().slice(0, 10),
    });

    await productionBatch.commit();
    return true;
  } catch (error) {
    console.error("Gagal menyelesaikan produksi:", error);
    return false;
  }
};
