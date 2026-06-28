import { Col, Select } from "antd";
import FilterBar from "../../../components/Layout/Filters/FilterBar";
import { buildFinanceMonthOptions } from "../helpers/financePeriodHelpers";

const MONTH_OPTIONS = buildFinanceMonthOptions();

const FinancePeriodYearMonthFilter = ({
  selectedYear,
  selectedMonth,
  yearOptions = [],
  onYearChange,
  onMonthChange,
}) => (
  <FilterBar>
    <Col xs={24} md={6}>
      <Select
        value={selectedYear}
        onChange={onYearChange}
        className="ims-filter-control"
        placeholder="Pilih tahun"
        options={(yearOptions || []).map((year) => ({ label: String(year), value: year }))}
      />
    </Col>
    <Col xs={24} md={6}>
      <Select
        value={selectedMonth}
        onChange={onMonthChange}
        className="ims-filter-control"
        placeholder="Pilih bulan"
        options={MONTH_OPTIONS}
      />
    </Col>
  </FilterBar>
);

export default FinancePeriodYearMonthFilter;
