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
  Tooltip,
  Drawer,
  Empty,
  Progress,
} from "antd";
import { PlusOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import { SALES_CHANNEL_OPTIONS, buildSalesChannelSummary } from "../../constants/salesChannelOptions";
import {
  getSalesCustomerReferences,
  resolveSalesCustomerReference,
} from "../../services/Transaksi/salesCustomerReferenceService";
import {
  createSaleTransaction,
  fetchSalesProducts,
  fetchSalesRawMaterials,
  fetchSalesRecords,
  updateSaleStatusTransaction,
  validateSaleStockAvailability,
} from "../../services/Transaksi/salesService";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const { Option } = Select;

// =========================
// SECTION: Daftar channel penjualan
// =========================
const salesChannels = SALES_CHANNEL_OPTIONS;

const getSaleDisplayReference = (sale) =>
  sale.saleNumber || sale.code || sale.referenceNumber || sale.sourceRef || "Tanpa ref";

const getSaleExternalReference = (sale) =>
  sale.externalReferenceNumber || "-";

const getSalesStatusColor = (status) => {
  const statusColors = {
    Selesai: "green",
    Dikirim: "orange",
    Diproses: "blue",
  };

  return statusColors[status] || "default";
};

// IMS NOTE [AKTIF] - Filter sumber item Sales.
// Fungsi blok: menyediakan pilihan Jenis Item per line agar Produk Jadi dan Bahan Baku tidak tercampur dalam satu dropdown panjang.
// Hubungan flow: ini hanya helper UI; payload final sale tetap memakai collectionName + itemId dari item terpilih.
// Alasan logic: user memilih sumber item dulu, lalu Select item difilter tanpa mengubah business rule penjualan.
const sellableItemTypeOptions = [
  { value: "products", label: "Produk Jadi" },
  { value: "raw_materials", label: "Bahan Baku" },
];

const defaultSaleLineItemType = "products";

// =====================================================
// SECTION: Status penjualan online — AKTIF / GUARDED
// Fungsi:
// - Menentukan status aktif Sales online yang boleh dibuat oleh user.
//
// Dipakai oleh:
// - Form create Sales dan guard status Sales.
//
// Alasan perubahan:
// - Sales tidak boleh dibatalkan dari menu Sales; pembeli batal/barang kembali wajib lewat Return agar stok dan audit tetap jelas.
//
// Catatan cleanup:
// - Tidak ada; status batal tidak menjadi flow aktif Sales.
//
// Risiko:
// - Jika jalur pembatalan diaktifkan lagi dari Sales, stok bisa direvert tanpa alur Return dan audit transaksi menjadi ambigu.
// =====================================================
const onlineStatuses = ["Diproses", "Dikirim", "Selesai"];

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
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState("all");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [selectedSalesChannelKey, setSelectedSalesChannelKey] = useState(null);
  const [channelDetailStatusFilter, setChannelDetailStatusFilter] = useState("all");
  const [channelDetailSearch, setChannelDetailSearch] = useState("");

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

    setSalesRecords([]);

    try {
      const fetchedSalesRecords = await fetchSalesRecords();
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
      const productList = await fetchSalesProducts();
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
      const rawMaterialList = await fetchSalesRawMaterials();
      setRawMaterials(rawMaterialList);
    } catch (error) {
      console.error("Gagal mengambil data bahan baku:", error);
      message.error("Gagal memuat daftar bahan baku.");
    }
  };

  // =========================
  // SECTION: Ambil customer
  // Fungsi:
  // - membaca customer lewat salesCustomerReferenceService agar Sales tetap Firebase-primary
  // Hubungan flow:
  // - dropdown Sales tidak boleh memakai customer offline-local yang belum tersync ke Firebase
  // Status:
  // - aktif/final
  // - tetap menyimpan snapshot customerName saat sale dibuat agar transaksi lama aman
  // =========================
  const fetchCustomers = async () => {
    try {
      const customerList = await getSalesCustomerReferences();
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
    currentItems[itemIndex] = {
      ...(currentItems[itemIndex] || {}),
      itemType,
      itemId: undefined,
      variantKey: undefined,
      quantity: 1,
      pricePerUnit: 0,
    };

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
      items: [{ itemType: defaultSaleLineItemType, itemId: undefined, variantKey: undefined, quantity: 1, pricePerUnit: 0 }],
    });
  };

  // =========================
  // SECTION: Normalisasi line penjualan final
  // Fungsi:
  // - membentuk snapshot item yang akan disimpan ke dokumen sales
  // - melakukan guard awal memakai availableStock dari cache UI agar user langsung mendapat feedback
  // Hubungan flow Sales/stok:
  // - sale line menyimpan collectionName + variantKey supaya mutasi stok keluar selalu memakai sumber stok yang sama
  // Status:
  // - aktif/final; validasi preflight Firestore dipanggil dari salesService, dan validasi final tetap diulang dalam createSaleTransaction
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
      unit:
        selectedItem.stockUnit ||
        selectedItem.unit ||
        selectedItem.baseUnit ||
        (selectedItem.collectionName === "products" ? "pcs" : ""),
    };
  };

  // =========================
  // SECTION: Tambah penjualan baru
  // =========================
  const handleAddSale = async () => {
    if (isSubmittingSale) return;

    try {
      setIsSubmittingSale(true);
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

      const saleItems = (items || []).map((item) => buildSaleLine(item));
      await validateSaleStockAvailability(saleItems);

      const totalSaleValue = saleItems.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      );

      const finalSaleStatus = isOfflineChannel(salesChannel) ? "Selesai" : status;

      if (!isOfflineChannel(salesChannel) && !onlineStatuses.includes(finalSaleStatus)) {
        throw new Error("Status online hanya boleh Diproses, Dikirim, atau Selesai. Jika pembeli batal setelah transaksi tercatat, gunakan menu Return.");
      }

      const selectedCustomer = resolveSalesCustomerReference(customers, customerId);

      await createSaleTransaction({
        saleItems,
        salesChannel,
        finalSaleStatus,
        saleDate: date,
        referenceNumber: isReferenceNumberEnabledChannel(salesChannel)
          ? referenceNumber
          : null,
        note,
        selectedCustomer,
        totalSaleValue,
      });

      message.success("Penjualan berhasil ditambahkan!");
      setIsModalOpen(false);
      form.resetFields();
      fetchSales();
    } catch (error) {
      console.error("Gagal tambah penjualan:", error);
      message.error(error?.message || "Gagal menambahkan penjualan.");
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // =====================================================
  // SECTION: Update status penjualan — AKTIF / GUARDED
  // Fungsi:
  // - Mengubah status Sales online hanya pada jalur resmi Diproses -> Dikirim -> Selesai.
  //
  // Dipakai oleh:
  // - Action button pada tabel Sales.
  //
  // Alasan perubahan:
  // - Aksi batal dari Sales tidak menjadi flow bisnis; Return adalah jalur resmi untuk barang kembali/stok masuk.
  //
  // Catatan cleanup:
  // - Tidak ada; flow cancel user-facing tidak dipakai di Sales.
  //
  // Risiko:
  // - Mengaktifkan aksi batal dari Sales bisa membuka peluang stok masuk tanpa Return dan membuat audit ambigu.
  // =====================================================
  const handleUpdateSaleStatus = async (saleId, newStatus) => {
    if (!onlineStatuses.includes(newStatus)) {
      message.error("Status Sales tidak valid. Gunakan menu Return untuk barang kembali.");
      return;
    }

    try {
      const selectedSale = salesRecords.find((sale) => sale.id === saleId);

      await updateSaleStatusTransaction({
        saleId,
        newStatus,
        selectedSale,
      });

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
    // Hubungan flow Sales: hanya filter tampilan tabel; status transition, stock mutation, income timing, dan alur Return tidak diubah.
    // Alasan logic: owner tidak boleh membaca status Selesai di tab Dikirim atau status lain yang tidak sesuai tab aktif.
    const statusMatchedRecords =
      activeTabKey === "all"
        ? salesRecords
        : salesRecords.filter((sale) => sale.status === activeTabKey);

    if (!searchKeyword) {
      return statusMatchedRecords;
    }

    return statusMatchedRecords.filter((sale) =>
      [
        sale.saleNumber,
        sale.code,
        sale.referenceNumber,
        sale.sourceRef,
        sale.externalReferenceNumber,
        sale.customerName,
        sale.salesChannel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchKeyword),
    );
  }, [activeTabKey, salesRecords, receiptSearch]);


  // =========================
  // SECTION: Ringkasan penjualan per channel
  // =========================
  const salesChannelSummaryItems = useMemo(
    () => buildSalesChannelSummary(filteredSalesRecords),
    [filteredSalesRecords],
  );

  const salesChannelTotalAmount = useMemo(
    () => salesChannelSummaryItems.reduce((total, channel) => total + Number(channel.totalAmount || 0), 0),
    [salesChannelSummaryItems],
  );

  const salesChannelTotalTransactions = useMemo(
    () => salesChannelSummaryItems.reduce((total, channel) => total + Number(channel.transactionCount || 0), 0),
    [salesChannelSummaryItems],
  );

  const topSalesChannelSummary =
    salesChannelSummaryItems.find((channel) => channel.transactionCount > 0) ||
    null;

  const highestPendingSalesChannelSummary =
    salesChannelSummaryItems.reduce((highest, channel) => {
      if (!highest || Number(channel.pendingAmount || 0) > Number(highest.pendingAmount || 0)) {
        return channel;
      }

      return highest;
    }, null);

  const selectedSalesChannelSummary = useMemo(
    () => salesChannelSummaryItems.find((channel) => channel.key === selectedSalesChannelKey) || null,
    [salesChannelSummaryItems, selectedSalesChannelKey],
  );

  const openSalesChannelDetail = (channelKey) => {
    const selectedSummary = salesChannelSummaryItems.find((channel) => channel.key === channelKey);

    if (!selectedSummary || selectedSummary.transactionCount <= 0) {
      return;
    }

    setSelectedSalesChannelKey(channelKey);
    setChannelDetailStatusFilter("all");
    setChannelDetailSearch("");
  };

  const closeSalesChannelDetail = () => {
    setSelectedSalesChannelKey(null);
    setChannelDetailStatusFilter("all");
    setChannelDetailSearch("");
  };

  const selectedSalesChannelTransactions = useMemo(() => {
    if (!selectedSalesChannelSummary) {
      return [];
    }

    const searchKeyword = channelDetailSearch.trim().toLowerCase();

    return selectedSalesChannelSummary.transactions.filter((sale) => {
      const statusMatched =
        channelDetailStatusFilter === "all" || sale.status === channelDetailStatusFilter;

      if (!statusMatched) {
        return false;
      }

      if (!searchKeyword) {
        return true;
      }

      return [
        getSaleDisplayReference(sale),
        getSaleExternalReference(sale),
        sale.customerName,
        sale.status,
        sale.date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchKeyword);
    });
  }, [channelDetailSearch, channelDetailStatusFilter, selectedSalesChannelSummary]);


  // =========================
  // SECTION: Summary monitoring penjualan
  // =========================
  const salesSummaryItems = useMemo(() => {
    // IMS NOTE [AKTIF/GUARDED] - Pending income hanya monitoring di halaman Sales.
    // Fungsi blok: menghitung estimasi uang dari sales Diproses/Dikirim tanpa menulis ke revenues/incomes.
    // Hubungan flow: Cash In dan Profit Loss tetap membaca pemasukan resmi dari revenues + incomes; pending tidak masuk kas resmi.
    // Alasan logic: marketplace/online belum menjadi income resmi sebelum status Selesai, tetapi owner tetap butuh estimasi uang tertahan.
    const pendingSalesRecords = filteredSalesRecords.filter((sale) => {
      const status = sale.status || "";
      const channel = sale.salesChannel || "";

      return ["Diproses", "Dikirim"].includes(status) && !isOfflineChannel(channel);
    });

    const pendingAmount = pendingSalesRecords.reduce(
      (total, sale) => total + Number(sale.total || 0),
      0,
    );

    const completedAmount = filteredSalesRecords
      .filter((sale) => sale.status === "Selesai")
      .reduce((total, sale) => total + Number(sale.total || 0), 0);

    return [
      {
        key: "sales-pending-income",
        title: "Pemasukan Pending",
        value: formatCurrencyId(pendingAmount),
        subtitle: `${formatNumberId(pendingSalesRecords.length)} penjualan Diproses/Dikirim. Belum masuk kas resmi.`,
        accent: "warning",
      },
      {
        key: "sales-official-completed",
        title: "Penjualan Selesai",
        value: formatCurrencyId(completedAmount),
        subtitle: "Dasar income resmi.",
        accent: "success",
      },
      {
        key: "sales-active-tab-count",
        title: "Data Aktif",
        value: formatNumberId(filteredSalesRecords.length),
        subtitle: "Transaksi sesuai filter.",
        accent: "primary",
      },
    ];
  }, [filteredSalesRecords]);

  // =========================
  // SECTION: Kolom tabel utama
  // IMS NOTE [AKTIF] - Urutan kolom Sales dibuat mengikuti alur baca transaksi.
  // Fungsi blok: menampilkan tanggal lebih dulu, lalu pelanggan, item, channel, referensi, total, status, dan aksi.
  // Hubungan flow: hanya mengubah presentasi tabel; filter tab, pending income, status transition, stok, income, dan alur Return tidak berubah.
  // Alasan logic: owner lebih mudah membaca kronologi penjualan tanpa mengubah data transaksi atau payload Firestore.
  // =========================
  /* =====================================================
     SECTION: Compact Sales Table Columns — AKTIF/GUARDED
     Fungsi:
     - Menampilkan ringkasan transaksi penjualan tanpa horizontal scroll besar.
     Dipakai oleh:
     - Sales main table.
     Alasan perubahan:
     - Action dan informasi keputusan cepat harus terlihat pada desktop/laptop normal.
     Catatan cleanup:
     - Item breakdown panjang bisa dibuat drawer khusus jika nanti owner butuh audit lebih nyaman.
     Risiko:
     - Jangan mengubah handler status/income/stock/return karena kolom ini hanya presentational.
     ===================================================== */
  const salesTableColumns = [
    {
      title: "Tanggal / Ref",
      key: "dateReference",
      width: 150,
      render: (_, record) => {
        const referenceText = record.saleNumber || record.code || record.referenceNumber || "Tanpa ref";
        return (
          <div style={{ minWidth: 0 }}>
            <div className="ims-cell-title">{record.date || "-"}</div>
            <Tooltip title={referenceText}>
              <div className="ims-cell-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {referenceText}
              </div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: "Pelanggan / Channel",
      key: "customerChannel",
      width: 210,
      render: (_, record) => {
        const customerName = record.customerName || "-";
        const channel = record.salesChannel || "-";
        return (
          <div style={{ minWidth: 0 }}>
            <Tooltip title={customerName}>
              <div className="ims-cell-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {customerName}
              </div>
            </Tooltip>
            <Tag style={{ marginTop: 4 }}>{channel}</Tag>
          </div>
        );
      },
    },
    {
      title: "Item Ringkas",
      dataIndex: "items",
      key: "items",
      width: 260,
      render: (items) => {
        const saleItems = Array.isArray(items) ? items : [];
        const primaryItem = saleItems[0];

        if (!primaryItem) return "-";

        const primaryLabel = `${primaryItem.itemName || "Item"}${primaryItem.variantLabel ? ` - ${primaryItem.variantLabel}` : ""}`;
        const tooltipContent = (
          <div style={{ maxWidth: 360 }}>
            {saleItems.map((item, index) => (
              <div key={`${item.itemId || item.itemName || "item"}-${index}`} style={{ marginBottom: index === saleItems.length - 1 ? 0 : 8 }}>
                <div className="ims-cell-title">
                  {item.itemName || "Item"}{item.variantLabel ? ` - ${item.variantLabel}` : ""}
                </div>
                <div>
                  {formatNumberId(item.quantity)} x {formatCurrencyId(item.pricePerUnit || 0)} = {formatCurrencyId(item.subtotal || 0)}
                </div>
              </div>
            ))}
          </div>
        );

        return (
          <Tooltip title={tooltipContent}>
            <div style={{ minWidth: 0 }}>
              <div className="ims-cell-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {primaryLabel}
              </div>
              <div className="ims-cell-meta">
                {saleItems.length} item transaksi
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 140,
      align: "right",
      render: (value) => (value != null ? <strong>{formatCurrencyId(value)}</strong> : "-"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => {
        return <Tag color={getSalesStatusColor(status)}>{status}</Tag>;
      },
    },
    {
      // =====================================================
      // SECTION: Aksi status Sales — AKTIF / GUARDED
      // Fungsi:
      // - Menampilkan aksi status resmi tanpa cancel user-facing dan tanpa hard delete.
      //
      // Dipakai oleh:
      // - Tabel Sales.
      //
      // Alasan perubahan:
      // - Sales tidak menyediakan aksi batal dari tabel; barang kembali diarahkan ke Return.
      //
      // Catatan cleanup:
      // - Tidak ada; tabel Sales tidak menyediakan aksi batal/hapus.
      //
      // Risiko:
      // - Aksi batal di Sales bisa disalahgunakan untuk bypass Return dan membuat audit stok ambigu.
      // =====================================================
      title: "Aksi",
      key: "action",
      width: 150,
      className: "app-table-action-column",
      render: (_, record) => {
        const canMoveToShipped = record.status === "Diproses" && !isOfflineChannel(record.salesChannel);
        const canComplete = record.status === "Dikirim" && !isOfflineChannel(record.salesChannel);

        if (!canMoveToShipped && !canComplete) {
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

          </div>
        );
      },
    },
  ];

  const salesChannelSummaryColumns = [
    {
      title: "Channel",
      key: "channel",
      width: 220,
      render: (_, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <div className="ims-cell-title">{record.channel}</div>
          <div className="ims-cell-meta">
            {record.groupLabel} • {formatNumberId(record.transactionCount)} transaksi
          </div>
        </div>
      ),
    },
    {
      title: "Omzet",
      key: "totalAmount",
      width: 150,
      align: "right",
      render: (_, record) => <strong>{formatCurrencyId(record.totalAmount)}</strong>,
    },
    {
      title: "Selesai",
      key: "completedAmount",
      width: 145,
      align: "right",
      render: (_, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight" style={{ alignItems: "flex-end" }}>
          <strong>{formatCurrencyId(record.completedAmount)}</strong>
          <span className="ims-cell-meta">{formatNumberId(record.completedCount)} transaksi</span>
        </div>
      ),
    },
    {
      title: "Pending",
      key: "pendingAmount",
      width: 145,
      align: "right",
      render: (_, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight" style={{ alignItems: "flex-end" }}>
          <strong>{formatCurrencyId(record.pendingAmount)}</strong>
          <span className="ims-cell-meta">{formatNumberId(record.pendingCount)} transaksi</span>
        </div>
      ),
    },
    {
      title: "Kontribusi",
      key: "contribution",
      width: 160,
      render: (_, record) => {
        const percent = salesChannelTotalAmount
          ? Math.round((Number(record.totalAmount || 0) / salesChannelTotalAmount) * 100)
          : 0;

        return (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <Progress percent={percent} size="small" showInfo={false} />
            <div className="ims-cell-meta">{formatNumberId(percent)}%</div>
          </div>
        );
      },
    },
    {
      title: "Detail",
      key: "detail",
      width: 105,
      align: "right",
      className: "app-table-action-column",
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          disabled={record.transactionCount <= 0}
          onClick={(event) => {
            event.stopPropagation();
            openSalesChannelDetail(record.key);
          }}
        >
          Lihat
        </Button>
      ),
    },
  ];

  const selectedSalesChannelTransactionColumns = [
    {
      title: "Tanggal / Ref",
      key: "dateReference",
      width: 170,
      render: (_, record) => {
        const referenceText = getSaleDisplayReference(record);
        const externalReference = getSaleExternalReference(record);

        return (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <div className="ims-cell-title">{record.date || "-"}</div>
            <Tooltip title={referenceText}>
              <div className="ims-cell-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {referenceText}
              </div>
            </Tooltip>
            {externalReference !== "-" ? (
              <Tooltip title={`No. marketplace: ${externalReference}`}>
                <Tag style={{ marginTop: 2 }}>Order: {externalReference}</Tag>
              </Tooltip>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "Pelanggan",
      key: "customerName",
      width: 160,
      render: (_, record) => record.customerName || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status) => <Tag color={getSalesStatusColor(status)}>{status}</Tag>,
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 140,
      align: "right",
      render: (value) => <strong>{formatCurrencyId(value || 0)}</strong>,
    },
  ];


  const salesTabItems = [
    { key: "all", label: "Semua Penjualan" },
    { key: "Diproses", label: "Diproses" },
    { key: "Dikirim", label: "Dikirim" },
    { key: "Selesai", label: "Selesai" },
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

  /* =====================================================
     SECTION: Sales Render Panel — GUARDED
     Fungsi:
     - Menata ringkasan, filter, tabel, dan form penjualan agar invoice, customer, item, stok, status, dan total mudah dibaca.

     Dipakai oleh:
     - Halaman Sales.

     Alasan perubahan:
     - Batch 3 merapikan microcopy dan panel transaksi tanpa mengubah payload, stok keluar, income timing, atau handler action.

     Catatan cleanup:
     - Detail transaksi bisa dibuat drawer audit khusus jika nanti dibutuhkan.

     Risiko:
     - Jangan mengubah mapping item, status, total, stok, cash in, atau callback dari section render ini.
     ===================================================== */
  return (
    <>
      <PageHeader
        title="Daftar Penjualan"
        subtitle="Penjualan dan status pembayaran."
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
        subtitle="Ringkasan dan channel mengikuti filter aktif."
      >
        <div style={{ marginBottom: 12, maxWidth: 360 }}>
          <Input.Search
            placeholder="Cari resi / order marketplace / referensi / channel"
            allowClear
            value={receiptSearch}
            onChange={(event) => setReceiptSearch(event.target.value)}
          />
        </div>

        <Tabs items={salesTabItems} activeKey={activeTabKey} onChange={(key) => setActiveTabKey(key)} />
      </PageSection>

      <PageSection
        title="Ringkasan Penjualan"
        subtitle="Berdasarkan filter aktif."
      >
        <SummaryStatGrid items={salesSummaryItems} columns={{ xs: 24, md: 8 }} />
      </PageSection>

      <PageSection
        title="Penjualan per Channel"
        subtitle="Pantau omzet, pending, dan transaksi per channel."
      >
        <div className="ims-readonly-stat-grid" style={{ marginBottom: 12 }}>
          <div className="ims-readonly-stat-field">
            <div className="ims-readonly-stat-label">Total Channel</div>
            <div className="ims-readonly-stat-value">{formatCurrencyId(salesChannelTotalAmount)}</div>
            <div className="ims-cell-meta">{formatNumberId(salesChannelTotalTransactions)} transaksi</div>
          </div>
          <div className="ims-readonly-stat-field">
            <div className="ims-readonly-stat-label">Channel Tertinggi</div>
            <div className="ims-readonly-stat-value">{topSalesChannelSummary?.channel || "-"}</div>
            <div className="ims-cell-meta">{formatCurrencyId(topSalesChannelSummary?.totalAmount || 0)}</div>
          </div>
          <div className="ims-readonly-stat-field">
            <div className="ims-readonly-stat-label">Pending Tertinggi</div>
            <div className="ims-readonly-stat-value">
              {Number(highestPendingSalesChannelSummary?.pendingAmount || 0) > 0
                ? highestPendingSalesChannelSummary.channel
                : "Tidak ada"}
            </div>
            <div className="ims-cell-meta">{formatCurrencyId(highestPendingSalesChannelSummary?.pendingAmount || 0)}</div>
          </div>
        </div>

        <Table
          className="app-data-table"
          columns={salesChannelSummaryColumns}
          dataSource={salesChannelSummaryItems}
          rowKey="key"
          pagination={false}
          tableLayout="fixed"
          size="small"
          scroll={{ x: 880 }}
          loading={isLoading}
          locale={{
            emptyText: getDataTableEmptyText(
              isLoading,
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada transaksi sesuai filter aktif." />,
            ),
          }}
          onRow={(record) => ({
            onClick: () => openSalesChannelDetail(record.key),
            style: record.transactionCount > 0 ? { cursor: "pointer" } : undefined,
          })}
        />

        <div className="ims-readonly-panel-note">
          Channel tanpa transaksi disembunyikan agar ringkasan tetap ringkas. Pending belum masuk kas resmi.
        </div>
      </PageSection>

      <PageSection
        title="Data Penjualan"
        subtitle="Menampilkan data sesuai filter aktif."
      >
        <DataRefreshIndicator loading={isLoading} dataSource={filteredSalesRecords} />
        <Table
          className="app-data-table"
          columns={salesTableColumns}
          dataSource={filteredSalesRecords}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(isLoading) }}
        />
      </PageSection>

      <Drawer
        title={selectedSalesChannelSummary ? `Detail Channel — ${selectedSalesChannelSummary.channel}` : "Detail Channel"}
        placement="right"
        width="min(100vw, 720px)"
        open={Boolean(selectedSalesChannelSummary)}
        onClose={closeSalesChannelDetail}
        destroyOnClose
      >
        {selectedSalesChannelSummary ? (
          <>
            <div className="ims-readonly-stat-grid" style={{ marginBottom: 16 }}>
              <div className="ims-readonly-stat-field">
                <div className="ims-readonly-stat-label">Omzet</div>
                <div className="ims-readonly-stat-value">{formatCurrencyId(selectedSalesChannelSummary.totalAmount)}</div>
                <div className="ims-cell-meta">Total channel</div>
              </div>
              <div className="ims-readonly-stat-field">
                <div className="ims-readonly-stat-label">Selesai</div>
                <div className="ims-readonly-stat-value">{formatCurrencyId(selectedSalesChannelSummary.completedAmount)}</div>
                <div className="ims-cell-meta">Income resmi</div>
              </div>
              <div className="ims-readonly-stat-field">
                <div className="ims-readonly-stat-label">Pending</div>
                <div className="ims-readonly-stat-value">{formatCurrencyId(selectedSalesChannelSummary.pendingAmount)}</div>
                <div className="ims-cell-meta">Belum masuk kas</div>
              </div>
            </div>

            <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
              <Input.Search
                placeholder="Cari ref / order / pelanggan"
                allowClear
                value={channelDetailSearch}
                onChange={(event) => setChannelDetailSearch(event.target.value)}
                style={{ width: "min(100%, 280px)" }}
              />
              <Select
                value={channelDetailStatusFilter}
                onChange={setChannelDetailStatusFilter}
                style={{ width: "min(100%, 180px)" }}
              >
                <Option value="all">Semua Status</Option>
                {onlineStatuses.map((status) => (
                  <Option key={status} value={status}>
                    {status}
                  </Option>
                ))}
              </Select>
            </Space>

            <Table
              className="app-data-table"
              columns={selectedSalesChannelTransactionColumns}
              dataSource={selectedSalesChannelTransactions}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
              tableLayout="fixed"
              scroll={{ x: 560 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Tidak ada transaksi yang cocok dengan filter ini."
                  />
                ),
              }}
            />
          </>
        ) : null}
      </Drawer>

      <Modal
        title="Tambah Penjualan"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => {
          if (!isSubmittingSale) {
            setIsModalOpen(false);
          }
        }}
        confirmLoading={isSubmittingSale}
        okButtonProps={{ disabled: isSubmittingSale }}
        cancelButtonProps={{ disabled: isSubmittingSale }}
        okText="Simpan"
        cancelText="Batal"
        width={860}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddSale}
          onFinishFailed={(errorInfo) => showFormValidationFeedback(errorInfo, { form })}
        >
          <Form.Item label="Pelanggan" name="customerId" extra="Opsional untuk pembeli umum.">
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
                  <div key={key} style={{ border: "1px solid var(--ims-border-color)", padding: 12, marginBottom: 16, borderRadius: 8 }}>
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
                                  ? "Item difilter sesuai jenis."
                                  : "Pilih jenis item dulu."
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
                                extra="Item bervarian wajib pilih varian."
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
                                Hubungan flow: hanya mengganti tampilan Alert lama; validasi stok, create sale, stock reduction, income timing, alur Return, dan payload Firestore tetap memakai logic existing.
                                Alasan logic: stok tersedia sebelum penjualan adalah info snapshot, bukan warning/error, sehingga mengikuti pola clean panel seperti Purchases/Stock Adjustment.
                                Status: AKTIF untuk UI Sales, GUARDED terhadap business rule stok dan transaksi. */}
                            <div className="ims-readonly-panel">
                              <div className="ims-readonly-panel-header">
                                <div>
                                  <div className="ims-readonly-panel-title">
                                    Stok Tersedia Sebelum Penjualan
                                  </div>
                                  <div className="ims-readonly-panel-description">
                                    Info stok sebelum transaksi disimpan.
                                  </div>
                                </div>
                                <Tag color={hasVariants ? "purple" : "default"}>
                                  {hasVariants ? "Varian" : "Master"}
                                </Tag>
                              </div>

                              <div style={{ marginBottom: 10 }}>
                                <span className="ims-cell-title">
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
                                  <div className="ims-readonly-stat-label">Stok Saat Ini</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.currentStock : getItemStockSnapshot(selectedItem).currentStock) || 0)}
                                  </div>
                                </div>
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Stok Tertahan</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.reservedStock : getItemStockSnapshot(selectedItem).reservedStock) || 0)}
                                  </div>
                                </div>
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Stok Tersedia</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.availableStock : getItemStockSnapshot(selectedItem).availableStock) || 0)}
                                  </div>
                                </div>
                              </div>

                              {hasVariants ? (
                                <div className="ims-readonly-panel-note">
                                  Item bervarian wajib memilih varian agar stok keluar dari varian yang benar.
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
                        <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} placeholder="Harga Satuan" style={{ width: "min(100%, 180px)" }} />
                      </Form.Item>

                      <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} />
                    </Space>
                  </div>
                ))}

                <Form.Item>
                  <Button type="dashed" onClick={() => add({ itemType: defaultSaleLineItemType, itemId: undefined, variantKey: undefined, quantity: 1, pricePerUnit: 0 })} block icon={<PlusOutlined />}>
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
                      ? "Opsional untuk nomor resi/order marketplace."
                      : "Tidak diperlukan untuk channel ini."
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
