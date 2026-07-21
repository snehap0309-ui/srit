import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { registerSchema, loginSchema, refreshSchema, logoutSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, changePasswordSchema, deleteAccountSchema, activeModeSchema, activeRoleAliasSchema } from './auth.validation';
import { loginLimiter, registerLimiter, refreshLimiter, forgotPasswordLimiter, resetPasswordLimiter } from '../../config/rateLimit';

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', refreshLimiter, validate(refreshSchema, 'body'), authController.refresh);
router.post('/logout', validate(logoutSchema, 'body'), authController.logout);
router.get('/me', authenticate, authController.getProfile);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.patch('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.patch('/password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.get('/account/deletion-info', authenticate, authController.getDeletionInfo);
router.delete('/account', authenticate, validate(deleteAccountSchema), authController.deleteAccount);
router.patch('/active-mode', authenticate, validate(activeModeSchema), authController.setActiveMode);
router.patch('/active-role', authenticate, validate(activeRoleAliasSchema), authController.setActiveMode);
router.get('/setup-vendor', authenticate, requireAdmin, authController.setupVendor);

export default router;
