const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
const fs = require('fs');

db.run("UPDATE users SET email = 'admin@platform.com' WHERE role = 'Admin'", function(err) {
    if(err) fs.writeFileSync('fix_db_log.txt', "Error: " + err.message);
    else fs.writeFileSync('fix_db_log.txt', "Success! Updated email to admin@platform.com. Rows affected: " + this.changes);
});
