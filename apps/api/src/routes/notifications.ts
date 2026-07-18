import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { recentNotifications } from '../services/scheduler';

const router = Router();
router.use(authenticate);

router.get('/recent', (req: Request, res: Response) => {
    sendSuccess(res, recentNotifications(req.user!.userId));
});

export default router;
