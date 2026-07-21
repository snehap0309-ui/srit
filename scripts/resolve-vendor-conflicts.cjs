const fs = require('fs');
const path = 'e:/PalSafar/src/screens/VendorDashboardScreen.tsx';
let src = fs.readFileSync(path, 'utf8');
const before = (src.match(/^<<<<<<< /gm) || []).length;
// Prefer HEAD (cream/bronze vendor palette)
src = src.replace(
  /^<<<<<<< HEAD\r?\n([\s\S]*?)^=======\r?\n([\s\S]*?)^>>>>>>> [^\r\n]*\r?\n/gm,
  '$1',
);
const after = (src.match(/^<<<<<<< |^=======|^>>>>>>> /gm) || []).length;
fs.writeFileSync(path, src);
console.log('conflicts before:', before, 'markers left:', after);
