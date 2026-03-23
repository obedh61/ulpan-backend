const mongoose = require('mongoose');

const videoViewSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'El video es obligatorio'],
    },
    alumnoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El alumno es obligatorio'],
    },
    duracionVista: {
      type: Number,
      default: 0,
    },
    porcentajeVisto: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completado: {
      type: Boolean,
      default: false,
    },
    fechaVista: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

videoViewSchema.index({ videoId: 1, alumnoId: 1 }, { unique: true });
videoViewSchema.index({ videoId: 1 });
videoViewSchema.index({ alumnoId: 1 });

module.exports = mongoose.model('VideoView', videoViewSchema);
