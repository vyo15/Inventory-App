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
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
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

// IMS NOTE [AKTIF] - Filter sumber item Sales.
// Fungsi blok: menyediakan pilihan Jenis Item per line agar Produk Jadi dan Bahan Baku tidak tercampur dalam satu dropdown panjang.
// Hubungan flow: ini hanya helper UI; payload final sale tetap memakai collectionName + itemId dari item terpilih.
// Alasan logic: user memilih sumber item dulu, lalu Select item difilter tanpa mengubah business rule penjualan.
const sellableItemTypeOptions = [
  { value: "products", label: "Produk Jadi" },
  { value: "raw_materials", label: "Bahan Baku" },
];

const defaultSaleLineItemType = "products";

const buildDefaultSaleLine = (overrides = {}) => ({
  itemType: defaultSaleLineItemType,
  itemId: undefined,
  variantKey: undefined,
  quantity: 1,
  pricePerUnit: 0,
  ...overrides,
});

const buildDefaultSaleFormValues = () => ({
  salesChannel: "Shopee",
  status: "Diproses",
  date: dayjs(),
  items: [buildDefaultSaleLine()],
});

// IMS NOTE [AKTIF/GUARDED] - Helper display income Sales.
// Fungsi blok: menyatukan teks item untuk income create dan status Selesai tanpa mengubah kapan income dibuat.
// Hubungan flow: rule income tetap terlihat di handler; helper ini hanya format description.
const formatSaleIncomeItemNames = (items = []) =>
  items
    .map((item) => `${item.itemName}${item.variantLabel ? ` - ${item.variantLabel}` : ""} (${item.quantity})`)
    .join(", ");

const buildSaleIncomePayload = ({ saleId, items = [], amount = 0, salesChannel = "", date }) => ({
  date: date?.toDate ? Timestamp.fromDate(date.toDate()) : Timestamp.now(),
  type: "Penjualan",
  relatedId: saleId,
  description: `Penjualan: ${formatSaleIncomeItemNames(items)}`,
  amount,
  salesChannel,
});

const buildSaleStockBucketKey = (item) =>
  `${item.collectionName}::${item.itemId}::${item.variantKey || "master"}`;

const getSaleLineAvailableStock = ({ item = {}, variant = null }) =>
  variant
    ? Number(variant.availableStock || 0)
    : Number(getItemStockSnapshot(item).availableStock || 0);

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

  // IMS NOTE [AKTIF] - Item dropdown difilter berdasarkan Jenis Item.
  // Fungsi blok: menampilkan hanya item dari collection yang dipilih user pada line Sales.
  // Hubungan flow: buildSellableKey tetap dipakai sehingga payload final lama tetap kompatibel.
  // Alasan logic: mengurangi risiko salah pilih item saat products dan raw_materials sudah banyak.
  const getSellableItemsByType = (itemType) =>
    sellableItems.filter((item) => item.collectionName === itemType);

  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchRawMaterials();
    fetchCustomers();
  }, []);

  // =========================
  // SECTION: Ambil semua data penjualan
  // =========================
  const fetchSales = async () => {
    setIsLoading(true);

    // IMS NOTE [GUARDED] - Clear state sebelum fetch ulang Sales.
    // Fungsi blok: mencegah row lama terlihat saat data penjualan dimuat ulang.
    // Hubungan flow Sales: hanya menjaga tampilan tabel; status transition, stock mutation, income timing, dan cancel/delete tidak diubah.
    // Alasan logic: Sales tab harus menjadi source UX yang aman agar Dikirim/Selesai/Dibatalkan tidak saling tampil karena state stale.
    setSalesRecords([]);

    try {
      const salesCollection = collection(db, "sales");

      // IMS NOTE [AKTIF/GUARDED] - Sales difetch satu source lalu difilter client-side.
      // Fungsi blok: menghindari tab status kosong karena query per-status/index Firestore gagal.
      // Hubungan flow: hanya strategi read tabel/summary; status transition, stok, income, cancel, dan payload Firestore tidak berubah.
      // Alasan logic: semua tab membaca dataset yang sama, lalu activeTabKey menjaga row sesuai status aktif. Behavior official accounting tetap dari status Selesai.
      const salesQuery = query(salesCollection, orderBy("createdAt", "desc"));
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
      setSalesRecords([]);
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
  // SECTION: Saat jenis item berubah, reset line agar tidak memakai item/varian/harga stale
  // =========================
  const handleSaleItemTypeChange = (itemType, itemIndex) => {
    const currentItems = form.getFieldValue("items") || [];

    // IMS NOTE [GUARDED] - Reset field line saat sumber item berubah.
    // Fungsi blok: menghapus itemId, variantKey, qty, dan harga yang mungkin berasal dari collection lama.
    // Hubungan flow Sales/stok: mencegah payload final memakai collectionName/item/variant yang tidak sesuai filter UI.
    // Alasan logic: itemType adalah field UI-only; source final tetap dibangun dari selectedItem.collectionName.
    currentItems[itemIndex] = buildDefaultSaleLine({ itemType });

    form.setFieldsValue({ items: [...currentItems] });
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
    const autoPrice = selectedItem.collectionName === "products"
      ? Number(selectedItem.price || 0)
      : Number(selectedItem.sellingPrice || 0);

    currentItems[itemIndex] = {
      ...(currentItems[itemIndex] || {}),
      itemId: itemKey,
      variantKey: undefined,
      pricePerUnit: autoPrice,
    };

    form.setFieldsValue({ items: [...currentItems] });
  };

  // =========================
  // SECTION: Helper channel offline dan reference
  // =========================
  const isOfflineChannel = (channel) => channel === "Offline";

  // IMS NOTE [AKTIF/GUARDED] - WhatsApp hanya non-reference, bukan offline status.
  // Fungsi blok: menentukan apakah input No. Resi/Order/Referensi boleh aktif.
  // Hubungan flow: Offline tetap otomatis Selesai; WhatsApp tidak diubah status/income timing-nya.
  // Alasan logic: mencegah resi marketplace terisi pada channel yang biasanya tidak memakai reference.
  const isReferenceNumberEnabledChannel = (channel) =>
    !["Offline", "WhatsApp"].includes(channel);

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

    form.setFieldsValue(buildDefaultSaleFormValues());
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

    const availableStock = getSaleLineAvailableStock({
      item: selectedItem,
      variant: selectedVariant,
    });
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

      const availableStock = getSaleLineAvailableStock({
        item: latestItem,
        variant: latestVariant,
      });

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
        referenceNumber: isReferenceNumberEnabledChannel(salesChannel)
          ? referenceNumber || null
          : null,
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

      // RULE: Pemasukan kas hanya dicatat saat status Selesai.
      if (status === "Selesai") {
        await addDoc(
          collection(db, "incomes"),
          buildSaleIncomePayload({
            saleId: salesDocument.id,
            items: newSalePayload.items,
            amount: totalSaleValue,
            salesChannel: newSalePayload.salesChannel,
            date,
          }),
        );
      }

      message.success("Penjualan berhasil ditambahkan!");
      setIsModalOpen(false);
      form.resetFields();
      fetchSales();
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
          await addDoc(
            collection(db, "incomes"),
            buildSaleIncomePayload({
              saleId,
              items: selectedSale.items,
              amount: selectedSale.total,
              salesChannel: selectedSale.salesChannel || "",
            }),
          );
        }
      }

      message.success(`Status penjualan berhasil diubah menjadi ${newStatus}.`);
      fetchSales();
    } catch (error) {
      console.error("Gagal update status:", error);
      message.error(error?.message || "Gagal mengubah status penjualan.");
    }
  };

  // =========================
  // SECTION: Filter tabel berdasarkan tab status dan nomor referensi
  // =========================
  const filteredSalesRecords = useMemo(() => {
    const searchKeyword = receiptSearch.trim().toLowerCase();

    // IMS NOTE [AKTIF/GUARDED] - Client-side guard tab status Sales.
    // Fungsi blok: menjaga tabel selalu sesuai activeTabKey walaupun query Firestore gagal, loading ulang, atau state lama masih tersisa.
    // Hubungan flow Sales: hanya filter tampilan tabel; status transition, stock mutation, income timing, dan cancel/delete tidak diubah.
    // Alasan logic: owner tidak boleh membaca status Selesai di tab Dikirim atau status lain yang tidak sesuai tab aktif.
    const statusMatchedRecords =
      activeTabKey === "all"
        ? salesRecords
        : salesRecords.filter((sale) => sale.status === activeTabKey);

    if (!searchKeyword) {
      return statusMatchedRecords;
    }

    return statusMatchedRecords.filter((sale) =>
      String(sale.referenceNumber || "")
        .toLowerCase()
        .includes(searchKeyword),
    );
  }, [activeTabKey, salesRecords, receiptSearch]);


  // =========================
  // SECTION: Summary monitoring penjualan
  // =========================
  const salesSummaryItems = useMemo(() => {
    // IMS NOTE [AKTIF/GUARDED] - Pending income hanya monitoring di halaman Sales.
    // Fungsi blok: menghitung estimasi uang dari sales Diproses/Dikirim tanpa menulis ke revenues/incomes.
    // Hubungan flow: Cash In dan Profit Loss tetap membaca pemasukan resmi dari revenues + incomes; pending tidak masuk kas resmi.
    // Alasan logic: marketplace/online belum menjadi income resmi sebelum status Selesai, tetapi owner tetap butuh estimasi uang tertahan.
    const pendingSalesRecords = salesRecords.filter((sale) => {
      const status = sale.status || "";
      const channel = sale.salesChannel || "";

      return ["Diproses", "Dikirim"].includes(status) && !isOfflineChannel(channel);
    });

    const pendingAmount = pendingSalesRecords.reduce(
      (total, sale) => total + Number(sale.total || 0),
      0,
    );

    const completedAmount = salesRecords
      .filter((sale) => sale.status === "Selesai")
      .reduce((total, sale) => total + Number(sale.total || 0), 0);

    return [
      {
        key: "sales-pending-income",
        title: "Pemasukan Pending",
        value: formatCurrencyId(pendingAmount),
        subtitle: `${formatNumberId(pendingSalesRecords.length)} penjualan Diproses/Dikirim. Belum masuk pemasukan resmi.`,
        accent: "warning",
      },
      {
        key: "sales-official-completed",
        title: "Penjualan Selesai",
        value: formatCurrencyId(completedAmount),
        subtitle: "Nilai sales berstatus Selesai yang menjadi dasar income resmi.",
        accent: "success",
      },
      {
        key: "sales-active-tab-count",
        title: "Data Tab Aktif",
        value: formatNumberId(filteredSalesRecords.length),
        subtitle: activeTabKey === "all" ? "Semua status penjualan." : `Hanya status ${activeTabKey}.`,
        accent: "primary",
      },
    ];
  }, [activeTabKey, filteredSalesRecords.length, salesRecords]);

  // =========================
  // SECTION: Kolom tabel utama
  // IMS NOTE [AKTIF] - Urutan kolom Sales dibuat mengikuti alur baca transaksi.
  // Fungsi blok: menampilkan tanggal lebih dulu, lalu pelanggan, item, channel, referensi, total, status, dan aksi.
  // Hubungan flow: hanya mengubah presentasi tabel; filter tab, pending income, status transition, stok, income, dan cancel flow tidak berubah.
  // Alasan logic: owner lebih mudah membaca kronologi penjualan tanpa mengubah data transaksi atau payload Firestore.
  // =========================
  const salesTableColumns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
      width: 140,
      render: (value) => value || "-",
    },
    {
      title: "Pelanggan",
      dataIndex: "customerName",
      key: "customerName",
      width: 160,
      render: (value) => value || "-",
    },
    {
      title: "Item",
      dataIndex: "items",
      key: "items",
      width: 300,
      render: (items) =>
        Array.isArray(items) && items.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item, index) => (
              <div key={index}>
                <div style={{ fontWeight: 600 }}>
                  {item.itemName}
                  {item.variantLabel ? ` - ${item.variantLabel}` : ""}
                </div>
                <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                  {formatNumberId(item.quantity)} x {formatCurrencyId(item.pricePerUnit || 0)} = {formatCurrencyId(item.subtotal || 0)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          "-"
        ),
    },
    {
      title: "Channel",
      dataIndex: "salesChannel",
      key: "salesChannel",
      width: 130,
      render: (value) => value || "-",
    },
    {
      title: "Resi / Order / Referensi",
      dataIndex: "referenceNumber",
      key: "referenceNumber",
      width: 190,
      render: (value) => value || "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 140,
      render: (value) => (value != null ? formatCurrencyId(value) : "-"),
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
      // IMS NOTE [AKTIF/GUARDED] - Action button Sales tanpa hard delete user biasa.
      // Fungsi blok: hanya memberi aksi status resmi; penjualan tidak jadi harus lewat Batalkan agar record audit tetap ada.
      // Hubungan flow: stok, income, cancel stock revert, dan inventory log tetap memakai handler existing; hard delete tidak tampil di tabel.
      // Alasan logic: Sales adalah transaksi auditable, sehingga tombol Hapus tidak boleh menjadi aksi operasional biasa.
      title: "Aksi",
      key: "action",
      width: 220,
      fixed: "right",
      className: "app-table-action-column",
      render: (_, record) => {
        const isOffline = isOfflineChannel(record.salesChannel);
        const canMoveToShipped = record.status === "Diproses" && !isOffline;
        const canComplete = record.status === "Dikirim" && !isOffline;
        const canCancel = ["Diproses", "Dikirim"].includes(record.status) && !isOffline;

        if (!canMoveToShipped && !canComplete && !canCancel) {
          return "-";
        }

        return (
          <div className="ims-action-group ims-action-group--vertical">
            {canMoveToShipped ? (
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
            ) : null}

            {canComplete ? (
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
            ) : null}

            {canCancel ? (
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
            ) : null}
          </div>
        );
      },
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
    const nextValues = isOfflineChannel(channel)
      ? { status: "Selesai" }
      : { status: "Diproses" };

    // IMS NOTE [AKTIF/GUARDED] - Reference dikosongkan untuk channel non-reference.
    // Fungsi blok: menghapus nilai resi/order lama saat user mengganti channel ke Offline/WhatsApp.
    // Hubungan flow: field reference tetap opsional dan tidak mengubah status/income timing WhatsApp.
    // Alasan logic: mencegah data reference marketplace tersimpan pada channel yang tidak relevan.
    if (!isReferenceNumberEnabledChannel(channel)) {
      nextValues.referenceNumber = undefined;
    }

    form.setFieldsValue(nextValues);
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
        title="Ringkasan Penjualan"
        subtitle="Pemasukan Pending hanya estimasi monitoring, belum masuk Cash In atau Profit Loss sampai status Selesai."
      >
        <SummaryStatGrid items={salesSummaryItems} columns={{ xs: 24, md: 8 }} />
      </PageSection>

      <PageSection
        title="Filter Penjualan"
        subtitle="Gunakan tab status dan pencarian nomor referensi untuk memantau transaksi lebih cepat."
      >
        <div style={{ marginBottom: 12, maxWidth: 360 }}>
          <Input.Search
            placeholder="Cari resi / order marketplace / referensi"
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
                    <Space style={{ width: "100%" }} align="baseline" wrap>
                      <Form.Item
                        {...restField}
                        label="Jenis Item"
                        name={[name, "itemType"]}
                        rules={[{ required: true, message: "Pilih jenis item!" }]}
                        style={{ width: 180, marginBottom: 12 }}
                      >
                        <Select placeholder="Pilih jenis" onChange={(itemType) => handleSaleItemTypeChange(itemType, name)}>
                          {sellableItemTypeOptions.map((option) => (
                            <Option key={option.value} value={option.value}>
                              {option.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Form.Item shouldUpdate noStyle>
                        {({ getFieldValue }) => {
                          const selectedItemType = getFieldValue(["items", name, "itemType"]);
                          const filteredSellableItems = getSellableItemsByType(selectedItemType);

                          return (
                            <Form.Item
                              {...restField}
                              label="Item Penjualan"
                              name={[name, "itemId"]}
                              rules={[{ required: true, message: "Pilih item!" }]}
                              extra={
                                selectedItemType
                                  ? "Daftar item sudah difilter berdasarkan Jenis Item."
                                  : "Pilih Jenis Item terlebih dahulu."
                              }
                              style={{ flex: 1, minWidth: 320, marginBottom: 12 }}
                            >
                              <Select
                                placeholder={selectedItemType ? "Pilih item sesuai jenis" : "Pilih Jenis Item dulu"}
                                disabled={!selectedItemType}
                                onChange={(itemId) => handleSaleItemChange(itemId, name)}
                                showSearch
                                optionFilterProp="children"
                              >
                                {/* IMS NOTE [AKTIF] - opsi item difilter per collection dan label stok disederhanakan karena detail stok sudah tampil di panel read-only. */}
                                {filteredSellableItems.map((item) => (
                                  <Option key={item.itemKey} value={item.itemKey}>
                                    {item.name} ({item.typeLabel})
                                  </Option>
                                ))}
                              </Select>
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Space>

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
                                      {item.label}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            ) : null}

                            {/* IMS NOTE [AKTIF/GUARDED] - Snapshot stok Sales.
                                Fungsi blok: menampilkan stok current/reserved/available item terpilih sebagai panel read-only pasif.
                                Hubungan flow: hanya mengganti tampilan Alert lama; validasi stok, create sale, stock reduction, income timing, cancel/delete, dan payload Firestore tetap memakai logic existing.
                                Alasan logic: stok tersedia sebelum penjualan adalah info snapshot, bukan warning/error, sehingga mengikuti pola clean panel seperti Purchases/Stock Adjustment.
                                Status: AKTIF untuk UI Sales, GUARDED terhadap business rule stok dan transaksi. */}
                            <div className="ims-readonly-panel">
                              <div className="ims-readonly-panel-header">
                                <div>
                                  <div className="ims-readonly-panel-title">
                                    Stok Tersedia Sebelum Penjualan
                                  </div>
                                  <div className="ims-readonly-panel-description">
                                    Snapshot ini hanya membantu membaca stok. Pengurangan stok tetap terjadi saat penjualan disimpan.
                                  </div>
                                </div>
                                <Tag color={hasVariants ? "purple" : "default"}>
                                  {hasVariants ? "Varian" : "Master"}
                                </Tag>
                              </div>

                              <div style={{ marginBottom: 10 }}>
                                <span style={{ fontWeight: 600 }}>
                                  {selectedItem.name || "Item"}
                                </span>
                                {hasVariants ? (
                                  <span style={{ color: "var(--ims-text-secondary)" }}>
                                    {` — ${selectedVariant?.variantLabel || selectedVariant?.name || "Pilih varian"}`}
                                  </span>
                                ) : null}
                              </div>

                              <div className="ims-readonly-stat-grid">
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Current Stock</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.currentStock : getItemStockSnapshot(selectedItem).currentStock) || 0)}
                                  </div>
                                </div>
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Reserved Stock</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.reservedStock : getItemStockSnapshot(selectedItem).reservedStock) || 0)}
                                  </div>
                                </div>
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Available Stock</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.availableStock : getItemStockSnapshot(selectedItem).availableStock) || 0)}
                                  </div>
                                </div>
                              </div>

                              {hasVariants ? (
                                <div className="ims-readonly-panel-note">
                                  Item bervarian wajib memilih varian agar stok yang terpotong berasal dari bucket variantKey yang benar.
                                </div>
                              ) : null}
                            </div>
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
                  <Button type="dashed" onClick={() => add(buildDefaultSaleLine())} block icon={<PlusOutlined />}>
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

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const salesChannel = getFieldValue("salesChannel");
              const referenceEnabled = isReferenceNumberEnabledChannel(salesChannel);

              return (
                <Form.Item
                  label="No. Resi / No. Order Marketplace"
                  name="referenceNumber"
                  extra={
                    referenceEnabled
                      ? "Opsional untuk marketplace/online. Isi jika ada nomor resi, order, atau reference transaksi."
                      : "Tidak diperlukan untuk Offline/WhatsApp. Nilai akan dikosongkan otomatis."
                  }
                >
                  <Input
                    disabled={!referenceEnabled}
                    placeholder={
                      referenceEnabled
                        ? "Opsional: masukkan nomor resi / order marketplace"
                        : "Tidak diperlukan untuk channel ini"
                    }
                  />
                </Form.Item>
              );
            }}
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
