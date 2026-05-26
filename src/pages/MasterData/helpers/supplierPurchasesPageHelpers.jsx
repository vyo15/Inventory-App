import { Tag } from 'antd';
import {
  calculateSupplierMaterialRestockMetrics,
  isValidSupplierCodeFormat,
  normalizeSupplierCode,
} from '../../../services/MasterData/suppliersService';

// IMS NOTE [AKTIF/UI ONLY] - Helper katalog Supplier tetap read-only.
export const PURCHASE_UNIT_OPTIONS = ['pcs', 'meter', 'roll', 'pack', 'ikat', 'dus', 'lainnya'];

export const SUPPLIER_PURCHASE_LOOKUP_LIMIT = 500;

export const formatPurchaseDate = (value) => {
  if (!value) return '-';
  const dateValue = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(dateValue.getTime())) return '-';
  return dateValue.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const getPurchaseTime = (purchase = {}) => {
  const value = purchase.date || purchase.purchaseDate || purchase.createdAt || purchase.updatedAt;
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

export const getMaterialStockUnit = (material = {}) => {
  return material.stockUnit || material.unit || material.baseUnit || '';
};

export const getSupplierBusinessCode = (supplier = {}) => {
  const code = normalizeSupplierCode(supplier.code);
  if (isValidSupplierCodeFormat(code)) return code;

  const supplierCode = normalizeSupplierCode(supplier.supplierCode);
  if (isValidSupplierCodeFormat(supplierCode)) return supplierCode;

  return '';
};

export const renderSupplierBusinessCode = (supplier = {}) => {
  const businessCode = getSupplierBusinessCode(supplier);

  if (businessCode) {
    return <span className="ims-cell-meta">{businessCode}</span>;
  }

  return <Tag color="warning">Perlu repair kode</Tag>;
};

export const getLatestPurchaseForMaterial = (purchaseRecords = [], materialId) => {
  if (!materialId) return null;

  return (
    (purchaseRecords || [])
      .filter((purchase) => {
        const purchaseType = String(purchase.itemType || purchase.type || '').toLowerCase();
        return purchaseType === 'material';
      })
      .filter(
        (purchase) =>
          String(purchase.itemId || purchase.materialId || purchase.rawMaterialId || '') === String(materialId),
      )
      .sort((leftPurchase, rightPurchase) => getPurchaseTime(rightPurchase) - getPurchaseTime(leftPurchase))[0] || null
  );
};

export const getSupplierTableSummaryDetail = (supplier = {}) => {
  const restockDetails = (supplier.materialDetails || []).filter((detail) => detail.materialId || detail.materialName);
  if (!restockDetails.length) return null;

  return [...restockDetails].sort((leftDetail, rightDetail) => {
    const leftPrice = calculateSupplierMaterialRestockMetrics(leftDetail).estimatedUnitPrice || Number.MAX_SAFE_INTEGER;
    const rightPrice = calculateSupplierMaterialRestockMetrics(rightDetail).estimatedUnitPrice || Number.MAX_SAFE_INTEGER;
    return leftPrice - rightPrice;
  })[0];
};
