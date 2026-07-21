/**
 * One-time bootstrap for production/staging when canonical accounts are missing or misconfigured.
 * Requires admin credentials. Safe to re-run (idempotent).
 *
 * Usage: node scripts/bootstrap-remote-credentials.cjs [baseUrl]
 */
const BASE = (process.argv[2] || 'https://palsafar-xwui.onrender.com/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = 'shivaay@palsafar.com';
const ADMIN_PASSWORD = 'google';

const VENDOR_ACCOUNTS = [
  {
    email: 'vendor_user_1@palsafar.com',
    password: 'Vendor@123',
    businessName: 'Madan Mahal Heritage Cafe',
    businessType: 'restaurant',
    city: 'Jabalpur',
    lat: 23.161,
    lng: 79.902,
  },
  {
    email: 'vendor_user_2@palsafar.com',
    password: 'Vendor@123',
    businessName: 'Goolgappa Express',
    businessType: 'restaurant',
    city: 'Jabalpur',
    lat: 23.175,
    lng: 79.932,
  },
];

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function login(email, password) {
  const { status, json } = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (status !== 200 || !json?.data?.accessToken) {
    throw new Error(json?.message || `Login failed (${status})`);
  }
  return json.data.accessToken;
}

async function ensureVendorUser(adminToken, vendor) {
  let vendorToken;
  try {
    vendorToken = await login(vendor.email, vendor.password);
  } catch (err) {
    console.log(`  SKIP ${vendor.email}: user missing (${err.message}). Deploy server to sync credentials.`);
    return;
  }

  const me = await api('/vendors/me', { token: vendorToken });
  if (me.status === 200 && me.json?.data?.id) {
    const v = me.json.data;
    console.log(`  OK ${vendor.email} → ${v.businessName} (${v.status})`);
    if (v.status !== 'APPROVED') {
      await api(`/vendors/${v.id}/verify`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      });
      console.log(`  Approved ${v.businessName}`);
    }
    return;
  }

  console.log(`  Registering vendor profile for ${vendor.email}...`);
  const reg = await api('/vendors/register', {
    method: 'POST',
    token: vendorToken,
    body: {
      businessName: vendor.businessName,
      businessType: vendor.businessType,
      phone: '+919876543210',
      address: `Near Center, ${vendor.city}`,
      city: vendor.city,
      state: 'Madhya Pradesh',
      latitude: vendor.lat,
      longitude: vendor.lng,
      description: `${vendor.businessName} — PalSafar test vendor`,
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=480',
    },
  });

  if (reg.status !== 201 && reg.status !== 200) {
    throw new Error(reg.json?.message || `Register failed (${reg.status})`);
  }

  const vendorId = reg.json?.data?.id;
  if (vendorId) {
    await api(`/vendors/${vendorId}/verify`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED' },
    });
    console.log(`  Created & approved ${vendor.businessName}`);
  }
}

async function fixTouristRole(adminToken) {
  const users = await api('/users?search=tourist@palsafar.com&limit=20', { token: adminToken });
  const list = Array.isArray(users.json?.data) ? users.json.data : users.json?.data?.users || [];
  const tourist = list.find((u) => u.email === 'tourist@palsafar.com');
  if (!tourist) {
    console.log('  tourist@palsafar.com not found — will be created on next server deploy');
    return;
  }
  const touristRoles = Array.isArray(tourist.roles) ? tourist.roles : (tourist.role ? [tourist.role] : []);
  if (touristRoles.includes('USER')) {
    console.log('  tourist@palsafar.com already has USER role');
    return;
  }
  const patch = await api(`/users/${tourist.id}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'USER' },
  });
  if (patch.status === 200) {
    console.log(`  Fixed tourist@palsafar.com roles: ${touristRoles.join(',') || 'none'} → USER`);
  } else {
    console.log(`  Could not fix tourist role: ${patch.json?.message || patch.status}`);
  }
}

async function main() {
  console.log(`\n=== Bootstrap remote credentials ===`);
  console.log(`API: ${BASE}\n`);

  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Admin login OK\n');

  console.log('Fixing tourist account role...');
  await fixTouristRole(adminToken);

  console.log('\nEnsuring vendor test accounts...');
  for (const vendor of VENDOR_ACCOUNTS) {
    try {
      await ensureVendorUser(adminToken, vendor);
    } catch (err) {
      console.log(`  FAIL ${vendor.email}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\nDone. Re-run: npm run verify:credentials --', BASE, '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
