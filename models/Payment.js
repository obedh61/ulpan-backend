const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    alumnoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El alumno es obligatorio'],
    },
    cursoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'El curso es obligatorio'],
    },
    monto: {
      type: Number,
      required: [true, 'El monto es obligatorio'],
    },
    montoOriginal: {
      type: Number,
      required: true,
    },
    moneda: {
      type: String,
      enum: ['ILS', 'USD', 'EUR'],
      default: 'ILS',
    },
    estado: {
      type: String,
      enum: ['pendiente', 'completado', 'fallido', 'reembolsado'],
      default: 'pendiente',
    },
    metodoPago: {
      type: String,
      default: 'allpay',
    },
    allpayTransactionId: {
      type: String,
      default: null,
    },
    allpayPaymentUrl: {
      type: String,
      default: null,
    },
    cuponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    cuponCodigo: {
      type: String,
      default: null,
    },
    descuento: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ alumnoId: 1, cursoId: 1 });
paymentSchema.index({ allpayTransactionId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
