import type { PageModuleType } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';
import { applyTemplateOverrides } from '../config/pageTemplates';

export async function getEffectiveTemplates() {
    const settings = await prisma.appSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    return applyTemplateOverrides(settings.templateOverrides);
}

export async function getEffectiveTemplateByType(moduleType: PageModuleType) {
    return (await getEffectiveTemplates()).find((template) => template.moduleType === moduleType);
}

export async function assertPageInstance(instanceId: string | null | undefined, expectedTemplate: PageModuleType) {
    if (!instanceId) return null;
    const page = await prisma.pageInstance.findUnique({ where: { id: instanceId } });
    if (!page || page.moduleType !== expectedTemplate) throw new ValidationError('Invalid instanceId');
    return page;
}

export async function getPageInstance(id: string) {
    const page = await prisma.pageInstance.findUnique({ where: { id } });
    if (!page) throw new NotFoundError('Page');
    return page;
}

export type PageDeletePreview = {
    id: string;
    name: string;
    moduleType: PageModuleType;
    rootLabel: string;
    itemCount: number;
};

export async function countPageRoots(id: string, moduleType: PageModuleType): Promise<number> {
    switch (moduleType) {
        case 'TASK': return prisma.task.count({ where: { instanceId: id } });
        case 'PROJECT': return prisma.project.count({ where: { instanceId: id } });
        case 'EXPENSE': return prisma.expense.count({ where: { instanceId: id } });
        case 'GOAL': return prisma.goal.count({ where: { instanceId: id } });
        case 'IDEA': return prisma.ideaTopic.count({ where: { instanceId: id } });
        case 'CALENDAR': return prisma.calendarEvent.count({ where: { instanceId: id } });
        case 'CAKEO': return prisma.caKeo.count({ where: { instanceId: id } });
        case 'HOUSEWORK': return prisma.houseworkItem.count({ where: { instanceId: id } });
        case 'ASSET': return prisma.asset.count({ where: { instanceId: id } });
        case 'HEALTHBOOK': return prisma.healthPerson.count({ where: { instanceId: id } });
        case 'KEYBOARD': return prisma.keyboard.count({ where: { instanceId: id } });
        case 'FOODPLACE': return prisma.foodPlace.count({ where: { instanceId: id } });
        case 'FUND': return prisma.fundTransaction.count({ where: { instanceId: id } });
        case 'LEARNING': return prisma.learningTopic.count({ where: { instanceId: id } });
    }
}
