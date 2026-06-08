const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/s3', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const fileUrl = `https://storage.example.com/uploads/${Date.now()}-${req.file.originalname}`;
    res.json({ success: true, data: { url: fileUrl, key: req.file.originalname } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/s3', authenticateToken, async (req, res) => {
  try {
    const { fileKey } = req.body;
    if (!fileKey) return res.status(400).json({ success: false, message: 'fileKey required' });
    res.json({ success: true, message: 'File deleted', data: { key: fileKey } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
