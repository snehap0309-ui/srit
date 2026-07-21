import { growthAnalyticsService } from './src/modules/growth-analytics/growthAnalytics.service';
import { cityAnalyticsService } from './src/modules/city-analytics/cityAnalytics.service';
import { revenueAnalyticsService } from './src/modules/revenue-analytics/revenueAnalytics.service';
import { prisma } from './src/config/database';

async function test() {
  try {
    console.log('Testing growth analytics...');
    await growthAnalyticsService.getDashboard({});
    console.log('Growth analytics OK');
  } catch(e) {
    console.error('Growth Analytics Error:', e);
  }

  try {
    console.log('Testing city analytics...');
    await cityAnalyticsService.getDashboard({});
    console.log('City analytics OK');
  } catch(e) {
    console.error('City Analytics Error:', e);
  }

  try {
    console.log('Testing revenue analytics...');
    await revenueAnalyticsService.getDashboard({});
    console.log('Revenue analytics OK');
  } catch(e) {
    console.error('Revenue Analytics Error:', e);
  }
}

test().finally(() => prisma.$disconnect());
