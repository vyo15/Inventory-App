import React, { useEffect, useMemo, useState } from "react";
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
import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  writeBatch,
  increment,
} from "firebase/firestore";
import {
  addInventoryLog,
  updateStock,
} from "../../services/Inventory/inventoryService";

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
  // =========================
  const sellableItems = useMemo(() => {
    return [...products, ...rawMaterials];
  }, [products, rawMaterials]);

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
  // =========================
  const fetchCustomers = async () => {
    try {
      const customersCollection = collection(db, "customers");
      const customersSnapshot = await getDocs(customersCollection);

      const customerList = customersSnapshot.docs.map((documentItem) => ({
        id: documentItem.id,
        ...documentItem.data(),
      }));

      setCustomers(customerList);
    } catch (error) {
      console.error("Gagal mengambil data pelanggan:", error);
      message.error("Gagal memuat daftar pelanggan.");
    }
  };

  // =========================
  // SECTION: Saat item dipilih, harga otomatis diisi
  // =========================
  const handleSaleItemChange = (itemId, itemIndex) => {
    const selectedItem = sellableItems.find((item) => item.id === itemId);

    if (!selectedItem) {
      return;
    }

    const currentItems = form.getFieldValue("items") || [];
    let autoPrice = 0;

    // RULE:
    // - Produk jadi ambil harga dari field price
    // - Bahan baku ambil harga dari field sellingPrice
    if (products.find((product) => product.id === itemId)) {
      autoPrice = Number(selectedItem.price || 0);
    } else {
      autoPrice = Number(selectedItem.sellingPrice || 0);
    }

    currentItems[itemIndex].pricePerUnit = autoPrice;
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
      items: [{ itemId: undefined, quantity: 1, pricePerUnit: 0 }],
    });
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

      let totalSaleValue = 0;

      // =========================
      // SECTION: Validasi stok cukup
      // =========================
      for (const item of items) {
        const selectedItem = sellableItems.find(
          (sellableItem) => sellableItem.id === item.itemId,
        );

        if (!selectedItem) {
          message.error("Produk/Bahan baku tidak ditemukan di inventaris.");
          return;
        }

        if (Number(selectedItem.stock || 0) < Number(item.quantity || 0)) {
          message.error(
            `Stok ${selectedItem.name} tidak mencukupi. Tersisa: ${selectedItem.stock}`,
          );
          return;
        }

        totalSaleValue +=
          Number(item.pricePerUnit || 0) * Number(item.quantity || 0);
      }

      const selectedCustomer = customers.find(
        (customer) => customer.id === customerId,
      );

      const newSalePayload = {
        customerId: customerId || null,
        customerName: selectedCustomer?.name || "",
        items: items.map((item) => {
          const selectedItem = sellableItems.find(
            (sellableItem) => sellableItem.id === item.itemId,
          );

          return {
            itemId: item.itemId,
            itemName: selectedItem?.name || "-",
            quantity: Number(item.quantity || 0),
            pricePerUnit: Number(item.pricePerUnit || 0),
            subtotal:
              Number(item.pricePerUnit || 0) * Number(item.quantity || 0),
            collectionName: products.find(
              (product) => product.id === item.itemId,
            )
              ? "products"
              : "raw_materials",
          };
        }),
        salesChannel,
        status,
        date: Timestamp.fromDate(date.toDate()),
        referenceNumber: referenceNumber || null,
        total: totalSaleValue,
        note: note || "",
        createdAt: Timestamp.now(),
      };

      // =========================
      // SECTION: Simpan transaksi penjualan
      // =========================
      const salesDocument = await addDoc(
        collection(db, "sales"),
        newSalePayload,
      );

      // =========================
      // SECTION: Kurangi stok semua item
      // =========================
      for (const item of newSalePayload.items) {
        await updateStock(item.itemId, -item.quantity, item.collectionName);

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
          },
        );
      }

      // RULE:
      // Pemasukan kas hanya dicatat saat status Selesai.
      if (status === "Selesai") {
        const itemNames = newSalePayload.items
          .map((item) => `${item.itemName} (${item.quantity})`)
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
      message.error("Gagal menambahkan penjualan.");
    }
  };

  // =========================
  // SECTION: Update status penjualan
  // =========================
  const handleUpdateSaleStatus = async (saleId, newStatus) => {
    try {
      const saleReference = doc(db, "sales", saleId);
      await updateDoc(saleReference, { status: newStatus });

      const selectedSale = salesRecords.find((sale) => sale.id === saleId);

      // RULE:
      // Saat status berubah menjadi Selesai,
      // baru catat pemasukan kas jika belum pernah dibuat.
      if (newStatus === "Selesai" && selectedSale && selectedSale.total > 0) {
        const incomeExists = await hasExistingIncome(saleId);

        if (!incomeExists) {
          const itemNames = selectedSale.items
            .map((item) => `${item.itemName} (${item.quantity})`)
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

      // RULE:
      // Jika dibatalkan, stok dikembalikan lagi.
      if (newStatus === "Dibatalkan" && selectedSale) {
        const revertBatch = writeBatch(db);

        for (const item of selectedSale.items || []) {
          const itemReference = doc(db, item.collectionName, item.itemId);

          revertBatch.update(itemReference, {
            stock: increment(item.quantity),
          });

          await addInventoryLog(
            item.itemId,
            item.itemName,
            item.quantity,
            "sale_cancel_revert",
            item.collectionName,
            {
              saleId,
              note: `Pembatalan penjualan via ${selectedSale.salesChannel || "-"}`,
              customerName: selectedSale.customerName || "",
            },
          );
        }

        await revertBatch.commit();
      }

      message.success(`Status penjualan berhasil diubah menjadi ${newStatus}.`);
      fetchSales(activeTabKey);
    } catch (error) {
      console.error("Gagal update status:", error);
      message.error("Gagal mengubah status penjualan.");
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

      // RULE:
      // Jika status sudah Dibatalkan, stok jangan dikembalikan lagi
      // karena sebelumnya sudah direvert saat ubah status.
      const shouldReturnStock = selectedSale.status !== "Dibatalkan";

      if (shouldReturnStock) {
        for (const item of selectedSale.items || []) {
          const itemReference = doc(db, item.collectionName, item.itemId);

          deleteBatch.update(itemReference, {
            stock: increment(item.quantity),
          });

          await addInventoryLog(
            item.itemId,
            item.itemName,
            item.quantity,
            "sale_revert",
            item.collectionName,
            {
              note: `Pembatalan/hapus penjualan ID: ${saleId}`,
              saleId,
              customerName: selectedSale.customerName || "",
            },
          );
        }
      }

      // =========================
      // SECTION: Hapus pemasukan terkait jika ada
      // =========================
      const incomesCollection = collection(db, "incomes");
      const incomeQuery = query(
        incomesCollection,
        where("relatedId", "==", saleId),
      );
      const incomesSnapshot = await getDocs(incomeQuery);

      incomesSnapshot.forEach((incomeDocument) => {
        deleteBatch.delete(incomeDocument.ref);
      });

      // =========================
      // SECTION: Hapus penjualan
      // =========================
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
      message.error("Gagal menghapus penjualan.");
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
                {item.itemName} ({item.quantity}) - Rp{" "}
                {Number(item.subtotal || 0).toLocaleString("id-ID")}
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
      render: (value) =>
        value != null ? `Rp ${Number(value).toLocaleString("id-ID")}` : "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
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
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
    },
    {
      // =========================
      // SECTION: aksi sticky
      // Fungsi:
      // - menjaga tombol update status penjualan tetap mudah dijangkau pada tabel transaksi
      // =========================
      title: "Aksi",
      key: "action",
      width: 220,
      fixed: "right",
      className: "app-table-action-column",
      render: (_, record) => (
        <Space size="middle" wrap>
          {record.status === "Diproses" &&
            !isOfflineChannel(record.salesChannel) && (
              <Popconfirm
                title="Yakin ubah status menjadi Dikirim?"
                onConfirm={() => handleUpdateSaleStatus(record.id, "Dikirim")}
                okText="Ya"
                cancelText="Tidak"
              >
                <Button type="link">Dikirim</Button>
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
                <Button type="link">Selesai</Button>
              </Popconfirm>
            )}

          {(record.status === "Diproses" || record.status === "Dikirim") &&
            !isOfflineChannel(record.salesChannel) && (
              <Popconfirm
                title="Yakin batalkan penjualan ini?"
                onConfirm={() =>
                  handleUpdateSaleStatus(record.id, "Dibatalkan")
                }
                okText="Ya"
                cancelText="Tidak"
              >
                <Button type="link" danger>
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
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // =========================
  // SECTION: Tab filter penjualan
  // =========================
  const salesTabItems = [
    { key: "all", label: "Semua Penjualan" },
    { key: "Diproses", label: "Diproses" },
    { key: "Dikirim", label: "Dikirim" },
    { key: "Selesai", label: "Selesai" },
    { key: "Dibatalkan", label: "Dibatalkan" },
  ];

  // =========================
  // SECTION: Saat channel berubah, atur status default
  // =========================
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
        subtitle="Kelola transaksi penjualan offline dan online, termasuk status pemrosesan serta pencatatan kas masuk."
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

        <Tabs
          items={salesTabItems}
          activeKey={activeTabKey}
          onChange={(key) => setActiveTabKey(key)}
        />
      </PageSection>

      <PageSection
        title="Data Penjualan"
        subtitle="Semua transaksi penjualan akan mengurangi stok item yang terjual dan dapat menghasilkan pemasukan saat selesai."
      >
        {/* =========================
            SECTION: tabel penjualan
            Class global dipakai supaya shape tabel dan tombol aksi konsisten.
        ========================= */}
        <Table
          className="app-data-table"
          columns={salesTableColumns}
          dataSource={filteredSalesRecords}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          loading={isLoading}
          scroll={{ x: 1180 }}
        />
      </PageSection>

      <Modal
        title="Tambah Penjualan"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => setIsModalOpen(false)}
        okText="Simpan"
        cancelText="Batal"
        width={820}
      >
        <Form form={form} layout="vertical" onFinish={handleAddSale}>
          <Form.Item
            label="Pelanggan"
            name="customerId"
            extra="Opsional. Boleh dikosongkan untuk pembeli offline umum atau marketplace."
          >
            <Select
              placeholder="Pilih pelanggan"
              allowClear
              showSearch
              optionFilterProp="children"
            >
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
                  <div
                    key={key}
                    style={{
                      border: "1px solid #d9d9d9",
                      padding: "12px",
                      marginBottom: "16px",
                      borderRadius: "8px",
                    }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, "itemId"]}
                      rules={[{ required: true, message: "Pilih item!" }]}
                      style={{ marginBottom: "12px" }}
                    >
                      <Select
                        placeholder="Pilih produk / bahan baku"
                        onChange={(itemId) =>
                          handleSaleItemChange(itemId, name)
                        }
                        showSearch
                        optionFilterProp="children"
                      >
                        {products.map((item) => (
                          <Option key={item.id} value={item.id}>
                            {item.name} (Produk Jadi - Stok: {item.stock})
                          </Option>
                        ))}
                        {rawMaterials.map((item) => (
                          <Option key={item.id} value={item.id}>
                            {item.name} (Bahan Baku - Stok: {item.stock})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Space style={{ marginBottom: 12 }} align="baseline" wrap>
                      <Form.Item
                        {...restField}
                        name={[name, "quantity"]}
                        rules={[{ required: true, message: "Jumlah!" }]}
                      >
                        <InputNumber
                          min={1}
                          placeholder="Jumlah"
                          style={{ width: 120 }}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, "pricePerUnit"]}
                        rules={[{ required: true, message: "Harga!" }]}
                      >
                        <InputNumber
                          min={0}
                          placeholder="Harga Satuan"
                          style={{ width: 180 }}
                        />
                      </Form.Item>

                      <Button
                        danger
                        onClick={() => remove(name)}
                        icon={<DeleteOutlined />}
                      />
                    </Space>
                  </div>
                ))}

                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() =>
                      add({
                        itemId: undefined,
                        quantity: 1,
                        pricePerUnit: 0,
                      })
                    }
                    block
                    icon={<PlusOutlined />}
                  >
                    Tambah Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item
            label="Channel Penjualan"
            name="salesChannel"
            rules={[{ required: true, message: "Harap pilih channel!" }]}
            initialValue="Shopee"
          >
            <Select
              placeholder="Pilih channel penjualan"
              onChange={handleSalesChannelChange}
            >
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
                <Form.Item
                  label="Status"
                  name="status"
                  rules={[{ required: true, message: "Harap pilih status!" }]}
                  initialValue={isOffline ? "Selesai" : "Diproses"}
                >
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

          <Form.Item
            label="No. Resi / No. Order / Referensi"
            name="referenceNumber"
          >
            <Input placeholder="Opsional: Masukkan nomor resi / order / referensi" />
          </Form.Item>

          <Form.Item
            label="Tanggal"
            name="date"
            rules={[{ required: true, message: "Harap pilih tanggal!" }]}
            initialValue={dayjs()}
          >
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
