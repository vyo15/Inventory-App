import { formatCurrencyId } from "../formatters/currencyId";
import { toRoundedInteger } from "../number/numberNormalization";

export const getSavingPresentation = (value) => {
  const amount = toRoundedInteger(value);

  if (amount > 0) {
    return {
      status: "hemat",
      label: `Hemat ${formatCurrencyId(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      status: "lebih_mahal",
      label: `Lebih Mahal ${formatCurrencyId(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    status: "normal",
    label: "Sesuai Referensi",
    color: "default",
  };
};
