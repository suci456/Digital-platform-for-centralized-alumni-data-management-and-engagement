const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);
db.all("PRAGMA table_info(alumni_profiles)", (err, rows) => {
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
});
