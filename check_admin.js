const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('database.sqlite');
db.all('SELECT id, email, role FROM users WHERE role="Admin"', [], (err, rows) => {
    if (err) {
        fs.writeFileSync('admin_dump.txt', 'Error: ' + err.message);
    } else {
        fs.writeFileSync('admin_dump.txt', JSON.stringify(rows, null, 2));
    }
});
