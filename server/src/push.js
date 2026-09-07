// Web Push sending (node `web-push`, VAPID + aes128gcm).
// Payload shape mirrors tid-worker cron: {title, body, tag, url}.
import { createECDH } from 'node:crypto';
import webPush from 'web-push';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function publicFromPrivate(privateB64) {
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(privateB64, 'base64url'));
  return b64url(ecdh.getPublicKey(null, 'uncompressed'));
}

export function initPush({ vapidPrivateKey, vapidSubject, vapidPublicKey }) {
  if (!vapidPrivateKey || !vapidSubject) {
    console.warn('push disabled: set VAPID_PRIVATE_KEY and VAPID_SUBJECT to enable');
    return null;
  }
  const pub = vapidPublicKey || publicFromPrivate(vapidPrivateKey);
  webPush.setVapidDetails(vapidSubject, pub, vapidPrivateKey);
  // 4 weeks like the worker's with_valid_duration.
  return { ttl: 2_419_200 };
}

/// Returns 'sent' | 'gone' | 'skipped'. Throws on transient errors.
export async function sendPush(ctx, sub, message, tag) {
  if (!ctx) return 'skipped';
  const payload = JSON.stringify({ title: '列車接近', body: message, tag, url: '/' });
  try {
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { TTL: ctx.ttl },
    );
    return 'sent';
  } catch (err) {
    if (err?.statusCode === 404 || err?.statusCode === 410) return 'gone';
    throw err;
  }
}
