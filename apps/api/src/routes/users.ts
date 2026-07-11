import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '../validators/users';
import { sendSuccess, sendCreated, sendMessage, sendPaginated } from '../utils/response';
import { ForbiddenError, NotFoundError } from '../utils/errors';

const router = Router();

// All user routes require auth
router.use(authenticate);

// List users (owner/admin only)
router.get('/', authorize('OWNER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                skip, take: limit,
                select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, notificationChannel: true },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.user.count(),
        ]);

        sendPaginated(res, users, total, page, limit);
    } catch (err) { next(err); }
});

// Create user (owner/admin only)
router.post('/', authorize('OWNER', 'ADMIN'), validate(createUserSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, name, password, role } = req.body;
        const hashed = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: { email, name, password: hashed, role },
            select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
        });

        sendCreated(res, user);
    } catch (err) { next(err); }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, email: true, name: true, role: true, active: true, theme: true, notificationEnabled: true, notificationChannel: true, notificationEmail: true, telegramChatId: true, createdAt: true },
        });
        if (!user) throw new NotFoundError('User');
        sendSuccess(res, user);
    } catch (err) { next(err); }
});

// Update user
router.patch('/:id', validate(updateUserSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const targetId = req.params.id;
        const currentUser = req.user!;

        // Users can update themselves; admins can update non-owners; owners can update anyone
        if (currentUser.userId !== targetId) {
            if (currentUser.role === 'USER') throw new ForbiddenError();
            const target = await prisma.user.findUnique({ where: { id: targetId } });
            if (!target) throw new NotFoundError('User');
            if (target.role === 'OWNER' && currentUser.role !== 'OWNER') throw new ForbiddenError('Cannot modify owner');
        }

        const user = await prisma.user.update({
            where: { id: targetId },
            data: req.body,
            select: { id: true, email: true, name: true, role: true, active: true, theme: true, notificationEnabled: true, notificationChannel: true },
        });

        sendSuccess(res, user);
    } catch (err) { next(err); }
});

// Toggle active (owner/admin)
router.patch('/:id/toggle-active', authorize('OWNER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const target = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!target) throw new NotFoundError('User');
        if (target.role === 'OWNER') throw new ForbiddenError('Cannot deactivate owner');

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { active: !target.active },
            select: { id: true, name: true, active: true },
        });

        sendSuccess(res, user);
    } catch (err) { next(err); }
});

// Reset password (owner/admin)
router.patch('/:id/reset-password', authorize('OWNER', 'ADMIN'), validate(resetPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const target = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!target) throw new NotFoundError('User');
        if (target.role === 'OWNER' && req.user!.role !== 'OWNER') throw new ForbiddenError('Cannot reset owner password');

        const hashed = await bcrypt.hash(req.body.newPassword, 12);
        await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
        // Invalidate refresh tokens
        await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });

        sendMessage(res, 'Password reset successfully');
    } catch (err) { next(err); }
});

// Delete user (owner/admin with role restrictions)
router.delete('/:id', authorize('OWNER', 'ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const target = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!target) throw new NotFoundError('User');
        if (target.id === req.user!.userId) throw new ForbiddenError('Cannot delete your own account');
        if (req.user!.role === 'ADMIN') {
            if (target.role !== 'USER') throw new ForbiddenError('Admin can only delete users with USER role');
        }

        await prisma.$transaction(async (tx) => {
            const ownerId = req.user!.role === 'OWNER'
                ? req.user!.userId
                : (await tx.user.findFirst({ where: { role: 'OWNER' }, select: { id: true } }))?.id;
            if (!ownerId) throw new ForbiddenError('An owner account is required to preserve pages');
            await Promise.all([
                tx.goalCheckIn.updateMany({ where: { userId: target.id, goal: { instanceId: { not: null } } }, data: { userId: ownerId } }),
                tx.projectTask.updateMany({ where: { createdById: target.id, project: { instanceId: { not: null } } }, data: { createdById: ownerId } }),
                tx.idea.updateMany({ where: { userId: target.id, topic: { instanceId: { not: null } } }, data: { userId: ownerId } }),
                tx.maintenanceRecord.updateMany({ where: { userId: target.id, asset: { instanceId: { not: null } } }, data: { userId: ownerId } }),
                tx.healthLog.updateMany({ where: { userId: target.id, person: { instanceId: { not: null } } }, data: { userId: ownerId } }),
                tx.learningItem.updateMany({ where: { userId: target.id, topic: { instanceId: { not: null } } }, data: { userId: ownerId } }),
                tx.task.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
                tx.project.updateMany({ where: { ownerId: target.id, instanceId: { not: null } }, data: { ownerId } }),
                tx.expense.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
                tx.goal.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
                tx.ideaTopic.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
                tx.calendarEvent.updateMany({ where: { createdById: target.id, instanceId: { not: null } }, data: { createdById: ownerId } }),
                tx.caKeo.updateMany({ where: { ownerId: target.id, instanceId: { not: null } }, data: { ownerId } }),
                tx.houseworkItem.updateMany({ where: { createdById: target.id, instanceId: { not: null } }, data: { createdById: ownerId } }),
                tx.asset.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
                tx.healthPerson.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
                tx.keyboard.updateMany({ where: { ownerId: target.id, instanceId: { not: null } }, data: { ownerId } }),
                tx.fundTransaction.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
                tx.learningTopic.updateMany({ where: { userId: target.id, instanceId: { not: null } }, data: { userId: ownerId } }),
            ]);
            await tx.pageInstance.updateMany({
                where: { createdById: target.id },
                data: { createdById: ownerId },
            });
            await tx.refreshToken.deleteMany({ where: { userId: target.id } });
            await tx.user.delete({ where: { id: target.id } });
        });
        sendMessage(res, 'User deleted');
    } catch (err) { next(err); }
});

export default router;
