import { useEffect, useState } from "react";
import { listenSupplierCatalog } from "../../../services/MasterData/suppliersService";
import {
  listenPurchaseProducts,
  listenPurchaseRawMaterials,
  listenPurchaseRecords,
} from "../../../services/Transaksi/purchasesService";

const usePurchaseReferenceData = ({ message, revision }) => {
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setIsLoading(true);

    const unsubscribePurchases = listenPurchaseRecords(
      (nextPurchaseRecords) => {
        setPurchaseRecords(nextPurchaseRecords);
        setLoadError("");
        setIsLoading(false);
      },
      (error) => {
        console.error("Gagal memuat data pembelian:", error);
        setPurchaseRecords([]);
        setLoadError("Gagal memuat data pembelian.");
        setIsLoading(false);
        message.error("Gagal memuat data pembelian.");
      },
    );

    const unsubscribeProducts = listenPurchaseProducts(
      setProducts,
      (error) => {
        console.error("Gagal memuat produk untuk pembelian:", error);
        message.error("Gagal memuat produk untuk pembelian.");
      },
    );

    const unsubscribeMaterials = listenPurchaseRawMaterials(
      setMaterials,
      (error) => {
        console.error("Gagal memuat bahan baku untuk pembelian:", error);
        message.error("Gagal memuat bahan baku untuk pembelian.");
      },
    );

    const unsubscribeSuppliers = listenSupplierCatalog(
      setSuppliers,
      (error) => {
        console.error("Gagal memuat supplier untuk pembelian:", error);
        message.error("Gagal memuat supplier untuk pembelian.");
      },
    );

    return () => {
      unsubscribePurchases?.();
      unsubscribeProducts?.();
      unsubscribeMaterials?.();
      unsubscribeSuppliers?.();
    };
  }, [message, revision]);

  return {
    data: {
      purchaseRecords,
      products,
      materials,
      suppliers,
      isLoading,
      loadError,
    },
    setters: {
      setPurchaseRecords,
      setProducts,
      setMaterials,
      setSuppliers,
    },
  };
};

export default usePurchaseReferenceData;
