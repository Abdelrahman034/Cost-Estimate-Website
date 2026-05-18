const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a professional bid proposal PDF
 * @param {Object} proposalData - AI-generated proposal content
 * @param {Object} projectInfo - Project information
 * @param {string} outputPath - Where to save the PDF
 */
async function generateProposalPDF(proposalData, projectInfo, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const colors = {
      primary: '#1e40af',    // Dark blue
      secondary: '#f59e0b',  // Amber
      dark: '#1f2937',
      gray: '#6b7280',
      lightGray: '#f3f4f6',
      white: '#ffffff',
    };

    // ─── HEADER ────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(colors.primary);
    doc.fillColor(colors.white)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(projectInfo.companyName || 'HVAC Mechanical Contractors', 50, 25);
    doc.fontSize(10)
      .font('Helvetica')
      .text(projectInfo.companyAddress || '', 50, 52)
      .text(`Tel: ${projectInfo.companyPhone || ''} | ${projectInfo.companyEmail || ''}`, 50, 66);

    // Proposal label top right
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('BID PROPOSAL', doc.page.width - 200, 30, { width: 150, align: 'right' })
      .fontSize(9)
      .font('Helvetica')
      .text(`#${proposalData.proposalNumber || 'PROP-2025-001'}`, doc.page.width - 200, 47, { width: 150, align: 'right' })
      .text(`Date: ${new Date().toLocaleDateString()}`, doc.page.width - 200, 60, { width: 150, align: 'right' });

    doc.moveDown(4);

    // ─── PROJECT INFO BOX ──────────────────────────────────────────────────
    doc.fillColor(colors.lightGray).rect(50, 110, doc.page.width - 100, 80).fill();
    doc.fillColor(colors.dark).fontSize(13).font('Helvetica-Bold').text('PROJECT INFORMATION', 65, 120);
    doc.fontSize(10).font('Helvetica');
    const col1x = 65, col2x = 320;
    doc.text(`Project: ${projectInfo.projectName || 'N/A'}`, col1x, 138);
    doc.text(`Location: ${projectInfo.location || 'N/A'}`, col1x, 153);
    doc.text(`Owner: ${projectInfo.owner || 'N/A'}`, col1x, 168);
    doc.text(`GC/CM: ${projectInfo.gc || 'N/A'}`, col2x, 138);
    doc.text(`Bid Date: ${projectInfo.bidDate || 'N/A'}`, col2x, 153);
    doc.text(`Valid Until: ${projectInfo.validUntil || 'N/A'}`, col2x, 168);

    doc.y = 205;

    // ─── SECTION HELPER ────────────────────────────────────────────────────
    function sectionHeader(title) {
      doc.moveDown(0.5);
      if (doc.y > doc.page.height - 100) doc.addPage();
      doc.fillColor(colors.primary).rect(50, doc.y, doc.page.width - 100, 22).fill();
      doc.fillColor(colors.white).fontSize(11).font('Helvetica-Bold')
        .text(title, 60, doc.y - 18);
      doc.moveDown(0.8);
      doc.fillColor(colors.dark);
    }

    // ─── EXECUTIVE SUMMARY ─────────────────────────────────────────────────
    sectionHeader('EXECUTIVE SUMMARY');
    doc.fontSize(10).font('Helvetica').fillColor(colors.dark)
      .text(proposalData.sections?.executiveSummary || '', 50, doc.y, {
        width: doc.page.width - 100,
        align: 'justify',
      });
    doc.moveDown(1);

    // ─── SCOPE OF WORK ─────────────────────────────────────────────────────
    sectionHeader('SCOPE OF WORK');
    const scope = proposalData.sections?.scopeOfWork || [];
    scope.forEach((item, i) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      doc.fontSize(10).font('Helvetica').fillColor(colors.dark)
        .text(`${i + 1}.  ${item}`, 60, doc.y, { width: doc.page.width - 120 });
      doc.moveDown(0.3);
    });

    // ─── EXCLUSIONS ────────────────────────────────────────────────────────
    doc.moveDown(0.5);
    sectionHeader('EXCLUSIONS');
    const excl = proposalData.sections?.exclusions || [];
    excl.forEach((item) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      doc.fontSize(10).font('Helvetica').fillColor(colors.gray)
        .text(`•  ${item}`, 60, doc.y, { width: doc.page.width - 120 });
      doc.moveDown(0.3);
    });

    // ─── COST BREAKDOWN ────────────────────────────────────────────────────
    doc.moveDown(0.5);
    sectionHeader('COST SUMMARY');
    if (doc.y > doc.page.height - 200) doc.addPage();

    const cb = proposalData.sections?.costBreakdown || {};
    const rows = [
      ['Material & Equipment', cb.material || 0],
      ['Labor', cb.labor || 0],
      ['Subcontractors', cb.subcontractors || 0],
      ['Overhead & Indirect', cb.overhead || 0],
      ['Profit', cb.profit || 0],
    ];

    const tableX = 50, tableW = doc.page.width - 100;
    let rowY = doc.y;

    rows.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#f9fafb' : colors.white;
      doc.fillColor(bg).rect(tableX, rowY, tableW, 20).fill();
      doc.fillColor(colors.dark).fontSize(10).font('Helvetica')
        .text(row[0], tableX + 10, rowY + 5)
        .text(`$${Number(row[1]).toLocaleString('en-US', { minimumFractionDigits: 0 })}`, tableX + tableW - 120, rowY + 5, { width: 110, align: 'right' });
      rowY += 20;
    });

    // Total row
    doc.fillColor(colors.primary).rect(tableX, rowY, tableW, 24).fill();
    doc.fillColor(colors.white).fontSize(12).font('Helvetica-Bold')
      .text('TOTAL BID PRICE', tableX + 10, rowY + 6)
      .text(`$${Number(cb.total || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`, tableX + tableW - 120, rowY + 6, { width: 110, align: 'right' });

    doc.y = rowY + 40;

    // ─── PAYMENT SCHEDULE ──────────────────────────────────────────────────
    sectionHeader('PAYMENT SCHEDULE');
    const payments = proposalData.sections?.paymentSchedule || [];
    payments.forEach((p, i) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      const bg = i % 2 === 0 ? '#f9fafb' : colors.white;
      doc.fillColor(bg).rect(50, doc.y, tableW, 18).fill();
      doc.fillColor(colors.dark).fontSize(10).font('Helvetica')
        .text(p.milestone, 60, doc.y + 4)
        .text(`${p.percentage}%`, 350, doc.y + 4)
        .text(`$${Number(p.amount || 0).toLocaleString()}`, 430, doc.y + 4, { width: 100, align: 'right' });
      doc.moveDown(0.8);
    });

    // ─── TERMS ─────────────────────────────────────────────────────────────
    doc.moveDown(0.5);
    sectionHeader('TERMS & CONDITIONS');
    const terms = proposalData.sections?.termsAndConditions || [];
    terms.forEach((term, i) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
        .text(`${i + 1}. ${term}`, 50, doc.y, { width: tableW });
      doc.moveDown(0.4);
    });

    // ─── SIGNATURE BLOCK ───────────────────────────────────────────────────
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(2);
    doc.fillColor(colors.dark).fontSize(11).font('Helvetica-Bold')
      .text('ACCEPTANCE OF PROPOSAL', 50, doc.y);
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
      .text('By signing below, you accept the terms and conditions of this proposal.', 50, doc.y);
    doc.moveDown(2);

    const sigY = doc.y;
    doc.moveTo(50, sigY).lineTo(280, sigY).strokeColor(colors.dark).stroke();
    doc.moveTo(320, sigY).lineTo(560, sigY).stroke();
    doc.fontSize(9).fillColor(colors.gray)
      .text('Authorized Signature', 50, sigY + 5)
      .text('Date', 320, sigY + 5);
    doc.moveDown(1.5);
    doc.moveTo(50, doc.y).lineTo(280, doc.y).stroke();
    doc.fontSize(9).fillColor(colors.gray).text('Printed Name / Title', 50, doc.y + 5);

    // ─── FOOTER ────────────────────────────────────────────────────────────
    doc.fontSize(8).fillColor(colors.gray)
      .text(
        `This proposal is valid for ${proposalData.sections?.validityDays || 30} days from the date of issue.`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

module.exports = { generateProposalPDF };
