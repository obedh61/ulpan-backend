const { sendEmail } = require('../config/email');
const { generateReceipt } = require('./pdfService');
const resolveTranslatable = require('../utils/resolveTranslatable');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUPPORTED_LANGS = ['es', 'en', 'he'];

const getLang = (user) => {
  const lang = user && user.idioma;
  return SUPPORTED_LANGS.includes(lang) ? lang : 'es';
};

const dateLocaleMap = { es: 'es-ES', en: 'en-US', he: 'he-IL' };

const formatDate = (fecha, lang) => {
  if (!fecha) return null;
  try {
    return new Date(fecha).toLocaleDateString(dateLocaleMap[lang] || 'es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
};

const groupByLang = (users) => {
  const groups = { es: [], en: [], he: [] };
  for (const u of users) groups[getLang(u)].push(u);
  return groups;
};

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Base Template ───────────────────────────────────────────────────────────

const footerTexts = {
  es: { school: 'Aprende online con maestros expertos', auto: 'Este es un email automatico. Por favor no responda a este mensaje.' },
  en: { school: 'Learn online with expert teachers', auto: 'This is an automated email. Please do not reply to this message.' },
  he: { school: 'למד אונליין עם מורים מומחים', auto: 'זהו אימייל אוטומטי. אנא אל תשיב להודעה זו.' },
};

const baseTemplate = (content, lang = 'es') => {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const ft = footerTexts[lang] || footerTexts.es;
  return `
<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ulpan Jerusalem</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;" dir="${dir}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1565C0;padding:30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:1px;">Ulpan Jerusalem</h1>
              <p style="color:#bbdefb;margin:8px 0 0;font-size:14px;">${ft.school}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;color:#333333;line-height:1.6;font-size:15px;" dir="${dir}">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f5f5f5;padding:20px 30px;text-align:center;border-top:1px solid #e0e0e0;">
              <p style="margin:0 0 5px;color:#666666;font-size:12px;"><strong>Ulpan Jerusalem</strong> — ${ft.school}</p>
              <p style="margin:0 0 5px;color:#666666;font-size:12px;">info@ulpanjerusalem.com</p>
              <p style="margin:10px 0 0;color:#999999;font-size:11px;">${ft.auto}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const btnStyle = 'display:inline-block;padding:12px 30px;background-color:#FF8F00;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:15px;';
const infoBoxStyle = 'background-color:#e3f2fd;border-left:4px solid #1565C0;padding:15px;margin:15px 0;border-radius:0 4px 4px 0;';

// ─── 0. Email Verification ───────────────────────────────────────────────────

const verificationTexts = {
  es: {
    subject: 'Verifica tu cuenta — Ulpan Jerusalem',
    heading: 'Verifica tu email',
    tagline: 'Aprende online con maestros expertos.',
    greeting: 'Hola',
    body: 'Gracias por registrarte en <strong>Ulpan Jerusalem</strong>. Cursos online, en vivo y grabados, dictados por maestros expertos en sus areas. Para activar tu cuenta, haz clic en el siguiente boton:',
    btn: 'Verificar mi cuenta',
    expiry: 'Este enlace expirara en 24 horas. Si no creaste esta cuenta, puedes ignorar este mensaje.',
    fallback: 'Si el boton no funciona, copia y pega este enlace en tu navegador:',
  },
  en: {
    subject: 'Verify your account — Ulpan Jerusalem',
    heading: 'Verify your email',
    tagline: 'Learn online with expert teachers.',
    greeting: 'Hello',
    body: 'Thank you for signing up at <strong>Ulpan Jerusalem</strong>. Online courses, live and recorded, taught by expert teachers in their fields. To activate your account, click the button below:',
    btn: 'Verify my account',
    expiry: 'This link will expire in 24 hours. If you did not create this account, you can ignore this message.',
    fallback: 'If the button does not work, copy and paste this link in your browser:',
  },
  he: {
    subject: 'אמת את החשבון שלך — אולפן ירושלים',
    heading: 'אמת את האימייל שלך',
    tagline: 'למד אונליין עם מורים מומחים.',
    greeting: 'שלום',
    body: 'תודה שנרשמת ב-<strong>אולפן ירושלים</strong>. קורסים אונליין, בשידור חי ומוקלטים, בהוראת מורים מומחים בתחומם. כדי להפעיל את החשבון שלך, לחץ על הכפתור הבא:',
    btn: 'אמת את החשבון שלי',
    expiry: 'קישור זה יפוג תוך 24 שעות. אם לא יצרת חשבון זה, ניתן להתעלם מהודעה זו.',
    fallback: 'אם הכפתור לא עובד, העתק והדבק את הקישור הבא בדפדפן:',
  },
};

const sendVerificationEmail = async (user, verificationToken) => {
  const lang = getLang(user);
  const txt = verificationTexts[lang];
  const verifyUrl = `${clientUrl()}/verify-email/${verificationToken}`;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p style="font-size:17px;color:#1565C0;font-weight:600;margin:0 0 12px;">${txt.tagline}</p>
    <p>${txt.greeting} <strong>${user.nombre}</strong>,</p>
    <p>${txt.body}</p>
    <p style="text-align:center;">
      <a href="${verifyUrl}" style="${btnStyle}">${txt.btn}</a>
    </p>
    <p style="color:#666666;font-size:13px;">${txt.expiry}</p>
    <p style="color:#666666;font-size:13px;">${txt.fallback}</p>
    <p style="color:#1565C0;font-size:13px;word-break:break-all;" dir="ltr">${verifyUrl}</p>
  `, lang);

  return sendEmail({ email: user.email, name: user.nombre }, txt.subject, html);
};

// ─── 1. Welcome Email ────────────────────────────────────────────────────────

const welcomeTexts = {
  es: {
    subject: 'Bienvenido/a a Ulpan Jerusalem',
    heading: (n) => `Bienvenido/a, ${n}!`,
    tagline: 'Aprende online con maestros expertos.',
    body: 'Gracias por registrarte en <strong>Ulpan Jerusalem</strong>. Cursos online, en vivo y grabados, dictados por maestros expertos en sus areas. Hebreo, idiomas, cultura y mucho mas. Aprende a tu propio ritmo, desde cualquier lugar.',
    accountLabel: 'Tu cuenta:',
    emailLabel: 'Email:',
    rolLabel: 'Rol:',
    roles: { alumno: 'Estudiante', maestro: 'Maestro/a', admin: 'Administrador' },
    afterAccount: 'Ya puedes acceder a la plataforma e inscribirte en los cursos disponibles.',
    btn: 'Iniciar Sesion',
    contact: 'Si tienes alguna pregunta, no dudes en contactarnos.',
  },
  en: {
    subject: 'Welcome to Ulpan Jerusalem',
    heading: (n) => `Welcome, ${n}!`,
    tagline: 'Learn online with expert teachers.',
    body: 'Thank you for signing up at <strong>Ulpan Jerusalem</strong>. Online courses, live and recorded, taught by expert teachers in their fields. Hebrew, languages, culture and more. Learn at your own pace, from anywhere.',
    accountLabel: 'Your account:',
    emailLabel: 'Email:',
    rolLabel: 'Role:',
    roles: { alumno: 'Student', maestro: 'Teacher', admin: 'Administrator' },
    afterAccount: 'You can now access the platform and enroll in the available courses.',
    btn: 'Sign In',
    contact: 'If you have any questions, please feel free to contact us.',
  },
  he: {
    subject: 'ברוכים הבאים לאולפן ירושלים',
    heading: (n) => `ברוכים הבאים, ${n}!`,
    tagline: 'למד אונליין עם מורים מומחים.',
    body: 'תודה שנרשמת ב-<strong>אולפן ירושלים</strong>. קורסים אונליין, בשידור חי ומוקלטים, בהוראת מורים מומחים בתחומם. עברית, שפות, תרבות ועוד. למד בקצב שלך, מכל מקום.',
    accountLabel: 'החשבון שלך:',
    emailLabel: 'אימייל:',
    rolLabel: 'תפקיד:',
    roles: { alumno: 'תלמיד/ה', maestro: 'מורה', admin: 'מנהל/ת' },
    afterAccount: 'כעת תוכל/י להיכנס לפלטפורמה ולהירשם לקורסים הזמינים.',
    btn: 'התחבר',
    contact: 'לכל שאלה, אל תהססו לפנות אלינו.',
  },
};

const sendWelcomeEmail = async (user) => {
  const lang = getLang(user);
  const txt = welcomeTexts[lang];

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading(user.nombre)}</h2>
    <p style="font-size:17px;color:#1565C0;font-weight:600;margin:0 0 12px;">${txt.tagline}</p>
    <p>${txt.body}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${txt.accountLabel}</strong></p>
      <p style="margin:5px 0 0;">${txt.emailLabel} ${user.email}</p>
      <p style="margin:5px 0 0;">${txt.rolLabel} ${txt.roles[user.rol] || user.rol}</p>
    </div>
    <p>${txt.afterAccount}</p>
    <p style="text-align:center;">
      <a href="${clientUrl()}/login" style="${btnStyle}">${txt.btn}</a>
    </p>
    <p style="color:#666666;font-size:13px;">${txt.contact}</p>
  `, lang);

  return sendEmail({ email: user.email, name: user.nombre }, txt.subject, html);
};

// ─── 2. Course Enrollment Email ──────────────────────────────────────────────

const enrollmentTexts = {
  es: {
    subject: (curso) => `Inscripcion confirmada: ${curso}`,
    heading: 'Inscripcion confirmada',
    greeting: 'Hola',
    body: 'Tu inscripcion al siguiente curso ha sido confirmada exitosamente:',
    info: (n) => `El curso cuenta con <strong>${n} ${n === 1 ? 'clase' : 'clases'}</strong>. Podras acceder al material, enlaces de Zoom y videos grabados desde tu panel de estudiante. Aprende a tu propio ritmo, desde cualquier lugar.`,
    btn: 'Ver mi curso',
    closing: 'Preparate para una experiencia de aprendizaje increible!',
  },
  en: {
    subject: (curso) => `Enrollment confirmed: ${curso}`,
    heading: 'Enrollment confirmed',
    greeting: 'Hello',
    body: 'Your enrollment in the following course has been successfully confirmed:',
    info: (n) => `The course includes <strong>${n} ${n === 1 ? 'class' : 'classes'}</strong>. You will be able to access materials, Zoom links and recorded videos from your student dashboard. Learn at your own pace, from anywhere.`,
    btn: 'View my course',
    closing: 'Get ready for an amazing learning experience!',
  },
  he: {
    subject: (curso) => `ההרשמה אושרה: ${curso}`,
    heading: 'ההרשמה אושרה',
    greeting: 'שלום',
    body: 'הרשמתך לקורס הבא אושרה בהצלחה:',
    info: (n) => `הקורס כולל <strong>${n} ${n === 1 ? 'שיעור' : 'שיעורים'}</strong>. תוכל/י לגשת לחומרים, לקישורי Zoom ולסרטונים המוקלטים מאזור התלמיד. למד בקצב שלך, מכל מקום.`,
    btn: 'צפה בקורס שלי',
    closing: 'התכונן/י לחוויית לימוד מדהימה!',
  },
};

const sendCourseEnrollmentEmail = async (alumno, curso) => {
  const lang = getLang(alumno);
  const txt = enrollmentTexts[lang];
  const titulo = resolveTranslatable(curso.titulo, lang);
  const desc = resolveTranslatable(curso.descripcion, lang);
  const numClases = curso.numeroClases || 24;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.greeting} <strong>${alumno.nombre}</strong>,</p>
    <p>${txt.body}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${titulo}</strong></p>
      <p style="margin:5px 0 0;">${desc}</p>
    </div>
    <p>${txt.info(numClases)}</p>
    <p style="text-align:center;">
      <a href="${clientUrl()}/alumno/cursos/${curso._id}" style="${btnStyle}">${txt.btn}</a>
    </p>
    <p style="color:#666666;font-size:13px;">${txt.closing}</p>
  `, lang);

  return sendEmail({ email: alumno.email, name: alumno.nombre }, txt.subject(titulo), html);
};

// ─── 3. New Video Notification ───────────────────────────────────────────────

const newVideoTexts = {
  es: {
    subject: (clase, curso) => `Nuevo video: ${clase} — ${curso}`,
    heading: 'Nuevo video disponible',
    body: 'Se ha subido un nuevo video a tu curso:',
    cursoLabel: 'Curso:',
    claseLabel: 'Clase',
    info: 'Ya puedes ver la grabacion de la clase desde tu panel de estudiante.',
    btn: 'Ver video',
  },
  en: {
    subject: (clase, curso) => `New video: ${clase} — ${curso}`,
    heading: 'New video available',
    body: 'A new video has been uploaded to your course:',
    cursoLabel: 'Course:',
    claseLabel: 'Class',
    info: 'You can now watch the class recording from your student dashboard.',
    btn: 'Watch video',
  },
  he: {
    subject: (clase, curso) => `סרטון חדש: ${clase} — ${curso}`,
    heading: 'סרטון חדש זמין',
    body: 'הועלה סרטון חדש לקורס שלך:',
    cursoLabel: 'קורס:',
    claseLabel: 'שיעור',
    info: 'ניתן לצפות בהקלטת השיעור מאזור התלמיד.',
    btn: 'צפה בסרטון',
  },
};

const _sendNewVideoEmailLang = async (alumnos, curso, clase, lang) => {
  const txt = newVideoTexts[lang];
  const cursoTitulo = resolveTranslatable(curso.titulo, lang);
  const claseTitulo = resolveTranslatable(clase.titulo, lang) || `${txt.claseLabel} ${clase.numeroClase}`;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.body}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${txt.cursoLabel}</strong> ${cursoTitulo}</p>
      <p style="margin:5px 0 0;"><strong>${txt.claseLabel} ${clase.numeroClase}:</strong> ${claseTitulo}</p>
    </div>
    <p>${txt.info}</p>
    <p style="text-align:center;">
      <a href="${clientUrl()}/alumno/cursos/${curso._id}" style="${btnStyle}">${txt.btn}</a>
    </p>
  `, lang);

  const destinatarios = alumnos.map((a) => ({ email: a.email, name: a.nombre }));
  return sendEmail(destinatarios, txt.subject(claseTitulo, cursoTitulo), html);
};

const sendNewVideoEmail = async (alumnos, curso, clase) => {
  if (!alumnos || alumnos.length === 0) return null;
  const groups = groupByLang(alumnos);
  return Promise.all(
    SUPPORTED_LANGS
      .filter((l) => groups[l].length > 0)
      .map((l) => _sendNewVideoEmailLang(groups[l], curso, clase, l))
  );
};

// ─── 4. Zoom Link Notification ───────────────────────────────────────────────

const zoomTexts = {
  es: {
    subject: (clase, curso) => `Clase en vivo: ${clase} — ${curso}`,
    heading: 'Clase en vivo programada',
    body: 'Se ha actualizado el enlace de Zoom para tu clase:',
    cursoLabel: 'Curso:',
    claseLabel: 'Clase',
    fechaLabel: 'Fecha:',
    fechaPendiente: 'Fecha por confirmar',
    join: 'Accede a la clase en vivo con el siguiente enlace:',
    btn: 'Unirse a la clase por Zoom',
    note: 'Asegurate de tener Zoom instalado antes de la clase.',
  },
  en: {
    subject: (clase, curso) => `Live class: ${clase} — ${curso}`,
    heading: 'Live class scheduled',
    body: 'The Zoom link for your class has been updated:',
    cursoLabel: 'Course:',
    claseLabel: 'Class',
    fechaLabel: 'Date:',
    fechaPendiente: 'Date to be confirmed',
    join: 'Join the live class with the following link:',
    btn: 'Join the class on Zoom',
    note: 'Make sure to have Zoom installed before the class.',
  },
  he: {
    subject: (clase, curso) => `שיעור חי: ${clase} — ${curso}`,
    heading: 'שיעור חי תוזמן',
    body: 'קישור ה-Zoom לשיעורך עודכן:',
    cursoLabel: 'קורס:',
    claseLabel: 'שיעור',
    fechaLabel: 'תאריך:',
    fechaPendiente: 'תאריך טרם נקבע',
    join: 'הצטרף לשיעור החי באמצעות הקישור הבא:',
    btn: 'הצטרף לשיעור ב-Zoom',
    note: 'ודא ש-Zoom מותקן לפני השיעור.',
  },
};

const _sendZoomLinkEmailLang = async (alumnos, curso, clase, lang) => {
  const txt = zoomTexts[lang];
  const cursoTitulo = resolveTranslatable(curso.titulo, lang);
  const claseTitulo = resolveTranslatable(clase.titulo, lang) || `${txt.claseLabel} ${clase.numeroClase}`;
  const fechaTexto = formatDate(clase.fecha, lang) || txt.fechaPendiente;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.body}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${txt.cursoLabel}</strong> ${cursoTitulo}</p>
      <p style="margin:5px 0 0;"><strong>${txt.claseLabel} ${clase.numeroClase}:</strong> ${claseTitulo}</p>
      <p style="margin:5px 0 0;"><strong>${txt.fechaLabel}</strong> ${fechaTexto}</p>
    </div>
    <p>${txt.join}</p>
    <p style="text-align:center;">
      <a href="${clase.zoomLink}" style="${btnStyle}">${txt.btn}</a>
    </p>
    <p style="color:#666666;font-size:13px;">${txt.note}</p>
  `, lang);

  const destinatarios = alumnos.map((a) => ({ email: a.email, name: a.nombre }));
  return sendEmail(destinatarios, txt.subject(claseTitulo, cursoTitulo), html);
};

const sendZoomLinkEmail = async (alumnos, curso, clase) => {
  if (!alumnos || alumnos.length === 0) return null;
  const groups = groupByLang(alumnos);
  return Promise.all(
    SUPPORTED_LANGS
      .filter((l) => groups[l].length > 0)
      .map((l) => _sendZoomLinkEmailLang(groups[l], curso, clase, l))
  );
};

// ─── 5. Password Reset Email ─────────────────────────────────────────────────

const passwordResetTexts = {
  es: {
    subject: 'Recuperar contrasena — Ulpan Jerusalem',
    heading: 'Recuperar contrasena',
    greeting: 'Hola',
    body: 'Recibimos una solicitud para restablecer tu contrasena. Haz clic en el siguiente boton para crear una nueva:',
    btn: 'Restablecer contrasena',
    expiry: 'Este enlace expirara en 1 hora. Si no solicitaste este cambio, puedes ignorar este mensaje.',
    fallback: 'Si el boton no funciona, copia y pega este enlace en tu navegador:',
  },
  en: {
    subject: 'Password reset — Ulpan Jerusalem',
    heading: 'Password reset',
    greeting: 'Hello',
    body: 'We received a request to reset your password. Click the button below to create a new one:',
    btn: 'Reset password',
    expiry: 'This link will expire in 1 hour. If you did not request this change, you can ignore this message.',
    fallback: 'If the button does not work, copy and paste this link in your browser:',
  },
  he: {
    subject: 'איפוס סיסמה — אולפן ירושלים',
    heading: 'איפוס סיסמה',
    greeting: 'שלום',
    body: 'קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור הבא כדי ליצור סיסמה חדשה:',
    btn: 'אפס סיסמה',
    expiry: 'קישור זה יפוג תוך שעה. אם לא ביקשת שינוי זה, ניתן להתעלם מהודעה זו.',
    fallback: 'אם הכפתור לא עובד, העתק והדבק את הקישור הבא בדפדפן:',
  },
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const lang = getLang(user);
  const txt = passwordResetTexts[lang];
  const resetUrl = `${clientUrl()}/reset-password/${resetToken}`;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.greeting} <strong>${user.nombre}</strong>,</p>
    <p>${txt.body}</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" style="${btnStyle}">${txt.btn}</a>
    </p>
    <p style="color:#666666;font-size:13px;">${txt.expiry}</p>
    <p style="color:#666666;font-size:13px;">${txt.fallback}</p>
    <p style="color:#1565C0;font-size:13px;word-break:break-all;" dir="ltr">${resetUrl}</p>
  `, lang);

  return sendEmail({ email: user.email, name: user.nombre }, txt.subject, html);
};

// ─── 6. Password Changed Confirmation ────────────────────────────────────────

const passwordChangedTexts = {
  es: {
    subject: 'Contrasena actualizada — Ulpan Jerusalem',
    heading: 'Contrasena actualizada',
    greeting: 'Hola',
    body: 'Tu contrasena ha sido restablecida exitosamente.',
    notify: 'Si tu no realizaste este cambio, contactanos de inmediato a',
    afterNotify: 'Ya puedes iniciar sesion con tu nueva contrasena.',
    btn: 'Iniciar Sesion',
  },
  en: {
    subject: 'Password updated — Ulpan Jerusalem',
    heading: 'Password updated',
    greeting: 'Hello',
    body: 'Your password has been successfully reset.',
    notify: 'If you did not make this change, please contact us immediately at',
    afterNotify: 'You can now sign in with your new password.',
    btn: 'Sign In',
  },
  he: {
    subject: 'הסיסמה עודכנה — אולפן ירושלים',
    heading: 'הסיסמה עודכנה',
    greeting: 'שלום',
    body: 'הסיסמה שלך אופסה בהצלחה.',
    notify: 'אם לא ביצעת שינוי זה, צור קשר מיד בכתובת',
    afterNotify: 'כעת ניתן להתחבר עם הסיסמה החדשה.',
    btn: 'התחבר',
  },
};

const sendPasswordChangedEmail = async (user) => {
  const lang = getLang(user);
  const txt = passwordChangedTexts[lang];

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.greeting} <strong>${user.nombre}</strong>,</p>
    <p>${txt.body}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;">${txt.notify} <a href="mailto:info@ulpanjerusalem.com" style="color:#1565C0;">info@ulpanjerusalem.com</a></p>
    </div>
    <p>${txt.afterNotify}</p>
    <p style="text-align:center;">
      <a href="${clientUrl()}/login" style="${btnStyle}">${txt.btn}</a>
    </p>
  `, lang);

  return sendEmail({ email: user.email, name: user.nombre }, txt.subject, html);
};

// ─── 7. Payment Confirmation Email ──────────────────────────────────────────

const paymentConfirmationTexts = {
  es: {
    subject: (curso) => `Pago confirmado: ${curso}`,
    heading: 'Pago confirmado',
    greeting: 'Hola',
    intro: 'Tu pago ha sido procesado exitosamente. Ya estas inscrito/a en el curso.',
    cursoLabel: 'Curso:',
    montoLabel: 'Monto pagado:',
    descuentoLabel: 'Descuento aplicado:',
    cuponLabel: 'Cupon:',
    txLabel: 'ID de transaccion:',
    receipt: 'Adjuntamos el recibo de pago en formato PDF.',
    info: (n) => `El curso cuenta con <strong>${n} ${n === 1 ? 'clase' : 'clases'}</strong>. Podras acceder al material desde tu panel de estudiante. Aprende a tu propio ritmo, desde cualquier lugar.`,
    btn: 'Ver mi curso',
  },
  en: {
    subject: (curso) => `Payment confirmed: ${curso}`,
    heading: 'Payment confirmed',
    greeting: 'Hello',
    intro: 'Your payment has been processed successfully. You are now enrolled in the course.',
    cursoLabel: 'Course:',
    montoLabel: 'Amount paid:',
    descuentoLabel: 'Discount applied:',
    cuponLabel: 'Coupon:',
    txLabel: 'Transaction ID:',
    receipt: 'We have attached the payment receipt as a PDF.',
    info: (n) => `The course includes <strong>${n} ${n === 1 ? 'class' : 'classes'}</strong>. You will be able to access materials from your student dashboard. Learn at your own pace, from anywhere.`,
    btn: 'View my course',
  },
  he: {
    subject: (curso) => `התשלום אושר: ${curso}`,
    heading: 'התשלום אושר',
    greeting: 'שלום',
    intro: 'התשלום שלך עובד בהצלחה. הנך רשום/ה כעת לקורס.',
    cursoLabel: 'קורס:',
    montoLabel: 'סכום ששולם:',
    descuentoLabel: 'הנחה שהוחלה:',
    cuponLabel: 'קופון:',
    txLabel: 'מזהה עסקה:',
    receipt: 'מצורפת קבלת התשלום בפורמט PDF.',
    info: (n) => `הקורס כולל <strong>${n} ${n === 1 ? 'שיעור' : 'שיעורים'}</strong>. תוכל/י לגשת לחומרים מאזור התלמיד. למד בקצב שלך, מכל מקום.`,
    btn: 'צפה בקורס שלי',
  },
};

const sendPaymentConfirmationEmail = async (alumno, curso, payment) => {
  const lang = getLang(alumno);
  const txt = paymentConfirmationTexts[lang];
  const monedaSymbol = { ILS: '₪', USD: '$', EUR: '€' }[payment.moneda] || payment.moneda;
  const cursoTitulo = resolveTranslatable(curso.titulo, lang);
  const numClases = curso.numeroClases || 24;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.greeting} <strong>${alumno.nombre}</strong>,</p>
    <p>${txt.intro}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${txt.cursoLabel}</strong> ${cursoTitulo}</p>
      <p style="margin:5px 0 0;"><strong>${txt.montoLabel}</strong> ${monedaSymbol}${payment.monto.toFixed(2)}</p>
      ${payment.descuento > 0 ? `<p style="margin:5px 0 0;"><strong>${txt.descuentoLabel}</strong> ${monedaSymbol}${payment.descuento.toFixed(2)}</p>` : ''}
      ${payment.cuponCodigo ? `<p style="margin:5px 0 0;"><strong>${txt.cuponLabel}</strong> ${payment.cuponCodigo}</p>` : ''}
      <p style="margin:5px 0 0;"><strong>${txt.txLabel}</strong> ${payment.allpayTransactionId || payment._id}</p>
    </div>
    <p>${txt.receipt}</p>
    <p>${txt.info(numClases)}</p>
    <p style="text-align:center;">
      <a href="${clientUrl()}/alumno/cursos/${curso._id}" style="${btnStyle}">${txt.btn}</a>
    </p>
  `, lang);

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
    txt.subject(cursoTitulo),
    html,
    attachment
  );
};

// ─── 8. Payment Failed Email ────────────────────────────────────────────────

const paymentFailedTexts = {
  es: {
    subject: (curso) => `Problema con tu pago: ${curso}`,
    heading: 'Problema con tu pago',
    greeting: 'Hola',
    intro: 'Lamentablemente hubo un problema al procesar tu pago para el siguiente curso:',
    cursoLabel: 'Curso:',
    retry: 'Puedes intentar realizar el pago nuevamente desde la plataforma.',
    btn: 'Intentar de nuevo',
    contact: 'Si el problema persiste, contactanos a info@ulpanjerusalem.com',
  },
  en: {
    subject: (curso) => `Problem with your payment: ${curso}`,
    heading: 'Problem with your payment',
    greeting: 'Hello',
    intro: 'Unfortunately there was a problem processing your payment for the following course:',
    cursoLabel: 'Course:',
    retry: 'You can try to make the payment again from the platform.',
    btn: 'Try again',
    contact: 'If the problem persists, contact us at info@ulpanjerusalem.com',
  },
  he: {
    subject: (curso) => `בעיה בתשלום: ${curso}`,
    heading: 'בעיה בתשלום',
    greeting: 'שלום',
    intro: 'לצערנו אירעה בעיה בעיבוד התשלום לקורס הבא:',
    cursoLabel: 'קורס:',
    retry: 'ניתן לנסות לבצע את התשלום שוב דרך הפלטפורמה.',
    btn: 'נסה שוב',
    contact: 'אם הבעיה נמשכת, צור קשר ב-info@ulpanjerusalem.com',
  },
};

const sendPaymentFailedEmail = async (alumno, curso) => {
  const lang = getLang(alumno);
  const txt = paymentFailedTexts[lang];
  const cursoTitulo = resolveTranslatable(curso.titulo, lang);

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.greeting} <strong>${alumno.nombre}</strong>,</p>
    <p>${txt.intro}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${txt.cursoLabel}</strong> ${cursoTitulo}</p>
    </div>
    <p>${txt.retry}</p>
    <p style="text-align:center;">
      <a href="${clientUrl()}/cursos/${curso._id}" style="${btnStyle}">${txt.btn}</a>
    </p>
    <p style="color:#666666;font-size:13px;">${txt.contact}</p>
  `, lang);

  return sendEmail({ email: alumno.email, name: alumno.nombre }, txt.subject(cursoTitulo), html);
};

// ─── 9. Admin New Sale Notification ──────────────────────────────────────────

const adminSaleTexts = {
  es: {
    subject: (curso, monto) => `Nueva venta: ${curso} — ${monto}`,
    heading: 'Nueva venta realizada',
    intro: 'Se ha completado un nuevo pago en la plataforma:',
    alumnoLabel: 'Alumno:',
    cursoLabel: 'Curso:',
    montoLabel: 'Monto:',
    descuentoLabel: 'Descuento:',
    cuponLabel: 'Cupon:',
    btn: 'Ver ingresos',
  },
  en: {
    subject: (curso, monto) => `New sale: ${curso} — ${monto}`,
    heading: 'New sale completed',
    intro: 'A new payment has been completed on the platform:',
    alumnoLabel: 'Student:',
    cursoLabel: 'Course:',
    montoLabel: 'Amount:',
    descuentoLabel: 'Discount:',
    cuponLabel: 'Coupon:',
    btn: 'View income',
  },
  he: {
    subject: (curso, monto) => `מכירה חדשה: ${curso} — ${monto}`,
    heading: 'מכירה חדשה הושלמה',
    intro: 'תשלום חדש הושלם בפלטפורמה:',
    alumnoLabel: 'תלמיד/ה:',
    cursoLabel: 'קורס:',
    montoLabel: 'סכום:',
    descuentoLabel: 'הנחה:',
    cuponLabel: 'קופון:',
    btn: 'צפה בהכנסות',
  },
};

const _sendAdminSaleLang = async (admins, alumno, curso, payment, lang) => {
  const txt = adminSaleTexts[lang];
  const monedaSymbol = { ILS: '₪', USD: '$', EUR: '€' }[payment.moneda] || payment.moneda;
  const cursoTitulo = resolveTranslatable(curso.titulo, lang);
  const montoFmt = `${monedaSymbol}${payment.monto.toFixed(2)}`;

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.intro}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${txt.alumnoLabel}</strong> ${alumno.nombre} (${alumno.email})</p>
      <p style="margin:5px 0 0;"><strong>${txt.cursoLabel}</strong> ${cursoTitulo}</p>
      <p style="margin:5px 0 0;"><strong>${txt.montoLabel}</strong> ${montoFmt}</p>
      ${payment.descuento > 0 ? `<p style="margin:5px 0 0;"><strong>${txt.descuentoLabel}</strong> ${monedaSymbol}${payment.descuento.toFixed(2)}</p>` : ''}
      ${payment.cuponCodigo ? `<p style="margin:5px 0 0;"><strong>${txt.cuponLabel}</strong> ${payment.cuponCodigo}</p>` : ''}
    </div>
    <p style="text-align:center;">
      <a href="${clientUrl()}/admin/ingresos" style="${btnStyle}">${txt.btn}</a>
    </p>
  `, lang);

  const destinatarios = admins.map((a) => ({ email: a.email, name: a.nombre }));
  return sendEmail(destinatarios, txt.subject(cursoTitulo, montoFmt), html);
};

const sendAdminNewSaleEmail = async (admins, alumno, curso, payment) => {
  if (!admins || admins.length === 0) return null;
  const groups = groupByLang(admins);
  return Promise.all(
    SUPPORTED_LANGS
      .filter((l) => groups[l].length > 0)
      .map((l) => _sendAdminSaleLang(groups[l], alumno, curso, payment, l))
  );
};

// ─── 10. Maestro New Student Notification ────────────────────────────────────

const maestroNewStudentTexts = {
  es: {
    subject: (curso, alumno) => `Nuevo alumno en ${curso}: ${alumno}`,
    heading: 'Nuevo alumno inscrito',
    greeting: 'Hola',
    intro: 'Un nuevo alumno se ha inscrito en tu curso:',
    alumnoLabel: 'Alumno:',
    cursoLabel: 'Curso:',
    btn: 'Ver curso',
  },
  en: {
    subject: (curso, alumno) => `New student in ${curso}: ${alumno}`,
    heading: 'New student enrolled',
    greeting: 'Hello',
    intro: 'A new student has enrolled in your course:',
    alumnoLabel: 'Student:',
    cursoLabel: 'Course:',
    btn: 'View course',
  },
  he: {
    subject: (curso, alumno) => `תלמיד/ה חדש/ה ב-${curso}: ${alumno}`,
    heading: 'תלמיד/ה חדש/ה נרשם/ה',
    greeting: 'שלום',
    intro: 'תלמיד/ה חדש/ה נרשם/ה לקורס שלך:',
    alumnoLabel: 'תלמיד/ה:',
    cursoLabel: 'קורס:',
    btn: 'צפה בקורס',
  },
};

const sendMaestroNewStudentEmail = async (maestro, alumno, curso) => {
  if (!maestro) return null;
  const lang = getLang(maestro);
  const txt = maestroNewStudentTexts[lang];
  const cursoTitulo = resolveTranslatable(curso.titulo, lang);

  const html = baseTemplate(`
    <h2 style="color:#1565C0;margin-top:0;">${txt.heading}</h2>
    <p>${txt.greeting} <strong>${maestro.nombre}</strong>,</p>
    <p>${txt.intro}</p>
    <div style="${infoBoxStyle}">
      <p style="margin:0;"><strong>${txt.alumnoLabel}</strong> ${alumno.nombre} (${alumno.email})</p>
      <p style="margin:5px 0 0;"><strong>${txt.cursoLabel}</strong> ${cursoTitulo}</p>
    </div>
    <p style="text-align:center;">
      <a href="${clientUrl()}/maestro/cursos/${curso._id}" style="${btnStyle}">${txt.btn}</a>
    </p>
  `, lang);

  return sendEmail(
    { email: maestro.email, name: maestro.nombre },
    txt.subject(cursoTitulo, alumno.nombre),
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
