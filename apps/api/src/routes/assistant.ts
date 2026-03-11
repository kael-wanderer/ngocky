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
import { ASSISTANT_POLICIES, HELP_TEXT, UNLINKED_TEXT, WELCOME_TEXT, WRITE_INTENTS } from '../services/assistant/policies';
import { normalizeMessage } from '../services/assistant/messageNormalizer';
import { parseIntent, type ParsedIntent } from '../services/assistant/intentParser';
import { executeIntent, logAssistantAction } from '../services/assistant/actionExecutor';
import { todayISO } from '../services/assistant/utils';
import { prisma } from '../config/database';
import { MessageDirection } from '@prisma/client';
import {
    buildLowConfidencePending,
    createPendingAction,
    getActivePendingAction,
    resolvePendingActionReply,
    type PendingActionPayload,
} from '../services/assistant/pendingActions';
import type { ResolverContext, ResolverResult } from '../services/assistant/resolvers/types';

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
            const trimmed = text.trim();

            // ── Commands that don't require a linked account ──────────────────

            if (trimmed === '/start') {
                return res.json({ ok: true, reply: WELCOME_TEXT, requiresConfirmation: false });
            }

            if (trimmed === '/help' || trimmed.toLowerCase() === 'help') {
                return res.json({ ok: true, reply: HELP_TEXT, requiresConfirmation: false });
            }

            // /link <CODE> — verify and bind the account
            const linkMatch = trimmed.match(/^\/link\s+([A-Z0-9]{8})$/i);
            if (linkMatch) {
                const code = linkMatch[1].toUpperCase();
                try {
                    const result = await verifyLinkCode(chatId, telegramUserId, telegramUsername, code);
                    return res.json({ ok: true, reply: result.reply, requiresConfirmation: false });
                } catch (err: any) {
                    return res.json({ ok: false, reply: err.message ?? 'Link verification failed\\.', requiresConfirmation: false });
                }
            }

            // ── All other commands require a linked account ───────────────────

            const userId = await resolveUserByChatId(chatId);
            if (!userId) {
                return res.json({ ok: true, reply: UNLINKED_TEXT, requiresConfirmation: false });
            }

            // Get user timezone for date/time resolution
            const userRecord = await prisma.user.findUnique({
                where: { id: userId },
                select: { timezone: true },
            });
            const timezone = userRecord?.timezone ?? 'Asia/Ho_Chi_Minh';
            const today = todayISO(timezone);

            // Normalize message
            const { normalized } = normalizeMessage(text);

            // Log inbound message with intent metadata
            await logMessage(userId, MessageDirection.INBOUND, text, {
                externalMessageId: messageId,
            });

            const ctx: ResolverContext = { userId, timezone, today };

            const pending = await getActivePendingAction(userId);
            if (pending) {
                const resolved = await resolvePendingActionReply(pending, normalized, ctx);
                if (resolved.keepPending) {
                    await logMessage(userId, MessageDirection.OUTBOUND, resolved.reply);
                    return res.json({
                        ok: true,
                        reply: resolved.reply,
                        requiresConfirmation: true,
                    });
                }

                await maybeStoreFollowupPending(userId, resolved.parsed ?? { intent: pending.intent as any, confidence: 1, entities: {} }, resolved);
                await logMessage(userId, MessageDirection.OUTBOUND, resolved.reply, {
                    intent: resolved.parsed?.intent ?? pending.intent,
                    confidence: resolved.parsed?.confidence ?? 1,
                });
                return res.json({
                    ok: true,
                    reply: resolved.reply,
                    requiresConfirmation: resolved.requiresConfirmation,
                });
            }

            // Execute intent
            const parsed = await parseIntent(normalized, timezone);

            await prisma.assistantMessage.updateMany({
                where: {
                    userId,
                    direction: MessageDirection.INBOUND,
                    externalMessageId: messageId,
                },
                data: {
                    normalizedText: normalized,
                    intent: parsed.intent,
                    confidence: parsed.confidence,
                },
            });

            if (
                WRITE_INTENTS.has(parsed.intent) &&
                parsed.confidence < ASSISTANT_POLICIES.MIN_CONFIDENCE
            ) {
                const payload = buildLowConfidencePending(parsed);
                await createPendingAction(userId, parsed.intent, payload);
                await logAssistantAction(parsed, ctx, {
                    reply: payload.prompt,
                    requiresConfirmation: true,
                });
                await logMessage(userId, MessageDirection.OUTBOUND, payload.prompt, {
                    intent: parsed.intent,
                    confidence: parsed.confidence,
                });
                return res.json({
                    ok: true,
                    reply: payload.prompt,
                    requiresConfirmation: true,
                });
            }

            const result = await executeIntent(parsed, ctx);
            await maybeStoreFollowupPending(userId, parsed, result);

            // Log outbound message
            await logMessage(userId, MessageDirection.OUTBOUND, result.reply, {
                intent: parsed.intent,
                confidence: parsed.confidence,
            });

            return res.json({
                ok: true,
                reply: result.reply,
                requiresConfirmation: result.requiresConfirmation,
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
            const selection = req.body.selection.trim();

            const userId = await resolveUserByChatId(chatId);
            if (!userId) {
                return res.json({ ok: true, reply: UNLINKED_TEXT, requiresConfirmation: false });
            }

            const userRecord = await prisma.user.findUnique({
                where: { id: userId },
                select: { timezone: true },
            });
            const timezone = userRecord?.timezone ?? 'Asia/Ho_Chi_Minh';
            const ctx: ResolverContext = { userId, timezone, today: todayISO(timezone) };
            const pending = await getActivePendingAction(userId);

            if (!pending) {
                return res.json({
                    ok: true,
                    reply: 'There is nothing waiting for confirmation right now\\.',
                    requiresConfirmation: false,
                });
            }

            const resolved = await resolvePendingActionReply(pending, selection, ctx);
            if (resolved.keepPending) {
                return res.json({
                    ok: true,
                    reply: resolved.reply,
                    requiresConfirmation: true,
                });
            }

            await maybeStoreFollowupPending(
                userId,
                resolved.parsed ?? { intent: pending.intent as any, confidence: 1, entities: {} },
                resolved,
            );
            return res.json({
                ok: true,
                reply: resolved.reply,
                requiresConfirmation: resolved.requiresConfirmation,
            });
        } catch (err) {
            next(err);
        }
    },
);

export default router;

async function maybeStoreFollowupPending(
    userId: string,
    parsed: ParsedIntent,
    result: ResolverResult,
): Promise<void> {
    if (!result.requiresConfirmation || !result.pendingIntent || !result.pendingPayload) {
        return;
    }

    await createPendingAction(userId, result.pendingIntent, result.pendingPayload as PendingActionPayload);
}
