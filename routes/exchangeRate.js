const express = require('express');
const router = express.Router();
const { getRates } = require('../services/exchangeRateService');

// GET /api/exchange-rates (publico)
router.get('/', async (req, res) => {
  try {
    const data = await getRates();
    if (!data) {
      return res.status(503).json({ message: 'Tasas de cambio no disponibles' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo tasas de cambio' });
  }
});

module.exports = router;
