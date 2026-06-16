const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all('SELECT name, email, role FROM users', [], (err, rows) => {
  if (err) {
    fs.writeFileSync('users.json', JSON.stringify({ error: err.message }));
  } else {
    fs.writeFileSync('users.json', JSON.stringify(rows, null, 2));
  }
  db.close();
});
