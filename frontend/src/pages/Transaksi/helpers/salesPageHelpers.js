export const getSaleDisplayReference = (sale = {}) => (
  sale.saleNumber
  || sale.code
  || sale.referenceNumber
  || sale.sourceRef
  || "Tanpa ref"
);

export const getSaleExternalReference = (sale = {}) => (
  sale.externalReferenceNumber || "-"
);

export const getSalesStatusColor = (status) => {
  const statusColors = {
    Selesai: "green",
    Dikirim: "orange",
    Diproses: "blue",
  };

  return statusColors[status] || "default";
};
