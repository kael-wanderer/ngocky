// Formats /api/service/report-data JSON into Telegram/OS-notification text.
// Plain text avoids Telegram parse-mode escaping issues with user content.

const MAX_LEN = 4000;

type Line = string;

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} VND`;

const day = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }) : '';

const time = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) : '';

function items(list: any[] | undefined, render: (x: any) => Line, cap = 10): Line[] {
    if (!Array.isArray(list) || list.length === 0) return [];
    const out = list.slice(0, cap).map((x) => `  - ${render(x)}`);
    if (list.length > cap) out.push(`  ... +${list.length - cap} more`);
    return out;
}

function header(title: string, lines: Line[]): Line[] {
    return lines.length ? [`${title}:`, ...lines] : [];
}

function sectionBlocks(d: any): Array<[string, Line[]]> {
    const isSummary = d.reportType === 'WEEKLY_SUMMARY' || d.reportType === 'SUMMARY';
    const blocks: Array<[string, Line[]]> = [];

    if (isSummary) {
        blocks.push(['goals', header('Goals', items(d.goals, (g) => `${g.title}: ${g.currentCount}/${g.targetCount} ${g.unit ?? ''}${g.completed ? ' done' : ''}`))]);
        blocks.push(['project', header('Projects', [
            ...items(d.project?.done, (t) => `Done: ${t.title} (${t.project})`),
            ...items(d.project?.inProgress, (t) => `In progress: ${t.title} (${t.project})`),
        ])]);
        blocks.push(['tasks', header('Tasks', [
            ...items(d.tasks?.done, (t) => `Done: ${t.title}`),
            ...items(d.tasks?.inProgress, (t) => `In progress: ${t.title}`),
        ])]);
        blocks.push(['expenses', header('Expenses', d.expenses?.count
            ? [
                `  Paid ${vnd(d.expenses.totalPaid)}; Received ${vnd(d.expenses.totalReceived)}; Net ${vnd(d.expenses.net)} (${d.expenses.count})`,
                ...items(d.expenses.items, (e) => `${e.description}: ${vnd(e.amount)}`),
            ]
            : [])]);
    } else {
        blocks.push(['goals', header('Goals', items(d.goals, (g) => `${g.title}: ${g.currentCount}/${g.targetCount} ${g.unit ?? ''}`))]);
        blocks.push(['project', header('Projects', items(d.project, (t) => `${t.title} (${t.project})${t.deadline ? ` - ${day(t.deadline)}` : ''}`))]);
        blocks.push(['tasks', header('Tasks', items(d.tasks, (t) => `${t.title}${t.dueDate ? ` - ${day(t.dueDate)}` : ''}`))]);
        blocks.push(['expenses', header('Expenses', items(d.expenses, (e) => `${e.description}: ${vnd(e.amount)}`))]);
    }

    blocks.push(['calendar', header('Calendar', items(d.calendar, (e) => `${e.title} - ${day(e.startDate)}${e.allDay ? '' : ` ${time(e.startDate)}`}${e.location ? ` @ ${e.location}` : ''}`))]);
    blocks.push(['housework', header('Housework', items(d.housework, (h) => `${h.title}${h.dueDate ? ` - ${day(h.dueDate)}` : ''}${h.completedDate ? ` done ${day(h.completedDate)}` : ''}`))]);
    blocks.push(['cakeo', header('Ca Keo', items(d.cakeo, (c) => `${c.title}${c.assigner ? ` (${c.assigner})` : ''}`))]);
    blocks.push(['assets', header('Assets', items(d.assets, (a) => `${a.asset}: ${a.serviceType}${a.cost ? ` ${vnd(a.cost)}` : ''}`))]);
    blocks.push(['healthbook', header('Healthbook', items(d.healthbook, (h) => `${h.person}: ${h.type} - ${day(h.date)}`))]);
    blocks.push(['keyboard', header('Keyboard', items(d.keyboard, (k) => `${k.name}${k.price ? ` ${vnd(k.price)}` : ''}`))]);
    blocks.push(['funds', header('Funds', items(d.funds, (f) => `${f.description ?? f.category}: ${vnd(f.amount)}`))]);
    blocks.push(['learning', header('Learning', items(d.learning, (l) => `${l.title}${l.topic ? ` (${l.topic})` : ''}${typeof l.progress === 'number' ? ` ${l.progress}%` : ''}`))]);
    blocks.push(['ideas', header('Ideas', items(d.ideas, (i) => i.title))]);

    return blocks;
}

export function formatReport(name: string, d: any): string {
    const wanted: string[] = Array.isArray(d.sections) && d.sections.length > 0 ? d.sections : [];
    const lines: Line[] = [`Report: ${name}${d.page?.name ? ` - ${d.page.name}` : ''}`];
    if (d.period) lines.push(`${day(d.period.start)} -> ${day(d.period.end)}`);

    for (const [key, block] of sectionBlocks(d)) {
        if (wanted.length && !wanted.includes(key)) continue;
        if (block.length) lines.push('', ...block);
    }

    if (lines.length <= 2) lines.push('', 'Nothing to report.');
    const text = lines.join('\n');
    return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN - 3)}...` : text;
}

export function summaryLine(d: any): string {
    const count = (v: any) => (Array.isArray(v) ? v.length : typeof v?.total === 'number' ? v.total : 0);
    const parts = [
        [count(d.tasks), 'task'],
        [count(d.project), 'project item'],
        [count(d.calendar), 'event'],
        [Array.isArray(d.expenses) ? d.expenses.length : d.expenses?.count ?? 0, 'expense'],
    ] as Array<[number, string]>;
    const bits = parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}${n > 1 ? 's' : ''}`);
    return bits.length ? bits.join(', ') : 'Report ready';
}
