import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(buffer: Buffer) {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

function base32Decode(secret: string) {
    const normalized = secret.toUpperCase().replace(/=+$/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (const char of normalized) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Buffer.from(bytes);
}

export function generateTotpSecret() {
    return base32Encode(crypto.randomBytes(20));
}

function generateTotpCode(secret: string, timestamp = Date.now()) {
    const key = base32Decode(secret);
    const counter = Math.floor(timestamp / 1000 / TOTP_STEP_SECONDS);
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buffer.writeUInt32BE(counter >>> 0, 4);

    const digest = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24)
        | ((digest[offset + 1] & 0xff) << 16)
        | ((digest[offset + 2] & 0xff) << 8)
        | (digest[offset + 3] & 0xff);

    return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, '0');
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
    const normalizedCode = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) return false;

    const now = Date.now();
    for (let offset = -window; offset <= window; offset += 1) {
        const candidate = generateTotpCode(secret, now + offset * TOTP_STEP_SECONDS * 1000);
        if (candidate === normalizedCode) return true;
    }
    return false;
}

export function buildOtpAuthUrl(secret: string, email: string, appName: string) {
    const issuer = encodeURIComponent(appName);
    const label = encodeURIComponent(`${appName}:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function buildQrCodeUrl(otpauthUrl: string) {
    return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(otpauthUrl)}`;
}
