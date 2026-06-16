const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);
const logFile = path.resolve(__dirname, 'jslog.txt');

function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
}

log("Starting seed_admin.js script");

async function seed() {
    log("Inside seed function");
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        log("Hash generated");
        
        db.all('SELECT id, email, role FROM users', [], (err, rows) => {
            if (err) return log("Error selecting: " + err.message);
            
            log("Existing users count: " + (rows ? rows.length : 0));
            if (rows) {
                 rows.forEach(r => log(r.email + " " + r.role));
            }
            
            db.run(
                `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
                 ON CONFLICT(email) DO UPDATE SET password = excluded.password`,
                ['System Administrator', 'admin@platform.com', hashedPassword, 'Admin'],
                function(err) {
                    if (err) {
                        log("Error inserting platform admin: " + err.message);
                    } else {
                        log('Admin account ready: admin@platform.com / admin123');
                    }
                    
                    db.run(
                        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
                         ON CONFLICT(email) DO UPDATE SET password = excluded.password`,
                        ['System Administrator', 'admin@gmail.com', hashedPassword, 'Admin'],
                        function(err2) {
                             if(err2) log("Error with gmail admin: " + err2.message);
                             else log('Admin account ready: admin@gmail.com / admin123');
                        }
                    );
                }
            );
        });
    } catch (e) {
        log("Exception: " + e.message);
    }
}

seed();
