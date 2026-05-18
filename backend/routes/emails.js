const express = require('express');
const router  = express.Router();
const { generateSupplierRFQ, sendRFQEmail } = require('../services');

router.post('/generate-rfq', async (req, res) => {
  const { units, projectInfo } = req.body;
  if (!units || !Array.isArray(units) || units.length === 0)
    return res.status(400).json({ error: 'units array is required' });
  if (!projectInfo || !projectInfo.projectName)
    return res.status(400).json({ error: 'projectInfo.projectName is required' });
  try {
    const rfq = await generateSupplierRFQ(units, projectInfo);
    res.json({ success: true, rfq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-rfq', async (req, res) => {
  const { units, projectInfo, suppliers } = req.body;
  if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0)
    return res.status(400).json({ error: 'suppliers array is required' });
  try {
    const rfq = await generateSupplierRFQ(units, projectInfo);
    const results = [];
    for (const supplier of suppliers) {
      try {
        const r = await sendRFQEmail(supplier.email, rfq.subject, rfq.body);
        results.push({ supplier: supplier.email, status: 'sent', messageId: r.messageId });
      } catch (e) {
        results.push({ supplier: supplier.email, status: 'failed', error: e.message });
      }
    }
    res.json({ success: true, rfq, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
