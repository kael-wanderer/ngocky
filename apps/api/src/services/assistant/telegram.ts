import crypto from 'crypto';
import { prisma } from '../../config/database';
import { AssistantChannel, MessageDirection } from '@prisma/client';
import { ASSISTANT_POLICIES } from './policies';

export interface InboundMessage {
    chatId: string;
    telegramUserId: string;
    telegramUsername?: string;
    messageId: string;
    text: string;
}

export interface AssistantResponse {
    ok: boolean;
    reply: string;
    requiresConfirmation: boolean;
}

/**
 * Resolve the NgocKy userId from a verified Telegram chatId.
 * Returns null if the chat is not linked.
 */
export async function resolveUserByChatId(chatId: string): Promise<string | null> {
    const link = await prisma.telegramLink.findUnique({
        where: { telegramChatId: chatId },
        select: { userId: true, verifiedAt: true },
    });

    if (!link || !link.verifiedAt) return null;
    return link.userId;
}

/**
 * Store an inbound or outbound assistant message for audit/debug.
 */
export async function logMessage(
    userId: string,
    direction: MessageDirection,
    rawText: string,
    options: {
        externalMessageId?: string;
        normalizedText?: string;
        intent?: string;
        confidence?: number;
    } = {},
): Promise<void> {
    await prisma.assistantMessage.create({
        data: {
            userId,
            channel: AssistantChannel.TELEGRAM,
            direction,
            rawText,
            normalizedText: options.normalizedText ?? null,
            externalMessageId: options.externalMessageId ?? null,
            intent: options.intent ?? null,
            confidence: options.confidence ?? null,
        },
    });
}

/**
 * Generate a cryptographically random 8-character alphanumeric link code
 * and persist it on the user's TelegramLink record (creating one if absent).
 * Returns the code.
 */
export async function generateLinkCode(userId: string): Promise<string> {
    const code = crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();
    const expiresAt = new Date(
        Date.now() + ASSISTANT_POLICIES.LINK_CODE_TTL_MINUTES * 60 * 1000,
    );

    await prisma.telegramLink.upsert({
        where: { userId },
        update: { linkCode: code, linkCodeExpiresAt: expiresAt },
        create: {
            userId,
            telegramChatId: `pending:${userId}`,
            telegramUserId: '',
            linkCode: code,
            linkCodeExpiresAt: expiresAt,
        },
    });

    return code;
}

/**
 * Verify a link code sent from Telegram and bind the chat to the user.
 * Returns the linked userId on success, or throws with a user-facing message.
 */
export async function verifyLinkCode(
    chatId: string,
    telegramUserId: string,
    telegramUsername: string | undefined,
    code: string,
): Promise<{ userId: string; reply: string }> {
    const record = await prisma.telegramLink.findFirst({
        where: { linkCode: code },
    });

    if (!record) {
        throw new Error('Link code not found. Generate a new one from NgocKy Settings.');
    }

    if (!record.linkCodeExpiresAt || record.linkCodeExpiresAt < new Date()) {
        throw new Error('Link code has expired. Generate a new one from NgocKy Settings.');
    }

    // Check if this chatId is already linked to a different user
    const existingChat = await prisma.telegramLink.findUnique({
        where: { telegramChatId: chatId },
    });
    if (existingChat && existingChat.userId !== record.userId) {
        throw new Error(
            'This Telegram account is already linked to another NgocKy user.',
        );
    }

    await prisma.telegramLink.update({
        where: { id: record.id },
        data: {
            telegramChatId: chatId,
            telegramUserId,
            telegramUsername: telegramUsername ?? null,
            linkCode: null,
            linkCodeExpiresAt: null,
            verifiedAt: new Date(),
        },
    });

    return {
        userId: record.userId,
        reply: 'Your Telegram account is now linked to NgocKy. Send /help to see what I can do.',
    };
}

/**
 * Revoke the Telegram link for a given NgocKy userId.
 */
export async function revokeTelegramLink(userId: string): Promise<void> {
    await prisma.telegramLink.deleteMany({ where: { userId } });
}

/**
 * Retrieve the current Telegram link status for a user.
 */
export async function getLinkStatus(userId: string) {
    return prisma.telegramLink.findUnique({
        where: { userId },
        select: {
            telegramChatId: true,
            telegramUsername: true,
            verifiedAt: true,
            createdAt: true,
        },
    });
}
