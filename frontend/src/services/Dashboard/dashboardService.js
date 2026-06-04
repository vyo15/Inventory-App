import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";
import { getStockIssueReadModels } from "../Inventory/stockReadModelService";
import { fetchSalesRecords } from "../Transaksi/salesService";
import { listFinanceExpenses, listFinanceIncomes } from "../Finance/financeService";

const onceFromListener = (listener) => new Promise((resolve, reject) => {
  let unsubscribe = null;
  unsubscribe = listener((rows) => { if (unsubscribe) unsubscribe(); resolve(rows || []); }, reject);
});
const sumAmount = (rows = []) => rows.reduce((sum, item) => sum + Number(item.totalAmount ?? item.amount ?? item.total ?? 0), 0);
export const readDashboardData = async ({ maxListItems = 5 } = {}) => {
  const [products, rawMaterials, sales, incomes, expenses, stockIssues] = await Promise.all([
    onceFromListener(listenProducts).catch(() => []),
    onceFromListener(listenRawMaterials).catch(() => []),
    fetchSalesRecords().catch(() => []),
    listFinanceIncomes({ limit: 1000 }).catch(() => []),
    listFinanceExpenses({ limit: 1000 }).catch(() => []),
    getStockIssueReadModels({ maxResults: maxListItems }).catch(() => []),
  ]);
  return {
    summary: {
      productCount: products.length,
      rawMaterialCount: rawMaterials.length,
      salesCount: sales.length,
      incomeTotal: sumAmount(incomes),
      expenseTotal: sumAmount(expenses),
      profit: sumAmount(incomes) - sumAmount(expenses),
    },
    lowStockItems: stockIssues.slice(0, maxListItems),
    recentSales: sales.slice(0, maxListItems),
    recentIncomes: incomes.slice(0, maxListItems),
    recentExpenses: expenses.slice(0, maxListItems),
  };
};
