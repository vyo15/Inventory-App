import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Space,
  Input,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  message,
  Tag,
  Button,
} from "antd";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
  FileExcelOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";

const { Search } = Input;
const { Option } = Select;

// Ambang batas stok rendah, bisa disesuaikan
const LOW_STOCK_THRESHOLD = 10;

const StockReport = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    // Listener untuk koleksi raw_materials
    const unsubscribeRawMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const rawMaterialsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          type: "Bahan Baku",
          // Tentukan status stok
          status: doc.data().stock < LOW_STOCK_THRESHOLD ? "Kritis" : "Normal",
        }));
        setInventory((prev) => [
          ...prev.filter((item) => item.type !== "Bahan Baku"),
          ...rawMaterialsData,
        ]);
        setLoading(false);
      },
      (error) => {
        message.error("Gagal memuat data bahan baku.");
        console.error("Error fetching raw materials:", error);
        setLoading(false);
      }
    );

    // Listener untuk koleksi products
    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          type: "Produk Jadi",
          // Tentukan status stok
          status: doc.data().stock < LOW_STOCK_THRESHOLD ? "Kritis" : "Normal",
        }));
        setInventory((prev) => [
          ...prev.filter((item) => item.type !== "Produk Jadi"),
          ...productsData,
        ]);
      },
      (error) => {
        message.error("Gagal memuat data produk jadi.");
        console.error("Error fetching products:", error);
      }
    );

    // Ambil data kategori
    const fetchCategories = async () => {
      try {
        const categorySnapshot = await getDocs(collection(db, "categories"));
        const categoryList = categorySnapshot.docs.map(
          (doc) => doc.data().name
        );
        setCategories(categoryList);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();

    return () => {
      unsubscribeRawMaterials();
      unsubscribeProducts();
    };
  }, []);

  // Filter dan hitung data untuk tampilan dashboard
  const filteredData = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesStatus =
        selectedStatus === "all" ||
        item.status.toLowerCase() === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventory, searchTerm, selectedCategory, selectedStatus]);

  const totalItems = filteredData.length;
  const lowStockItems = filteredData.filter(
    (item) => item.stock < LOW_STOCK_THRESHOLD
  );
  const criticalStockItems = filteredData.filter((item) => item.stock === 0);

  // Fungsi untuk ekspor ke CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) {
      message.warning("Tidak ada data untuk diekspor.");
      return;
    }
    const headers = [
      "Nama Item",
      "Kategori",
      "Jenis",
      "Stok",
      "Satuan",
      "Status",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredData.map(
        (item) =>
          `${item.name},${item.category || "N/A"},${item.type},${item.stock},${
            item.unit || "N/A"
          },${item.status}`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "laporan_stok.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      title: "Nama Item",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Kategori",
      dataIndex: "category",
      key: "category",
    },
    {
      title: "Jenis",
      dataIndex: "type",
      key: "type",
      filters: [
        { text: "Bahan Baku", value: "Bahan Baku" },
        { text: "Produk Jadi", value: "Produk Jadi" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Stok",
      dataIndex: "stock",
      key: "stock",
      sorter: (a, b) => a.stock - b.stock,
    },
    {
      title: "Satuan",
      dataIndex: "unit",
      key: "unit",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        let color = "geekblue";
        let icon = null;
        if (status === "Kritis") {
          color = "volcano";
          icon = <WarningOutlined />;
        } else if (status === "Normal") {
          color = "green";
          icon = <CheckCircleOutlined />;
        }
        return (
          <Tag color={color} icon={icon}>
            {status}
          </Tag>
        );
      },
      filters: [
        { text: "Normal", value: "normal" },
        { text: "Kritis", value: "kritis" },
      ],
      onFilter: (value, record) => record.status.toLowerCase() === value,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Laporan Stok</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Item"
              value={totalItems}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Item Stok Rendah"
              value={lowStockItems.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Item Stok Habis"
              value={criticalStockItems.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>

      <Space
        style={{
          marginBottom: 16,
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <Space>
          <Search
            placeholder="Cari item..."
            allowClear
            onSearch={setSearchTerm}
            style={{ width: 250 }}
          />
          <Select
            defaultValue="all"
            style={{ width: 150 }}
            onChange={setSelectedCategory}
          >
            <Option value="all">Semua Kategori</Option>
            {categories.map((cat) => (
              <Option key={cat} value={cat}>
                {cat}
              </Option>
            ))}
          </Select>
          <Select
            defaultValue="all"
            style={{ width: 150 }}
            onChange={setSelectedStatus}
          >
            <Option value="all">Semua Status</Option>
            <Option value="normal">Normal</Option>
            <Option value="kritis">Kritis</Option>
          </Select>
        </Space>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          onClick={exportToCSV}
        >
          Ekspor ke CSV
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        rowKey="id"
        bordered
      />
    </div>
  );
};

export default StockReport;
