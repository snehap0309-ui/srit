import { logger } from '../../config/logger';
import { walletService } from '../wallet/wallet.service';
import { pointRulesService } from '../point-rules/pointRules.service';

export async function awardDailyReward(userId: string): Promise<number> {
  const RULE_KEY = 'daily_login';
  
  try {
    const isLimitReached = await pointRulesService.checkDailyLimit(userId, RULE_KEY);
    if (isLimitReached) return 0;

    const onCooldown = await pointRulesService.checkCooldown(userId, RULE_KEY);
    if (onCooldown) return 0;

    const rule = await pointRulesService.getPointsForAction(RULE_KEY);
    if (!rule) return 0;

    await walletService.earn(userId, rule.points, 'daily_login', undefined, 'LOGIN_REWARD');
    
    logger.info({ userId, amount: rule.points }, 'Daily login reward awarded via rules');
    return rule.points;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to process daily login reward');
    return 0;
  }
}
