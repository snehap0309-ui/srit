import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.PALSAFAR_API_URL || 'http://localhost:5000/api/v1';
const STATUS_DIR = path.resolve(__dirname, '..', 'status');

async function api(method, path, token, body, isForm) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function uploadVideo(token, filePath) {
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: 'video/mp4' });
  const form = new FormData();
  form.append('video', blob, path.basename(filePath));
  const data = await api('POST', '/upload/video', token, form, true);
  return data.data.url;
}

async function ensureCreator(token, currentUserId) {
  const res = await fetch(`${API}/social/creators/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: 'shivaay_admin',
      fullName: 'Shivaay Admin',
      bio: 'Admin account for PalSafar. Managing platform content and reels.',
      travelCategories: ['culture', 'heritage', 'nature'],
      applicationReason: 'Administrator managing platform content and reels for PalSafar travel app.',
    }),
  });

  let profileId = null;

  if (res.status === 400) {
    console.log('  Creator application already exists, fetching list...');
    const list = await api('GET', '/social/admin/creators', token);
    const myId = currentUserId;
    const profile = list?.data?.find(p => p.userId === myId);
    if (!profile) throw new Error('Could not find existing creator profile');
    profileId = profile.id;
    console.log(`  Found profile: ${profileId} (${profile.status})`);
  } else if (!res.ok) {
    throw new Error(`Apply creator failed (${res.status}): ${await res.text()}`);
  } else {
    const data = await res.json();
    profileId = data.data?.id;
    console.log('  Creator application submitted!');
  }

  if (profileId) {
    console.log('  Approving creator profile...');
    await api('PATCH', `/social/admin/creators/${profileId}/verify`, token, { status: 'APPROVED' });
    console.log('  Approved!');
  }
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set');
    process.exit(1);
  }
  console.log('Logging in as admin...');
  const loginData = await api('POST', '/auth/login', null, { email: adminEmail, password: adminPassword });
  const token = loginData.data.accessToken;
  console.log('  OK\n');

  // Ensure admin has an approved creator profile
  console.log('Checking creator profile...');
  await ensureCreator(token, loginData.data.user.id);
  console.log();

  // Upload videos
  const files = fs.readdirSync(STATUS_DIR).filter(f => f.endsWith('.mp4'));
  console.log(`Found ${files.length} videos\n`);

  const uploaded = [];
  for (const file of files) {
    const filePath = path.join(STATUS_DIR, file);
    const name = path.parse(file).name;
    console.log(`Uploading ${file}...`);
    try {
      const url = await uploadVideo(token, filePath);
      console.log(`  -> ${url}`);
      uploaded.push({ file, name, url });
    } catch (e) {
      console.error(`  Failed: ${e.message}`);
    }
  }

  if (uploaded.length === 0) {
    console.error('No videos uploaded');
    process.exit(1);
  }

  // Create reels
  console.log('\n--- Creating reels ---');
  for (const u of uploaded) {
    try {
      const data = await api('POST', '/social/reels', token, {
        videoUrl: u.url,
        title: u.name.slice(0, 200),
        description: `Status video - ${u.name}`,
      });
      console.log(`  ${u.file} -> Reel ${data.data.id}`);
    } catch (e) {
      console.error(`  ${u.file}: ${e.message}`);
    }
  }

  console.log('\nDone!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
