import { config } from '../config/env';

export type FiredNotification = {
    key: string;
    sourceType: string;
    id: string;
    title: string;
    subtitle?: string;
    userId: string;
    firedAt: string;
};

const recent: FiredNotification[] = [];

export function recentNotifications(userId: string): FiredNotification[] {
    return recent.filter((n) => n.userId === userId);
}

const serviceHeaders = {
    'X-Assistant-Api-Key': config.ASSISTANT_API_KEY,
    'Content-Type': 'application/json',
};

async function sendTelegram(chatId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
    }).catch((err) => console.error('telegram send failed', err));
}

export async function tick(lookbackMinutes: number, base = `http://127.0.0.1:${config.APP_PORT}/api`) {
    try {
        const res = await fetch(`${base}/service/due-notifications?lookbackMinutes=${lookbackMinutes}`, {
            headers: serviceHeaders,
        });
        if (!res.ok) return;
        const { data } = (await res.json()) as { data: any[] };
        for (const n of data ?? []) {
            if (!n?.user?.id) continue;
            const text = `🔔 ${n.title}${n.subtitle ? ` — ${n.subtitle}` : ''}`;
            if (n.user.telegramChatId) await sendTelegram(n.user.telegramChatId, text);
            recent.unshift({
                key: `${n.sourceType}:${n.id}:${Date.now()}`,
                sourceType: n.sourceType,
                id: n.id,
                title: n.title,
                subtitle: n.subtitle ?? undefined,
                userId: n.user.id,
                firedAt: new Date().toISOString(),
            });
            if (recent.length > 100) recent.length = 100;
            await fetch(`${base}/service/due-notifications/sent`, {
                method: 'POST',
                headers: serviceHeaders,
                body: JSON.stringify({ sourceType: n.sourceType, id: n.id }),
            });
        }
    } catch (err) {
        console.error('scheduler tick failed', err);
    }
}

export function startScheduler() {
    void tick(24 * 60); // boot catch-up: fire what was missed while the machine was off
    let lastTick = Date.now();
    setInterval(() => {
        const gap = Math.ceil((Date.now() - lastTick) / 60_000) + 15; // covers laptop sleep
        lastTick = Date.now();
        void tick(gap);
    }, 5 * 60 * 1000).unref();
    console.log('⏰ local scheduler started');
}
