const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: [true, 'El codigo del cupon es obligatorio'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    tipo: {
      type: String,
      enum: ['porcentaje', 'monto_fijo'],
      required: [true, 'El tipo de descuento es obligatorio'],
    },
    descuento: {
      type: Number,
      required: [true, 'El valor del descuento es obligatorio'],
      min: 0,
    },
    cursosAplicables: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    usoMaximo: {
      type: Number,
      default: null,
    },
    usosActuales: {
      type: Number,
      default: 0,
    },
    fechaInicio: {
      type: Date,
      default: null,
    },
    fechaExpiracion: {
      type: Date,
      default: null,
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
