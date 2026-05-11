import { Form, Switch } from 'antd';

/* =====================================================
SECTION: PricingModeSwitch — AKTIF
Fungsi:
- Shared UI switch untuk memilih mode harga Manual atau Pricing Rule.

Dipakai oleh:
- Master Data Product.
- Master Data Raw Material.

Alasan perubahan:
- Mengurangi duplikasi UI pricing mode tanpa mengubah formula harga, preview, atau service validation.

Catatan cleanup:
- Auto-preview dan warning tetap local karena Product dan Raw Material memakai base cost dan target price berbeda.

Risiko:
- Jika salah menangani switch Manual, `pricingRuleId` bisa tidak dibersihkan atau mode Rule bisa kehilangan pilihan rule.
===================================================== */
export default function PricingModeSwitch({
  value,
  onChange,
  label = 'Gunakan Pricing Rule',
  manualLabel = 'Manual',
  ruleLabel = 'Rule',
  checkedChildren = 'Rule',
  unCheckedChildren = 'Manual',
  extra,
  disabled = false,
  className,
}) {
  const checked = value === 'rule';

  return (
    <Form.Item label={label} extra={extra} className={className}>
      <Switch
        checked={checked}
        checkedChildren={checkedChildren || ruleLabel}
        unCheckedChildren={unCheckedChildren || manualLabel}
        disabled={disabled}
        onChange={(nextChecked) => {
          onChange?.(nextChecked ? 'rule' : 'manual');
        }}
      />
    </Form.Item>
  );
}
