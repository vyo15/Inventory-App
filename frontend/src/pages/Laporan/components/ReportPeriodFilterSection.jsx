import { Col, DatePicker } from "antd";
import FilterBar from "../../../components/Layout/Filters/FilterBar";
import PageSection from "../../../components/Layout/Page/PageSection";
import { getDefaultReportDateRange } from "../../../utils/reports/reportDateRange";

const { RangePicker } = DatePicker;

const ReportPeriodFilterSection = ({
  value,
  onChange,
  subtitle,
}) => (
  <PageSection title="Filter Periode" subtitle={subtitle}>
    <FilterBar surface={false}>
      <Col xs={24} md={10} lg={8}>
        <RangePicker
          style={{ width: "100%" }}
          format="DD/MM/YYYY"
          value={value}
          allowClear={false}
          onChange={(nextValue) => onChange(nextValue || getDefaultReportDateRange())}
        />
      </Col>
    </FilterBar>
  </PageSection>
);

export default ReportPeriodFilterSection;
