import { Form, Input, Modal, Select } from "antd";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import RupiahInputNumber from "../../../components/Layout/Forms/RupiahInputNumber";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";

const { Option } = Select;

const SupplierPriceCheckModal = ({
  handlePriceCheck,
  priceCheckForm,
  priceCheckOffer,
  priceCheckSaving,
  priceCheckVisible,
  setPriceCheckOffer,
  setPriceCheckVisible,
}) => (
      <Modal
        title={`Cek Harga: ${priceCheckOffer?.itemName || ''}`}
        open={priceCheckVisible}
        onCancel={() => {
          if (priceCheckSaving) return;
          setPriceCheckVisible(false);
          setPriceCheckOffer(null);
        }}
        onOk={() => priceCheckForm.submit()}
        okText="Simpan Pengecekan"
        cancelText="Batal"
        confirmLoading={priceCheckSaving}
      >
        <Form form={priceCheckForm} layout="vertical" onFinish={handlePriceCheck}>
          <ImsNotice
            compact
            variant="guard"
            title="Buka link toko dan cocokkan harga aktual sebelum menyimpan."
            description="Harga lama dan waktu pengecekan hanya masuk ke Histori Toko, tidak memadati tampilan katalog utama."
          />
          <Form.Item name="resultStatus" label="Hasil Pengecekan" rules={[{ required: true }]}>
            <Select>
              <Option value="verified">Harga tersedia / sudah diperiksa</Option>
              <Option value="stock_unavailable">Barang habis</Option>
              <Option value="link_unavailable">Link tidak tersedia</Option>
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const resultStatus = getFieldValue('resultStatus');
              if (resultStatus !== 'verified') return null;
              return (
                <Form.Item name="actualPrice" label="Harga Aktual per Paket / Satuan Beli" rules={[{ required: true, message: 'Harga aktual wajib diisi' }]}>
                  <RupiahInputNumber min={1} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="note" label="Catatan"><Input.TextArea rows={3} placeholder="Opsional" /></Form.Item>
        </Form>
      </Modal>
);

export default SupplierPriceCheckModal;
