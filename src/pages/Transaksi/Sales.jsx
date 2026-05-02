import { useEffect, useMemo, useState } from "react";
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tabs,
  message,
  Space,
  InputNumber,
  Popconfirm,
  Alert,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import {
  collection,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  Timestamp,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  addInventoryLog,
  updateInventoryStock,
} from "../../services/Inventory/inventoryService";
import { getCustomers } from "../../services/MasterData/customersService";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";
import { formatCurrencyId } from "../../utils/formatters/currencyId";


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const { Option } = Select;

// =========================
// SECTION: Daftar channel penjualan
// =========================
const salesChannels = [
  { value: "Offline", label: "Offline" },
  { value: "Shopee", label: "Shopee" },
  { value: "Tokopedia", label: "Tokopedia" },
  { value: "TikTok Shop", label: "TikTok Shop" },
  { value: "Lazada", label: "Lazada" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Instagram", label: "Instagram" },
  { value: "Lainnya", label: "Lainnya" },
];

// =========================
// SECTION: Status penjualan online
// =========================
const onlineStatuses = ["Diproses", "Dikirim", "Selesai", "Dibatalkan"];

const buildSellableKey = (collectionName, itemId) => `${collectionName}::${itemId}`;

// =========================
// SECTION: Sales Page
// =========================
const Sales = () => {
  // =========================
  // SECTION: State utama
  // =========================
  const [salesRecords, setSalesRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // =========================
  // SECTION: Modal dan filter
  // =========================
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState("all");
  const [receiptSearch, setReceiptSearch] = useState("");

  const [form] = Form.useForm();

  // =========================
  // SECTION: Semua item yang bisa dijual
  // ACTIVE / FINAL:
  // - form menyimpan itemKey berisi collectionName::itemId agar produk dan bahan baku tidak ambigu
  // - sale payload tetap menyimpan itemId asli + collectionName untuk kompatibilitas laporan lama
  // =========================
  const sellableItems = useMemo(() => {
    return [
      ...products.map((item) => ({
        ...item,
        itemKey: buildSellableKey("products", item.id),
        collectionName: "products",
        typeLabel: "Produk Jadi",
      })),
      ...rawMaterials.map((item) => ({
        ...item,
        itemKey: buildSellableKey("raw_materials", item.id),
        collectionName: "raw_materials",
        typeLabel: "Bahan Baku",
      })),
    ];
  }, [products, rawMaterials]);

  const findSellableItem = (itemKey) => sellableItems.find((item) => item.itemKey === itemKey);

  useEffect(() => {
    fetchSales(activeTabKey);
    fetchProducts();
    fetchRawMaterials();
    fetchCustomers();
  }, [activeTabKey]);

  // =========================
  // SECTION: Ambil data penjualan berdasarkan tab/status
  // =========================
  const fetchSales = async (statusFilter) => {
    setIsLoading(true);

    try {
      const salesCollection = collection(db, "sales");
      let salesQuery;

      if (statusFilter === "all") {
        salesQuery = query(salesCollection, orderBy("createdAt", "desc"));
      } else {
        salesQuery = query(
          salesCollection,
          where("status", "==", statusFilter),
          orderBy("createdAt", "desc"),
        );
      }

      const salesSnapshot = await getDocs(salesQuery);

      const fetchedSalesRecords = salesSnapshot.docs.map((documentItem) => {
        const salesData = documentItem.data();
        const dateValue = salesData.date;

        return {
          id: documentItem.id,
          ...salesData,
          date: dateValue?.toDate
            ? dayjs(dateValue.toDate()).format("YYYY-MM-DD")
            : "Tanggal Tidak Tersedia",
        };
      });

      setSalesRecords(fetchedSalesRecords);
    } catch (error) {
      console.error("Gagal mengambil data penjualan:", error);
      message.error("Gagal mengambil data penjualan.");
    } finally {
      setIsLoading(false);
    }
  };

  // =========================
  // SECTION: Ambil produk jadi
  // =========================
  const fetchProducts = async () => {
    try {
      const productsCollection = collection(db, "products");
      const productsSnapshot = await getDocs(productsCollection);

      const productList = productsSnapshot.docs.map((documentItem) => ({
        id: documentItem.id,
        ...documentItem.data(),
      }));

      setProducts(productList);
    } catch (error) {
      console.error("Gagal mengambil data produk:", error);
      message.error("Gagal memuat daftar produk.");
    }
  };

  // =========================
  // SECTION: Ambil bahan baku
  // =========================
  const fetchRawMaterials = async () => {
    try {
      const rawMaterialsCollection = collection(db, "raw_materials");
      const rawMaterialsSnapshot = await getDocs(rawMaterialsCollection);

      const rawMaterialList = rawMaterialsSnapshot.docs.map((documentItem) => ({
        id: documentItem.id,
        ...documentItem.data(),
      }));

      setRawMaterials(rawMaterialList);
    } catch (error) {
      console.error("Gagal mengambil data bahan baku:", error);
      message.error("Gagal memuat daftar bahan baku.");
    }
  };

  // =========================
  // SECTION: Ambil customer
  // Fungsi:
  // - membaca customer lewat customersService sebagai source final yang sama dengan Master Customer
  // Hubungan flow:
  // - dropdown Sales tidak boleh query collection sendiri supaya tidak kembali bercabang
  // Status:
  // - aktif/final
  // - tetap menyimpan snapshot customerName saat sale dibuat agar transaksi lama aman
  // =========================
  const fetchCustomers = async () => {
    try {
      const customerList = await getCustomers();
      setCustomers(customerList);
    } catch (error) {
      console.error("Gagal mengambil data pelanggan:", error);
      message.error("Gagal memuat daftar pelanggan.");
    }
  };

  // =========================
  // SECTION: Saat item dipilih, harga otomatis diisi dan varian di-reset
  // =========================
  const handleSaleItemChange = (itemKey, itemIndex) => {
    const selectedItem = findSellableItem(itemKey);

    if (!selectedItem) {
      return;
    }

    const currentItems = form.getFieldValue("items") || [];
    let autoPrice = 0;

    // RULE:
    // - Produk jadi ambil harga dari field price
    // - Bahan baku ambil harga dari field sellingPrice
    if (selectedItem.collectionName === "products") {
      autoPrice = Number(selectedItem.price || 0);
    } else {
      autoPrice = Number(selectedItem.sellingPrice || 0);
    }

    currentItems[itemIndex] = {
      ...(currentItems[itemIndex] || {}),
      itemId: itemKey,
      variantKey: undefined,
      pricePerUnit: autoPrice,
    };

    form.setFieldsValue({ items: [...currentItems] });
  };

  // =========================
  // SECTION: Helper channel offline
  // =========================
  const isOfflineChannel = (channel) => channel === "Offline";

  // =========================
  // SECTION: Cek apakah income sale sudah pernah dibuat
  // =========================
  const hasExistingIncome = async (saleId) => {
    const incomesCollection = collection(db, "incomes");
    const incomeQuery = query(
      incomesCollection,
      where("relatedId", "==", saleId),
    );
    const incomeSnapshot = await getDocs(incomeQuery);

    return !incomeSnapshot.empty;
  };

  // =========================
  // SECTION: Buka modal tambah penjualan
  // =========================
  const openCreateSaleModal = () => {
    setIsModalOpen(true);
    form.resetFields();

    form.setFieldsValue({
      salesChannel: "Shopee",
      status: "Diproses",
      date: dayjs(),
      items: [{ itemId: undefined, variantKey: undefined, quantity: 1, pricePerUnit: 0 }],
    });
  };

  // =========================
  // SECTION: Normalisasi line penjualan final
  // Fungsi:
  // - membentuk snapshot item yang akan disimpan ke dokumen sales
  // - melakukan guard awal memakai availableStock dari cache UI agar user langsung mendapat feedback
  // Hubungan flow Sales/stok:
  // - sale line menyimpan collectionName + variantKey supaya mutasi stok dan revert cancel/delete kembali ke sumber stok yang sama
  // Status:
  // - aktif/final; validasi final tetap dilakukan ulang ke Firestore oleh validateSaleStockAvailability sebelum sale dibuat
  // - bukan legacy dan bukan kandidat cleanup
  // =========================
  const buildSaleLine = (item) => {
    const selectedItem = findSellableItem(item.itemId);

    if (!selectedItem) {
      throw new Error("Produk/Bahan baku tidak ditemukan di inventaris.");
    }

    const hasVariants = inferHasVariants(selectedItem);
    const selectedVariant = hasVariants ? findVariantByKey(selectedItem, item.variantKey) : null;

    if (hasVariants && !selectedVariant) {
      throw new Error(`Pilih varian untuk ${selectedItem.name} agar penjualan tidak memotong stok master.`);
    }

    const availableStock = selectedVariant
      ? Number(selectedVariant.availableStock || 0)
      : Number(getItemStockSnapshot(selectedItem).availableStock || 0);
    const requestedQuantity = Number(item.quantity || 0);

    if (availableStock < requestedQuantity) {
      throw new Error(
        `Stok tersedia ${selectedItem.name}${selectedVariant ? ` - ${selectedVariant.variantLabel}` : ""} tidak mencukupi. Tersisa: ${formatNumberId(availableStock)}`,
      );
    }

    return {
      itemId: selectedItem.id,
      itemName: selectedItem.name || "-",
      quantity: requestedQuantity,
      pricePerUnit: Number(item.pricePerUnit || 0),
      subtotal: Number(item.pricePerUnit || 0) * requestedQuantity,
      collectionName: selectedItem.collectionName,
      variantKey: selectedVariant?.variantKey || "",
      variantLabel: selectedVariant?.variantLabel || "",
      stockSourceType: selectedVariant ? "variant" : "master",
    };
  };

  // =========================
  // SECTION: Key agregasi kebutuhan stok per sumber final
  // Fungsi:
  // - menggabungkan kebutuhan item yang sama pada beberapa baris sale
  // Hubungan flow Sales/stok:
  // - mencegah kasus dua baris item yang sama masing-masing terlihat cukup, tetapi totalnya melebihi availableStock
  // Status:
  // - aktif/final untuk Fase A Sales stock safety
  // - bukan legacy dan bukan kandidat cleanup
  // =========================
  const buildSaleStockBucketKey = (item) =>
    `${item.collectionName}::${item.itemId}::${item.variantKey || "master"}`;

  // =========================
  // SECTION: Validasi final available stock dari Firestore sebelum create sale
  // Fungsi:
  // - membaca ulang dokumen item terbaru langsung dari Firestore
  // - memvalidasi availableStock master atau varian, bukan currentStock mentah
  // Hubungan flow Sales/stok:
  // - memastikan sale tidak dibuat jika stok tersedia sudah berubah/kurang sebelum user menekan Simpan
  // Status:
  // - aktif/final untuk Fase A Sales stock safety
  // - bukan legacy dan bukan kandidat cleanup
  // =========================
  const validateSaleStockAvailability = async (saleItems = []) => {
    const stockNeedsByBucket = new Map();

    saleItems.forEach((item) => {
      const bucketKey = buildSaleStockBucketKey(item);
      const existingNeed = stockNeedsByBucket.get(bucketKey);

      stockNeedsByBucket.set(bucketKey, {
        ...item,
        quantity: Number(existingNeed?.quantity || 0) + Number(item.quantity || 0),
      });
    });

    for (const item of stockNeedsByBucket.values()) {
      const itemReference = doc(db, item.collectionName, item.itemId);
      const itemSnapshotDocument = await getDoc(itemReference);

      if (!itemSnapshotDocument.exists()) {
        throw new Error(`Item ${item.itemName || item.itemId} tidak ditemukan. Penjualan dibatalkan agar stok tidak salah.`);
      }

      const latestItem = {
        id: itemSnapshotDocument.id,
        ...itemSnapshotDocument.data(),
      };
      const hasVariants = inferHasVariants(latestItem);
      const latestVariant = hasVariants && item.variantKey
        ? findVariantByKey(latestItem, item.variantKey)
        : null;

      if (hasVariants && !latestVariant) {
        throw new Error(`Varian ${item.variantLabel || item.variantKey || "item"} untuk ${item.itemName} tidak ditemukan. Penjualan dibatalkan agar stok tidak masuk ke master/default.`);
      }

      const stockSnapshot = latestVariant
        ? {
            availableStock: Number(latestVariant.availableStock || 0),
          }
        : getItemStockSnapshot(latestItem);
      const availableStock = Number(stockSnapshot.availableStock || 0);

      if (availableStock < Number(item.quantity || 0)) {
        throw new Error(
          `Stok tersedia ${item.itemName}${latestVariant ? ` - ${latestVariant.variantLabel}` : ""} tidak mencukupi. Dibutuhkan: ${formatNumberId(item.quantity)}, tersedia: ${formatNumberId(availableStock)}. Penjualan belum disimpan.`,
        );
      }
    }
  };

  // =========================
  // SECTION: Rollback sale jika mutasi stok gagal setelah dokumen sale dibuat
  // Fungsi:
  // - mengembalikan stok item yang sudah sempat terpotong
  // - menghapus dokumen sale yang baru dibuat agar tidak ada sale tersimpan tanpa stok keluar lengkap
  // Hubungan flow Sales/stok:
  // - menjaga atomic-like behavior di sisi UI tanpa mengubah service inventory global
  // Status:
  // - aktif/final guard Fase A
  // - bukan legacy; kandidat cleanup hanya jika nanti flow dipindah ke transaction/cloud function resmi
  // =========================
  const rollbackSaleAfterStockMutationFailure = async ({
    saleId,
    appliedStockItems = [],
  }) => {
    const rollbackErrors = [];

    for (const item of appliedStockItems) {
      try {
        await updateInventoryStock({
          itemId: item.itemId,
          collectionName: item.collectionName,
          quantityChange: Number(item.quantity || 0),
          variantKey: item.variantKey || "",
          allowMasterForVariant: !item.variantKey,
        });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (saleId) {
      await deleteDoc(doc(db, "sales", saleId));
    }

    if (rollbackErrors.length > 0) {
      throw new Error(
        "Mutasi stok gagal dan rollback stok perlu dicek manual. Sale baru sudah dihapus agar tidak tersimpan tanpa stok keluar lengkap.",
      );
    }
  };

  // =========================
  // SECTION: Tambah penjualan baru
  // =========================
  const handleAddSale = async () => {
    try {
      const values = await form.validateFields();

      const {
        customerId,
        items,
        salesChannel,
        status,
        date,
        referenceNumber,
        note,
      } = values;

      // =========================
      // SECTION: Validasi stok dan bangun item line final
      // Fungsi:
      // - membangun saleItems final dari form
      // - menjalankan validasi awal dan validasi final Firestore sebelum dokumen sale dibuat
      // Hubungan flow Sales/stok:
      // - sale hanya boleh dibuat jika availableStock master/varian cukup untuk total kebutuhan semua line
      // Status:
      // - aktif/final untuk Fase A Sales stock safety
      // - bukan legacy dan bukan kandidat cleanup
      // =========================
      const saleItems = (items || []).map((item) => buildSaleLine(item));
      await validateSaleStockAvailability(saleItems);

      const totalSaleValue = saleItems.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      );

      const selectedCustomer = customers.find(
        (customer) => customer.id === customerId,
      );

      const newSalePayload = {
        customerId: customerId || null,
        customerName: selectedCustomer?.name || "",
        items: saleItems,
        salesChannel,
        status,
        date: Timestamp.fromDate(date.toDate()),
        referenceNumber: referenceNumber || null,
        total: totalSaleValue,
        note: note || "",
        createdAt: Timestamp.now(),
      };

      const salesDocument = await addDoc(collection(db, "sales"), newSalePayload);
      const appliedStockItems = [];

      // =========================
      // SECTION: Kurangi stok item final dengan rollback jika gagal
      // Fungsi:
      // - memotong stok melalui updateInventoryStock yang sudah variant-aware dan preventNegative
      // - menunda inventory log sampai semua mutasi stok berhasil agar tidak ada log sale untuk transaksi yang dibatalkan
      // Hubungan flow Sales/stok:
      // - jika salah satu mutasi gagal, stok yang sudah sempat terpotong dikembalikan dan dokumen sale baru dihapus
      // Status:
      // - aktif/final untuk Fase A Sales stock safety
      // - bukan legacy; kandidat cleanup hanya jika nanti diganti transaction/cloud function
      // =========================
      try {
        for (const item of newSalePayload.items) {
          await updateInventoryStock({
            itemId: item.itemId,
            collectionName: item.collectionName,
            quantityChange: -item.quantity,
            variantKey: item.variantKey || "",
            preventNegative: true,
          });

          appliedStockItems.push(item);
        }
      } catch (stockMutationError) {
        await rollbackSaleAfterStockMutationFailure({
          saleId: salesDocument.id,
          appliedStockItems,
        });

        throw new Error(
          stockMutationError?.message ||
            "Mutasi stok penjualan gagal. Penjualan dibatalkan dan belum disimpan.",
        );
      }

      // =========================
      // SECTION: Catat log stok setelah mutasi stok berhasil semua
      // Fungsi:
      // - menulis audit trail penjualan hanya setelah stok benar-benar terpotong lengkap
      // Hubungan flow Sales/stok:
      // - mencegah inventory_logs berisi sale yang dokumen transaksinya sudah dihapus karena rollback
      // Status:
      // - aktif/final; bukan legacy dan bukan kandidat cleanup
      // =========================
      for (const item of newSalePayload.items) {
        await addInventoryLog(
          item.itemId,
          item.itemName,
          -item.quantity,
          "sale",
          item.collectionName,
          {
            customerName: newSalePayload.customerName || "",
            saleId: salesDocument.id,
            note: `Penjualan via ${newSalePayload.salesChannel}`,
            subtotal: item.subtotal,
            referenceNumber: newSalePayload.referenceNumber || "",
            variantKey: item.variantKey || "",
            variantLabel: item.variantLabel || "",
            stockSourceType: item.stockSourceType || "master",
          },
        );
      }

      // RULE:
      // Pemasukan kas hanya dicatat saat status Selesai.
      if (status === "Selesai") {
        const itemNames = newSalePayload.items
          .map((item) => `${item.itemName}${item.variantLabel ? ` - ${item.variantLabel}` : ""} (${item.quantity})`)
          .join(", ");

        await addDoc(collection(db, "incomes"), {
          date: Timestamp.fromDate(date.toDate()),
          type: "Penjualan",
          relatedId: salesDocument.id,
          description: `Penjualan: ${itemNames}`,
          amount: totalSaleValue,
          salesChannel: newSalePayload.salesChannel,
        });
      }

      message.success("Penjualan berhasil ditambahkan!");
      setIsModalOpen(false);
      form.resetFields();
      fetchSales(activeTabKey);
    } catch (error) {
      console.error("Gagal tambah penjualan:", error);
      message.error(error?.message || "Gagal menambahkan penjualan.");
    }
  };

  // =========================
  // SECTION: Revert stok sale item
  // =========================
  const revertSaleItemsStock = async (selectedSale, logType, saleId) => {
    for (const item of selectedSale.items || []) {
      // =========================
      // SECTION: Legacy guard cancel/delete
      // Sale baru selalu punya variantKey. allowMasterForVariant hanya untuk data lama yang belum sempat dimigrasi/reset.
      // Aman dihapus setelah reset terarah sales lama selesai.
      // =========================
      await updateInventoryStock({
        itemId: item.itemId,
        collectionName: item.collectionName,
        quantityChange: Number(item.quantity || 0),
        variantKey: item.variantKey || "",
        allowMasterForVariant: !item.variantKey,
      });

      await addInventoryLog(
        item.itemId,
        item.itemName,
        item.quantity,
        logType,
        item.collectionName,
        {
          saleId,
          note:
            logType === "sale_cancel_revert"
              ? `Pembatalan penjualan via ${selectedSale.salesChannel || "-"}`
              : `Pembatalan/hapus penjualan ID: ${saleId}`,
          customerName: selectedSale.customerName || "",
          variantKey: item.variantKey || "",
          variantLabel: item.variantLabel || "",
          stockSourceType: item.stockSourceType || "master",
        },
      );
    }
  };

  // =========================
  // SECTION: Update status penjualan
  // =========================
  const handleUpdateSaleStatus = async (saleId, newStatus) => {
    try {
      const selectedSale = salesRecords.find((sale) => sale.id === saleId);

      // RULE:
      // Jika dibatalkan, stok dikembalikan sebelum status ditutup agar revert tetap memakai sale item snapshot.
      if (newStatus === "Dibatalkan" && selectedSale) {
        await revertSaleItemsStock(selectedSale, "sale_cancel_revert", saleId);
      }

      const saleReference = doc(db, "sales", saleId);
      await updateDoc(saleReference, { status: newStatus });

      // RULE:
      // Saat status berubah menjadi Selesai,
      // baru catat pemasukan kas jika belum pernah dibuat.
      if (newStatus === "Selesai" && selectedSale && selectedSale.total > 0) {
        const incomeExists = await hasExistingIncome(saleId);

        if (!incomeExists) {
          const itemNames = selectedSale.items
            .map((item) => `${item.itemName}${item.variantLabel ? ` - ${item.variantLabel}` : ""} (${item.quantity})`)
            .join(", ");

          await addDoc(collection(db, "incomes"), {
            date: Timestamp.now(),
            type: "Penjualan",
            relatedId: saleId,
            description: `Penjualan: ${itemNames}`,
            amount: selectedSale.total,
            salesChannel: selectedSale.salesChannel || "",
          });
        }
      }

      message.success(`Status penjualan berhasil diubah menjadi ${newStatus}.`);
      fetchSales(activeTabKey);
    } catch (error) {
      console.error("Gagal update status:", error);
      message.error(error?.message || "Gagal mengubah status penjualan.");
    }
  };

  // =========================
  // SECTION: Hapus penjualan
  // =========================
  const handleDeleteSale = async (saleId) => {
    const deleteBatch = writeBatch(db);

    try {
      const selectedSale = salesRecords.find((sale) => sale.id === saleId);

      if (!selectedSale) {
        throw new Error("Penjualan tidak ditemukan.");
      }

      const shouldReturnStock = selectedSale.status !== "Dibatalkan";

      if (shouldReturnStock) {
        await revertSaleItemsStock(selectedSale, "sale_revert", saleId);
      }

      const incomesCollection = collection(db, "incomes");
      const incomeQuery = query(
        incomesCollection,
        where("relatedId", "==", saleId),
      );
      const incomesSnapshot = await getDocs(incomeQuery);

      incomesSnapshot.forEach((incomeDocument) => {
        deleteBatch.delete(incomeDocument.ref);
      });

      const saleReference = doc(db, "sales", saleId);
      deleteBatch.delete(saleReference);

      await deleteBatch.commit();

      message.success(
        shouldReturnStock
          ? "Penjualan berhasil dihapus dan stok dikembalikan."
          : "Penjualan berhasil dihapus tanpa retur stok ulang karena status sudah dibatalkan.",
      );

      fetchSales(activeTabKey);
    } catch (error) {
      console.error("Gagal menghapus penjualan:", error);
      message.error(error?.message || "Gagal menghapus penjualan.");
    }
  };

  // =========================
  // SECTION: Filter berdasarkan nomor referensi
  // =========================
  const filteredSalesRecords = useMemo(() => {
    const searchKeyword = receiptSearch.trim().toLowerCase();

    if (!searchKeyword) {
      return salesRecords;
    }

    return salesRecords.filter((sale) =>
      String(sale.referenceNumber || "")
        .toLowerCase()
        .includes(searchKeyword),
    );
  }, [salesRecords, receiptSearch]);

  // =========================
  // SECTION: Kolom tabel utama
  // =========================
  const salesTableColumns = [
    {
      title: "Pelanggan",
      dataIndex: "customerName",
      key: "customerName",
      render: (value) => value || "-",
    },
    {
      title: "Item",
      dataIndex: "items",
      key: "items",
      render: (items) =>
        Array.isArray(items) && items.length > 0 ? (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {items.map((item, index) => (
              <li key={index}>
                {item.itemName}
                {item.variantLabel ? ` - ${item.variantLabel}` : ""} ({formatNumberId(item.quantity)}) - {formatCurrencyId(item.subtotal || 0)}
              </li>
            ))}
          </ul>
        ) : (
          "-"
        ),
    },
    {
      title: "Channel",
      dataIndex: "salesChannel",
      key: "salesChannel",
    },
    {
      title: "No. Resi / Order / Referensi",
      dataIndex: "referenceNumber",
      key: "referenceNumber",
      render: (value) => value || "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (value) => (value != null ? formatCurrencyId(value) : "-"),
    },
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      fixed: "right",
      className: "app-table-status-column app-table-fixed-secondary",
      render: (status) => {
        const statusColors = {
          Selesai: "green",
          Dikirim: "orange",
          Diproses: "blue",
          Dibatalkan: "red",
        };

        return <Tag color={statusColors[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "Aksi",
      key: "action",
      width: 220,
      fixed: "right",
      className: "app-table-action-column",
      render: (_, record) => (
        <div className="ims-action-group">
          {record.status === "Diproses" &&
            !isOfflineChannel(record.salesChannel) && (
              <Popconfirm
                title="Yakin ubah status menjadi Dikirim?"
                onConfirm={() => handleUpdateSaleStatus(record.id, "Dikirim")}
                okText="Ya"
                cancelText="Tidak"
              >
                <Button className="ims-action-button" size="small">
                  Dikirim
                </Button>
              </Popconfirm>
            )}

          {record.status === "Dikirim" &&
            !isOfflineChannel(record.salesChannel) && (
              <Popconfirm
                title="Yakin ubah status menjadi Selesai?"
                onConfirm={() => handleUpdateSaleStatus(record.id, "Selesai")}
                okText="Ya"
                cancelText="Tidak"
              >
                <Button className="ims-action-button" size="small">
                  Selesai
                </Button>
              </Popconfirm>
            )}

          {(record.status === "Diproses" || record.status === "Dikirim") &&
            !isOfflineChannel(record.salesChannel) && (
              <Popconfirm
                title="Yakin batalkan penjualan ini?"
                onConfirm={() => handleUpdateSaleStatus(record.id, "Dibatalkan")}
                okText="Ya"
                cancelText="Tidak"
              >
                <Button className="ims-action-button" size="small" danger>
                  Batalkan
                </Button>
              </Popconfirm>
            )}

          <Popconfirm
            title="Yakin hapus penjualan ini?"
            onConfirm={() => handleDeleteSale(record.id)}
            okText="Ya"
            cancelText="Tidak"
          >
            <Button className="ims-action-button" size="small" danger icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const salesTabItems = [
    { key: "all", label: "Semua Penjualan" },
    { key: "Diproses", label: "Diproses" },
    { key: "Dikirim", label: "Dikirim" },
    { key: "Selesai", label: "Selesai" },
    { key: "Dibatalkan", label: "Dibatalkan" },
  ];

  const handleSalesChannelChange = (channel) => {
    if (isOfflineChannel(channel)) {
      form.setFieldsValue({ status: "Selesai" });
    } else {
      form.setFieldsValue({ status: "Diproses" });
    }
  };

  return (
    <>
      <PageHeader
        title="Daftar Penjualan"
        subtitle="Kelola transaksi penjualan offline dan online, termasuk pemotongan stok varian serta pencatatan kas masuk."
        actions={[
          {
            key: "add-sale",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Penjualan",
            onClick: openCreateSaleModal,
          },
        ]}
      />

      <PageSection
        title="Filter Penjualan"
        subtitle="Gunakan tab status dan pencarian nomor referensi untuk memantau transaksi lebih cepat."
      >
        <div style={{ marginBottom: 12, maxWidth: 360 }}>
          <Input.Search
            placeholder="Cari nomor resi / order / referensi"
            allowClear
            value={receiptSearch}
            onChange={(event) => setReceiptSearch(event.target.value)}
          />
        </div>

        <Tabs items={salesTabItems} activeKey={activeTabKey} onChange={(key) => setActiveTabKey(key)} />
      </PageSection>

      <PageSection
        title="Data Penjualan"
        subtitle="Semua transaksi penjualan akan mengurangi stok item/varian yang terjual dan dapat menghasilkan pemasukan saat selesai."
      >
        <Table
          className="app-data-table"
          columns={salesTableColumns}
          dataSource={filteredSalesRecords}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          loading={isLoading}
          scroll={{ x: 1240 }}
        />
      </PageSection>

      <Modal
        title="Tambah Penjualan"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => setIsModalOpen(false)}
        okText="Simpan"
        cancelText="Batal"
        width={860}
      >
        <Form form={form} layout="vertical" onFinish={handleAddSale}>
          <Form.Item label="Pelanggan" name="customerId" extra="Opsional. Boleh dikosongkan untuk pembeli offline umum atau marketplace.">
            <Select placeholder="Pilih pelanggan" allowClear showSearch optionFilterProp="children">
              {customers.map((customer) => (
                <Option key={customer.id} value={customer.id}>
                  {customer.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ border: "1px solid #d9d9d9", padding: 12, marginBottom: 16, borderRadius: 8 }}>
                    <Form.Item {...restField} name={[name, "itemId"]} rules={[{ required: true, message: "Pilih item!" }]} style={{ marginBottom: 12 }}>
                      <Select placeholder="Pilih produk / bahan baku" onChange={(itemId) => handleSaleItemChange(itemId, name)} showSearch optionFilterProp="children">
                        {/* ACTIVE / FINAL: opsi item menampilkan availableStock agar UI Sales sejalan dengan validasi stok final. Bukan legacy/kandidat cleanup. */}
                        {sellableItems.map((item) => (
                          <Option key={item.itemKey} value={item.itemKey}>
                            {item.name} ({item.typeLabel} - Stok tersedia: {formatNumberId(getItemStockSnapshot(item).availableStock)})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const selectedItemKey = getFieldValue(["items", name, "itemId"]);
                        const selectedItem = findSellableItem(selectedItemKey);
                        const hasVariants = inferHasVariants(selectedItem || {});
                        const currentVariantKey = getFieldValue(["items", name, "variantKey"]);
                        const selectedVariant = hasVariants ? findVariantByKey(selectedItem, currentVariantKey) : null;

                        return selectedItem ? (
                          <>
                            {hasVariants ? (
                              <Form.Item
                                {...restField}
                                name={[name, "variantKey"]}
                                label={selectedItem.variantLabel || "Varian"}
                                rules={[{ required: true, message: "Pilih varian!" }]}
                                extra="Item ini bervarian. Penjualan wajib memotong stok varian yang dipilih."
                              >
                                <Select placeholder="Pilih varian" showSearch optionFilterProp="children">
                                  {buildVariantOptionsFromItem(selectedItem).map((item) => (
                                    <Option key={item.value} value={item.value}>
                                      {item.label} - Stok tersedia: {formatNumberId(item.raw?.availableStock || 0)}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            ) : null}

                            {/* ACTIVE / FINAL: alert stok memakai availableStock master/varian supaya user melihat angka yang sama dengan guard submit. Bukan legacy/kandidat cleanup. */}
                            <Alert
                              showIcon
                              type={hasVariants ? "info" : "success"}
                              style={{ marginBottom: 12 }}
                              message={
                                hasVariants
                                  ? `Stok tersedia varian terpilih: ${formatNumberId(selectedVariant?.availableStock || 0)}`
                                  : `Stok tersedia master saat ini: ${formatNumberId(getItemStockSnapshot(selectedItem).availableStock)}`
                              }
                            />
                          </>
                        ) : null;
                      }}
                    </Form.Item>

                    <Space style={{ marginBottom: 12 }} align="baseline" wrap>
                      <Form.Item {...restField} name={[name, "quantity"]} rules={[{ required: true, message: "Jumlah!" }]}>
                        <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} placeholder="Jumlah" style={{ width: 120 }} />
                      </Form.Item>

                      <Form.Item {...restField} name={[name, "pricePerUnit"]} rules={[{ required: true, message: "Harga!" }]}>
                        <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} placeholder="Harga Satuan" style={{ width: 180 }} />
                      </Form.Item>

                      <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} />
                    </Space>
                  </div>
                ))}

                <Form.Item>
                  <Button type="dashed" onClick={() => add({ itemId: undefined, variantKey: undefined, quantity: 1, pricePerUnit: 0 })} block icon={<PlusOutlined />}>
                    Tambah Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item label="Channel Penjualan" name="salesChannel" rules={[{ required: true, message: "Harap pilih channel!" }]} initialValue="Shopee">
            <Select placeholder="Pilih channel penjualan" onChange={handleSalesChannelChange}>
              {salesChannels.map((channel) => (
                <Option key={channel.value} value={channel.value}>
                  {channel.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const salesChannel = getFieldValue("salesChannel");
              const isOffline = isOfflineChannel(salesChannel);

              return (
                <Form.Item label="Status" name="status" rules={[{ required: true, message: "Harap pilih status!" }]} initialValue={isOffline ? "Selesai" : "Diproses"}>
                  <Select placeholder="Pilih status" disabled={isOffline}>
                    {isOffline ? (
                      <Option value="Selesai">Selesai</Option>
                    ) : (
                      onlineStatuses.map((status) => (
                        <Option key={status} value={status}>
                          {status}
                        </Option>
                      ))
                    )}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item label="No. Resi / No. Order / Referensi" name="referenceNumber">
            <Input placeholder="Opsional: Masukkan nomor resi / order / referensi" />
          </Form.Item>

          <Form.Item label="Tanggal" name="date" rules={[{ required: true, message: "Harap pilih tanggal!" }]} initialValue={dayjs()}>
            <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Catatan" name="note">
            <Input.TextArea rows={3} placeholder="Catatan tambahan" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Sales;
