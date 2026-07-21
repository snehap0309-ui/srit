import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { rideEstimatesQuerySchema } from './rides.validation';
import { getRideEstimates } from './rides.controller';

const router = Router();

router.get('/estimates', validate(rideEstimatesQuerySchema, 'query'), getRideEstimates);

export default router;
