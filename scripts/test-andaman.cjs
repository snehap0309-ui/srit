const https = require('https');

const query = `[out:json];area["name:en"~"Andaman"]["admin_level"];out;`;
const data = new URLSearchParams({ data: query }).toString();
const options = {
  hostname: 'overpass-api.de',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(data),
  },
};
const req = https.request(options, (res) => {
  let result = '';
  res.on('data', chunk => result += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(result);
      console.log(json.elements.map(e => ({ name: e.tags['name:en'], admin_level: e.tags.admin_level })));
    } catch (e) { console.log(result); }
  });
});
req.write(data); req.end();
