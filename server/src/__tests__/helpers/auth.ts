import request from 'supertest';
import app from '../../app';

export type SeededAuthRole = 'USER' | 'ADMIN' | 'VENDOR' | 'CONTENT_CREATOR';

export async function getAuthToken(role: SeededAuthRole = 'USER'): Promise<string> {
  const email = role === 'ADMIN'
    ? 'shivaay@palsafar.com'
    : role === 'VENDOR'
      ? 'streetstory@palsafar.com'
      : role === 'CONTENT_CREATOR'
        ? 'rahul.chelani@palsafar.com'
        : 'user@palsafar.com';
  const password = role === 'USER'
    ? 'User@123'
    : role === 'ADMIN'
      ? 'google'
      : role === 'CONTENT_CREATOR'
        ? 'Creator@123'
        : 'Vendor@123';

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (res.status !== 200) {
    console.error(`Login failed for ${role}:`, res.status, res.body);
  }

  return res.body.data?.accessToken || '';
}
