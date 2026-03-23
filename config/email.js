const { BrevoClient } = require('@getbrevo/brevo');

let brevoClient = null;

const getClient = () => {
  if (!brevoClient && process.env.BREVO_API_KEY) {
    brevoClient = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  }
  return brevoClient;
};

/**
 * Envía un email transaccional usando Brevo
 * @param {{ email: string, name?: string }|Array} to - Destinatario(s)
 * @param {string} subject - Asunto del email
 * @param {string} htmlContent - Contenido HTML
 * @param {Array} [attachment] - Adjuntos opcionales [{ content: base64, name: string }]
 * @returns {Promise<object|null>} Resultado de Brevo o null si falla
 */
const sendEmail = async (to, subject, htmlContent, attachment) => {
  const client = getClient();
  if (!client) {
    console.warn('BREVO_API_KEY no configurada — email no enviado');
    return null;
  }

  try {
    const payload = {
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'Ulpan Jerusalem',
        email: process.env.EMAIL_FROM || 'noreply@ulpanjerusalem.com',
      },
      to: Array.isArray(to) ? to : [to],
      subject,
      htmlContent,
    };

    if (attachment && attachment.length > 0) {
      payload.attachment = attachment;
    }

    const data = await client.transactionalEmails.sendTransacEmail(payload);
    console.log('Email enviado:', subject);
    return data;
  } catch (error) {
    console.error('Error enviando email:', error.body || error.message || error);
    return null;
  }
};

module.exports = { sendEmail };
