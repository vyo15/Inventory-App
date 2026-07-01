import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Typography,
} from "antd";
import {
  DEFAULT_PRODUCTION_PROFILE_FORM,
  PRODUCTION_PROFILE_TYPES,
} from "../../../constants/productionProfileOptions";

const ProductionProfileFormDrawer = ({
  currentMetrics,
  editingProfile,
  form,
  formVisible,
  handleSubmit,
  products,
  renderStatisticValue,
  resetFormState,
  setFormVisible,
  submitting,
}) => (
      <Drawer
        title={editingProfile?.id ? 'Edit Profil Produksi' : 'Tambah Profil Produksi'}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={820}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => { setFormVisible(false); resetFormState(); }}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>Simpan</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_PRODUCTION_PROFILE_FORM}>
          {/*
=====================================================
SECTION: Drawer form profil produksi — AKTIF
Fungsi:
- Mengelompokkan konfigurasi profil produksi, kebutuhan bahan, batch, dan preview kapasitas.

Dipakai oleh:
- Halaman ProductionProfiles untuk tambah/edit template produksi per produk.

Alasan perubahan:
- Drawer profil dirapikan menjadi section Card agar angka produksi tidak bercampur dalam satu area panjang.

Catatan cleanup:
- Belum ada; field dan payload form tetap mengikuti struktur existing.

Risiko:
- Jika name Form.Item berubah, payload profile dan perhitungan kapasitas bisa rusak.
=====================================================
*/}
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card size="small" title="Ringkasan Profil">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Produk" name="productId" rules={[{ required: true, message: 'Produk wajib dipilih' }]}> 
                    <Select
                      showSearch
                      optionFilterProp="label"
                      options={(products || []).map((item) => ({ value: item.id, label: item.name || '-' }))}
                      placeholder="Pilih produk..."
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Nama Profil" name="profileName" rules={[{ required: true, message: 'Nama profil wajib diisi' }]}> 
                    <Input placeholder="Contoh: Profil Mawar Reguler" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Tipe Profil" name="profileType">
                    <Select options={PRODUCTION_PROFILE_TYPES} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Default" name="isDefault" valuePropName="checked">
                    <Switch checkedChildren="Ya" unCheckedChildren="Tidak" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Status Aktif" name="isActive" valuePropName="checked">
                    <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="Kebutuhan per 1 Produk">
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item label="Kelopak / Unit" name="petalsPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Daun / Unit" name="leavesPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Tangkai / Unit" name="stemsPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            </Card>

            <Card
              size="small"
              title="Hasil Standar Bahan Awal"
              extra={<Typography.Text type="secondary">Input hasil potongan normal.</Typography.Text>}
            >
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item label="Kelopak / Meter" name="petalYieldPerMeter"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Daun / Meter" name="leafYieldPerMeter"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Tangkai / Batang 40 cm" name="stemYieldPerRod40cm"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            </Card>

            <Card size="small" title="Batch Assembly Standar">
              <Row gutter={16}>
                <Col xs={24} md={6}><Form.Item label="Plastik Kelopak" name="assemblyPetalPackCount"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={6}><Form.Item label="Plastik Daun" name="assemblyLeafPackCount"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={6}><Form.Item label="Ikat Kawat" name="assemblyStemBundleCount"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={6}><Form.Item label="Kawat Extra pcs" name="assemblyStemExtraQty"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Target Output Batch" name="assemblyTargetOutput"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Alert Kuning %" name="missYellowPercent"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Alert Merah %" name="missRedPercent"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>

              <Form.Item label="Catatan" name="notes">
                <Input.TextArea rows={3} placeholder="Catatan operasional atau asumsi batch" />
              </Form.Item>
            </Card>

            <Card size="small" title="Ringkasan Kapasitas Otomatis">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Bunga / Meter Kelopak"
                    value={currentMetrics.flowerEquivalentPerPetalMeter || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Bunga / Meter Daun"
                    value={currentMetrics.flowerEquivalentPerLeafMeter || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Bunga / Batang 40 cm"
                    value={currentMetrics.flowerEquivalentPerRod40cm || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Total Kawat / Batch"
                    value={currentMetrics.assemblyStemQty || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Kapasitas Kelopak / Batch"
                    value={currentMetrics.assemblyFlowerEquivalentFromPetal || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Sisa Daun Teoritis"
                    value={currentMetrics.assemblyLeafTheoreticalLeftover || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
              </Row>
            </Card>
          </Space>
        </Form>
      </Drawer>
);

export default ProductionProfileFormDrawer;
