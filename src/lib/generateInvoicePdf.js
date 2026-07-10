import jsPDF from 'jspdf';

const BRAND = {
  name: 'Aura Virtual Assistants',
  tagline: 'Professional Virtual Assistant Services',
  address: '123 Business Park, Cape Town, 8001, South Africa',
  email: 'billing@aura-va.com',
  phone: '+27 21 000 0000',
  website: 'www.aura-va.com',
  vatNumber: '4123456789',
};

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function fmtMoney(n) {
  return `R ${(parseFloat(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateInvoicePdf(inv) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;
  const col2 = W - margin; // right edge

  // ── Header bar ──────────────────────────────────────────────────
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, W, 38, 'F');

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND.name, margin, 16);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(BRAND.tagline, margin, 23);

  // "INVOICE" label top-right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', col2, 22, { align: 'right' });

  // ── Invoice meta (right side, below header) ──────────────────────
  let y = 50;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  const meta = [
    ['Invoice #', inv.invoice_number || '—'],
    ['Date Issued', fmtDate(inv.created_date || new Date().toISOString())],
    ['Billing Period', inv.month || '—'],
    ['Due Date', fmtDate(inv.due_date)],
    ['Status', (inv.status || 'draft').toUpperCase()],
  ];

  meta.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(label + ':', col2 - 45, y, { align: 'left' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(value, col2, y, { align: 'right' });
    y += 6;
  });

  // ── From / To blocks ─────────────────────────────────────────────
  y = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('FROM', margin, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 15, 15);
  doc.text(BRAND.name, margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  [BRAND.address, BRAND.email, BRAND.phone, BRAND.website, `VAT: ${BRAND.vatNumber}`].forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('BILLED TO', margin, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 15, 15);
  doc.text(inv.client_email || '—', margin, y);

  if (inv.period_start && inv.period_end) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}`, margin, y);
  }

  // ── Divider ───────────────────────────────────────────────────────
  y += 12;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(margin, y, col2, y);

  // ── Line-items table header ───────────────────────────────────────
  y += 8;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 5, W - margin * 2, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('DESCRIPTION', margin + 2, y);
  doc.text('QTY / HRS', 115, y, { align: 'right' });
  doc.text('RATE', 145, y, { align: 'right' });
  doc.text('AMOUNT', col2, y, { align: 'right' });

  // ── Line items ────────────────────────────────────────────────────
  y += 10;
  const lineItems = [];

  if (inv.hours_billed > 0) {
    lineItems.push({
      desc: `Virtual Assistant Services — ${inv.month || 'Monthly'}`,
      sub: inv.period_start && inv.period_end ? `${fmtDate(inv.period_start)} to ${fmtDate(inv.period_end)}` : null,
      qty: `${inv.hours_billed} hrs`,
      rate: inv.rate_per_hour ? fmtMoney(inv.rate_per_hour) + '/hr' : '—',
      amount: fmtMoney(inv.subtotal || inv.total),
    });
  } else {
    lineItems.push({
      desc: `Professional Services — ${inv.month || 'Monthly'}`,
      qty: '—',
      rate: '—',
      amount: fmtMoney(inv.total),
    });
  }

  lineItems.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, y - 5, W - margin * 2, item.sub ? 14 : 9, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(item.desc, margin + 2, y);
    if (item.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(item.sub, margin + 2, y + 5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(item.qty, 115, y, { align: 'right' });
    doc.text(item.rate, 145, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(item.amount, col2, y, { align: 'right' });
    y += item.sub ? 16 : 10;
  });

  // ── Totals block ─────────────────────────────────────────────────
  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, col2, y);
  y += 8;

  const totalsX = 145;
  const totalsRight = col2;

  const addTotalRow = (label, value, bold = false, color = [60, 60, 60]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(...color);
    doc.text(label, totalsX, y, { align: 'right' });
    doc.text(value, totalsRight, y, { align: 'right' });
    y += 7;
  };

  addTotalRow('Subtotal', fmtMoney(inv.subtotal || inv.total));
  addTotalRow('VAT / Tax', fmtMoney(inv.tax || 0));

  y += 2;
  doc.setFillColor(15, 15, 15);
  doc.rect(totalsX - 30, y - 6, col2 - (totalsX - 30), 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL DUE', totalsX, y, { align: 'right' });
  doc.text(fmtMoney(inv.total), totalsRight, y, { align: 'right' });
  y += 14;

  // ── Notes ─────────────────────────────────────────────────────────
  if (inv.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(inv.notes, W - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 6;
  }

  // ── Payment instructions ──────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, col2, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('PAYMENT INSTRUCTIONS', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Please use the invoice number as payment reference.', margin, y);
  y += 5;
  doc.text(`Payment due by: ${fmtDate(inv.due_date)}`, margin, y);

  // ── Footer ────────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 282, W, 15, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`${BRAND.name} · ${BRAND.website} · ${BRAND.email}`, W / 2, 290, { align: 'center' });

  // ── Save ──────────────────────────────────────────────────────────
  const filename = `invoice-${inv.invoice_number || inv.id || 'download'}.pdf`;
  doc.save(filename);
}