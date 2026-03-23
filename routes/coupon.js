const express = require('express');
const { body } = require('express-validator');
const {
  crearCupon,
  getCupones,
  validarCupon,
  toggleCupon,
  eliminarCupon,
  actualizarCupon,
} = require('../controllers/couponController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

// Validar cupon - requiere auth pero no admin
router.post('/validate', authMiddleware, validarCupon);

// Rutas de admin
router.use(authMiddleware, roleMiddleware('admin'));

router.get('/', getCupones);

router.post(
  '/',
  [
    body('codigo', 'El codigo es obligatorio').notEmpty(),
    body('tipo', 'Tipo invalido').isIn(['porcentaje', 'monto_fijo']),
    body('descuento', 'El descuento es obligatorio').isNumeric(),
  ],
  crearCupon
);

router.put('/:id', actualizarCupon);
router.put('/:id/toggle', toggleCupon);
router.delete('/:id', eliminarCupon);

module.exports = router;
