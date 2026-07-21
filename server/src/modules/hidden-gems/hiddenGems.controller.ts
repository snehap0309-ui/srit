import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { hiddenGemsService } from './hiddenGems.service';
import { catchAsync } from '../../shared/utils/catchAsync';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import { hasRole } from '../../middleware/auth';

export const hiddenGemsController = {
  create: catchAsync(async (req: any, res: Response) => {
    const submission = await hiddenGemsService.create(req.body, req.user.id);
    sendCreated(res, submission, 'Hidden gem submitted for review');
  }),

  list: catchAsync(async (req: any, res: Response) => {
    const result = await hiddenGemsService.list(req.query as any, {
      isAdmin: hasRole(req.user, Role.ADMIN),
      userId: req.user?.id,
    });
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  getById: catchAsync(async (req: any, res: Response) => {
    const submission = await hiddenGemsService.getById(req.params.id as string, {
      isAdmin: hasRole(req.user, Role.ADMIN),
      userId: req.user?.id,
    });
    sendSuccess(res, submission);
  }),

  approve: catchAsync(async (req: any, res: Response) => {
    const submission = await hiddenGemsService.approve(req.params.id as string, req.body, req.user.id);
    sendSuccess(res, submission, { message: 'Hidden gem approved successfully' });
  }),

  reject: catchAsync(async (req: any, res: Response) => {
    const submission = await hiddenGemsService.reject(req.params.id as string, req.body, req.user.id);
    sendSuccess(res, submission, { message: 'Hidden gem rejected' });
  }),
};