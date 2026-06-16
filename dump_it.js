const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');
db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const fs = require('fs');
  fs.writeFileSync('schema_out.txt', JSON.stringify(rows, null, 2));
  db.close();
});
