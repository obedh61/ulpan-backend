const express = require('express');
const { crearPago, webhookAllpay, verificarPago, getMisPagos, getReceipt } = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Webhook - publico, sin autenticacion (debe ir primero)
router.post('/webhook', webhookAllpay);

// Rutas protegidas
router.use(authMiddleware);

router.post('/create', crearPago);
router.get('/verify/:paymentId', verificarPago);
router.get('/mis-pagos', getMisPagos);
router.get('/:id/receipt', getReceipt);

module.exports = router;
