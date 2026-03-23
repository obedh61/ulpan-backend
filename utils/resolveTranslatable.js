/**
 * Resolves a translatable field to a string.
 * If it's already a string (legacy data), returns it as-is.
 * If it's an object { es, en, he }, returns the value for lang with fallback to 'es'.
 */
const resolveTranslatable = (field, lang = 'es') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field[lang] || field.es || field.en || '';
  }
  return String(field);
};

module.exports = resolveTranslatable;
