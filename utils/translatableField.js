const mongoose = require('mongoose');

const translatableField = (required = false) => ({
  type: new mongoose.Schema(
    {
      es: { type: String, default: '' },
      en: { type: String, default: '' },
      he: { type: String, default: '' },
    },
    { _id: false }
  ),
  required,
  default: () => ({ es: '', en: '', he: '' }),
});

module.exports = translatableField;
