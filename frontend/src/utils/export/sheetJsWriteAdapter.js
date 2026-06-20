import { utils, write } from "xlsx";

// Export-only adapter. IMS tidak membaca workbook dari file user melalui package xlsx.
export const createWorkbookBuffer = ({ rows = [], sheetName = "Data", configureWorksheet } = {}) => {
  const worksheet = utils.aoa_to_sheet(rows);
  if (typeof configureWorksheet === "function") configureWorksheet(worksheet, utils);

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, sheetName);

  return write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
};
