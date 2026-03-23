/**
 * Migration script: Convert existing string fields to translatable objects.
 *
 * Run with: node server/scripts/migrateTranslatable.js
 *
 * This converts:
 *   Course.titulo (String) → { es: "old value", en: "", he: "" }
 *   Course.descripcion (String) → { es: "old value", en: "", he: "" }
 *   Clase.titulo (String) → { es: "old value", en: "", he: "" }
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // Migrate courses
  const courses = await db.collection('courses').find({}).toArray();
  let courseCount = 0;

  for (const course of courses) {
    const update = {};

    if (typeof course.titulo === 'string') {
      update.titulo = { es: course.titulo, en: '', he: '' };
    }
    if (typeof course.descripcion === 'string') {
      update.descripcion = { es: course.descripcion, en: '', he: '' };
    }

    if (Object.keys(update).length > 0) {
      await db.collection('courses').updateOne(
        { _id: course._id },
        { $set: update }
      );
      courseCount++;
    }
  }

  console.log(`Migrated ${courseCount} courses`);

  // Migrate clases
  const clases = await db.collection('clases').find({}).toArray();
  let claseCount = 0;

  for (const clase of clases) {
    if (typeof clase.titulo === 'string') {
      const es = clase.titulo;
      // Auto-translate "Clase N" or "Lección N" pattern
      const match = es.match(/^(?:Clase|Lección)\s+(\d+)$/i);
      const newEs = match ? `Lección ${match[1]}` : es;
      const en = match ? `Lesson ${match[1]}` : '';
      const he = match ? `שיעור ${match[1]}` : '';

      await db.collection('clases').updateOne(
        { _id: clase._id },
        { $set: { titulo: { es: newEs, en, he } } }
      );
      claseCount++;
    } else if (typeof clase.titulo === 'object') {
      // Fix already-migrated clases: rename "Clase N" → "Lección N" and fill empty en/he
      const es = clase.titulo.es || '';
      const match = es.match(/^(?:Clase|Lección)\s+(\d+)$/i);
      if (match) {
        const update = {};
        if (es.match(/^Clase\s+/i)) update['titulo.es'] = `Lección ${match[1]}`;
        if (!clase.titulo.en || clase.titulo.en.match(/^Class\s+/i)) update['titulo.en'] = `Lesson ${match[1]}`;
        if (!clase.titulo.he) update['titulo.he'] = `שיעור ${match[1]}`;
        if (Object.keys(update).length > 0) {
          await db.collection('clases').updateOne(
            { _id: clase._id },
            { $set: update }
          );
          claseCount++;
        }
      }
    }
  }

  console.log(`Migrated ${claseCount} clases`);
  console.log('Migration complete!');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
