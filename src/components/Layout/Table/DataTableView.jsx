import { Table } from "antd";
import { DataRefreshIndicator, getDataTableEmptyText } from "../Feedback/DataLoadingState";

// IMS NOTE [AKTIF] - Shared wrapper tabel data operasional.
// Fungsi blok: menyatukan pola DataRefreshIndicator + empty state tabel tanpa mengubah dataSource, columns, pagination, atau handler page.
// Guardrail: komponen ini presentational-only; jangan masukkan query Firestore, mutation, stock, payroll, purchase, reset, atau business rule di sini.
const DataTableView = ({
  loading = false,
  dataSource = [],
  emptyText,
  locale,
  showRefreshIndicator = true,
  ...tableProps
}) => {
  const resolvedLocale = {
    ...locale,
    emptyText: locale?.emptyText ?? getDataTableEmptyText(loading, emptyText),
  };

  return (
    <>
      {showRefreshIndicator ? (
        <DataRefreshIndicator loading={loading} dataSource={dataSource} />
      ) : null}
      <Table
        {...tableProps}
        dataSource={dataSource}
        locale={resolvedLocale}
      />
    </>
  );
};

export default DataTableView;
