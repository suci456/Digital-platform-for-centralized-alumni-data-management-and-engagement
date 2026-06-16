const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');

const db = new sqlite3.Database('database.sqlite');
const logFile = 'force_log.txt';

function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
}

async function fix() {
    try {
        log("Started script");
        const hash = await bcrypt.hash('admin123', 10);
        log("Hash generated");
        db.run("UPDATE users SET password = ? WHERE role = 'Admin'", [hash], function(err) {
            if(err) log("Error: " + err.message);
            else log("Success! Updated " + this.changes + " rows.");
        });
    } catch(e) {
        log("Exception: " + e.message);
    }
}

fix();
