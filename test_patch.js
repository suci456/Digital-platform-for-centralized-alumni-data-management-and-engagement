const http = require('http');
const fs = require('fs');
const txt = fs.readFileSync('test_login_out.txt', 'utf8');
const token = txt.split('"token":"')[1].split('"')[0];
const req = http.request({
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/admin/alumni/3/permissions',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.write(JSON.stringify({can_view_students: true, can_message_students: false}));
req.end();
