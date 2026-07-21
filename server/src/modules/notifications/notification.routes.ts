import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  registerDeviceTokenSchema,
  unregisterDeviceTokenSchema,
  sendNotificationSchema,
  listNotificationsSchema,
  markReadSchema,
  sendToRoleSchema,
  sendToCitySchema,
  sendToCategorySchema,
  createTemplateSchema,
  updateTemplateSchema,
  sendFromTemplateSchema,
} from './notification.validation';

const router = Router();

router.use(authenticate);

router.post('/register-token', validate(registerDeviceTokenSchema), notificationController.registerToken);
router.delete('/unregister-token', validate(unregisterDeviceTokenSchema), notificationController.unregisterToken);
router.get('/', validate(listNotificationsSchema, 'query'), notificationController.getNotifications);
router.patch('/mark-read', validate(markReadSchema), notificationController.markRead);
router.post('/mark-all-read', notificationController.markAllRead);

const adminRouter = Router({ mergeParams: true });
adminRouter.use(authenticate, requireAdmin);

adminRouter.post('/send', validate(sendNotificationSchema), notificationController.sendNotification);
adminRouter.post('/send-to-role', validate(sendToRoleSchema), notificationController.sendToRole);
adminRouter.post('/send-to-city', validate(sendToCitySchema), notificationController.sendToCity);
adminRouter.post('/send-to-category', validate(sendToCategorySchema), notificationController.sendToCategory);
adminRouter.post('/send-from-template', validate(sendFromTemplateSchema), notificationController.sendFromTemplate);

adminRouter.get('/admin-list', notificationController.listAdmin);

adminRouter.get('/templates', notificationController.listTemplates);
adminRouter.post('/templates', validate(createTemplateSchema), notificationController.createTemplate);
adminRouter.patch('/templates/:id', validate(updateTemplateSchema), notificationController.updateTemplate);
adminRouter.delete('/templates/:id', notificationController.deleteTemplate);

export default router;
export { adminRouter };
