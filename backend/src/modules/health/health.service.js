const getHealthStatus = () => ({
  service: "Layanan lokal IMS",
  active: true,
  serverTime: new Date().toISOString(),
});

module.exports = {
  getHealthStatus,
};
