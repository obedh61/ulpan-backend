const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
  {
    cursoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'El curso es obligatorio'],
    },
    alumnoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El alumno es obligatorio'],
    },
    fechaInscripcion: {
      type: Date,
      default: Date.now,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    pagado: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ cursoId: 1, alumnoId: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
