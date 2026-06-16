const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Starting migration: Adding granular permissions to alumni_profiles...');

    // Check if columns exist first
    db.all("PRAGMA table_info(alumni_profiles)", (err, columns) => {
        if (err) {
            console.error('Error checking table info:', err.message);
            process.exit(1);
        }

        const columnNames = columns.map(c => c.name);
        
        const addCanView = !columnNames.includes('can_view_students');
        const addCanMessage = !columnNames.includes('can_message_students');

        if (addCanView) {
            db.run("ALTER TABLE alumni_profiles ADD COLUMN can_view_students BOOLEAN DEFAULT 0", (err) => {
                if (err) console.error('Error adding can_view_students:', err.message);
                else console.log('Added column can_view_students');
            });
        }

        if (addCanMessage) {
            db.run("ALTER TABLE alumni_profiles ADD COLUMN can_message_students BOOLEAN DEFAULT 0", (err) => {
                if (err) console.error('Error adding can_message_students:', err.message);
                else console.log('Added column can_message_students');
            });
        }

        // Optional: Sync with existing permissions table
        if (addCanView || addCanMessage) {
            db.all("SELECT alumni_id, status FROM permissions", (err, perms) => {
                if (!err && perms) {
                    perms.forEach(p => {
                        const val = p.status === 'Granted' ? 1 : 0;
                        db.run("UPDATE alumni_profiles SET can_view_students = ?, can_message_students = ? WHERE user_id = ?", [val, val, p.alumni_id]);
                    });
                }
            });
        }

        console.log('Migration completed.');
    });
});
