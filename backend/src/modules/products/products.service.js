const getProductsRouterConfig = () => ({
  tableName: "products",
  moduleKey: "products",
  entityType: "product",
  codePrefix: "PRD",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
});

module.exports = {
  getProductsRouterConfig,
};
