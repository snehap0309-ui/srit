import { ensureSeedData } from '../../config/db-seed';

export async function setup() {
  await ensureSeedData();
}
