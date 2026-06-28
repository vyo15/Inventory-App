const getTransactionRecordRouterDefinitions = () => [
  {
    path: "/purchases",
    config: {
      tableName: "purchases",
      moduleKey: "purchases",
      entityType: "purchase",
      codePrefix: "PUR",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Purchase database lokal atomic aktif untuk Product/Raw stock-in.",
        "Direct write generic diblokir agar stok/finance tidak dobel.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Purchase wajib lewat POST /api/transactions/purchases/commit",
        "agar stok masuk, expense, audit log, dan transaction record atomic.",
      ].join(" "),
    },
  },
  {
    path: "/sales",
    config: {
      tableName: "sales",
      moduleKey: "sales",
      entityType: "sale",
      codePrefix: "ORD",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Sales database lokal atomic aktif untuk Product/Raw stock-out.",
        "Direct write/delete diblokir; status aktif hanya Diproses, Dikirim, Selesai.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Sales wajib lewat endpoint commit/status resmi.",
        "Cancel/delete sales dilarang; gunakan Return untuk barang kembali.",
      ].join(" "),
    },
  },
  {
    path: "/returns",
    config: {
      tableName: "returns",
      moduleKey: "returns",
      entityType: "return",
      codePrefix: "RET",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Returns aktif wajib terkait transaksi Sales.",
        "Direct write generic diblokir agar stok kembali tidak bisa dibuat tanpa relasi sales.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Return wajib lewat POST /api/transactions/returns/commit dan harus terkait Sales",
        "agar qty retur, stok kembali, audit log, dan transaction record tetap terkunci.",
      ].join(" "),
    },
  },
];


module.exports = { getTransactionRecordRouterDefinitions };
