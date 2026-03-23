const PDFDocument = require('pdfkit');
const resolveTranslatable = require('../utils/resolveTranslatable');

const MONEDA_SYMBOLS = { ILS: 'ILS', USD: 'USD', EUR: 'EUR' };
const MONEDA_SIGNS = { ILS: 'NIS', USD: '$', EUR: 'EUR' };

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatCurrency = (amount, moneda) => {
  const sign = MONEDA_SIGNS[moneda] || moneda;
  return `${sign} ${amount.toFixed(2)}`;
};

const drawLine = (doc, y, opts = {}) => {
  const left = opts.left || 50;
  const right = opts.right || 545;
  const color = opts.color || '#E0E0E0';
  doc.strokeColor(color).lineWidth(0.5).moveTo(left, y).lineTo(right, y).stroke();
};

// ─── 1. Generate Receipt ────────────────────────────────────────────────────

/**
 * Genera un PDF de recibo de pago
 * @param {Object} payment - Documento de pago (populated con alumnoId y cursoId)
 * @returns {Promise<Buffer>} Buffer del PDF
 */
const generateReceipt = (payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const alumno = payment.alumnoId || {};
      const curso = payment.cursoId || {};

      // ── Header ──────────────────────────────────────────────────────
      doc
        .rect(0, 0, 595, 100)
        .fill('#1565C0');

      doc
        .fontSize(26)
        .fillColor('#FFFFFF')
        .text('Ulpan Jerusalem', 50, 30, { align: 'left' });

      doc
        .fontSize(10)
        .fillColor('#BBDEFB')
        .text('Escuela de Hebreo', 50, 60, { align: 'left' });

      doc
        .fontSize(18)
        .fillColor('#FFFFFF')
        .text('RECIBO DE PAGO', 0, 38, { align: 'right', width: 545 });

      // ── Receipt info ────────────────────────────────────────────────
      const startY = 120;
      doc.fillColor('#333333');

      doc.fontSize(9).fillColor('#666666');
      doc.text('Numero de recibo:', 50, startY);
      doc.text('Fecha de pago:', 50, startY + 18);
      doc.text('Metodo de pago:', 50, startY + 36);
      doc.text('ID Transaccion:', 50, startY + 54);

      doc.fontSize(9).fillColor('#333333');
      doc.text(payment._id.toString(), 170, startY);
      doc.text(formatDate(payment.createdAt), 170, startY + 18);
      doc.text('Allpay', 170, startY + 36);
      doc.text(payment.allpayTransactionId || '—', 170, startY + 54);

      // ── Estado badge ────────────────────────────────────────────────
      const estadoColors = {
        completado: '#4CAF50',
        pendiente: '#FF9800',
        fallido: '#F44336',
        reembolsado: '#2196F3',
      };
      const estadoLabels = {
        completado: 'COMPLETADO',
        pendiente: 'PENDIENTE',
        fallido: 'FALLIDO',
        reembolsado: 'REEMBOLSADO',
      };
      const badgeColor = estadoColors[payment.estado] || '#999';
      const badgeLabel = estadoLabels[payment.estado] || payment.estado.toUpperCase();

      doc
        .roundedRect(430, startY, 115, 22, 4)
        .fill(badgeColor);
      doc
        .fontSize(10)
        .fillColor('#FFFFFF')
        .text(badgeLabel, 430, startY + 6, { width: 115, align: 'center' });

      // ── Divider ─────────────────────────────────────────────────────
      drawLine(doc, startY + 80);

      // ── Datos del alumno ────────────────────────────────────────────
      const secAlumno = startY + 95;
      doc
        .fontSize(12)
        .fillColor('#1565C0')
        .text('Datos del estudiante', 50, secAlumno);

      doc.fontSize(9).fillColor('#666666');
      doc.text('Nombre:', 50, secAlumno + 22);
      doc.text('Email:', 50, secAlumno + 38);

      doc.fontSize(9).fillColor('#333333');
      doc.text(alumno.nombre || '—', 120, secAlumno + 22);
      doc.text(alumno.email || '—', 120, secAlumno + 38);

      // ── Divider ─────────────────────────────────────────────────────
      drawLine(doc, secAlumno + 62);

      // ── Detalle del curso ───────────────────────────────────────────
      const secCurso = secAlumno + 77;
      doc
        .fontSize(12)
        .fillColor('#1565C0')
        .text('Detalle del curso', 50, secCurso);

      doc.fontSize(9).fillColor('#666666');
      doc.text('Curso:', 50, secCurso + 22);

      doc.fontSize(9).fillColor('#333333');
      doc.text(resolveTranslatable(curso.titulo) || '—', 120, secCurso + 22);

      // ── Divider ─────────────────────────────────────────────────────
      drawLine(doc, secCurso + 50);

      // ── Desglose de pago ────────────────────────────────────────────
      const secPago = secCurso + 65;
      doc
        .fontSize(12)
        .fillColor('#1565C0')
        .text('Desglose del pago', 50, secPago);

      // Table header
      const tableY = secPago + 25;
      doc
        .rect(50, tableY, 495, 22)
        .fill('#F5F5F5');

      doc.fontSize(9).fillColor('#666666');
      doc.text('Concepto', 60, tableY + 6);
      doc.text('Monto', 430, tableY + 6, { width: 105, align: 'right' });

      // Row: monto original
      const row1 = tableY + 28;
      doc.fontSize(9).fillColor('#333333');
      doc.text('Precio del curso', 60, row1);
      doc.text(formatCurrency(payment.montoOriginal, payment.moneda), 430, row1, { width: 105, align: 'right' });

      let currentRow = row1 + 18;

      // Row: descuento (if any)
      if (payment.descuento > 0) {
        doc.fontSize(9).fillColor('#4CAF50');
        doc.text(
          `Descuento${payment.cuponCodigo ? ` (Cupon: ${payment.cuponCodigo})` : ''}`,
          60,
          currentRow
        );
        doc.text(`-${formatCurrency(payment.descuento, payment.moneda)}`, 430, currentRow, { width: 105, align: 'right' });
        currentRow += 18;
      }

      // Divider before total
      drawLine(doc, currentRow + 4);

      // Row: total
      currentRow += 14;
      doc
        .rect(50, currentRow - 2, 495, 26)
        .fill('#E3F2FD');

      doc.fontSize(11).fillColor('#1565C0');
      doc.text('TOTAL PAGADO', 60, currentRow + 4);
      doc.text(formatCurrency(payment.monto, payment.moneda), 400, currentRow + 4, { width: 135, align: 'right' });

      // ── Footer ──────────────────────────────────────────────────────
      const footerY = 720;
      drawLine(doc, footerY, { color: '#CCCCCC' });

      doc
        .fontSize(8)
        .fillColor('#999999')
        .text('Ulpan Jerusalem — Escuela de Hebreo', 50, footerY + 10, { align: 'center', width: 495 })
        .text('info@ulpanjerusalem.com', 50, footerY + 22, { align: 'center', width: 495 })
        .text('Este documento es un comprobante de pago generado automaticamente.', 50, footerY + 38, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// ─── 2. Generate Incomes Report ─────────────────────────────────────────────

/**
 * Genera un PDF de reporte de ingresos
 * @param {Object} data - { payments, totalPorMoneda, ingresosPorMes, ingresosPorCurso, fechaInicio, fechaFin }
 * @returns {Promise<Buffer>} Buffer del PDF
 */
const generateIncomesReport = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { payments = [], totalPorMoneda = [], ingresosPorMes = [], ingresosPorCurso = [], fechaInicio, fechaFin } = data;

      // ── Header ──────────────────────────────────────────────────────
      doc
        .rect(0, 0, 595, 90)
        .fill('#1565C0');

      doc
        .fontSize(24)
        .fillColor('#FFFFFF')
        .text('Ulpan Jerusalem', 50, 25, { align: 'left' });

      doc
        .fontSize(16)
        .fillColor('#FFFFFF')
        .text('REPORTE DE INGRESOS', 0, 32, { align: 'right', width: 545 });

      doc
        .fontSize(9)
        .fillColor('#BBDEFB')
        .text('Escuela de Hebreo', 50, 52, { align: 'left' });

      // Date range
      const rangeText = fechaInicio || fechaFin
        ? `Periodo: ${fechaInicio ? formatDate(fechaInicio) : 'Inicio'} — ${fechaFin ? formatDate(fechaFin) : 'Hoy'}`
        : `Generado el ${formatDate(new Date())}`;

      doc
        .fontSize(9)
        .fillColor('#BBDEFB')
        .text(rangeText, 0, 55, { align: 'right', width: 545 });

      // ── Summary by currency ─────────────────────────────────────────
      let y = 110;
      doc.fontSize(13).fillColor('#1565C0').text('Resumen de ingresos', 50, y);
      y += 25;

      if (totalPorMoneda.length > 0) {
        totalPorMoneda.forEach((item) => {
          doc
            .roundedRect(50, y, 495, 35, 4)
            .fill('#E3F2FD');

          doc.fontSize(11).fillColor('#1565C0');
          doc.text(`${item._id || 'N/A'}`, 65, y + 10);

          doc.fontSize(13).fillColor('#333333');
          doc.text(
            `${MONEDA_SIGNS[item._id] || item._id} ${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
            250,
            y + 10,
            { width: 285, align: 'right' }
          );

          doc.fontSize(8).fillColor('#666666');
          doc.text(`${item.count} pago${item.count !== 1 ? 's' : ''}`, 65, y + 24, { continued: false });

          y += 42;
        });
      } else {
        doc.fontSize(10).fillColor('#999').text('Sin ingresos registrados', 50, y);
        y += 20;
      }

      // ── Monthly breakdown ───────────────────────────────────────────
      y += 10;
      if (ingresosPorMes.length > 0) {
        doc.fontSize(13).fillColor('#1565C0').text('Ingresos mensuales', 50, y);
        y += 22;

        const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        // Table header
        doc.rect(50, y, 495, 20).fill('#F5F5F5');
        doc.fontSize(8).fillColor('#666666');
        doc.text('Mes', 60, y + 6);
        doc.text('Pagos', 300, y + 6, { width: 80, align: 'right' });
        doc.text('Total', 400, y + 6, { width: 135, align: 'right' });
        y += 24;

        ingresosPorMes.forEach((item) => {
          if (y > 740) {
            doc.addPage();
            y = 50;
          }
          doc.fontSize(9).fillColor('#333333');
          doc.text(`${MONTH_NAMES[item._id.month - 1]} ${item._id.year}`, 60, y);
          doc.text(`${item.count}`, 300, y, { width: 80, align: 'right' });
          doc.text(`${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, 400, y, { width: 135, align: 'right' });
          y += 16;
        });
      }

      // ── Income by course ────────────────────────────────────────────
      y += 15;
      if (ingresosPorCurso.length > 0) {
        if (y > 680) {
          doc.addPage();
          y = 50;
        }

        doc.fontSize(13).fillColor('#1565C0').text('Ingresos por curso', 50, y);
        y += 22;

        doc.rect(50, y, 495, 20).fill('#F5F5F5');
        doc.fontSize(8).fillColor('#666666');
        doc.text('Curso', 60, y + 6);
        doc.text('Pagos', 300, y + 6, { width: 80, align: 'right' });
        doc.text('Total', 400, y + 6, { width: 135, align: 'right' });
        y += 24;

        ingresosPorCurso.forEach((item) => {
          if (y > 740) {
            doc.addPage();
            y = 50;
          }
          doc.fontSize(9).fillColor('#333333');
          doc.text(item.cursoTitulo || '—', 60, y, { width: 230 });
          doc.text(`${item.count}`, 300, y, { width: 80, align: 'right' });
          doc.text(`${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, 400, y, { width: 135, align: 'right' });
          y += 16;
        });
      }

      // ── Transactions table ──────────────────────────────────────────
      y += 15;
      if (payments.length > 0) {
        if (y > 620) {
          doc.addPage();
          y = 50;
        }

        doc.fontSize(13).fillColor('#1565C0').text('Detalle de transacciones', 50, y);
        y += 22;

        // Table header
        doc.rect(50, y, 495, 20).fill('#F5F5F5');
        doc.fontSize(7).fillColor('#666666');
        doc.text('Fecha', 55, y + 6);
        doc.text('Alumno', 120, y + 6);
        doc.text('Curso', 230, y + 6);
        doc.text('Estado', 350, y + 6);
        doc.text('Monto', 430, y + 6, { width: 110, align: 'right' });
        y += 24;

        payments.forEach((p) => {
          if (y > 740) {
            doc.addPage();
            y = 50;
          }

          doc.fontSize(7).fillColor('#333333');
          doc.text(formatDate(p.createdAt), 55, y, { width: 60 });
          doc.text(p.alumnoId?.nombre || '—', 120, y, { width: 105 });
          doc.text(resolveTranslatable(p.cursoId?.titulo) || '—', 230, y, { width: 115 });

          const estadoColor = {
            completado: '#4CAF50',
            pendiente: '#FF9800',
            fallido: '#F44336',
            reembolsado: '#2196F3',
          }[p.estado] || '#999';
          doc.fillColor(estadoColor).text(p.estado, 350, y, { width: 70 });

          doc.fillColor('#333333').text(formatCurrency(p.monto, p.moneda), 430, y, { width: 110, align: 'right' });
          y += 14;
        });
      }

      // ── Footer ──────────────────────────────────────────────────────
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(7)
          .fillColor('#AAAAAA')
          .text(
            `Ulpan Jerusalem — Reporte de ingresos — Pagina ${i + 1} de ${pages.count}`,
            50,
            780,
            { align: 'center', width: 495 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// ─── 3. Generate CSV ────────────────────────────────────────────────────────

/**
 * Genera un CSV de pagos
 * @param {Array} payments - Lista de pagos (populated)
 * @returns {string} Contenido CSV
 */
const generatePaymentsCsv = (payments) => {
  const header = 'Fecha,Alumno,Email,Curso,Monto Original,Descuento,Monto Final,Moneda,Estado,Cupon,Transaction ID\n';

  const rows = payments.map((p) => {
    const fecha = p.createdAt ? new Date(p.createdAt).toISOString().substring(0, 10) : '';
    const alumno = (p.alumnoId?.nombre || '').replace(/,/g, ' ');
    const email = p.alumnoId?.email || '';
    const curso = (resolveTranslatable(p.cursoId?.titulo) || '').replace(/,/g, ' ');
    const montoOriginal = p.montoOriginal?.toFixed(2) || '0.00';
    const descuento = p.descuento?.toFixed(2) || '0.00';
    const monto = p.monto?.toFixed(2) || '0.00';
    const moneda = p.moneda || '';
    const estado = p.estado || '';
    const cupon = p.cuponCodigo || '';
    const txId = p.allpayTransactionId || '';

    return `${fecha},"${alumno}",${email},"${curso}",${montoOriginal},${descuento},${monto},${moneda},${estado},${cupon},${txId}`;
  });

  return header + rows.join('\n');
};

module.exports = { generateReceipt, generateIncomesReport, generatePaymentsCsv };
