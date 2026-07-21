const https = require('https');
const query = `[out:json]; area["name:en"="Tamil Nadu"]["admin_level"="4"]; out;`;
const data = new URLSearchParams({ data: query }).toString();
const options = { hostname: 'overpass-api.de', path: '/api/interpreter', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) } };
const req = https.request(options, (res) => { let result = ''; res.on('data', chunk => result+=chunk); res.on('end', () => console.log(result)); });
req.write(data); req.end();
