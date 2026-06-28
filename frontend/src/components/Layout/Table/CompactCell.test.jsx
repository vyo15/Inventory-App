import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompactCell, { CompactCellText } from './CompactCell';

describe('CompactCell', () => {
  it('menampilkan title, secondary text, dan fallback tanpa business coupling', () => {
    render(
      <CompactCell tight>
        <CompactCellText strong>Nama utama</CompactCellText>
        <CompactCellText secondary>Informasi tambahan</CompactCellText>
        <CompactCellText value="" />
      </CompactCell>,
    );

    expect(screen.getByText('Nama utama')).toBeTruthy();
    expect(screen.getByText('Informasi tambahan')).toBeTruthy();
    expect(screen.getByText('-')).toBeTruthy();
  });
});
