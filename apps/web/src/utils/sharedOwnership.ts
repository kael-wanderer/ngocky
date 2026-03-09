export function getSharedOwnerName(item: any, currentUserId?: string | null): string | null {
    if (!item?.isShared || !currentUserId) return null;

    const owner = item.owner || item.user || item.createdBy;
    const ownerId = owner?.id || item.ownerId || item.userId || item.createdById;
    const ownerName = owner?.name;

    if (!ownerName || !ownerId || ownerId === currentUserId) return null;
    return ownerName;
}
