/**
 * Verify seeded login credentials against the API.
 * Usage: node scripts/verify-credentials.cjs [baseUrl]
 * Default baseUrl: http://localhost:5000/api/v1
 */
const BASE = (process.argv[2] || process.env.API_BASE || 'http://localhost:5000/api/v1').replace(/\/$/, '');

const ACCOUNTS = [
  { label: 'Admin', email: 'shivaay@palsafar.com', password: 'google', role: 'ADMIN' },
  { label: 'Tourist', email: 'user@palsafar.com', password: 'User@123', role: 'USER' },
  { label: 'Vendor Street Story', email: 'streetstory@palsafar.com', password: 'Vendor@123', role: 'VENDOR', vendorCheck: true },
  { label: 'Creator Rahul', email: 'rahul.chelani@palsafar.com', password: 'Creator@123', role: 'CONTENT_CREATOR' },
];

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function getVendorMe(token) {
  const res = await fetch(`${BASE}/vendors/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  console.log(`Verifying credentials against ${BASE}\n`);
  let failed = 0;

  for (const acct of ACCOUNTS) {
    const { status, json } = await login(acct.email, acct.password);
    const ok = status === 200 && json?.success;
    const permission = json?.data?.user?.permission || json?.data?.user?.role;
    const match = !acct.role || permission === acct.role || (Array.isArray(json?.data?.user?.roles) && json.data.user.roles.includes(acct.role));

    if (!ok || !match) {
      failed++;
      console.log(`FAIL  ${acct.label} (${acct.email}) — status=${status} permission=${permission || 'n/a'}`);
      if (json?.message) console.log(`      ${json.message}`);
      continue;
    }

    let vendorOk = true;
    if (acct.vendorCheck) {
      const token = json.data.accessToken;
      const v = await getVendorMe(token);
      vendorOk = v.status === 200 && !!v.json?.data;
      if (!vendorOk) {
        failed++;
        console.log(`FAIL  ${acct.label} — login ok but /vendors/me failed (${v.status})`);
        continue;
      }
    }

    console.log(`OK    ${acct.label} (${acct.email}) — ${permission}`);
  }

  console.log(failed === 0 ? '\nAll credentials OK' : `\n${failed} account(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
