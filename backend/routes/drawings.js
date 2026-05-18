const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { analyzeDrawing } = require('../services');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP images are supported'));
  },
});

router.post('/analyze', upload.single('drawing'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let mediaType = 'image/jpeg';
    if (ext === '.png')  mediaType = 'image/png';
    if (ext === '.webp') mediaType = 'image/webp';

    const base64 = fs.readFileSync(req.file.path).toString('base64');
    const result = await analyzeDrawing(base64, mediaType);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, filename: req.file.originalname, data: result });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Drawing analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
