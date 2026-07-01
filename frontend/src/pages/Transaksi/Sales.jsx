import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Form,
  Input,
  Select,
  Tabs,
  Empty,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import DataTableView from "../../components/Layout/Table/DataTableView";
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
import { findVariantByKey, getItemStockSnapshot, inferHasVariants } from "../../utils/variants/variantStockHelpers";
import { formatNumberId } from "../../utils/formatters/numberId";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import SalesDetailDrawer from './components/SalesDetailDrawer';
import SalesChannelDetailDrawer from './components/SalesChannelDetailDrawer';
import SalesFormModal from "./components/SalesFormModal";
import {
  createSalesChannelMobileCardConfig,
  createSalesChannelSummaryColumns,
  createSalesMobileCardConfig,
  createSalesTableColumns,
  createSelectedSalesChannelTransactionColumns,
  createSelectedSalesChannelTransactionMobileCardConfig,
  getSaleDisplayReference,
  getSaleExternalReference,
  SALES_TAB_ITEMS,
} from './helpers/salesPageHelpers';


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const { Option } = Select;
const { Text } = Typography;

// =========================
// SECTION: Daftar channel penjualan
// =========================
const salesChannels = SALES_CHANNEL_OPTIONS;

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
  const { message } = AntdApp.useApp();
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
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);

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

  // =========================
  // SECTION: Ambil semua data penjualan
  // =========================
  const fetchSales = useCallback(async () => {
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
  }, [message]);

  // =========================
  // SECTION: Ambil produk jadi
  // =========================
  const fetchProducts = useCallback(async () => {
    try {
      const productList = await fetchSalesProducts();
      setProducts(productList);
    } catch (error) {
      console.error("Gagal mengambil data produk:", error);
      message.error("Gagal memuat daftar produk.");
    }
  }, [message]);

  // =========================
  // SECTION: Ambil bahan baku
  // =========================
  const fetchRawMaterials = useCallback(async () => {
    try {
      const rawMaterialList = await fetchSalesRawMaterials();
      setRawMaterials(rawMaterialList);
    } catch (error) {
      console.error("Gagal mengambil data bahan baku:", error);
      message.error("Gagal memuat daftar bahan baku.");
    }
  }, [message]);

  // =========================
  // SECTION: Ambil customer
  // Fungsi:
  // - membaca customer lewat salesCustomerReferenceService agar Sales tetap lewat service database lokal
  // Hubungan flow:
  // - dropdown Sales tidak boleh memakai customer draft lokal yang belum tersimpan di database lokal
  // Status:
  // - aktif/final
  // - tetap menyimpan snapshot customerName saat sale dibuat agar transaksi lama aman
  // =========================
  const fetchCustomers = useCallback(async () => {
    try {
      const customerList = await getSalesCustomerReferences();
      setCustomers(customerList);
    } catch (error) {
      console.error("Gagal mengambil data pelanggan:", error);
      message.error("Gagal memuat daftar pelanggan.");
    }
  }, [message]);

  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchRawMaterials();
    fetchCustomers();
  }, [fetchCustomers, fetchProducts, fetchRawMaterials, fetchSales]);

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
  // - aktif/final; validasi preflight dipanggil dari salesService, dan validasi final tetap diulang dalam createSaleTransaction
  // - bukan data historis dan bukan kandidat cleanup
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
        values: {
          salesChannel,
          status: finalSaleStatus,
          date,
          transactionDate: date,
          referenceNumber: isReferenceNumberEnabledChannel(salesChannel)
            ? referenceNumber
            : null,
          note,
          notes: note,
          customerId: selectedCustomer?.id || customerId || "",
          customerCode: selectedCustomer?.customerCode || selectedCustomer?.code || "",
          customerName: selectedCustomer?.name || "",
          totalAmount: totalSaleValue,
          total: totalSaleValue,
        },
        saleItems,
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
    // Fungsi blok: menjaga tabel selalu sesuai activeTabKey walaupun query service gagal, loading ulang, atau state lama masih tersisa.
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

  // =========================
  // SECTION: Detail read-only transaksi Sales
  // Fungsi:
  // - membuka drawer detail transaksi dari mobile card tanpa mengubah status, stok, income, atau return flow.
  // Hubungan flow:
  // - detail memakai record sales yang sudah ada di state tabel; tidak melakukan write/fetch tambahan.
  // Status:
  // - AKTIF sebagai UI mobile detail.
  // - GUARDED karena Sales tidak membuka aksi batal/delete dari drawer ini.
  // =========================
  const openSaleDetail = (record) => {
    setSelectedSaleDetail(record);
  };

  const closeSaleDetail = () => {
    setSelectedSaleDetail(null);
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

  const salesTableColumns = createSalesTableColumns({
    isOfflineChannel,
    onUpdateStatus: handleUpdateSaleStatus,
  });
  const salesChannelSummaryColumns = createSalesChannelSummaryColumns({
    onOpenDetail: openSalesChannelDetail,
    totalAmount: salesChannelTotalAmount,
  });
  const selectedSalesChannelTransactionColumns = createSelectedSalesChannelTransactionColumns();
  const salesChannelMobileCardConfig = createSalesChannelMobileCardConfig({
    onOpenDetail: openSalesChannelDetail,
    totalAmount: salesChannelTotalAmount,
  });
  const selectedSalesChannelTransactionMobileCardConfig = createSelectedSalesChannelTransactionMobileCardConfig();
  const salesTabItems = SALES_TAB_ITEMS;

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

  const salesMobileCardConfig = createSalesMobileCardConfig({
    onOpenDetail: openSaleDetail,
  });

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

      <PageContentCanvas>

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

        <DataTableView
          className="app-data-table"
          columns={salesChannelSummaryColumns}
          dataSource={salesChannelSummaryItems}
          rowKey="key"
          pagination={false}
          tableLayout="fixed"
          size="small"
          scroll={{ x: 880 }}
          loading={isLoading}
          showRefreshIndicator={false}
          mobileCardConfig={salesChannelMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(
              isLoading,
              <EmptyStateBlock compact image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada transaksi sesuai filter aktif." />,
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
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          columns={salesTableColumns}
          dataSource={filteredSalesRecords}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(isLoading) }}
          mobileCardConfig={salesMobileCardConfig}
        />
      </PageSection>

      </PageContentCanvas>

      <SalesDetailDrawer sale={selectedSaleDetail} onClose={closeSaleDetail} />

      <SalesChannelDetailDrawer
        summary={selectedSalesChannelSummary}
        onClose={closeSalesChannelDetail}
        searchValue={channelDetailSearch}
        onSearchChange={setChannelDetailSearch}
        statusValue={channelDetailStatusFilter}
        onStatusChange={setChannelDetailStatusFilter}
        statusOptions={onlineStatuses}
        columns={selectedSalesChannelTransactionColumns}
        transactions={selectedSalesChannelTransactions}
        mobileCardConfig={selectedSalesChannelTransactionMobileCardConfig}
      />

<SalesFormModal
        formState={{ form, isModalOpen, isSubmittingSale }}
        referenceData={{
          customers,
          onlineStatuses,
          salesChannels,
          sellableItemTypeOptions,
        }}
        channelState={{ isOfflineChannel, isReferenceNumberEnabledChannel }}
        defaults={{ defaultSaleLineItemType }}
        actions={{
          findSellableItem,
          getSellableItemsByType,
          handleAddSale,
          handleSaleItemChange,
          handleSaleItemTypeChange,
          handleSalesChannelChange,
          setIsModalOpen,
        }}
      />
    </>
  );
};

export default Sales;
