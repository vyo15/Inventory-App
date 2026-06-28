import { describe, expect, it } from 'vitest';
import { tallyPayrollStatus } from './payrollReportHelpers';

describe('tallyPayrollStatus', () => {
  it('menghitung status dan nominal non-cancelled secara konsisten', () => {
    expect(tallyPayrollStatus([
      { status: 'draft', finalAmount: 1000 },
      { status: 'confirmed', finalAmount: 2000 },
      { status: 'paid', finalAmount: 3000 },
      { status: 'cancelled', finalAmount: 4000 },
    ])).toEqual({
      totalDraft: 1,
      totalConfirmed: 1,
      totalPaid: 1,
      totalCancelled: 1,
      totalNominal: 6000,
    });
  });
});
