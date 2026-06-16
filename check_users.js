const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../database.sqlite'));

db.all('SELECT id, name, email, role FROM users', [], (err, rows) => {
    if (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
    console.log('--- USERS ---');
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
