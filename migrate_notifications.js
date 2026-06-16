const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    db.run("ALTER TABLE notifications ADD COLUMN category TEXT DEFAULT 'General'", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column already exists');
                process.exit(0);
            } else {
                console.error('Error adding column:', err.message);
                db.close();
                process.exit(1);
            }
        } else {
            console.log('Column added successfully');
            db.close();
            process.exit(0);
        }
    });
});
