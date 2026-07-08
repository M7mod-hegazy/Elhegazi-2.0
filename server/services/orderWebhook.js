import crypto from 'crypto';
import SyncStore from '../models/SyncStore.js';

// POST the signed order to one store's POS webhook, retrying transient failures.
async function postWithRetry(url, signedBody, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedBody),
      });
      if (resp.ok) return { ok: true, status: resp.status };
      // Client errors (bad signature/duplicate/store mismatch) won't fix on retry.
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        return { ok: false, status: resp.status };
      }
    } catch {
      // network error — fall through to backoff/retry
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
  }
  return { ok: false, status: 0 };
}

// Notify every store that registered an active webhook. Signs the payload
// (minus `signature`) with that store's secret so the POS can verify it.
export async function dispatchOrderWebhooks(order) {
  try {
    const stores = await SyncStore.find({ webhookActive: true, webhookUrl: { $ne: '' } })
      .select('_id webhookUrl webhookSecret')
      .lean();
    if (!stores.length) return;

    const items = (order.items || []).map((it) => ({
      sku: it.product?.sku || it.sku || '',
      name: it.product?.nameAr || it.product?.name || it.name || '',
      quantity: it.quantity,
      price: it.price,
    }));

    const base = {
      orderId: String(order._id),
      orderNumber: order.orderNumber || '',
      customerName: order.shippingAddress?.fullName || order.customerName || 'عميل',
      customerPhone: order.shippingAddress?.phone || '',
      total: order.total || 0,
      itemsCount: items.length,
      items,
    };

    await Promise.all(stores.map((s) => {
      const data = { ...base, storeId: String(s._id) };
      const secret = s.webhookSecret || '';
      const signedBody = secret
        ? { ...data, signature: crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex') }
        : data;
      return postWithRetry(s.webhookUrl, signedBody);
    }));
  } catch (err) {
    console.error('dispatchOrderWebhooks error:', err.message);
  }
}

export default { dispatchOrderWebhooks };
