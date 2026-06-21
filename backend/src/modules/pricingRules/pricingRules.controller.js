const { failure, success } = require("../../utils/response");
const {
  applyPricingRuleBatch,
  createPricingRule,
  generatePricingRuleCode,
  getPricingRuleById,
  listPricingRules,
  softDeletePricingRule,
  updatePricingRule,
} = require("./pricingRules.service");

const getActor = (req) => req.localAuth?.user?.username || "system";

const handlePricingRuleError = (res, error) => {
  if (String(error?.message || "").includes("UNIQUE")) {
    return failure(res, "Kode/ID pricing rule sudah ada di database lokal.", "DUPLICATE_CODE", 409);
  }

  if (error?.isServiceError) {
    return failure(res, error.message, error.code, error.statusCode || 400);
  }

  return null;
};

const generatePricingRuleCodeController = async (_req, res, next) => {
  try {
    const code = await generatePricingRuleCode();
    return success(res, "Kode pricing rule database lokal berhasil dibuat", { code });
  } catch (error) {
    return next(error);
  }
};

const listPricingRulesController = async (req, res, next) => {
  try {
    const pricingRules = await listPricingRules(req.query);
    return success(res, "Data pricing rule database lokal berhasil dimuat", pricingRules);
  } catch (error) {
    return next(error);
  }
};

const getPricingRuleController = async (req, res, next) => {
  try {
    const pricingRule = await getPricingRuleById(req.params.id);

    if (!pricingRule) {
      return failure(res, "Pricing rule database lokal tidak ditemukan.", "NOT_FOUND", 404);
    }

    return success(res, "Pricing rule database lokal berhasil dimuat", pricingRule);
  } catch (error) {
    return next(error);
  }
};

const createPricingRuleController = async (req, res, next) => {
  try {
    const pricingRule = await createPricingRule(req.body, getActor(req));
    return success(res, "Pricing rule berhasil ditambahkan ke database lokal", pricingRule, undefined, 201);
  } catch (error) {
    const handled = handlePricingRuleError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const updatePricingRuleController = async (req, res, next) => {
  try {
    const pricingRule = await updatePricingRule(req.params.id, req.body, getActor(req));
    return success(res, "Pricing rule database lokal berhasil diubah", pricingRule);
  } catch (error) {
    const handled = handlePricingRuleError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const applyPricingRuleBatchController = async (req, res, next) => {
  try {
    const result = await applyPricingRuleBatch(req.params.id, req.body, getActor(req));
    return success(
      res,
      `Pricing rule berhasil diterapkan secara atomic ke ${result.updatedCount} item`,
      result,
    );
  } catch (error) {
    const handled = handlePricingRuleError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const deletePricingRuleController = async (req, res, next) => {
  try {
    const result = await softDeletePricingRule(req.params.id, getActor(req));
    return success(res, "Pricing rule database lokal berhasil dihapus", result);
  } catch (error) {
    const handled = handlePricingRuleError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

module.exports = {
  applyPricingRuleBatchController,
  createPricingRuleController,
  deletePricingRuleController,
  generatePricingRuleCodeController,
  getPricingRuleController,
  listPricingRulesController,
  updatePricingRuleController,
};
