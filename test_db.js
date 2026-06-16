const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./platform.db');
db.all('SELECT * FROM users', (err, rows) => {
    if(err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
});
