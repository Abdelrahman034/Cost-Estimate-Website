const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const {
  generateProposalContent,
  generateProposalPDF,
  sendProposal,
  proposals,
} = require('../services');

const outputsDir = path.join(__dirname, '..', 'outputs');
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

router.post('/generate', async (req, res) => {
  const { estimateData, projectInfo } = req.body;
  if (!estimateData || !projectInfo)
    return res.status(400).json({ error: 'estimateData and projectInfo are required' });
  try {
    const proposalData = await generateProposalContent(estimateData, projectInfo);
    const filename = 'Proposal_' + (projectInfo.projectName || 'Draft').replace(/\s+/g, '_') + '_' + Date.now() + '.pdf';
    const outputPath = path.join(outputsDir, filename);
    await generateProposalPDF(proposalData, projectInfo, outputPath);

    if (projectInfo._dbId) {
      proposals.save(projectInfo._dbId, filename, estimateData.total || 0);
    }

    res.json({ success: true, proposalData, downloadUrl: '/outputs/' + filename, filename });
  } catch (err) {
    console.error('Proposal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:filename', (req, res) => {
  const filePath = path.join(outputsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

router.post('/send', async (req, res) => {
  const { estimateData, projectInfo, clientEmail, clientName } = req.body;
  if (!clientEmail) return res.status(400).json({ error: 'clientEmail is required' });
  try {
    const proposalData = await generateProposalContent(estimateData, projectInfo);
    const filename = 'Proposal_' + (projectInfo.projectName || 'Draft').replace(/\s+/g, '_') + '_' + Date.now() + '.pdf';
    const outputPath = path.join(outputsDir, filename);
    await generateProposalPDF(proposalData, projectInfo, outputPath);
    await sendProposal(clientEmail, clientName || 'Client', projectInfo.projectName, outputPath);
    res.json({ success: true, message: 'Proposal sent to ' + clientEmail, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
