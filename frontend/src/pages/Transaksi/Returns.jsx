import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  message,
  Tag,
  Tooltip,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import {
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import { showFormValidationFeedback } from "../../utils/forms/formValidationFeedback";
import {
  createReturnTransaction,
  listenReturnProducts,
  listenReturnRawMaterials,
  listenReturnRecords,
  listenReturnSales,
} from "../../services/Transaksi/returnsService";

const { Option } = Select;

const normalizeSourceType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["product", "products"].includes(normalized)) return "product";
  if (["material", "raw", "raw_material", "raw_materials"].includes(normalized)) return "raw_material";
  return normalized;
};

const getSaleItemSourceType = (item = {}) => normalizeSourceType(
  item.sourceType
    || item.itemType
    || item.type
    || (item.collectionName === "raw_materials" ? "raw_material" : "product"),
);

const getSaleItemSourceId = (item = {}) => String(item.sourceId || item.itemId || item.id || "").trim();
const getSaleItemVariantKey = (item = {}) => String(item.variantKey || item.productVariantKey || item.materialVariantId || "").trim();
const buildSaleItemKey = (item = {}) => [
  getSaleItemSourceType(item),
  getSaleItemSourceId(item),
  getSaleItemVariantKey(item) || "master",
].join("::");

const getRecordDateText = (record = {}, withTime = true) => {
  const rawDate = record.date?.toDate ? record.date.toDate() : record.transactionDate || record.date || record.createdAt;
  if (!rawDate) return "-";
  const parsed = dayjs(rawDate);
  return parsed.isValid() ? parsed.format(withTime ? "DD-MM-YYYY HH:mm" : "DD-MM-YYYY") : "-";
};

const getReturnRecordItems = (record = {}) => {
  const rows = Array.isArray(record.items) && record.items.length > 0
    ? record.items
    : [{
        sourceType: record.sourceType || record.type,
        sourceId: record.sourceId || record.itemId,
        variantKey: record.variantKey,
        quantity: record.quantity,
      }];

  return rows.map((item) => ({
    ...item,
    sourceType: normalizeSourceType(item.sourceType || item.type || record.sourceType || record.type),
    sourceId: item.sourceId || item.itemId || item.id || record.sourceId || record.itemId,
    variantKey: item.variantKey || record.variantKey || "",
    quantity: Number(item.quantity || item.qty || 0),
  }));
};

const buildReturnableItemsForSale = (sale = {}, returnRecords = []) => {
  const saleItems = Array.isArray(sale.items) ? sale.items : [];
  const groupedItems = new Map();

  saleItems.forEach((item) => {
    const sourceType = getSaleItemSourceType(item);
    const sourceId = getSaleItemSourceId(item);
    if (!sourceType || !sourceId) return;

    const variantKey = getSaleItemVariantKey(item);
    const key = buildSaleItemKey({ sourceType, sourceId, variantKey });
    const existing = groupedItems.get(key) || {
      key,
      sourceType,
      sourceId,
      itemId: sourceId,
      itemName: item.itemName || item.name || "Item Sales",
      variantKey,
      variantLabel: item.variantLabel || "",
      unit: item.unit || item.stockUnit || "",
      pricePerUnit: Number(item.pricePerUnit || 0),
      soldQuantity: 0,
      returnedQuantity: 0,
    };

    existing.soldQuantity += Math.abs(Number(item.quantity || item.qty || 0));
    groupedItems.set(key, existing);
  });

  returnRecords
    .filter((record) => String(record.relatedSaleId || record.saleId || "") === String(sale.id || ""))
    .forEach((record) => {
      getReturnRecordItems(record).forEach((item) => {
        const key = buildSaleItemKey(item);
        const target = groupedItems.get(key);
        if (target) {
          target.returnedQuantity += Math.abs(Number(item.quantity || 0));
        }
      });
    });

  return Array.from(groupedItems.values()).map((item) => ({
    ...item,
    remainingQuantity: Math.max(item.soldQuantity - item.returnedQuantity, 0),
    saleReference: sale.referenceNumber || sale.saleNumber || sale.code || sale.id,
  }));
};

const Returns = () => {
  const [form] = Form.useForm();

  const [returnRecords, setReturnRecords] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const selectedSaleId = Form.useWatch("relatedSaleId", form);
  const selectedSaleItemKey = Form.useWatch("saleItemKey", form);

  const allItems = useMemo(() => [...products, ...materials], [products, materials]);
  const salesWithItems = useMemo(
    () => salesRecords.filter((sale) => Array.isArray(sale.items) && sale.items.length > 0),
    [salesRecords],
  );
  const selectedSale = useMemo(
    () => salesRecords.find((sale) => String(sale.id) === String(selectedSaleId)) || null,
    [salesRecords, selectedSaleId],
  );
  const returnableItems = useMemo(
    () => (selectedSale ? buildReturnableItemsForSale(selectedSale, returnRecords) : []),
    [selectedSale, returnRecords],
  );
  const selectedReturnItem = useMemo(
    () => returnableItems.find((item) => item.key === selectedSaleItemKey) || null,
    [returnableItems, selectedSaleItemKey],
  );
  const selectedStockItem = useMemo(
    () => allItems.find((item) => String(item.id) === String(selectedReturnItem?.sourceId)) || null,
    [allItems, selectedReturnItem],
  );
  const selectedItemHasVariants = inferHasVariants(selectedStockItem || {});
  const selectedVariant = selectedItemHasVariants && selectedReturnItem?.variantKey
    ? findVariantByKey(selectedStockItem, selectedReturnItem.variantKey)
    : null;

  useEffect(() => {
    const unsubscribeReturns = listenReturnRecords(
      (nextReturnRecords) => {
        setReturnRecords(nextReturnRecords);
        setLoadError("");
        setIsLoading(false);
      },
      (error) => {
        console.error("Gagal memuat data retur:", error);
        setReturnRecords([]);
        setLoadError("Gagal memuat data retur.");
        setIsLoading(false);
        message.error("Gagal memuat data retur.");
      },
    );

    const unsubscribeSales = listenReturnSales(
      (nextSalesRecords) => setSalesRecords(nextSalesRecords),
      (error) => {
        console.error("Gagal memuat sales untuk retur:", error);
        setSalesRecords([]);
        message.error("Gagal memuat transaksi sales untuk retur.");
      },
    );

    const unsubscribeProducts = listenReturnProducts(
      (nextProducts) => setProducts(nextProducts),
      (error) => {
        console.error("Gagal memuat produk untuk retur:", error);
        message.error("Gagal memuat produk untuk retur.");
      },
    );

    const unsubscribeMaterials = listenReturnRawMaterials(
      (nextMaterials) => setMaterials(nextMaterials),
      (error) => {
        console.error("Gagal memuat bahan baku untuk retur:", error);
        message.error("Gagal memuat bahan baku untuk retur.");
      },
    );

    return () => {
      unsubscribeReturns();
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeMaterials();
    };
  }, []);

  useEffect(() => {
    form.setFieldsValue({ saleItemKey: undefined, quantity: undefined });
  }, [form, selectedSaleId]);

  const resetReturnFormState = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  const openCreateReturnModal = () => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs() });
    setIsModalOpen(true);
  };

  const handleSubmitReturn = async (values) => {
    if (isSubmittingReturn) return;

    setIsSubmittingReturn(true);

    try {
      await createReturnTransaction({
        values,
        returnableItems,
        selectedSale,
      });

      message.success("Retur berhasil ditambahkan!");
      resetReturnFormState();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan retur");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const returnTableColumns = [
    {
      title: "Tanggal / Ref",
      key: "dateReference",
      width: 190,
      render: (_, record) => {
        const dateText = getRecordDateText(record);
        const referenceText = resolveDisplayReference(record, {
          fields: ["returnNumber", "returnCode", "code", "referenceNumber", "sourceRef", "referenceCode"],
          fallback: "Referensi belum tersedia",
          allowTechnicalId: false,
        });
        const saleReference = record.saleReference || record.relatedSaleId || "Sales belum tercatat";
        return (
          <div style={{ minWidth: 0 }}>
            <div className="ims-cell-title">{dateText}</div>
            <Tooltip title={referenceText}>
              <div className="ims-cell-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {referenceText}
              </div>
            </Tooltip>
            <Tooltip title={`Sales: ${saleReference}`}>
              <div className="ims-cell-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Sales: {saleReference}
              </div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: "Item / Asal",
      key: "itemSource",
      width: 270,
      render: (_, record) => {
        const itemName = record.itemName || record.items?.[0]?.itemName || "-";
        const recordType = record.items?.[0]?.sourceType || record.sourceType || record.type;
        const typeTag = normalizeSourceType(recordType) === "product" ? <Tag color="blue">Produk</Tag> : <Tag color="gold">Bahan Baku</Tag>;
        const variantLabel = record.variantLabel || record.variantKey || record.items?.[0]?.variantLabel || record.items?.[0]?.variantKey;
        const variantTag = variantLabel ? <Tag color="purple">{variantLabel}</Tag> : <Tag>Master</Tag>;

        return (
          <div style={{ minWidth: 0 }}>
            <Tooltip title={itemName}>
              <div className="ims-cell-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {itemName}
              </div>
            </Tooltip>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {typeTag}
              {variantTag}
            </div>
          </div>
        );
      },
    },
    {
      title: "Qty Return",
      dataIndex: "quantity",
      key: "quantity",
      width: 130,
      align: "right",
      render: (value, record) => {
        const firstItem = record.items?.[0] || {};
        const unit = firstItem.unit || record.stockUnit || record.unit || "";
        const quantity = value ?? firstItem.quantity ?? 0;
        return <strong>{formatNumberId(quantity)}{unit ? ` ${unit}` : ""}</strong>;
      },
    },
    {
      title: "Alasan / Catatan",
      dataIndex: "note",
      key: "note",
      width: 280,
      render: (value, record) => {
        const noteText = value || record.notes || "-";
        return (
          <Tooltip title={noteText}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {noteText}
            </span>
          </Tooltip>
        );
      },
    },
  ];

  const returnMobileCardConfig = {
    title: (record) => resolveDisplayReference(record, {
      fields: ["returnNumber", "returnCode", "code", "referenceNumber", "sourceRef", "referenceCode"],
      fallback: "Referensi belum tersedia",
      allowTechnicalId: false,
    }),
    subtitle: (record) => [
      getRecordDateText(record),
      record.itemName || record.items?.[0]?.itemName || "Item tidak tercatat",
    ],
    tags: (record) => {
      const firstItem = record.items?.[0] || {};
      const recordType = normalizeSourceType(firstItem.sourceType || record.sourceType || record.type);
      return [
        <Tag key="item-type" color={recordType === "product" ? "blue" : "gold"}>
          {recordType === "product" ? "Produk" : "Bahan Baku"}
        </Tag>,
        <Tag key="variant" color={firstItem.variantLabel || firstItem.variantKey || record.variantLabel || record.variantKey ? "purple" : "default"}>
          {firstItem.variantLabel || firstItem.variantKey || record.variantLabel || record.variantKey || "Master"}
        </Tag>,
      ];
    },
    meta: [
      { label: "Qty Return", value: (record) => {
        const firstItem = record.items?.[0] || {};
        const unit = firstItem.unit || record.stockUnit || record.unit || "";
        const quantity = record.quantity ?? firstItem.quantity ?? 0;
        return `${formatNumberId(quantity)}${unit ? ` ${unit}` : ""}`;
      } },
      { label: "Sales", value: (record) => record.saleReference || record.relatedSaleId || "-" },
      { label: "Tanggal", value: (record) => getRecordDateText(record, false) },
    ],
    content: (record) => record.note || record.notes || "-",
  };

  return (
    <>
      <PageHeader
        title="Retur"
        subtitle="Retur barang dari transaksi Sales resmi."
        actions={[
          {
            key: "add-return",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Retur",
            onClick: openCreateReturnModal,
          },
        ]}
      />

      <PageSection
        title="Data Retur"
        subtitle="Stok kembali hanya dari item yang pernah terjual."
      >
        <DataRefreshIndicator loading={isLoading} dataSource={returnRecords} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          dataSource={returnRecords}
          columns={returnTableColumns}
          rowKey="id"
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(isLoading, loadError || "Belum ada data retur.") }}
          mobileCardConfig={returnMobileCardConfig}
        />
      </PageSection>

      <Modal
        title="Tambah Retur"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => {
          if (!isSubmittingReturn) {
            resetReturnFormState();
          }
        }}
        confirmLoading={isSubmittingReturn}
        okButtonProps={{ disabled: isSubmittingReturn || !selectedReturnItem || selectedReturnItem.remainingQuantity <= 0 }}
        cancelButtonProps={{ disabled: isSubmittingReturn }}
        okText="Simpan"
        cancelText="Batal"
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitReturn}
          onFinishFailed={(errorInfo) => showFormValidationFeedback(errorInfo, { form })}
        >
          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="relatedSaleId"
            label="Transaksi Sales"
            rules={[{ required: true, message: "Transaksi Sales wajib dipilih" }]}
            extra="Retur wajib berasal dari transaksi Sales agar qty dan stok tetap terkunci."
          >
            <Select
              placeholder="Pilih transaksi Sales"
              showSearch
              optionFilterProp="children"
            >
              {salesWithItems.map((sale) => {
                const reference = sale.referenceNumber || sale.saleNumber || sale.code || sale.id;
                const label = `${reference} - ${sale.customerName || "Pelanggan"} - ${getRecordDateText(sale, false)}`;
                return (
                  <Option key={sale.id} value={sale.id}>
                    {label}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          {selectedSale ? (
            <div className="ims-readonly-panel" style={{ marginBottom: 16 }}>
              <div className="ims-readonly-panel-header">
                <div>
                  <div className="ims-readonly-panel-title">
                    Ringkasan Sales
                  </div>
                  <div className="ims-readonly-panel-description">
                    {selectedSale.customerName || "Pelanggan"} • {selectedSale.salesChannel || "Channel"}
                  </div>
                </div>
                <Tag>{selectedSale.status || "Status"}</Tag>
              </div>
            </div>
          ) : null}

          <Form.Item
            name="saleItemKey"
            label="Item dari Sales"
            rules={[{ required: true, message: "Item Sales wajib dipilih" }]}
          >
            <Select
              placeholder={selectedSale ? "Pilih item yang diretur" : "Pilih transaksi Sales dulu"}
              disabled={!selectedSale}
              showSearch
              optionFilterProp="children"
            >
              {returnableItems.map((item) => (
                <Option key={item.key} value={item.key} disabled={item.remainingQuantity <= 0}>
                  {item.itemName}{item.variantLabel ? ` - ${item.variantLabel}` : ""} — Sisa retur: {formatNumberId(item.remainingQuantity)} dari {formatNumberId(item.soldQuantity)}{item.unit ? ` ${item.unit}` : ""}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedReturnItem ? (
            <div className="ims-readonly-panel" style={{ marginBottom: 16 }}>
              <div className="ims-readonly-panel-header">
                <div>
                  <div className="ims-readonly-panel-title">
                    Batas Retur Item
                  </div>
                  <div className="ims-readonly-panel-description">
                    Qty retur tidak boleh melebihi sisa item dari sales ini.
                  </div>
                </div>
                <Tag color={selectedReturnItem.sourceType === "product" ? "blue" : "gold"}>
                  {selectedReturnItem.sourceType === "product" ? "Produk" : "Bahan Baku"}
                </Tag>
              </div>
              <div className="ims-readonly-stat-grid">
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Terjual</div>
                  <div className="ims-readonly-stat-value">{formatNumberId(selectedReturnItem.soldQuantity)}</div>
                </div>
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Sudah Retur</div>
                  <div className="ims-readonly-stat-value">{formatNumberId(selectedReturnItem.returnedQuantity)}</div>
                </div>
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Sisa Bisa Retur</div>
                  <div className="ims-readonly-stat-value">{formatNumberId(selectedReturnItem.remainingQuantity)}</div>
                </div>
              </div>
            </div>
          ) : null}

          {selectedReturnItem ? (
            <div className="ims-readonly-panel" style={{ marginBottom: 16 }}>
              <div className="ims-readonly-panel-header">
                <div>
                  <div className="ims-readonly-panel-title">
                    Stok Item Sebelum Retur
                  </div>
                  <div className="ims-readonly-panel-description">
                    Info stok sebelum retur disimpan.
                  </div>
                </div>
                <Tag color={selectedItemHasVariants ? "purple" : "default"}>
                  {selectedItemHasVariants ? "Varian" : "Master"}
                </Tag>
              </div>

              <div style={{ marginBottom: 10 }}>
                <span className="ims-cell-title">
                  {selectedReturnItem.itemName || selectedStockItem?.name || "Item"}
                </span>
                {selectedReturnItem.variantLabel || selectedReturnItem.variantKey ? (
                  <span style={{ color: "var(--ims-text-secondary)" }}>
                    {` — ${selectedReturnItem.variantLabel || selectedReturnItem.variantKey}`}
                  </span>
                ) : null}
              </div>

              <div className="ims-readonly-stat-grid">
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Stok Saat Ini</div>
                  <div className="ims-readonly-stat-value">
                    {formatNumberId((selectedItemHasVariants ? selectedVariant?.currentStock : getItemStockSnapshot(selectedStockItem || {}).currentStock) || 0)}
                  </div>
                </div>
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Stok Tertahan</div>
                  <div className="ims-readonly-stat-value">
                    {formatNumberId((selectedItemHasVariants ? selectedVariant?.reservedStock : getItemStockSnapshot(selectedStockItem || {}).reservedStock) || 0)}
                  </div>
                </div>
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Stok Tersedia</div>
                  <div className="ims-readonly-stat-value">
                    {formatNumberId((selectedItemHasVariants ? selectedVariant?.availableStock : getItemStockSnapshot(selectedStockItem || {}).availableStock) || 0)}
                  </div>
                </div>
              </div>

              {selectedItemHasVariants ? (
                <div className="ims-readonly-panel-note">
                  Retur akan masuk ke varian yang sama dengan item sales.
                </div>
              ) : null}
            </div>
          ) : null}

          <Form.Item
            name="quantity"
            label="Jumlah"
            rules={[
              { required: true, message: "Jumlah wajib diisi" },
              {
                validator: (_, value) => {
                  const qty = Number(value || 0);
                  if (!selectedReturnItem) return Promise.reject(new Error("Pilih item Sales dulu."));
                  if (qty <= 0) return Promise.reject(new Error("Jumlah harus lebih dari 0."));
                  if (qty > selectedReturnItem.remainingQuantity) {
                    return Promise.reject(new Error(`Jumlah retur maksimal ${formatNumberId(selectedReturnItem.remainingQuantity)}.`));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              min={1}
              max={selectedReturnItem?.remainingQuantity || undefined}
              step={1}
              precision={0}
              parser={parseIntegerIdInput}
              disabled={!selectedReturnItem || selectedReturnItem.remainingQuantity <= 0}
              style={{ width: "100%" }}
            />
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Returns;
