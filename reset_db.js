const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
console.log(`Resetting database at: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

async function resetDB() {
    console.log('Starting total database reset...');
    
    const tables = [
        'job_applications',
        'mentorship_requests',
        'applications',
        'resumes',
        'messages',
        'notifications',
        'jobs',
        'permissions',
        'alumni_profiles',
        'users'
    ];

    db.serialize(async () => {
        db.run('BEGIN TRANSACTION');
        
        try {
            // Delete all records from all tables
            for (const table of tables) {
                console.log(`Cleaning table: ${table}`);
                db.run(`DELETE FROM ${table}`);
                // Reset autoincrement
                db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, [table]);
            }

            // Create fresh admin account
            const hashedPassword = await bcrypt.hash('admin123', 10);
            db.run(
                `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
                ['System Administrator', 'admin@gmail.com', hashedPassword, 'Admin'],
                function(err) {
                    if (err) {
                        console.error('Error creating admin:', err);
                        db.run('ROLLBACK');
                    } else {
                        console.log('Fresh Admin account created: admin@gmail.com / admin123');
                        db.run('COMMIT');
                        console.log('Database reset complete!');
                    }
                    db.close();
                }
            );
        } catch (err) {
            console.error('Reset failed:', err);
            db.run('ROLLBACK');
            db.close();
        }
    });
}

resetDB();
