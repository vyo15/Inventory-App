import dayjs from "dayjs";

export const getCurrentFinanceYear = () => dayjs().year();

export const buildFinanceMonthOptions = ({ includeAll = false } = {}) => {
  const monthOptions = Array.from({ length: 12 }).map((_, index) => ({
    label: dayjs().month(index).format("MMMM"),
    value: index,
  }));

  return includeAll
    ? [{ label: "Semua Bulan", value: "all" }, ...monthOptions]
    : monthOptions;
};

const getRecordDate = (record = {}, dateField = "date") => {
  const value = record?.[dateField];

  if (!value || typeof value?.toDate !== "function") {
    return null;
  }

  const parsedDate = dayjs(value.toDate());
  return parsedDate.isValid() ? parsedDate : null;
};

export const buildFinanceRecordYearOptions = (
  records = [],
  currentYear = getCurrentFinanceYear(),
  { dateField = "date" } = {},
) => {
  const availableYears = (Array.isArray(records) ? records : [])
    .map((record) => getRecordDate(record, dateField)?.year())
    .filter((year) => Number.isInteger(year));

  return [...new Set([currentYear, ...availableYears])]
    .sort((left, right) => right - left);
};

export const buildFinanceYearSelectOptions = ({
  currentYear = getCurrentFinanceYear(),
  optionCount = 8,
  futureYearCount = 1,
} = {}) => Array.from({ length: optionCount }).map((_, index) => {
  const year = currentYear + futureYearCount - index;

  return {
    label: String(year),
    value: year,
  };
});

export const filterFinanceRecordsByPeriod = (
  records = [],
  { year, month = "all", dateField = "date" } = {},
) => (Array.isArray(records) ? records : []).filter((record) => {
  const recordDate = getRecordDate(record, dateField);
  if (!recordDate) return false;

  const matchesYear = recordDate.year() === Number(year);
  const matchesMonth = month === "all" || recordDate.month() === Number(month);

  return matchesYear && matchesMonth;
});
