import type { PageModuleType } from '@prisma/client';
import { prisma } from '../../config/database';

export type PageResolution =
    | { status: 'none' }
    | { status: 'resolved'; page: { id: string; name: string; slug: string; moduleType: PageModuleType } }
    | { status: 'ambiguous'; pages: Array<{ id: string; name: string; slug: string; moduleType: PageModuleType }> };

/** Resolve a user-supplied custom page name without silently choosing between duplicates. */
export async function resolveAssistantPage(userId: string, pageName?: string, moduleType?: PageModuleType): Promise<PageResolution> {
    const normalized = pageName?.trim().toLocaleLowerCase();
    if (!normalized) return { status: 'none' };

    const pages = await prisma.pageInstance.findMany({
        where: {
            ...(moduleType ? { moduleType } : {}),
            OR: [{ createdById: userId }, { createdById: { not: userId } }],
        },
        select: { id: true, name: true, slug: true, moduleType: true },
        orderBy: { createdAt: 'asc' },
    });
    const matches = pages.filter((page) => page.name.trim().toLocaleLowerCase() === normalized);
    if (matches.length === 1) return { status: 'resolved', page: matches[0] };
    if (matches.length > 1) return { status: 'ambiguous', pages: matches };
    return { status: 'none' };
}

export function pageAmbiguityReply(pages: Array<{ name: string; moduleType: string }>) {
    const options = pages.map((page) => `${page.name} (${page.moduleType})`).join(', ');
    return `I found multiple matching pages: ${options}. Please specify the page name more precisely\\.`;
}
