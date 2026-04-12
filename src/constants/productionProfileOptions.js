// =====================================================
// Production Profile Options
// Profil produksi per produk untuk kebutuhan jangka panjang.
// Menyimpan parameter hasil, batch assembly, dan alert miss.
// =====================================================

export const PRODUCTION_PROFILE_TYPES = [
  { value: 'flower', label: 'Bunga' },
  { value: 'bouquet', label: 'Bouquet' },
  { value: 'custom', label: 'Custom' },
];

export const PRODUCTION_PROFILE_MISS_STATUSES = [
  { value: 'normal', label: 'Normal' },
  { value: 'warning', label: 'Perlu Perhatian' },
  { value: 'critical', label: 'Tinggi' },
];

export const DEFAULT_PRODUCTION_PROFILE_FORM = {
  productId: '',
  profileName: '',
  profileType: 'flower',
  petalsPerUnit: 10,
  leavesPerUnit: 1,
  stemsPerUnit: 1,
  petalYieldPerMeter: 480,
  leafYieldPerMeter: 256,
  stemYieldPerRod40cm: 2,
  assemblyPetalPackCount: 5,
  assemblyLeafPackCount: 1,
  assemblyStemBundleCount: 2,
  assemblyStemExtraQty: 40,
  assemblyTargetOutput: 240,
  missYellowPercent: 2,
  missRedPercent: 5,
  notes: '',
  isDefault: true,
  isActive: true,
};

export const PRODUCTION_PROFILE_TYPE_MAP = PRODUCTION_PROFILE_TYPES.reduce(
  (acc, item) => ({ ...acc, [item.value]: item.label }),
  {},
);

export const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const calculateProductionProfileMetrics = (values = {}) => {
  const petalsPerUnit = Math.max(1, toNumber(values.petalsPerUnit, 1));
  const leavesPerUnit = Math.max(1, toNumber(values.leavesPerUnit, 1));
  const stemsPerUnit = Math.max(1, toNumber(values.stemsPerUnit, 1));
  const petalYieldPerMeter = Math.max(0, toNumber(values.petalYieldPerMeter, 0));
  const leafYieldPerMeter = Math.max(0, toNumber(values.leafYieldPerMeter, 0));
  const stemYieldPerRod40cm = Math.max(0, toNumber(values.stemYieldPerRod40cm, 0));
  const assemblyPetalPackCount = Math.max(0, toNumber(values.assemblyPetalPackCount, 0));
  const assemblyLeafPackCount = Math.max(0, toNumber(values.assemblyLeafPackCount, 0));
  const assemblyStemBundleCount = Math.max(0, toNumber(values.assemblyStemBundleCount, 0));
  const assemblyStemExtraQty = Math.max(0, toNumber(values.assemblyStemExtraQty, 0));

  const flowerEquivalentPerPetalMeter = petalYieldPerMeter / petalsPerUnit;
  const flowerEquivalentPerLeafMeter = leafYieldPerMeter / leavesPerUnit;
  const flowerEquivalentPerRod40cm = stemYieldPerRod40cm / stemsPerUnit;
  const assemblyStemQty = assemblyStemBundleCount * 100 + assemblyStemExtraQty;

  const assemblyFlowerEquivalentFromPetal = assemblyPetalPackCount * flowerEquivalentPerPetalMeter;
  const assemblyFlowerEquivalentFromLeaf = assemblyLeafPackCount * flowerEquivalentPerLeafMeter;
  const assemblyFlowerEquivalentFromStem = assemblyStemQty / stemsPerUnit;
  const assemblyLeafTheoreticalLeftover = Math.max(
    assemblyLeafPackCount * leafYieldPerMeter - toNumber(values.assemblyTargetOutput, 0) * leavesPerUnit,
    0,
  );

  return {
    petalsPerUnit,
    leavesPerUnit,
    stemsPerUnit,
    petalYieldPerMeter,
    leafYieldPerMeter,
    stemYieldPerRod40cm,
    assemblyPetalPackCount,
    assemblyLeafPackCount,
    assemblyStemBundleCount,
    assemblyStemExtraQty,
    assemblyStemQty,
    flowerEquivalentPerPetalMeter,
    flowerEquivalentPerLeafMeter,
    flowerEquivalentPerRod40cm,
    assemblyFlowerEquivalentFromPetal,
    assemblyFlowerEquivalentFromLeaf,
    assemblyFlowerEquivalentFromStem,
    assemblyLeafTheoreticalLeftover,
  };
};

export const getMissStatus = (percent = 0, yellow = 2, red = 5) => {
  const missPercent = Math.max(0, toNumber(percent, 0));
  if (missPercent > red) return 'critical';
  if (missPercent > yellow) return 'warning';
  return 'normal';
};
