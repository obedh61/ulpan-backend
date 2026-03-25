const { sendEmail } = require('../config/email');
const { generateReceipt } = require('./pdfService');
const resolveTranslatable = require('../utils/resolveTranslatable');

// ─── Base Template ───────────────────────────────────────────────────────────

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ulpan Jerusalem</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1565C0;padding:30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:1px;">Ulpan Jerusalem</h1>
              <p style="color:#bbdefb;margin:8px 0 0;font-size:14px;">Escuela de Hebreo</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:30px;color:#333333;line-height:1.6;font-size:15px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f5f5f5;padding:20px 30px;text-align:center;border-top:1px solid #e0e0e0;">
              <p style="margin:0 0 5px;color:#666666;font-size:12px;"><strong>Ulpan Jerusalem</strong> — Escuela de Hebreo</p>
              <p style="margin:0 0 5px;color:#666666;font-size:12px;">info@ulpanjerusalem.com</p>
              <p style="margin:10px 0 0;color:#999999;font-size:11px;">Este es un email automatico. Por favor no responda a este mensaje.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const btnStyle = 'display:inline-block;padding:12px 30px;background-color:#FF8F00;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:15px;';
const infoBoxStyle = 'background-color:#e3f2fd;border-left:4px solid #1565C0;padding:15px;margin:15px 0;border-radius:0 4px 4px 0;';

// ─── 0. Email Verification ───────────────────────────────────────────────────

const verificationTexts = {
  es: {
    subject: 'Verifica tu cuenta — Ulpan Jerusalem',
    heading: 'Verifica tu email',
    greeting: 'Hola',
    body: 'Gracias por registrarte en <strong>Ulpan Jerusalem</strong>. Para activar tu cuenta, haz clic en el siguiente boton:',
    btn: 'Verificar mi cuenta',
    expiry: 'Este enlace expirara en 24 horas. Si no creaste esta cuenta, puedes ignorar este mensaje.',
    fallback: 'Si el boton no funciona, copia y pega este enlace en tu navegador:',
  },
  en: {
    subject: 'Verify your account — Ulpan Jerusalem',
    heading: 'Verify your email',
    greeting: 'Hello',
    body: 'Thank you for signing up at <strong>Ulpan Jerusalem</strong>. To activate your account, click the button below:',
    btn: 'Verify my account',
    expiry: 'This link will expire in 24 hours. If you did not create this account, you can ignore this message.',
    fallback: 'If the button does not work, copy and paste this link in your browser:',
  },
  he: {
    subject: 'אמת את החשבון שלך — אולפן ירושלים',
    heading: 'אמת את האימייל שלך',
    greeting: 'שלום',
    body: 'תודה שנרשמת ב-<strong>אולפן ירושלים</strong>. כדי להפעיל את החשבון שלך, לחץ על הכפתור הבא:',
    btn: 'אמת את החשבון שלי',
    expiry: 'קישור זה יפוג תוך 24 שעות. אם לא יצרת חשבון זה, ניתן להתעלם מהודעה זו.',
    fallback: 'אם הכפתור לא עובד, העתק והדבק את הקישור הבא בדפדפן:',
  },
};

const sendVerificationEmail = async (user, verificationToken) => {
  const lang = user.idioma || 'es';
  const txt = verificationTexts[lang] || verificationTexts.es;
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;

  const html = baseTemplate(`
    <div dir="${dir}">
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.greeting} <strong>${user.nombre}</strong>,</p>
    <p>${txt.body}</p>
    <p style="text-align:center;">
      <a href="${verifyUrl}" style="${btnStyle}">${txt.btn}</a>
    </p>
    <p style="color:#666666;font-size:13px;">${txt.expiry}</p>
    <p style="color:#666666;font-size:13px;">${txt.fallback}</p>
    <p style="color:#1565C0;font-size:13px;word-break:break-all;" dir="ltr">${verifyUrl}</p>
    </div>
  `);

  return sendEmail(
    { email: user.email, name: user.nombre },
    txt.subject,
    html
  );
};

// ─── 1. Welcome Email ────────────────────────────────────────────────────────

const sendWelcomeEmail = async (user) => {
  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Bienvenido/a, ${user.nombre}!</h2>
    <p>Gracias por registrarte en <strong>Ulpan Jerusalem</strong>. Estamos encantados de tenerte como parte de nuestra comunidad de estudiantes de hebreo.</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>Tu cuenta:</strong></p>
      <p style="margin:5px 0 0;">Email: ${user.email}</p>
      <p style="margin:5px 0 0;">Rol: ${user.rol === 'alumno' ? 'Estudiante' : user.rol === 'maestro' ? 'Maestro/a' : 'Administrador'}</p>
    </div>
    <p>Ya puedes acceder a la plataforma e inscribirte en los cursos disponibles.</p>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="${btnStyle}">Iniciar Sesion</a>
    </p>
    <p style="color:#666666;font-size:13px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
  `);

  return sendEmail(
    { email: user.email, name: user.nombre },
    'Bienvenido/a a Ulpan Jerusalem',
    html
  );
};

// ─── 2. Course Enrollment Email ──────────────────────────────────────────────

const sendCourseEnrollmentEmail = async (alumno, curso) => {
  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Inscripcion confirmada</h2>
    <p>Hola <strong>${alumno.nombre}</strong>,</p>
    <p>Tu inscripcion al siguiente curso ha sido confirmada exitosamente:</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${resolveTranslatable(curso.titulo)}</strong></p>
      <p style="margin:5px 0 0;">${resolveTranslatable(curso.descripcion)}</p>
    </div>
    <p>El curso cuenta con <strong>24 clases</strong>. Podras acceder al material, enlaces de Zoom y videos grabados desde tu panel de estudiante.</p>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/alumno/cursos/${curso._id}" style="${btnStyle}">Ver mi curso</a>
    </p>
    <p style="color:#666666;font-size:13px;">Preparate para una experiencia de aprendizaje increible!</p>
  `);

  return sendEmail(
    { email: alumno.email, name: alumno.nombre },
    `Inscripcion confirmada: ${resolveTranslatable(curso.titulo)}`,
    html
  );
};

// ─── 3. New Video Notification ───────────────────────────────────────────────

const sendNewVideoEmail = async (alumnos, curso, clase) => {
  if (!alumnos || alumnos.length === 0) return null;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Nuevo video disponible</h2>
    <p>Se ha subido un nuevo video a tu curso:</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>Curso:</strong> ${resolveTranslatable(curso.titulo)}</p>
      <p style="margin:5px 0 0;"><strong>Clase ${clase.numeroClase}:</strong> ${resolveTranslatable(clase.titulo) || `Clase ${clase.numeroClase}`}</p>
    </div>
    <p>Ya puedes ver la grabacion de la clase desde tu panel de estudiante.</p>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/alumno/cursos/${curso._id}" style="${btnStyle}">Ver video</a>
    </p>
  `);

  const destinatarios = alumnos.map((a) => ({ email: a.email, name: a.nombre }));

  return sendEmail(
    destinatarios,
    `Nuevo video: ${resolveTranslatable(clase.titulo) || `Clase ${clase.numeroClase}`} — ${resolveTranslatable(curso.titulo)}`,
    html
  );
};

// ─── 4. Zoom Link Notification ───────────────────────────────────────────────

const sendZoomLinkEmail = async (alumnos, curso, clase) => {
  if (!alumnos || alumnos.length === 0) return null;

  const fechaTexto = clase.fecha
    ? new Date(clase.fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Fecha por confirmar';

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Clase en vivo programada</h2>
    <p>Se ha actualizado el enlace de Zoom para tu clase:</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>Curso:</strong> ${resolveTranslatable(curso.titulo)}</p>
      <p style="margin:5px 0 0;"><strong>Clase ${clase.numeroClase}:</strong> ${resolveTranslatable(clase.titulo) || `Clase ${clase.numeroClase}`}</p>
      <p style="margin:5px 0 0;"><strong>Fecha:</strong> ${fechaTexto}</p>
    </div>
    <p>Accede a la clase en vivo con el siguiente enlace:</p>
    <p style="text-align:center;">
      <a href="${clase.zoomLink}" style="${btnStyle}">Unirse a la clase por Zoom</a>
    </p>
    <p style="color:#666666;font-size:13px;">Asegurate de tener Zoom instalado antes de la clase.</p>
  `);

  const destinatarios = alumnos.map((a) => ({ email: a.email, name: a.nombre }));

  return sendEmail(
    destinatarios,
    `Clase en vivo: ${resolveTranslatable(clase.titulo) || `Clase ${clase.numeroClase}`} — ${resolveTranslatable(curso.titulo)}`,
    html
  );
};

// ─── 5. Password Reset Email (placeholder for next prompt) ───────────────────

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Recuperar contrasena</h2>
    <p>Hola <strong>${user.nombre}</strong>,</p>
    <p>Recibimos una solicitud para restablecer tu contrasena. Haz clic en el siguiente boton para crear una nueva:</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" style="${btnStyle}">Restablecer contrasena</a>
    </p>
    <p style="color:#666666;font-size:13px;">Este enlace expirara en 1 hora. Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
    <p style="color:#666666;font-size:13px;">Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
    <p style="color:#1565C0;font-size:13px;word-break:break-all;">${resetUrl}</p>
  `);

  return sendEmail(
    { email: user.email, name: user.nombre },
    'Recuperar contrasena — Ulpan Jerusalem',
    html
  );
};

// ─── 6. Password Changed Confirmation ────────────────────────────────────────

const sendPasswordChangedEmail = async (user) => {
  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Contrasena actualizada</h2>
    <p>Hola <strong>${user.nombre}</strong>,</p>
    <p>Tu contrasena ha sido restablecida exitosamente.</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;">Si tu no realizaste este cambio, contactanos de inmediato a <a href="mailto:info@ulpanjerusalem.com" style="color:#1565C0;">info@ulpanjerusalem.com</a></p>
    </div>
    <p>Ya puedes iniciar sesion con tu nueva contrasena.</p>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="${btnStyle}">Iniciar Sesion</a>
    </p>
  `);

  return sendEmail(
    { email: user.email, name: user.nombre },
    'Contrasena actualizada — Ulpan Jerusalem',
    html
  );
};

// ─── 7. Payment Confirmation Email ──────────────────────────────────────────

const sendPaymentConfirmationEmail = async (alumno, curso, payment) => {
  const monedaSymbol = { ILS: '₪', USD: '$', EUR: '€' }[payment.moneda] || payment.moneda;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Pago confirmado</h2>
    <p>Hola <strong>${alumno.nombre}</strong>,</p>
    <p>Tu pago ha sido procesado exitosamente. Ya estas inscrito/a en el curso.</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>Curso:</strong> ${resolveTranslatable(curso.titulo)}</p>
      <p style="margin:5px 0 0;"><strong>Monto pagado:</strong> ${monedaSymbol}${payment.monto.toFixed(2)}</p>
      ${payment.descuento > 0 ? `<p style="margin:5px 0 0;"><strong>Descuento aplicado:</strong> ${monedaSymbol}${payment.descuento.toFixed(2)}</p>` : ''}
      ${payment.cuponCodigo ? `<p style="margin:5px 0 0;"><strong>Cupon:</strong> ${payment.cuponCodigo}</p>` : ''}
      <p style="margin:5px 0 0;"><strong>ID de transaccion:</strong> ${payment.allpayTransactionId || payment._id}</p>
    </div>
    <p>Adjuntamos el recibo de pago en formato PDF.</p>
    <p>El curso cuenta con <strong>24 clases</strong>. Podras acceder al material desde tu panel de estudiante.</p>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/alumno/cursos/${curso._id}" style="${btnStyle}">Ver mi curso</a>
    </p>
  `);

  // Generar PDF del recibo y adjuntarlo
  let attachment;
  try {
    const paymentForPdf = {
      ...payment.toObject ? payment.toObject() : payment,
      alumnoId: alumno,
      cursoId: curso,
    };
    const pdfBuffer = await generateReceipt(paymentForPdf);
    attachment = [
      {
        content: pdfBuffer.toString('base64'),
        name: `recibo-${payment._id}.pdf`,
      },
    ];
  } catch (err) {
    console.error('Error generando PDF del recibo para email:', err);
  }

  return sendEmail(
    { email: alumno.email, name: alumno.nombre },
    `Pago confirmado: ${resolveTranslatable(curso.titulo)}`,
    html,
    attachment
  );
};

// ─── 8. Payment Failed Email ────────────────────────────────────────────────

const sendPaymentFailedEmail = async (alumno, curso) => {
  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Problema con tu pago</h2>
    <p>Hola <strong>${alumno.nombre}</strong>,</p>
    <p>Lamentablemente hubo un problema al procesar tu pago para el siguiente curso:</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>Curso:</strong> ${resolveTranslatable(curso.titulo)}</p>
    </div>
    <p>Puedes intentar realizar el pago nuevamente desde la plataforma.</p>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/cursos/${curso._id}" style="${btnStyle}">Intentar de nuevo</a>
    </p>
    <p style="color:#666666;font-size:13px;">Si el problema persiste, contactanos a info@ulpanjerusalem.com</p>
  `);

  return sendEmail(
    { email: alumno.email, name: alumno.nombre },
    `Problema con tu pago: ${resolveTranslatable(curso.titulo)}`,
    html
  );
};

// ─── 9. Admin New Sale Notification ──────────────────────────────────────────

const sendAdminNewSaleEmail = async (admins, alumno, curso, payment) => {
  if (!admins || admins.length === 0) return null;

  const monedaSymbol = { ILS: '₪', USD: '$', EUR: '€' }[payment.moneda] || payment.moneda;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Nueva venta realizada</h2>
    <p>Se ha completado un nuevo pago en la plataforma:</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>Alumno:</strong> ${alumno.nombre} (${alumno.email})</p>
      <p style="margin:5px 0 0;"><strong>Curso:</strong> ${resolveTranslatable(curso.titulo)}</p>
      <p style="margin:5px 0 0;"><strong>Monto:</strong> ${monedaSymbol}${payment.monto.toFixed(2)}</p>
      ${payment.descuento > 0 ? `<p style="margin:5px 0 0;"><strong>Descuento:</strong> ${monedaSymbol}${payment.descuento.toFixed(2)}</p>` : ''}
      ${payment.cuponCodigo ? `<p style="margin:5px 0 0;"><strong>Cupon:</strong> ${payment.cuponCodigo}</p>` : ''}
    </div>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/ingresos" style="${btnStyle}">Ver ingresos</a>
    </p>
  `);

  const destinatarios = admins.map((a) => ({ email: a.email, name: a.nombre }));

  return sendEmail(
    destinatarios,
    `Nueva venta: ${resolveTranslatable(curso.titulo)} — ${monedaSymbol}${payment.monto.toFixed(2)}`,
    html
  );
};

// ─── 10. Maestro New Student Notification ────────────────────────────────────

const sendMaestroNewStudentEmail = async (maestro, alumno, curso) => {
  if (!maestro) return null;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">Nuevo alumno inscrito</h2>
    <p>Hola <strong>${maestro.nombre}</strong>,</p>
    <p>Un nuevo alumno se ha inscrito en tu curso:</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>Alumno:</strong> ${alumno.nombre} (${alumno.email})</p>
      <p style="margin:5px 0 0;"><strong>Curso:</strong> ${resolveTranslatable(curso.titulo)}</p>
    </div>
    <p style="text-align:center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/maestro/cursos/${curso._id}" style="${btnStyle}">Ver curso</a>
    </p>
  `);

  return sendEmail(
    { email: maestro.email, name: maestro.nombre },
    `Nuevo alumno en ${resolveTranslatable(curso.titulo)}: ${alumno.nombre}`,
    html
  );
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendCourseEnrollmentEmail,
  sendNewVideoEmail,
  sendZoomLinkEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail,
  sendAdminNewSaleEmail,
  sendMaestroNewStudentEmail,
};
