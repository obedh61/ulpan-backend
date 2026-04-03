const cloudinary = require('../config/cloudinary');
const User = require('../models/User');

// POST /api/avatar
const subirAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se envió ninguna imagen' });
    }

    const user = await User.findById(req.user._id);

    // Eliminar avatar anterior de Cloudinary si existe
    if (user.avatarPublicId) {
      await cloudinary.uploader.destroy(user.avatarPublicId).catch((err) =>
        console.error('Error eliminando avatar anterior:', err)
      );
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'ulpan-jerusalem/avatars',
          transformation: [
            { width: 256, height: 256, crop: 'fill', gravity: 'face', quality: 'auto', format: 'webp' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    user.avatar = result.secure_url;
    user.avatarPublicId = result.public_id;
    await user.save({ validateBeforeSave: false });

    res.json({ avatar: result.secure_url });
  } catch (error) {
    console.error('Error al subir avatar:', error);
    res.status(500).json({ message: 'Error al subir el avatar' });
  }
};

// DELETE /api/avatar
const eliminarAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.avatarPublicId) {
      await cloudinary.uploader.destroy(user.avatarPublicId).catch((err) =>
        console.error('Error eliminando avatar de Cloudinary:', err)
      );
    }

    user.avatar = null;
    user.avatarPublicId = null;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Avatar eliminado' });
  } catch (error) {
    console.error('Error al eliminar avatar:', error);
    res.status(500).json({ message: 'Error al eliminar el avatar' });
  }
};

module.exports = { subirAvatar, eliminarAvatar };
