import { Descriptions } from "antd";
import dayjs from "dayjs";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import formatCurrency from "../../../utils/formatters/currencyId";
import formatNumber from "../../../utils/formatters/numberId";
import { resolveDisplayReference } from "../../../utils/references/displayReferenceResolver";
import { getCompactPayrollStatusHelp } from "../helpers/productionPayrollsPageHelpers";
import {
  PayrollDetailValue,
  ProductionPayrollStatusTags,
} from "./ProductionPayrollStatusTags";

const ProductionPayrollDetailDrawer = ({
  detailVisible,
  selectedRecord,
  setDetailVisible,
}) => (
      <MobileDetailDrawer
        title="Detail Payroll Produksi"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={640}
      >
        {!selectedRecord ? (
          <EmptyStateBlock compact description="Tidak ada data" />
        ) : (
          <>
            {/* =====================================================
                ACTIVE / READ-ONLY CONTEXT
                Fungsi blok:
                - memberi konteks singkat agar user memahami detail payroll sebagai
                  line pembayaran per operator dari Work Log completed.
                Alasan perubahan:
                - Task 3 meminta help text tanpa mengubah status, nominal, atau service.
                Status:
                - aktif dipakai; bukan kandidat cleanup.
            ===================================================== */}
            <ImsNotice
              variant="info"
              compact
              className="ims-mb-16"
              title="Detail payroll operator"
              description="Payroll final berasal dari Work Log completed dan rule tahapan."
            />

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="No. Line Payroll">
                <PayrollDetailValue help="Nomor unik untuk satu baris payroll. Satu Work Log bisa menghasilkan beberapa line jika ada lebih dari satu operator.">
                  {resolveDisplayReference(selectedRecord, { fields: ["payrollNumber"], fallback: "-" })}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Payroll">
                <PayrollDetailValue help="Tanggal pencatatan line payroll di modul Payroll Produksi.">
                  {selectedRecord.payrollDate
                    ? dayjs(
                        selectedRecord.payrollDate?.toDate
                          ? selectedRecord.payrollDate.toDate()
                          : selectedRecord.payrollDate,
                      ).format("DD/MM/YYYY")
                    : "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Operator / Karyawan">
                <PayrollDetailValue help="Karyawan produksi yang menerima payroll dari line ini.">
                  {selectedRecord.workerName || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Work Log Asal">
                <PayrollDetailValue help="Pekerjaan produksi yang menjadi sumber payroll. Dipakai untuk audit ke hasil produksi.">
                  {selectedRecord.workNumber || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Target Produksi">
                <PayrollDetailValue help="Produk/semi finished yang dikerjakan pada Work Log terkait.">
                  {selectedRecord.targetName || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Step / Tahapan">
                <PayrollDetailValue help="Tahapan produksi yang menentukan rule, mode, dan tarif payroll.">
                  {selectedRecord.stepName || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Sistem Bayar">
                <PayrollDetailValue help="Mode payroll dari rule tahapan, misalnya per qty atau per batch.">
                  {selectedRecord.payrollMode || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Payroll Rate / Tarif">
                <PayrollDetailValue help="Tarif dasar dari rule Tahapan Produksi yang dipakai untuk menghitung payroll.">
                  {formatCurrency(selectedRecord.payrollRate)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Qty Dasar / Output Qty Used">
                <PayrollDetailValue help="Jumlah output yang dipakai sebagai dasar hitung payroll. Biasanya dari Good Qty atau basis output sesuai rule tahapan.">
                  {formatNumber(selectedRecord.outputQtyUsed)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Amount Calculated / Hasil Hitung Sistem">
                <PayrollDetailValue help="Nominal hasil hitung otomatis dari sistem sebelum bonus dan potongan manual.">
                  {formatCurrency(selectedRecord.amountCalculated)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Final Amount / Nominal Akhir">
                <PayrollDetailValue help="Nominal akhir line payroll setelah bonus dan potongan. Nilai ini yang dipakai sebagai nilai payroll final.">
                  {formatCurrency(selectedRecord.finalAmount)}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <PayrollDetailValue help={getCompactPayrollStatusHelp(selectedRecord)}>
                  <ProductionPayrollStatusTags record={selectedRecord} />
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Calculation Notes / Catatan Sistem">
                <PayrollDetailValue help="Catatan otomatis dari sistem tentang cara payroll dihitung. Berguna untuk audit jika nominal perlu dicek ulang.">
                  {selectedRecord.calculationNotes || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
              <Descriptions.Item label="Notes / Catatan Manual">
                <PayrollDetailValue help="Catatan manual dari user/admin. Tidak mengubah nominal payroll kecuali ada penyesuaian bonus atau potongan yang disimpan di field terkait.">
                  {selectedRecord.notes || "-"}
                </PayrollDetailValue>
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </MobileDetailDrawer>
);

export default ProductionPayrollDetailDrawer;
