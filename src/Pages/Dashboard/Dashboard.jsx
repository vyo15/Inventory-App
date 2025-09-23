// src/Pages/Dashboard/Dashboard.jsx
import React, { useState, useEffect } from "react";
import { Row, Col, message } from "antd";
import {
  collection,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";

// Import sub-komponen UI yang sudah Anda buat
import SummaryCards from "../../Components/Dashboard/SummaryCards";
import MonthlyChart from "../../Components/Dashboard/MonthlyChart";
import LowStockTable from "../../Components/Dashboard/LowStockTable";
import RecentTransactionsTable from "../../Components/Dashboard/RecentTransactionsTable";
import RecentProductionsTable from "../../Components/Dashboard/RecentProductionsTable";
import ProductManagementTable from "../../Components/Dashboard/ProductManagementTable";

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalProducts: 0,
    totalMaterials: 0,
    lowStockProducts: [],
    lowStockMaterials: [],
    recentTransactions: [],
    totalRevenue: 0,
    totalExpenses: 0,
    monthlyFinancialData: [],
    recentProductions: [],
    products: [],
    categories: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kode untuk mengambil data dari Firebase
    if (!db) {
      console.error("Firebase db is not initialized.");
      setLoading(false);
      message.error("Firebase tidak terinisialisasi.");
      return;
    }

    const unsubs = [];
    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          key: doc.id,
        }));
        setDashboardData((prev) => ({
          ...prev,
          products: data,
          totalProducts: snapshot.size,
          lowStockProducts: data.filter((item) => item.stock <= 5),
        }));
      },
      (error) => {
        console.error("Error fetching products: ", error);
        message.error("Gagal memuat produk.");
      }
    );
    unsubs.push(unsubProducts);

    const unsubMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const lowStock = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            collectionName: "raw_materials",
            key: doc.id,
          }))
          .filter((item) => item.stock <= 10);
        setDashboardData((prev) => ({
          ...prev,
          lowStockMaterials: lowStock,
          totalMaterials: snapshot.size,
        }));
      },
      (error) => {
        console.error("Error fetching raw materials: ", error);
        message.error("Gagal memuat bahan baku.");
      }
    );
    unsubs.push(unsubMaterials);

    const unsubTransactions = onSnapshot(
      collection(db, "inventory_logs"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          key: doc.id,
          timestamp: doc.data().timestamp
            ? doc.data().timestamp.toDate()
            : null,
        }));
        const sortedTransactions = data
          .filter((item) => item.timestamp)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 5);
        setDashboardData((prev) => ({
          ...prev,
          recentTransactions: sortedTransactions,
        }));
      },
      (error) => {
        console.error("Error fetching transactions: ", error);
        message.error("Gagal memuat transaksi terbaru.");
      }
    );
    unsubs.push(unsubTransactions);

    const unsubCategories = onSnapshot(
      collection(db, "categories"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          key: doc.id,
        }));
        setDashboardData((prev) => ({ ...prev, categories: data }));
      },
      (error) => {
        console.error("Error fetching categories: ", error);
        message.error("Gagal memuat kategori.");
      }
    );
    unsubs.push(unsubCategories);

    const fetchChartAndProductionData = async () => {
      try {
        const [salesSnap, purchasesSnap, productionsSnap] = await Promise.all([
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "purchases")),
          getDocs(
            query(
              collection(db, "productions"),
              orderBy("date", "desc"),
              limit(5)
            )
          ),
        ]);

        const totalRev = salesSnap.docs.reduce(
          (sum, doc) => sum + (doc.data().total || 0),
          0
        );
        const totalExp = purchasesSnap.docs.reduce(
          (sum, doc) => sum + (doc.data().total || 0),
          0
        );

        const salesData = salesSnap.docs.map((doc) => ({
          ...doc.data(),
          date: doc.data().date ? doc.data().date.toDate() : new Date(),
        }));
        const purchasesData = purchasesSnap.docs.map((doc) => ({
          ...doc.data(),
          date: doc.data().date ? doc.data().date.toDate() : new Date(),
        }));

        const monthlyDataMap = new Map();
        const getMonthYear = (date) =>
          `${date.getFullYear()}-${date.getMonth() + 1}`;
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "Mei",
          "Jun",
          "Jul",
          "Agu",
          "Sep",
          "Okt",
          "Nov",
          "Des",
        ];

        salesData.forEach((sale) => {
          const monthYear = getMonthYear(sale.date);
          if (!monthlyDataMap.has(monthYear)) {
            monthlyDataMap.set(monthYear, {
              month: monthNames[sale.date.getMonth()],
              sales: 0,
              expenses: 0,
            });
          }
          monthlyDataMap.get(monthYear).sales += sale.total;
        });

        purchasesData.forEach((purchase) => {
          const monthYear = getMonthYear(purchase.date);
          if (!monthlyDataMap.has(monthYear)) {
            monthlyDataMap.set(monthYear, {
              month: monthNames[purchase.date.getMonth()],
              sales: 0,
              expenses: 0,
            });
          }
          monthlyDataMap.get(monthYear).expenses += purchase.total;
        });

        const combinedData = [];
        Array.from(monthlyDataMap.entries()).forEach(([, value]) => {
          combinedData.push({
            month: value.month,
            value: value.sales,
            type: "Penjualan",
          });
          combinedData.push({
            month: value.month,
            value: value.expenses,
            type: "Pembelian",
          });
        });

        const sortedMonthlyData = combinedData.sort((a, b) => {
          return monthNames.indexOf(a.month) - monthNames.indexOf(b.month);
        });

        setDashboardData((prev) => ({
          ...prev,
          totalRevenue: totalRev,
          totalExpenses: totalExp,
          monthlyFinancialData: sortedMonthlyData,
          recentProductions: productionsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            key: doc.id,
          })),
        }));
      } catch (error) {
        console.error("Gagal mengambil data tambahan:", error);
        message.error("Gagal memuat data chart dan produksi.");
      } finally {
        setLoading(false);
      }
    };

    fetchChartAndProductionData();

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const {
    totalProducts,
    totalMaterials,
    lowStockProducts,
    lowStockMaterials,
    recentTransactions,
    totalRevenue,
    totalExpenses,
    monthlyFinancialData,
    recentProductions,
    products,
    categories,
  } = dashboardData;

  const allLowStockProductsCount =
    lowStockProducts.length + lowStockMaterials.length;

  return (
    <div style={{ padding: 24 }}>
      <SummaryCards
        totalProducts={totalProducts}
        totalMaterials={totalMaterials}
        lowStockProductsCount={allLowStockProductsCount}
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        loading={loading}
      />

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <MonthlyChart
            monthlyFinancialData={monthlyFinancialData}
            loading={loading}
          />
        </Col>

        <Col xs={24} md={8}>
          <LowStockTable
            lowStockProducts={lowStockProducts}
            lowStockMaterials={lowStockMaterials}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={12}>
          <RecentTransactionsTable
            recentTransactions={recentTransactions}
            loading={loading}
          />
        </Col>
        <Col xs={24} md={12}>
          <RecentProductionsTable
            recentProductions={recentProductions}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <ProductManagementTable
            products={products}
            categories={categories}
            loading={loading}
          />
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
