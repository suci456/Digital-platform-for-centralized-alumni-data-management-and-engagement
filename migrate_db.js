const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
    process.exit(1);
  }
});

console.log("Running migrations...");

db.serialize(() => {
  const columnsToAdd = [
    { table: 'users', col: 'skills TEXT' },
    { table: 'users', col: 'projects TEXT' },
    { table: 'users', col: 'linkedin_url TEXT' },
    { table: 'alumni_profiles', col: 'experience_years INTEGER' },
    { table: 'alumni_profiles', col: 'achievements TEXT' },
    { table: 'alumni_profiles', col: 'company_history TEXT' }
  ];

  columnsToAdd.forEach(({ table, col }) => {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${col}`, (err) => {
      if (err) {
        // It's expected to fail if the column already exists
        if (!err.message.includes('duplicate column name')) {
          console.error(`Error adding ${col} to ${table}:`, err.message);
        } else {
          console.log(`Column ${col} already exists in ${table}.`);
        }
      } else {
        console.log(`Successfully added ${col} to ${table}.`);
      }
    });
  });
});

// Close database connection after a brief wait to ensure serialize finishes
setTimeout(() => {
  db.close(() => {
    console.log("Migration finished.");
  });
}, 2000);
