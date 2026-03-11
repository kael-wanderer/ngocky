/**
 * Shared types for all intent resolvers.
 */

export interface ResolverContext {
    userId: string;
    timezone: string;
    today: string; // YYYY-MM-DD in user timezone
}

export interface ResolverResult {
    reply: string;           // MarkdownV2-formatted Telegram reply
    requiresConfirmation: boolean;
    pendingIntent?: string;  // set when disambiguation needed
    pendingPayload?: Record<string, any>;
}
