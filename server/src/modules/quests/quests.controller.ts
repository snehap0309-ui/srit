import { Response } from 'express';
import { questsService } from './quests.service';
import { catchAsync } from '../../shared/utils/catchAsync';
import { sendSuccess, sendCreated } from '../../shared/utils/response';

export const questsController = {
  list: catchAsync(async (req: any, res: Response) => {
    const result = await questsService.list(req.query);
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  getById: catchAsync(async (req: any, res: Response) => {
    const quest = await questsService.getById(req.params.id);
    sendSuccess(res, quest);
  }),

  create: catchAsync(async (req: any, res: Response) => {
    const quest = await questsService.create(req.body);
    sendCreated(res, quest, 'Quest created');
  }),

  update: catchAsync(async (req: any, res: Response) => {
    const quest = await questsService.update(req.params.id, req.body);
    sendSuccess(res, quest, { message: 'Quest updated' });
  }),

  delete: catchAsync(async (req: any, res: Response) => {
    await questsService.delete(req.params.id);
    sendSuccess(res, null, { message: 'Quest deleted' });
  }),

  getCompletions: catchAsync(async (req: any, res: Response) => {
    const result = await questsService.getCompletions(req.params.id, req.query);
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  complete: catchAsync(async (req: any, res: Response) => {
    const completion = await questsService.complete(req.params.id, req.user.id);
    sendCreated(res, completion, 'Quest completed');
  }),

  // Checkpoint-level
  getMyProgress: catchAsync(async (req: any, res: Response) => {
    const progress = await questsService.getMyProgress(req.params.id, req.user.id);
    sendSuccess(res, progress);
  }),

  completeCheckpoint: catchAsync(async (req: any, res: Response) => {
    const { checkpointId } = req.params;
    const { photoProofUrl } = req.body;
    const record = await questsService.completeCheckpoint(
      req.params.id,
      checkpointId,
      req.user.id,
      photoProofUrl
    );
    sendCreated(res, record, 'Checkpoint completed');
  }),
};
