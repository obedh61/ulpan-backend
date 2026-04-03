const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { subirAvatar, eliminarAvatar } = require('../controllers/avatarController');

const router = express.Router();

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP)'));
    }
  },
});

router.use(authMiddleware);

router.post('/', uploadImage.single('avatar'), subirAvatar);
router.delete('/', eliminarAvatar);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'La imagen excede el límite de 2MB' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err.message && err.message.includes('Solo se permiten')) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;
