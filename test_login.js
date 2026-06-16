const http = require('http');
const fs = require('fs');

const data = JSON.stringify({
  email: 'admin@platform.com',
  password: 'admin123'
});

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let out = `statusCode: ${res.statusCode}\n`;

  res.on('data', d => {
    out += d.toString();
  });
  res.on('end', () => {
    fs.writeFileSync('test_login_out.txt', out);
    console.log("Written output to test_login_out.txt");
  });
});

req.on('error', error => {
  fs.writeFileSync('test_login_out.txt', 'Error: ' + error.message);
});

req.write(data);
req.end();
