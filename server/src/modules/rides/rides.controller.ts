import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync';
import { sendSuccess } from '../../shared/utils/response';
import { ridesService } from './rides.service';

export const getRideEstimates = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { originLat, originLng, destLat, destLng } = req.query as Record<string, string>;

  const estimates = ridesService.getEstimates(
    Number(originLat),
    Number(originLng),
    Number(destLat),
    Number(destLng),
  );

  sendSuccess(res, {
    origin: { lat: Number(originLat), lng: Number(originLng) },
    destination: { lat: Number(destLat), lng: Number(destLng) },
    estimates,
  });
});
