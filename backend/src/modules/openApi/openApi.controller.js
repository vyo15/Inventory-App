const { buildOpenApiDocument } = require("./openApi.service");

const getOpenApiDocumentController = (req, res) => {
  const protocol = req.protocol || "http";
  const host = req.get?.("host") || "localhost:3001";
  res.setHeader("Cache-Control", "no-store");
  return res.json(buildOpenApiDocument({ baseUrl: `${protocol}://${host}` }));
};

module.exports = { getOpenApiDocumentController };
