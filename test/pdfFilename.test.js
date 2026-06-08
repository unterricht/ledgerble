const { buildPdfFilename } = require('../src/data/pdfFilename');

describe('buildPdfFilename', () => {
  const base = { fileName: '/home/u/Johannes Budget.ledger', tabName: 'Einnahmen & Ausgaben', connector: 'bis' };

  it('builds "{file} - {tab} - MM-YYYY bis MM-YYYY.pdf" for a monthly range', () => {
    expect(buildPdfFilename({ ...base, period: 'Monthly', intervals: ['2023-04', '2023-05', '2025-07'] }))
      .toBe('Johannes Budget - Einnahmen & Ausgaben - 04-2023 bis 07-2025.pdf');
  });

  it('uses a single period label when first and last interval are equal', () => {
    expect(buildPdfFilename({ ...base, period: 'Monthly', intervals: ['2023-04'] }))
      .toBe('Johannes Budget - Einnahmen & Ausgaben - 04-2023.pdf');
  });

  it('formats yearly / quarterly / weekly / daily ranges numerically', () => {
    expect(buildPdfFilename({ ...base, period: 'Yearly', intervals: ['2021', '2024'] }))
      .toContain('2021 bis 2024');
    expect(buildPdfFilename({ ...base, period: 'Quarterly', intervals: ['2023-Q1', '2024-Q3'] }))
      .toContain('Q1-2023 bis Q3-2024');
    expect(buildPdfFilename({ ...base, period: 'Weekly', intervals: ['2023-W05', '2023-W12'] }))
      .toContain('W05-2023 bis W12-2023');
    expect(buildPdfFilename({ ...base, period: 'Daily', intervals: ['2023-04-15', '2023-04-20'] }))
      .toContain('15-04-2023 bis 20-04-2023');
  });

  it('strips the journal extension and any directory (incl. Windows paths)', () => {
    expect(buildPdfFilename({ fileName: 'C:\\Users\\me\\cody.journal', tabName: 'Postings', connector: 'to', period: 'Monthly', intervals: [] }))
      .toBe('cody - Postings.pdf');
  });

  it('omits the period segment when there are no intervals', () => {
    expect(buildPdfFilename({ ...base, period: 'Monthly', intervals: [] }))
      .toBe('Johannes Budget - Einnahmen & Ausgaben.pdf');
  });

  it('falls back to a generic name when no file is loaded', () => {
    expect(buildPdfFilename({ fileName: null, tabName: 'Optionen', connector: 'bis', period: 'Monthly', intervals: [] }))
      .toBe('Optionen.pdf');
  });

  it('falls back to "ledgerble.pdf" when nothing identifying is available', () => {
    expect(buildPdfFilename({ fileName: null, tabName: '', connector: 'bis', period: 'Monthly', intervals: [] }))
      .toBe('ledgerble.pdf');
  });

  it('removes characters illegal in file names', () => {
    const name = buildPdfFilename({ fileName: '/x/a:b*c?.ledger', tabName: 'X/Y', connector: 'bis', period: 'Monthly', intervals: [] });
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});
