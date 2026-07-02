import { Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import PageHeader from "../../../components/Layout/Page/PageHeader";
import PageContentCanvas from "../../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../../components/Layout/Page/PageSection";
import SummaryStatGrid from "../../../components/Layout/Display/SummaryStatGrid";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import PageFormModal from "../../../components/Layout/Forms/PageFormModal";
import {
  DataRefreshIndicator,
  getDataTableEmptyText,
} from "../../../components/Layout/Feedback/DataLoadingState";
import { formatNumberId } from "../../../utils/formatters/numberId";
import CashTransactionFormFields from "./CashTransactionFormFields";
import FinancePeriodYearMonthFilter from "./FinancePeriodYearMonthFilter";

const CashFlowPageShell = ({
  header,
  summary,
  filter,
  table,
  formModal,
}) => (
  <>
    <PageHeader
      title={header.title}
      subtitle={header.subtitle}
      actions={[
        {
          key: header.actionKey,
          type: "primary",
          icon: <PlusOutlined />,
          label: header.actionLabel,
          onClick: header.onAdd,
        },
      ]}
    />

    <PageContentCanvas>
      <PageSection
        title="Ringkasan Periode"
        subtitle="KPI periode aktif."
        extra={summary.extra}
      >
        <SummaryStatGrid
          items={summary.items}
          columns={summary.columns}
          variant="finance"
          highlightKey={summary.highlightKey}
          className="cash-flow-summary"
        />
      </PageSection>

      <PageSection title={filter.title} subtitle="Filter periode.">
        <FinancePeriodYearMonthFilter
          selectedYear={filter.selectedYear}
          selectedMonth={filter.selectedMonth}
          yearOptions={filter.yearOptions}
          onYearChange={filter.onYearChange}
          onMonthChange={filter.onMonthChange}
        />
      </PageSection>

      <PageSection
        title={table.title}
        subtitle="Transaksi periode."
        extra={(
          <Tag color={table.countTagColor}>
            {formatNumberId(table.rows.length)} baris
          </Tag>
        )}
      >
        <DataRefreshIndicator loading={table.loading} dataSource={table.rows} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          rowKey="id"
          dataSource={table.rows}
          columns={table.columns}
          tableLayout={table.tableLayout}
          locale={{
            emptyText: getDataTableEmptyText(table.loading, table.emptyText),
          }}
          mobileCardConfig={table.mobileCardConfig}
        />
      </PageSection>
    </PageContentCanvas>

    <PageFormModal
      title={formModal.title}
      open={formModal.open}
      onCancel={formModal.onCancel}
      form={formModal.form}
      onFinish={formModal.onFinish}
    >
      <CashTransactionFormFields
        typeLabel={formModal.typeLabel}
        typeRequiredMessage={formModal.typeRequiredMessage}
        typeOptions={formModal.typeOptions}
        defaultType={formModal.defaultType}
      />
    </PageFormModal>
  </>
);

export default CashFlowPageShell;
