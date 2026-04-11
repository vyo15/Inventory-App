import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  message,
  Space,
  Tag,
} from "antd";
import { collection, addDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import {
  updateStock,
  addInventoryLog,
} from "../../services/Inventory/inventoryService";

const { Option } = Select;

// =========================
// SECTION: Format angka Indonesia tanpa desimal
// =========================
const formatNumberId = (value) => {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });
};

// =========================
// SECTION: Format rupiah Indonesia tanpa desimal
// =========================
const formatCurrencyIdr = (value) => {
  return `Rp ${formatNumberId(value)}`;
};

// =========================
// SECTION: Bantu tentukan status selisih hemat pembelian
// =========================
const getPurchaseSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      status: "hemat",
      label: `Hemat ${formatCurrencyIdr(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      status: "lebih_mahal",
      label: `Lebih Mahal ${formatCurrencyIdr(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    status: "normal",
    label: "Sesuai Referensi",
    color: "default",
  };
};

// =========================
// SECTION: Purchases Page
// =========================
const Purchases = () => {
  const [form] = Form.useForm();

  // =========================
  // SECTION: State utama
  // =========================
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // =========================
  // SECTION: Watch fields
  // =========================
  const itemType = Form.useWatch("type", form);
  const itemId = Form.useWatch("itemId", form);
  const quantity = Form.useWatch("quantity", form);
  const conversionValue = Form.useWatch("conversionValue", form);

  const subtotalItems = Form.useWatch("subtotalItems", form);
  const shippingCost = Form.useWatch("shippingCost", form);
  const shippingDiscount = Form.useWatch("shippingDiscount", form);
  const voucherDiscount = Form.useWatch("voucherDiscount", form);
  const serviceFee = Form.useWatch("serviceFee", form);

  const totalStockIn = Form.useWatch("totalStockIn", form);

  // =========================
  // SECTION: Bahan terpilih
  // =========================
  const selectedMaterial = useMemo(() => {
    return materials.find((item) => item.id === itemId);
  }, [materials, itemId]);

  // =========================
  // SECTION: Supplier difilter berdasarkan bahan baku yang dipilih
  // =========================
  const filteredSuppliers = useMemo(() => {
    if (itemType !== "material") {
      return suppliers;
    }

    if (!itemId) {
      return suppliers;
    }

    const matchedSuppliers = suppliers.filter((supplier) =>
      (supplier.supportedMaterialIds || []).includes(itemId),
    );

    return matchedSuppliers.length ? matchedSuppliers : suppliers;
  }, [suppliers, itemId, itemType]);

  // =========================
  // SECTION: Sinkron data utama dari firestore
  // =========================
  useEffect(() => {
    const unsubscribePurchases = onSnapshot(
      collection(db, "purchases"),
      (snapshot) => {
        const nextPurchaseRecords = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setPurchaseRecords(nextPurchaseRecords);
      },
    );

    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const nextProducts = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setProducts(nextProducts);
      },
    );

    const unsubscribeMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const nextMaterials = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setMaterials(nextMaterials);
      },
    );

    const unsubscribeSuppliers = onSnapshot(
      collection(db, "supplierPurchases"),
      (snapshot) => {
        const nextSuppliers = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setSuppliers(nextSuppliers);
      },
    );

    return () => {
      unsubscribePurchases();
      unsubscribeProducts();
      unsubscribeMaterials();
      unsubscribeSuppliers();
    };
  }, []);

  // =========================
  // SECTION: Isi field otomatis saat item berubah
  // =========================
  useEffect(() => {
    form.setFieldsValue({
      supplierId: undefined,
    });

    if (itemType === "product") {
      const selectedProduct = products.find((item) => item.id === itemId);

      if (selectedProduct) {
        form.setFieldsValue({
          purchaseUnit: undefined,
          stockUnit: undefined,
          conversionValue: undefined,
          totalStockIn: Math.round(Number(quantity || 0) || 0),
          restockReferencePrice: 0,
        });
      } else {
        form.setFieldsValue({
          purchaseUnit: undefined,
          stockUnit: undefined,
          conversionValue: undefined,
          totalStockIn: undefined,
          restockReferencePrice: 0,
        });
      }
    }

    if (itemType === "material") {
      const material = materials.find((item) => item.id === itemId);

      if (material) {
        form.setFieldsValue({
          purchaseUnit: material.defaultPurchaseUnit || "",
          stockUnit: material.stockUnit || material.unit || "",
          restockReferencePrice: Math.round(
            Number(material.restockReferencePrice || 0),
          ),
        });
      } else {
        form.setFieldsValue({
          purchaseUnit: null,
          stockUnit: null,
          conversionValue: undefined,
          totalStockIn: undefined,
          restockReferencePrice: 0,
        });
      }
    }
  }, [itemId, itemType, products, materials, form, quantity]);

  // =========================
  // SECTION: Hitung stok masuk otomatis
  // =========================
  useEffect(() => {
    const qty = Number(quantity || 0);
    const conversion = Number(conversionValue || 0);

    const nextTotalStockIn = itemType === "material" ? qty * conversion : qty;

    form.setFieldsValue({
      totalStockIn: Math.round(nextTotalStockIn || 0),
    });
  }, [quantity, conversionValue, itemType, form]);

  // =========================
  // SECTION: Hitung total aktual pembelian
  // =========================
  useEffect(() => {
    const subtotal = Number(subtotalItems || 0);
    const shipping = Number(shippingCost || 0);
    const shippingDiscountAmount = Number(shippingDiscount || 0);
    const voucherAmount = Number(voucherDiscount || 0);
    const serviceFeeAmount = Number(serviceFee || 0);

    const totalActualPurchase =
      subtotal +
      shipping -
      shippingDiscountAmount -
      voucherAmount +
      serviceFeeAmount;

    form.setFieldsValue({
      totalActualPurchase: Math.round(totalActualPurchase || 0),
    });
  }, [
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    form,
  ]);

  // =========================
  // SECTION: Hitung modal aktual per satuan stok
  // =========================
  useEffect(() => {
    const totalActualPurchase = Number(
      form.getFieldValue("totalActualPurchase") || 0,
    );
    const stockIn = Number(form.getFieldValue("totalStockIn") || 0);

    const actualUnitCost =
      stockIn > 0 ? Math.round(totalActualPurchase / stockIn) : 0;

    form.setFieldsValue({
      actualUnitCost,
    });
  }, [
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    quantity,
    conversionValue,
    itemType,
    form,
  ]);

  // =========================
  // SECTION: Hitung total referensi dan selisih hemat pembelian
  // =========================
  useEffect(() => {
    const referencePerStockUnit = Number(
      form.getFieldValue("restockReferencePrice") || 0,
    );
    const stockIn = Number(totalStockIn || 0);
    const totalActualPurchase = Number(
      form.getFieldValue("totalActualPurchase") || 0,
    );

    const totalReferencePurchase = stockIn * referencePerStockUnit;
    const purchaseSaving = totalReferencePurchase - totalActualPurchase;

    form.setFieldsValue({
      totalReferencePurchase: Math.round(totalReferencePurchase || 0),
      purchaseSaving: Math.round(purchaseSaving || 0),
    });
  }, [
    totalStockIn,
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    form,
  ]);

  // =========================
  // SECTION: Modal Helpers
  // =========================
  const openCreatePurchaseModal = () => {
    form.resetFields();
    form.setFieldsValue({
      type: "material",
      quantity: 1,
      subtotalItems: 0,
      shippingCost: 0,
      shippingDiscount: 0,
      voucherDiscount: 0,
      serviceFee: 0,
      totalActualPurchase: 0,
      actualUnitCost: 0,
      restockReferencePrice: 0,
      totalReferencePurchase: 0,
      purchaseSaving: 0,
    });
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Submit pembelian + sinkron ke stok + sinkron ke pengeluaran
  // =========================
  const handleSubmitPurchase = async (values) => {
    try {
      const {
        type,
        itemId,
        quantity,
        date,
        note,
        supplierId,
        purchaseUnit,
        stockUnit,
        conversionValue,
        subtotalItems,
        shippingCost,
        shippingDiscount,
        voucherDiscount,
        serviceFee,
        totalActualPurchase,
        actualUnitCost,
        restockReferencePrice,
        totalReferencePurchase,
        purchaseSaving,
      } = values;

      const collectionName = type === "product" ? "products" : "raw_materials";
      const selectedSupplier = suppliers.find(
        (supplier) => supplier.id === supplierId,
      );
      const supplierName =
        selectedSupplier?.storeName || "Supplier tidak ditemukan";

      const selectedItem =
        type === "product"
          ? products.find((item) => item.id === itemId)
          : materials.find((item) => item.id === itemId);

      const itemName = selectedItem?.name || "Item tidak ditemukan";

      const finalQuantity =
        type === "product"
          ? Number(quantity || 0)
          : Number(quantity || 0) * Number(conversionValue || 0);

      const savingMeta = getPurchaseSavingMeta(purchaseSaving);

      const purchasePayload = {
        type,
        itemId,
        itemName,
        supplierId: supplierId || null,
        supplierName: supplierName || "",
        quantity: Number(quantity || 0),
        date: Timestamp.fromDate(values.date.toDate()),
        note: note || "",
        subtotalItems: Math.round(Number(subtotalItems || 0)),
        shippingCost: Math.round(Number(shippingCost || 0)),
        shippingDiscount: Math.round(Number(shippingDiscount || 0)),
        voucherDiscount: Math.round(Number(voucherDiscount || 0)),
        serviceFee: Math.round(Number(serviceFee || 0)),
        totalActualPurchase: Math.round(Number(totalActualPurchase || 0)),
        actualUnitCost: Math.round(Number(actualUnitCost || 0)),
        restockReferencePrice: Math.round(Number(restockReferencePrice || 0)),
        totalReferencePurchase: Math.round(Number(totalReferencePurchase || 0)),
        purchaseSaving: Math.round(Number(purchaseSaving || 0)),
        purchaseSavingStatus: savingMeta.status,
        purchaseSavingLabel: savingMeta.label,
      };

      if (type === "material") {
        Object.assign(purchasePayload, {
          purchaseUnit,
          stockUnit,
          conversionValue: Number(conversionValue || 0),
          totalStockIn: Math.round(finalQuantity),
        });
      } else {
        Object.assign(purchasePayload, {
          totalStockIn: Math.round(finalQuantity),
        });
      }

      const purchaseDocument = await addDoc(
        collection(db, "purchases"),
        purchasePayload,
      );

      await updateStock(itemId, finalQuantity, collectionName);

      await addInventoryLog(
        itemId,
        itemName,
        finalQuantity,
        "purchase_in",
        collectionName,
        {
          supplierName: supplierName || "",
          totalActualPurchase: Math.round(Number(totalActualPurchase || 0)),
          actualUnitCost: Math.round(Number(actualUnitCost || 0)),
          totalReferencePurchase: Math.round(
            Number(totalReferencePurchase || 0),
          ),
          purchaseSaving: Math.round(Number(purchaseSaving || 0)),
          purchaseSavingStatus: savingMeta.status,
          note:
            type === "material"
              ? `${note || ""} | Pembelian ${formatNumberId(quantity)} ${
                  purchaseUnit || ""
                } = ${formatNumberId(finalQuantity)} ${stockUnit || ""}`
              : note || "",
        },
      );

      await addDoc(collection(db, "expenses"), {
        date: Timestamp.fromDate(date.toDate()),
        type: "Pembelian Bahan/Barang",
        description: `Pembelian ${itemName} dari ${supplierName}`,
        amount: Math.round(Number(totalActualPurchase || 0)),
        totalReferenceAmount: Math.round(Number(totalReferencePurchase || 0)),
        savingAmount: Math.round(Number(purchaseSaving || 0)),
        savingStatus: savingMeta.status,
        savingLabel: savingMeta.label,
        supplierId: supplierId || null,
        supplierName: supplierName || "",
        relatedItemId: itemId,
        relatedItemName: itemName,
        relatedPurchaseId: purchaseDocument.id,
        itemType: type,
        sourceModule: "purchases",
        createdAt: Timestamp.now(),
      });

      message.success("Pembelian berhasil ditambahkan!");
      form.resetFields();
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan pembelian");
    }
  };

  // =========================
  // SECTION: Kolom tabel pembelian
  // =========================
  const purchaseTableColumns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
      render: (value) =>
        value?.toDate ? dayjs(value.toDate()).format("DD-MM-YYYY") : "-",
    },
    {
      title: "Jenis",
      dataIndex: "type",
      key: "type",
      render: (type) =>
        type === "product" ? (
          <Tag color="blue">Produk</Tag>
        ) : (
          <Tag color="gold">Bahan Baku</Tag>
        ),
    },
    {
      title: "Nama Item",
      dataIndex: "itemName",
      key: "itemName",
    },
    {
      title: "Supplier",
      dataIndex: "supplierName",
      key: "supplierName",
    },
    {
      title: "Qty Beli",
      key: "quantityDisplay",
      render: (_, record) =>
        record.type === "material"
          ? `${formatNumberId(record.quantity)} ${record.purchaseUnit || ""}`
          : formatNumberId(record.quantity),
    },
    {
      title: "Stok Masuk",
      key: "stockInDisplay",
      render: (_, record) =>
        record.type === "material"
          ? `${formatNumberId(record.totalStockIn || record.quantity)} ${
              record.stockUnit || ""
            }`
          : formatNumberId(record.quantity),
    },
    {
      title: "Total Aktual Pembelian",
      dataIndex: "totalActualPurchase",
      key: "totalActualPurchase",
      render: (value) => formatCurrencyIdr(value),
    },
    {
      title: "Modal Aktual / Satuan",
      dataIndex: "actualUnitCost",
      key: "actualUnitCost",
      render: (value, record) => (
        <span>
          {formatCurrencyIdr(value)}
          {record.stockUnit ? (
            <>
              <br />
              <span style={{ color: "#999", fontSize: 12 }}>
                / {record.stockUnit}
              </span>
            </>
          ) : null}
        </span>
      ),
    },
    {
      title: "Selisih Hemat",
      dataIndex: "purchaseSaving",
      key: "purchaseSaving",
      render: (value) => {
        const savingMeta = getPurchaseSavingMeta(value);
        return <Tag color={savingMeta.color}>{savingMeta.label}</Tag>;
      },
    },
    {
      title: "Catatan",
      dataIndex: "note",
      key: "note",
    },
  ];

  return (
    <>
      <PageHeader
        title="Pembelian"
        subtitle="Catat pembelian bahan baku maupun produk, sinkronkan stok masuk, dan hitung efisiensi pembelian."
        actions={[
          {
            key: "add-purchase",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Pembelian",
            onClick: openCreatePurchaseModal,
          },
        ]}
      />

      <PageSection
        title="Data Pembelian"
        subtitle="Pembelian akan menambah stok item, mencatat inventory log, dan menghasilkan pengeluaran kas."
      >
        <Table
          dataSource={purchaseRecords}
          columns={purchaseTableColumns}
          rowKey="id"
        />
      </PageSection>

      <Modal
        title="Tambah Pembelian"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => setIsModalOpen(false)}
        okText="Simpan"
        cancelText="Batal"
        width={760}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitPurchase}>
          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="type"
            label="Jenis Item"
            initialValue="material"
            rules={[{ required: true, message: "Jenis wajib dipilih" }]}
          >
            <Select placeholder="Pilih jenis item">
              <Option value="product">Produk</Option>
              <Option value="material">Bahan Baku</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Nama Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih item"
              showSearch
              optionFilterProp="children"
            >
              {(itemType === "product" ? products : materials).map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="supplierId"
            label="Nama Supplier"
            rules={[{ required: true, message: "Supplier wajib dipilih" }]}
            extra={
              itemType === "material" && itemId
                ? "Supplier sudah difilter berdasarkan bahan baku yang dipilih"
                : "Pilih supplier"
            }
          >
            <Select
              placeholder="Pilih supplier"
              showSearch
              optionFilterProp="children"
            >
              {filteredSuppliers.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.storeName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Qty Beli"
            rules={[{ required: true, message: "Qty wajib diisi" }]}
          >
            <InputNumber
              min={0.01}
              step={0.01}
              style={{ width: "100%" }}
              formatter={(value) => formatNumberId(value)}
              parser={(value) => value?.replace(/\./g, "") || ""}
            />
          </Form.Item>

          {itemType === "material" && (
            <>
              <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
                <Form.Item
                  name="purchaseUnit"
                  label="Satuan Beli"
                  rules={[
                    { required: true, message: "Satuan beli wajib diisi" },
                  ]}
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <Input placeholder="Contoh: roll / pack / ikat" />
                </Form.Item>

                <Form.Item
                  name="stockUnit"
                  label="Satuan Stok"
                  rules={[
                    { required: true, message: "Satuan stok wajib diisi" },
                  ]}
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <Input disabled />
                </Form.Item>
              </Space>

              <Form.Item
                name="conversionValue"
                label="Konversi Aktual"
                rules={[{ required: true, message: "Konversi wajib diisi" }]}
                extra={`Isi berapa ${selectedMaterial?.stockUnit || "satuan stok"} untuk 1 ${
                  form.getFieldValue("purchaseUnit") || "satuan beli"
                }. Contoh: 1 roll = 45 meter, isi 45.`}
              >
                <InputNumber
                  min={0.01}
                  step={0.01}
                  style={{ width: "100%" }}
                  formatter={(value) => formatNumberId(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </>
          )}

          <Form.Item label="Stok Masuk Otomatis" name="totalStockIn">
            <InputNumber
              style={{ width: "100%" }}
              readOnly
              formatter={(value) => formatNumberId(value)}
            />
          </Form.Item>

          <Form.Item
            shouldUpdate={(prev, curr) =>
              prev.stockUnit !== curr.stockUnit || prev.itemId !== curr.itemId
            }
            noStyle
          >
            {({ getFieldValue }) => {
              const stockUnit = getFieldValue("stockUnit") || "satuan stok";

              return (
                <Form.Item
                  name="restockReferencePrice"
                  label="Harga Referensi Restock"
                  extra={`Harga patokan per ${stockUnit}. Dipakai untuk membandingkan apakah pembelian ini lebih hemat atau lebih mahal.`}
                >
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={(value) => value?.replace(/\./g, "") || ""}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="subtotalItems"
            label="Subtotal Barang"
            rules={[{ required: true, message: "Subtotal barang wajib diisi" }]}
            extra="Nilai harga barang sebelum ongkir, diskon, voucher, dan biaya layanan."
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              addonBefore="Rp"
              formatter={(value) => formatNumberId(value)}
              parser={(value) => value?.replace(/\./g, "") || ""}
            />
          </Form.Item>

          <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
            <Form.Item
              name="shippingCost"
              label="Ongkir"
              style={{ flex: 1, minWidth: 180 }}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                addonBefore="Rp"
                formatter={(value) => formatNumberId(value)}
                parser={(value) => value?.replace(/\./g, "") || ""}
              />
            </Form.Item>

            <Form.Item
              name="shippingDiscount"
              label="Diskon Ongkir"
              style={{ flex: 1, minWidth: 180 }}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                addonBefore="Rp"
                formatter={(value) => formatNumberId(value)}
                parser={(value) => value?.replace(/\./g, "") || ""}
              />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
            <Form.Item
              name="voucherDiscount"
              label="Voucher / Potongan"
              style={{ flex: 1, minWidth: 180 }}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                addonBefore="Rp"
                formatter={(value) => formatNumberId(value)}
                parser={(value) => value?.replace(/\./g, "") || ""}
              />
            </Form.Item>

            <Form.Item
              name="serviceFee"
              label="Biaya Layanan"
              style={{ flex: 1, minWidth: 180 }}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                addonBefore="Rp"
                formatter={(value) => formatNumberId(value)}
                parser={(value) => value?.replace(/\./g, "") || ""}
              />
            </Form.Item>
          </Space>

          <Form.Item
            shouldUpdate={(prev, curr) =>
              prev.stockUnit !== curr.stockUnit || prev.itemId !== curr.itemId
            }
            noStyle
          >
            {({ getFieldValue }) => {
              const stockUnit = getFieldValue("stockUnit") || "satuan stok";

              return (
                <>
                  <Form.Item
                    label="Total Referensi Pembelian"
                    name="totalReferencePurchase"
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      readOnly
                      addonBefore="Rp"
                      formatter={(value) => formatNumberId(value)}
                    />
                  </Form.Item>

                  <div
                    style={{
                      marginTop: -18,
                      marginBottom: 16,
                      color: "#999",
                      fontSize: 12,
                    }}
                  >
                    Dihitung dari total stok masuk × harga referensi per{" "}
                    {stockUnit}.
                  </div>
                </>
              );
            }}
          </Form.Item>

          <Form.Item label="Total Aktual Pembelian" name="totalActualPurchase">
            <InputNumber
              style={{ width: "100%" }}
              readOnly
              addonBefore="Rp"
              formatter={(value) => formatNumberId(value)}
            />
          </Form.Item>

          <Form.Item
            shouldUpdate={(prev, curr) =>
              prev.stockUnit !== curr.stockUnit || prev.itemId !== curr.itemId
            }
            noStyle
          >
            {({ getFieldValue }) => {
              const stockUnit = getFieldValue("stockUnit") || "satuan stok";

              return (
                <Form.Item
                  label="Modal Aktual per Satuan Stok"
                  name="actualUnitCost"
                  extra={`Dipakai untuk menghitung modal nyata per ${stockUnit} setelah pembelian ini.`}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    readOnly
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            label="Selisih Hemat Pembelian"
            name="purchaseSaving"
            extra="Nilai positif berarti pembelian ini lebih hemat dari harga referensi. Nilai negatif berarti lebih mahal dari harga referensi."
          >
            <InputNumber
              style={{ width: "100%" }}
              readOnly
              addonBefore="Rp"
              formatter={(value) => formatNumberId(value)}
            />
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Purchases;
