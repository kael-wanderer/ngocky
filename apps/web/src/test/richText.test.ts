import { describe, expect, it } from 'vitest';
import { toRichTextHtml } from '../utils/richText';
import { toLocalDateInput } from '../utils/dates';

describe('toRichTextHtml', () => {
    it('strips scripts and event handlers from stored HTML', () => {
        const html = toRichTextHtml('<p onclick="steal()">hi</p><script>steal()</script><img src=x onerror="steal()">');
        expect(html).not.toMatch(/script|onclick|onerror/i);
        expect(html).toContain('<p>hi</p>');
    });

    it('drops javascript: links', () => {
        expect(toRichTextHtml('<a href="javascript:steal()">x</a>')).not.toContain('javascript:');
    });

    it('keeps editor formatting', () => {
        const html = toRichTextHtml('<p><strong>bold</strong> <span style="color: red">red</span></p><table><tbody><tr><td>cell</td></tr></tbody></table>');
        expect(html).toContain('<strong>bold</strong>');
        expect(html).toContain('color: red');
        expect(html).toContain('<td>cell</td>');
    });

    it('escapes legacy plain text', () => {
        expect(toRichTextHtml('a < b\nnext')).toBe('a &lt; b<br>next');
        expect(toRichTextHtml(null)).toBe('');
    });
});

describe('toLocalDateInput', () => {
    it('formats the local calendar date, not the UTC one', () => {
        expect(toLocalDateInput(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    });
});
