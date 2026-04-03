const axios = require('axios');
const crypto = require('crypto');

const ALLPAY_ENDPOINT = 'https://allpay.to/app/';

/**
 * Genera la firma SHA256 segun la documentacion de Allpay:
 * 1. Eliminar parametro 'sign' y valores vacios
 * 2. Ordenar todas las claves alfabeticamente (incluidos arrays anidados)
 * 3. Extraer solo los valores, unirlos con ':'
 * 4. Agregar API key al final despues de ':'
 * 5. Hash SHA256
 */
const generateSign = (params) => {
  const apiKey = process.env.ALLPAY_API_KEY;

  const extractValues = (obj) => {
    const values = [];
    const sortedKeys = Object.keys(obj).sort();
    for (const key of sortedKeys) {
      if (key === 'sign') continue;
      const val = obj[key];
      if (val === '' || val === null || val === undefined) continue;
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'object' && item !== null) {
            values.push(...extractValues(item));
          } else {
            values.push(String(item));
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        values.push(...extractValues(val));
      } else {
        values.push(String(val));
      }
    }
    return values;
  };

  const values = extractValues(params);
  const signString = values.join(':') + ':' + apiKey;

  return crypto.createHash('sha256').update(signString).digest('hex');
};

/**
 * Crea una transaccion de pago en Allpay
 */
const createTransaction = async ({ amount, currency, description, paymentId, successUrl, failureUrl, webhookUrl, clientName, clientEmail, clientPhone, payments }) => {
  const params = {
    login: process.env.ALLPAY_API_LOGIN,
    order_id: paymentId,
    currency: currency || 'ILS',
    items: [
      {
        name: description,
        price: amount,
        qty: 1,
        vat: 1,
      },
    ],
    success_url: successUrl,
    webhook_url: webhookUrl,
  };

  if (payments && payments > 1) params.payments = payments;
  if (clientName) params.client_name = clientName;
  if (clientEmail) params.client_email = clientEmail;
  if (clientPhone) params.client_phone = clientPhone;

  params.sign = generateSign(params);

  const response = await axios.post(
    `${ALLPAY_ENDPOINT}?show=getpayment&mode=api10`,
    params,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return response.data;
};

/**
 * Verifica el estado de un pago en Allpay
 */
const checkPaymentStatus = async (orderId) => {
  const params = {
    login: process.env.ALLPAY_API_LOGIN,
    order_id: orderId,
  };
  params.sign = generateSign(params);

  const response = await axios.post(
    `${ALLPAY_ENDPOINT}?show=paymentstatus&mode=api10`,
    params,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return response.data;
};

/**
 * Verifica la firma del webhook de Allpay.
 * El webhook envia un campo 'sign' que se debe verificar
 * con el mismo algoritmo de firma usando el API key.
 */
const verifyWebhookSignature = (payload) => {
  if (!payload || !payload.sign) return false;

  const receivedSign = payload.sign;
  const computedSign = generateSign(payload);

  return receivedSign === computedSign;
};

module.exports = { createTransaction, checkPaymentStatus, verifyWebhookSignature, generateSign };
