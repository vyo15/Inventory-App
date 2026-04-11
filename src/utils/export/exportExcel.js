import dayjs from "dayjs";

export const exportJsonToExcel = async ({ data, sheetName, fileName }) => {
  const [{ utils, write, book_new, book_append_sheet }, { saveAs }] = await Promise.all([
    import("xlsx").then((module) => ({
      utils: module.utils,
      write: module.write,
      book_new: module.utils.book_new,
      book_append_sheet: module.utils.book_append_sheet,
    })),
    import("file-saver"),
  ]);

  const worksheet = utils.json_to_sheet(data);
  const workbook = book_new();
  book_append_sheet(workbook, worksheet, sheetName);

  const excelBuffer = write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `${fileName}-${dayjs().format("YYYY-MM-DD")}.xlsx`);
};
