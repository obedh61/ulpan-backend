const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('maestro', 'admin'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  },
});

router.post('/pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se envió ningún archivo' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'ulpan-jerusalem/pdfs',
          public_id: req.file.originalname.replace(/\.pdf$/i, ''),
          format: 'pdf',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ url: result.secure_url });
  } catch (error) {
    console.error('Error al subir PDF:', error);
    res.status(500).json({ message: 'Error al subir el archivo' });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'El archivo excede el límite de 10MB' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;
