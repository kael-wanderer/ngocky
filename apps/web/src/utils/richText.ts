import DOMPurify from 'dompurify';

/**
 * Turn stored rich text (TipTap HTML, or legacy plain text) into HTML that is
 * safe for `dangerouslySetInnerHTML`. Stored content is user input shared
 * between family members, so it is always sanitized.
 */
export function toRichTextHtml(value?: string | null): string {
    if (!value) return '';
    const html = /<\/?[a-z][\s\S]*>/i.test(value)
        ? value
        : value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br />');
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
