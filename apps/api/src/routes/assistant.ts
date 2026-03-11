import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authenticateAssistant } from '../middleware/assistantAuth';
import { validate } from '../middleware/validate';
import {
    generateLinkCode,
    verifyLinkCode,
    revokeTelegramLink,
    getLinkStatus,
    logMessage,
    resolveUserByChatId,
} from '../services/assistant/telegram';
import { HELP_TEXT, UNLINKED_TEXT } from '../services/assistant/policies';
import { MessageDirection } from '@prisma/client';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const inboundMessageSchema = z.object({
    chatId: z.string().min(1),
    telegramUserId: z.string().min(1),
    telegramUsername: z.string().optional(),
    messageId: z.string().min(1),
    text: z.string().min(1).max(4096),
});

const linkVerifySchema = z.object({
    chatId: z.string().min(1),
    telegramUserId: z.string().min(1),
    telegramUsername: z.string().optional(),
    code: z.string().length(8),
});

const confirmSchema = z.object({
    chatId: z.string().min(1),
    selection: z.string().min(1),
});

// ─── Browser-auth routes (called from Settings UI) ───────────────────────────

/**
 * POST /api/assistant/link-code
 * Generate a one-time link code for the authenticated user.
 * Called by the Settings UI — uses browser JWT.
 */
router.post('/link-code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const code = await generateLinkCode(userId);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        res.json({ ok: true, code, expiresAt });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/assistant/link-status
 * Return Telegram link status for the authenticated user.
 */
router.get('/link-status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = await getLinkStatus(req.user!.userId);
        res.json({ ok: true, linked: !!status?.verifiedAt, link: status ?? null });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/assistant/telegram/link
 * Revoke the Telegram link for the authenticated user.
 */
router.delete(
    '/telegram/link',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await revokeTelegramLink(req.user!.userId);
            res.json({ ok: true, message: 'Telegram link removed.' });
        } catch (err) {
            next(err);
        }
    },
);

// ─── Service-auth routes (called from n8n) ───────────────────────────────────

/**
 * POST /api/assistant/telegram/link
 * Verify a link code sent from the Telegram bot (/link <code>).
 * Called by n8n — uses X-Assistant-Api-Key.
 */
router.post(
    '/telegram/link',
    authenticateAssistant,
    validate(linkVerifySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { chatId, telegramUserId, telegramUsername, code } = req.body;
            const result = await verifyLinkCode(chatId, telegramUserId, telegramUsername, code);
            res.json({ ok: true, reply: result.reply });
        } catch (err: any) {
            // Return a user-facing reply instead of a 500
            res.json({ ok: false, reply: err.message ?? 'Link verification failed\\.' });
        }
    },
);

/**
 * POST /api/assistant/telegram/message
 * Main entrypoint for all inbound Telegram messages from n8n.
 * Phases 3+ will add intent parsing and routing here.
 */
router.post(
    '/telegram/message',
    authenticateAssistant,
    validate(inboundMessageSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { chatId, telegramUserId, telegramUsername, messageId, text } = req.body;

            // Handle /help command directly
            if (text.trim().toLowerCase() === '/help' || text.trim().toLowerCase() === 'help') {
                return res.json({ ok: true, reply: HELP_TEXT, requiresConfirmation: false });
            }

            // Resolve linked user
            const userId = await resolveUserByChatId(chatId);
            if (!userId) {
                return res.json({ ok: true, reply: UNLINKED_TEXT, requiresConfirmation: false });
            }

            // Log inbound message
            await logMessage(userId, MessageDirection.INBOUND, text, {
                externalMessageId: messageId,
            });

            // TODO Phase 3: parse intent and route to executor
            return res.json({
                ok: true,
                reply: 'Message received\\. Intent parsing coming in Phase 3\\.',
                requiresConfirmation: false,
            });
        } catch (err) {
            next(err);
        }
    },
);

/**
 * POST /api/assistant/telegram/confirm
 * Accept a confirmation/selection reply for a pending action.
 * Phase 6 will implement the full pending action resolution.
 */
router.post(
    '/telegram/confirm',
    authenticateAssistant,
    validate(confirmSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { chatId } = req.body;

            const userId = await resolveUserByChatId(chatId);
            if (!userId) {
                return res.json({ ok: true, reply: UNLINKED_TEXT, requiresConfirmation: false });
            }

            // TODO Phase 6: resolve pending action and execute
            return res.json({
                ok: true,
                reply: 'Confirmation handling coming in Phase 6\\.',
                requiresConfirmation: false,
            });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
