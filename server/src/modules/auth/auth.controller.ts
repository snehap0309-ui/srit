import { Request, Response } from 'express';
import { authService } from './auth.service';
import { catchAsync } from '../../shared/utils/catchAsync';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/utils/response';
import { env } from '../../config/env';

export const authController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendCreated(res, result, 'Account created successfully');
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    sendSuccess(res, result, { message: 'Login successful' });
  }),

  refresh: catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    sendSuccess(res, result, { message: 'Token refreshed successfully' });
  }),

  logout: catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.clearCookie('token', {
      path: '/',
      secure: env.isProduction,
      sameSite: env.isProduction ? 'none' : 'strict',
    });
    sendNoContent(res);
  }),

  getProfile: catchAsync(async (req: any, res: Response) => {
    const user = await authService.getProfile(req.user.id);
    sendSuccess(res, user);
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, null, { message: 'If an account with that email exists, a verification code has been sent.' });
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    const { email, token, password } = req.body;
    const result = await authService.resetPassword(email, token, password);
    sendSuccess(res, result, { message: 'Password reset successful' });
  }),

  updateProfile: catchAsync(async (req: any, res: Response) => {
    const result = await authService.updateProfile(req.user.id, req.body);
    sendSuccess(res, result, { message: 'Profile updated successfully' });
  }),

  changePassword: catchAsync(async (req: any, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    sendSuccess(res, null, { message: 'Password changed successfully. Other sessions have been signed out.' });
  }),

  getDeletionInfo: catchAsync(async (req: any, res: Response) => {
    const info = await authService.getDeletionInfo(req.user.id);
    sendSuccess(res, info);
  }),

  deleteAccount: catchAsync(async (req: any, res: Response) => {
    const { password, confirmDeletion } = req.body;
    const result = await authService.deleteAccount(req.user.id, password, confirmDeletion);
    res.clearCookie('token', {
      path: '/',
      secure: env.isProduction,
      sameSite: env.isProduction ? 'none' : 'strict',
    });
    sendSuccess(res, result, { message: 'Account deleted successfully' });
  }),

  setActiveMode: catchAsync(async (req: any, res: Response) => {
    const result = await authService.setActiveMode(req.user.id, req.body.activeMode);
    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    sendSuccess(res, result, { message: 'Active mode updated successfully' });
  }),

  setupVendor: catchAsync(async (req: Request, res: Response) => {
    const email = typeof req.query.email === 'string' ? req.query.email : undefined;
    const result = await authService.setupVendor(email);
    sendSuccess(res, result, { message: 'Vendor account setup successful' });
  }),
};

