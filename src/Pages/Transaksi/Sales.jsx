import React, { useState, useEffect } from "react";
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
import { addInventoryLog, updateStock } from "../../utils/stockService";

const { Option } = Select;

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [form] = Form.useForm();

  const allItems = [...products, ...rawMaterials];

  useEffect(() => {
    fetchSales(activeTab);
    fetchProducts();
    fetchRawMaterials();
  }, [activeTab]);

  const fetchSales = async (statusFilter) => {
    setLoading(true);
    try {
      const salesRef = collection(db, "sales");
      let q;

      if (statusFilter === "all") {
        q = query(salesRef, orderBy("createdAt", "desc"));
      } else {
        // This is the query that requires a composite index in Firestore
        q = query(
          salesRef,
          where("status", "==", statusFilter),
          orderBy("createdAt", "desc")
        );
      }

      const querySnapshot = await getDocs(q);
      const fetchedSales = querySnapshot.docs.map((d) => {
        const data = d.data();
        const dateValue = data.date;
        return {
          id: d.id,
          ...data,
          date: dateValue?.toDate
            ? dayjs(dateValue.toDate()).format("YYYY-MM-DD")
            : "Tanggal Tidak Tersedia",
        };
      });
      setSales(fetchedSales);
    } catch (error) {
      console.error("Gagal mengambil data penjualan:", error);
      message.error(
        "Gagal mengambil data penjualan. Silakan periksa konsol untuk detailnya."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const productsRef = collection(db, "products");
      const productsSnapshot = await getDocs(productsRef);
      const productsList = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsList);
    } catch (error) {
      console.error("Gagal mengambil data produk:", error);
      message.error("Gagal memuat daftar produk.");
    }
  };

  const fetchRawMaterials = async () => {
    try {
      const materialsRef = collection(db, "raw_materials");
      const materialsSnapshot = await getDocs(materialsRef);
      const materialsList = materialsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRawMaterials(materialsList);
    } catch (error) {
      console.error("Gagal mengambil data bahan baku:", error);
      message.error("Gagal memuat daftar bahan baku.");
    }
  };

  const onItemSelectChange = (itemId, itemIndex) => {
    const selectedItem = allItems.find((item) => item.id === itemId);
    if (selectedItem && selectedItem.price !== undefined) {
      const items = form.getFieldValue("items");
      items[itemIndex].pricePerUnit = selectedItem.price;
      form.setFieldsValue({ items: [...items] });
    }
  };

  const handleAddSale = async () => {
    try {
      const values = await form.validateFields();
      const { customer, items, platform, status, date, receiptNumber } = values;

      let totalSaleValue = 0;

      for (const item of items) {
        const selectedItem = allItems.find((p) => p.id === item.itemId);
        if (!selectedItem) {
          message.error("Produk/Bahan baku tidak ditemukan di inventaris.");
          return;
        }
        if ((selectedItem.stock || 0) < item.quantity) {
          message.error(
            `Stok ${selectedItem.name} tidak mencukupi. Tersisa: ${selectedItem.stock}`
          );
          return;
        }
        totalSaleValue += item.pricePerUnit * item.quantity;
      }

      const newSale = {
        customer,
        items: items.map((item) => {
          const selectedItem = allItems.find((p) => p.id === item.itemId);
          return {
            itemId: item.itemId,
            itemName: selectedItem.name,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
            subtotal: item.pricePerUnit * item.quantity,
            collectionName: products.find((p) => p.id === item.itemId)
              ? "products"
              : "raw_materials",
          };
        }),
        platform,
        status,
        date: Timestamp.fromDate(date.toDate()),
        receiptNumber: receiptNumber || null,
        total: totalSaleValue,
        createdAt: Timestamp.now(),
      };

      const salesRef = await addDoc(collection(db, "sales"), newSale);

      for (const item of newSale.items) {
        await updateStock(item.itemId, -item.quantity, item.collectionName);
        await addInventoryLog(
          item.itemId,
          item.itemName,
          -item.quantity,
          "sale",
          item.collectionName,
          {
            customer: newSale.customer,
            saleId: salesRef.id,
            note: `Penjualan ke ${newSale.customer}`,
            subtotal: item.subtotal,
          }
        );
      }

      if (status === "Selesai") {
        const itemNames = newSale.items
          .map((item) => `${item.itemName} (${item.quantity})`)
          .join(", ");
        const descriptionText = `Penjualan: ${itemNames}`;

        await addDoc(collection(db, "revenues"), {
          date: Timestamp.fromDate(date.toDate()),
          type: "Penjualan",
          relatedId: salesRef.id,
          description: descriptionText,
          amount: totalSaleValue,
        });
      }

      message.success("Penjualan berhasil ditambahkan!");
      setIsModalVisible(false);
      form.resetFields();
      fetchSales(activeTab);
    } catch (error) {
      console.error("Gagal tambah penjualan:", error);
      message.error("Gagal menambahkan penjualan.");
    }
  };

  const handleUpdateStatus = async (saleId, newStatus) => {
    try {
      const saleRef = doc(db, "sales", saleId);
      await updateDoc(saleRef, { status: newStatus });
      message.success(`Status penjualan berhasil diubah menjadi ${newStatus}.`);

      if (newStatus === "Selesai") {
        const saleToComplete = sales.find((o) => o.id === saleId);
        if (saleToComplete && saleToComplete.total > 0) {
          const itemNames = saleToComplete.items
            .map((item) => `${item.itemName} (${item.quantity})`)
            .join(", ");
          const descriptionText = `Penjualan: ${itemNames}`;

          await addDoc(collection(db, "revenues"), {
            date: Timestamp.now(),
            type: "Penjualan",
            relatedId: saleId,
            description: descriptionText,
            amount: saleToComplete.total,
          });
        }
      }

      // Update local state immediately to remove the item from the current view
      setSales((prevSales) => prevSales.filter((sale) => sale.id !== saleId));
      fetchSales(activeTab); // Then fetch the latest data
    } catch (error) {
      console.error("Gagal update status:", error);
      message.error("Gagal mengubah status penjualan.");
    }
  };

  const handleDeleteSale = async (id) => {
    const batch = writeBatch(db);
    try {
      const saleToDelete = sales.find((o) => o.id === id);
      if (!saleToDelete) {
        throw new Error("Penjualan tidak ditemukan.");
      }

      for (const item of saleToDelete.items) {
        const itemRef = doc(db, item.collectionName, item.itemId);
        batch.update(itemRef, { stock: increment(item.quantity) });

        await addInventoryLog(
          item.itemId,
          item.itemName,
          item.quantity,
          "sale_revert",
          item.collectionName,
          {
            note: `Pembatalan penjualan ID: ${id}`,
            saleId: id,
            customer: saleToDelete.customer,
          }
        );
      }

      if (saleToDelete.status === "Selesai") {
        const revenuesRef = collection(db, "revenues");
        const q = query(revenuesRef, where("relatedId", "==", id));
        const revenuesSnapshot = await getDocs(q);
        revenuesSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      const saleRef = doc(db, "sales", id);
      batch.delete(saleRef);

      await batch.commit();

      message.success("Penjualan berhasil dihapus dan stok dikembalikan.");
      fetchSales(activeTab);
    } catch (error) {
      console.error("Gagal menghapus penjualan:", error);
      message.error("Gagal menghapus penjualan. Silakan coba lagi.");
    }
  };

  const columns = [
    { title: "Nama Pelanggan", dataIndex: "customer", key: "customer" },
    {
      title: "Produk",
      dataIndex: "items",
      key: "items",
      render: (items) =>
        Array.isArray(items) && items.length > 0 ? (
          <ul>
            {items.map((item, index) => (
              <li key={index}>
                {item.itemName} ({item.quantity}) - Rp{" "}
                {item.subtotal?.toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          "-"
        ),
    },
    { title: "Platform", dataIndex: "platform", key: "platform" },
    {
      title: "Resi",
      dataIndex: "receiptNumber",
      key: "receiptNumber",
      render: (receiptNumber) => receiptNumber || "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (val) => (val != null ? `Rp ${val.toLocaleString()}` : "-"),
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
        };
        const color = statusColors[status] || "default";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    { title: "Tanggal", dataIndex: "date", key: "date" },
    {
      title: "Aksi",
      key: "action",
      render: (text, record) => (
        <Space size="middle">
          {record.status === "Diproses" &&
            record.platform !== "Offline Store" && (
              <Popconfirm
                title="Yakin ubah status menjadi Dikirim?"
                onConfirm={() => handleUpdateStatus(record.id, "Dikirim")}
                okText="Ya"
                cancelText="Tidak"
              >
                <Button type="link">Dikirim</Button>
              </Popconfirm>
            )}
          {record.status === "Dikirim" &&
            record.platform !== "Offline Store" && (
              <Popconfirm
                title="Yakin ubah status menjadi Selesai?"
                onConfirm={() => handleUpdateStatus(record.id, "Selesai")}
                okText="Ya"
                cancelText="Tidak"
              >
                <Button type="link">Selesai</Button>
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

  const tabItems = [
    { key: "all", label: "Semua Penjualan" },
    { key: "Diproses", label: "Diproses" },
    { key: "Dikirim", label: "Dikirim" },
    { key: "Selesai", label: "Selesai" },
  ];

  const handlePlatformChange = (value) => {
    if (value === "Offline Store") {
      form.setFieldsValue({ status: "Selesai" });
    } else {
      form.setFieldsValue({ status: "Diproses" });
    }
  };

  return (
    <div>
      <h2>Daftar Penjualan</h2>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setIsModalVisible(true);
          form.resetFields();
          form.setFieldsValue({
            platform: "Shopee",
            status: "Diproses",
            date: dayjs(),
          });
        }}
      >
        Tambah Penjualan
      </Button>

      <Tabs
        items={tabItems}
        defaultActiveKey="all"
        onChange={(key) => setActiveTab(key)}
        style={{ marginTop: 16 }}
      />

      <Table
        columns={columns}
        dataSource={sales}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        loading={loading}
        style={{ marginTop: 16 }}
      />

      <Modal
        title="Tambah Penjualan"
        open={isModalVisible}
        onOk={form.submit}
        onCancel={() => setIsModalVisible(false)}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleAddSale}>
          <Form.Item
            label="Nama Pelanggan"
            name="customer"
            rules={[{ required: true, message: "Harap isi nama pelanggan!" }]}
          >
            <Input placeholder="Ketik nama pelanggan" />
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
                        placeholder="Pilih produk/bahan baku"
                        onChange={(itemId) => onItemSelectChange(itemId, name)}
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
                    <Space style={{ marginBottom: 12 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, "quantity"]}
                        rules={[{ required: true, message: "Jumlah!" }]}
                      >
                        <InputNumber
                          min={1}
                          placeholder="Jumlah"
                          style={{ width: 100 }}
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
                          formatter={(value) =>
                            `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                          }
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
                    onClick={() => add()}
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
            label="Platform"
            name="platform"
            rules={[{ required: true, message: "Harap pilih platform!" }]}
            initialValue="Shopee"
          >
            <Select
              placeholder="Pilih platform"
              onChange={handlePlatformChange}
            >
              <Option value="Offline Store">Offline Store</Option>
              <Option value="Shopee">Shopee</Option>
              <Option value="Tokopedia">Tokopedia</Option>
              <Option value="TikTok">TikTok</Option>
              <Option value="WhatsApp">WhatsApp</Option>
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const platform = getFieldValue("platform");
              const isOffline = platform === "Offline Store";
              return (
                <Form.Item
                  label="Status"
                  name="status"
                  rules={[{ required: true, message: "Harap pilih status!" }]}
                  initialValue={isOffline ? "Selesai" : "Diproses"}
                >
                  <Select
                    placeholder="Pilih status penjualan"
                    disabled={isOffline}
                  >
                    {isOffline ? (
                      <Option value="Selesai">Selesai</Option>
                    ) : (
                      <>
                        <Option value="Diproses">Diproses</Option>
                        <Option value="Dikirim">Dikirim</Option>
                        <Option value="Selesai">Selesai</Option>
                      </>
                    )}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item label="Nomor Resi" name="receiptNumber">
            <Input placeholder="Opsional: Masukkan nomor resi" />
          </Form.Item>

          <Form.Item
            label="Tanggal"
            name="date"
            rules={[{ required: true, message: "Harap pilih tanggal!" }]}
            initialValue={dayjs()}
          >
            <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Sales;
