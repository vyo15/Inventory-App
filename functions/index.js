// Import Firebase Functions v2 & Firebase Admin
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Init Firebase Admin SDK
initializeApp();
const db = getFirestore();

/**
 * 🔹 Update stok saat ada penjualan baru
 */
exports.onSalesItemCreate = onDocumentCreated(
  "sales/{saleId}/items/{itemId}",
  async (event) => {
    const item = event.data.data();
    const productRef = db.collection("products").doc(item.product_id);

    await db.runTransaction(async (t) => {
      const doc = await t.get(productRef);
      if (!doc.exists) throw new Error("Product not found");

      const newStock = (doc.data().stock || 0) - item.quantity;
      t.update(productRef, { stock: newStock });
    });
  }
);

/**
 * 🔹 Update stok saat ada pembelian baru
 */
exports.onPurchaseItemCreate = onDocumentCreated(
  "purchases/{purchaseId}/items/{itemId}",
  async (event) => {
    const item = event.data.data();
    const productRef = db.collection("products").doc(item.product_id);

    await db.runTransaction(async (t) => {
      const doc = await t.get(productRef);
      if (!doc.exists) throw new Error("Product not found");

      const newStock = (doc.data().stock || 0) + item.quantity;
      t.update(productRef, { stock: newStock });
    });
  }
);

/**
 * 🔹 Update stok saat ada penyesuaian manual
 */
exports.onStockAdjustmentCreate = onDocumentCreated(
  "stock_adjustments/{adjustmentId}",
  async (event) => {
    const adj = event.data.data();
    const productRef = db.collection("products").doc(adj.product_id);

    await productRef.update({
      stock: adj.new_stock,
    });
  }
);
