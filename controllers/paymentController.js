const Payment = require('../models/Payment');
const Course = require('../models/Course');
const Coupon = require('../models/Coupon');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { createTransaction, checkPaymentStatus, verifyWebhookSignature } = require('../config/allpay');
const { sendPaymentConfirmationEmail, sendPaymentFailedEmail, sendCourseEnrollmentEmail, sendAdminNewSaleEmail, sendMaestroNewStudentEmail } = require('../services/emailService');
const { generateReceipt } = require('../services/pdfService');

// POST /api/payments/create
const crearPago = async (req, res) => {
  try {
    const { cursoId, cuponCodigo, tashlumim, telefono } = req.body;

    const course = await Course.findById(cursoId);
    if (!course || !course.activo) {
      return res.status(404).json({ message: 'Curso no encontrado o inactivo' });
    }

    if (course.esGratuito || course.precio <= 0) {
      return res.status(400).json({ message: 'Este curso es gratuito, no requiere pago' });
    }

    // Verificar si ya esta inscrito
    const existeInscripcion = await Enrollment.findOne({
      cursoId,
      alumnoId: req.user._id,
    });
    if (existeInscripcion) {
      return res.status(400).json({ message: 'Ya estas inscrito en este curso' });
    }

    // Verificar si hay un pago pendiente o completado
    const pagoExistente = await Payment.findOne({
      cursoId,
      alumnoId: req.user._id,
      estado: { $in: ['pendiente', 'completado'] },
    });
    if (pagoExistente && pagoExistente.estado === 'completado') {
      return res.status(400).json({ message: 'Ya tienes un pago completado para este curso' });
    }

    let monto = course.precio;
    let montoOriginal = course.precio;
    let descuento = 0;
    let cuponId = null;
    let cuponCodigoFinal = null;

    // Validar y aplicar cupon
    if (cuponCodigo) {
      const cupon = await Coupon.findOne({
        codigo: cuponCodigo.toUpperCase(),
        activo: true,
      });

      if (!cupon) {
        return res.status(400).json({ message: 'Cupon no valido' });
      }

      const now = new Date();
      if (cupon.fechaInicio && now < cupon.fechaInicio) {
        return res.status(400).json({ message: 'El cupon aun no esta activo' });
      }
      if (cupon.fechaExpiracion && now > cupon.fechaExpiracion) {
        return res.status(400).json({ message: 'El cupon ha expirado' });
      }
      if (cupon.usoMaximo !== null && cupon.usosActuales >= cupon.usoMaximo) {
        return res.status(400).json({ message: 'El cupon ha alcanzado su limite de uso' });
      }
      if (cupon.cursosAplicables.length > 0 && !cupon.cursosAplicables.some((id) => id.toString() === cursoId)) {
        return res.status(400).json({ message: 'El cupon no aplica para este curso' });
      }

      if (cupon.tipo === 'porcentaje') {
        descuento = Math.round((monto * cupon.descuento) / 100 * 100) / 100;
      } else {
        descuento = cupon.descuento;
      }

      monto = Math.max(0, monto - descuento);
      cuponId = cupon._id;
      cuponCodigoFinal = cupon.codigo;
    }

    // Si el monto final es 0 (100% descuento), crear inscripcion directamente
    if (monto === 0) {
      const payment = await Payment.create({
        alumnoId: req.user._id,
        cursoId,
        monto: 0,
        montoOriginal,
        moneda: course.moneda,
        estado: 'completado',
        cuponId,
        cuponCodigo: cuponCodigoFinal,
        descuento,
      });

      await Enrollment.create({
        cursoId,
        alumnoId: req.user._id,
        paymentId: payment._id,
        pagado: true,
      });

      if (cuponId) {
        await Coupon.findByIdAndUpdate(cuponId, { $inc: { usosActuales: 1 } });
      }

      sendPaymentConfirmationEmail(req.user, course, payment).catch((err) =>
        console.error('Error enviando payment email:', err)
      );

      // Notificar admins y maestro
      User.find({ rol: 'admin' }).select('nombre email').then((admins) => {
        sendAdminNewSaleEmail(admins, req.user, course, payment).catch((err) =>
          console.error('Error enviando admin sale email:', err)
        );
      });
      if (course.maestroId) {
        User.findById(course.maestroId).select('nombre email').then((maestro) => {
          sendMaestroNewStudentEmail(maestro, req.user, course).catch((err) =>
            console.error('Error enviando maestro new student email:', err)
          );
        });
      }

      return res.json({ paymentId: payment._id, free: true });
    }

    // Crear pago en la base de datos
    const payment = await Payment.create({
      alumnoId: req.user._id,
      cursoId,
      monto,
      montoOriginal,
      moneda: course.moneda,
      cuponId,
      cuponCodigo: cuponCodigoFinal,
      descuento,
    });

    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

    // Guardar teléfono en el perfil del usuario si lo proporcionó
    if (telefono && !req.user.telefono) {
      req.user.telefono = telefono;
      req.user.save({ validateBeforeSave: false }).catch((err) =>
        console.error('Error guardando telefono:', err)
      );
    }

    // Crear transaccion en Allpay (API real)
    const clientPhone = telefono || req.user.telefono || undefined;
    const allpayResponse = await createTransaction({
      amount: monto,
      currency: course.moneda,
      description: `Curso: ${course.titulo}`,
      paymentId: payment._id.toString(),
      successUrl: `${frontendUrl}/alumno/pago-resultado?paymentId=${payment._id}&status=success`,
      failureUrl: `${frontendUrl}/alumno/pago-resultado?paymentId=${payment._id}&status=failed`,
      webhookUrl: `${backendUrl}/api/payments/webhook`,
      clientName: req.user.nombre,
      clientEmail: req.user.email,
      clientPhone,
      payments: tashlumim && tashlumim > 1 ? Math.min(Math.max(Math.floor(tashlumim), 2), 12) : undefined,
    });

    // Allpay retorna payment_page_url con la URL del formulario de pago
    const paymentUrl = allpayResponse.payment_page_url || allpayResponse.payment_url || allpayResponse.url;

    if (paymentUrl) {
      payment.allpayPaymentUrl = paymentUrl;
    }
    if (allpayResponse.transaction_id || allpayResponse.id) {
      payment.allpayTransactionId = allpayResponse.transaction_id || allpayResponse.id;
    }
    await payment.save();

    res.json({
      paymentId: payment._id,
      paymentUrl: paymentUrl,
    });
  } catch (error) {
    console.error('Error creando pago:', error);
    res.status(500).json({ message: 'Error al crear el pago', error: error.message });
  }
};

// Helper: procesar pago completado (usado por webhook y verificacion)
const completarPago = async (payment) => {
  payment.estado = 'completado';
  await payment.save();

  // Crear inscripcion
  const existeInscripcion = await Enrollment.findOne({
    cursoId: payment.cursoId,
    alumnoId: payment.alumnoId,
  });

  if (!existeInscripcion) {
    await Enrollment.create({
      cursoId: payment.cursoId,
      alumnoId: payment.alumnoId,
      paymentId: payment._id,
      pagado: true,
    });
  }

  // Incrementar uso del cupon
  if (payment.cuponId) {
    await Coupon.findByIdAndUpdate(payment.cuponId, { $inc: { usosActuales: 1 } });
  }

  // Enviar emails
  const [alumno, curso] = await Promise.all([
    User.findById(payment.alumnoId),
    Course.findById(payment.cursoId),
  ]);

  if (alumno && curso) {
    sendPaymentConfirmationEmail(alumno, curso, payment).catch((err) =>
      console.error('Error enviando payment confirmation email:', err)
    );

    User.find({ rol: 'admin' }).select('nombre email').then((admins) => {
      sendAdminNewSaleEmail(admins, alumno, curso, payment).catch((err) =>
        console.error('Error enviando admin sale email:', err)
      );
    });
    if (curso.maestroId) {
      const maestroId = curso.maestroId._id || curso.maestroId;
      User.findById(maestroId).select('nombre email').then((maestro) => {
        sendMaestroNewStudentEmail(maestro, alumno, curso).catch((err) =>
          console.error('Error enviando maestro new student email:', err)
        );
      });
    }
  }
};

// POST /api/payments/webhook (publico, sin auth)
// Allpay envia: order_id, status (0=no pagado, 1=pagado), amount, sign, etc.
const webhookAllpay = async (req, res) => {
  try {
    // Verificar firma SHA256 del webhook
    if (!verifyWebhookSignature(req.body)) {
      return res.status(400).json({ message: 'Firma invalida' });
    }

    const { order_id, status } = req.body;

    const payment = await Payment.findById(order_id);
    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    // Idempotencia: si ya esta completado, no procesar de nuevo
    if (payment.estado === 'completado') {
      return res.json({ message: 'Pago ya procesado' });
    }

    // Allpay usa status: 1 = pagado, 0 = no pagado
    const isPaid = status === 1 || status === '1';

    if (isPaid) {
      await completarPago(payment);
    } else {
      payment.estado = 'fallido';
      await payment.save();

      const [alumno, curso] = await Promise.all([
        User.findById(payment.alumnoId),
        Course.findById(payment.cursoId),
      ]);

      if (alumno && curso) {
        sendPaymentFailedEmail(alumno, curso).catch((err) =>
          console.error('Error enviando payment failed email:', err)
        );
      }
    }

    res.json({ message: 'Webhook procesado' });
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).json({ message: 'Error procesando webhook' });
  }
};

// GET /api/payments/verify/:paymentId
const verificarPago = async (req, res) => {
  try {
    let payment = await Payment.findById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    if (payment.alumnoId.toString() !== req.user._id.toString() && req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Fallback: si sigue pendiente, consultar Allpay directamente
    if (payment.estado === 'pendiente') {
      try {
        const allpayStatus = await checkPaymentStatus(payment._id.toString());
        console.log('Allpay status response:', JSON.stringify(allpayStatus));
        const isPaid = allpayStatus.status === 1 || allpayStatus.status === '1';

        if (isPaid) {
          await completarPago(payment);
          payment = await Payment.findById(req.params.paymentId);
        }
        // No marcar como fallido desde aquí — solo el webhook tiene autoridad para eso
      } catch (err) {
        console.error('Error consultando Allpay status:', err.message);
      }
    }

    // Re-fetch con populate para la respuesta
    payment = await Payment.findById(req.params.paymentId)
      .populate('cursoId', 'titulo')
      .populate('alumnoId', 'nombre email');

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error al verificar pago', error: error.message });
  }
};

// GET /api/payments/mis-pagos
const getMisPagos = async (req, res) => {
  try {
    const pagos = await Payment.find({ alumnoId: req.user._id })
      .populate('cursoId', 'titulo')
      .sort({ createdAt: -1 });

    res.json(pagos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener pagos', error: error.message });
  }
};

// GET /api/payments/:id/receipt
const getReceipt = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('alumnoId', 'nombre email')
      .populate('cursoId', 'titulo');

    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    if (payment.alumnoId._id.toString() !== req.user._id.toString() && req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const pdfBuffer = await generateReceipt(payment);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="recibo-${payment._id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generando recibo:', error);
    res.status(500).json({ message: 'Error al generar el recibo', error: error.message });
  }
};

module.exports = { crearPago, webhookAllpay, verificarPago, getMisPagos, getReceipt };
