import Handlebars from 'handlebars';
import { env } from '../../../config/env.js';
import { formatMoney } from '../../../utils/money.js';

/**
 * Email templates (HTML + plain text) compiled with Handlebars.
 * `{{ }}` HTML-escapes values, so user-supplied names can't inject markup.
 * Templates live in TypeScript so they are type-checked and ship with `tsc` output.
 */
const hbs = Handlebars.create();
hbs.registerHelper('money', (cents: number, currency: string) => formatMoney(cents, currency));
hbs.registerHelper('lower', (s: string) => String(s).toLowerCase());

interface LineItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface TemplateDataMap {
  verifyEmail: { name: string; url: string };
  passwordReset: { name: string; url: string; expiresInMinutes: number };
  passwordChanged: { name: string };
  accountLocked: { name: string; minutes: number };
  orderConfirmation: {
    name: string;
    orderId: string;
    items: LineItem[];
    totalCents: number;
    currency: string;
  };
  adminNewOrder: {
    orderId: string;
    customerName: string;
    customerEmail: string;
    items: LineItem[];
    totalCents: number;
    currency: string;
  };
  orderStatusChanged: {
    name: string;
    orderId: string;
    status: string;
    previousStatus: string;
    note?: string;
  };
  lowStockAlert: {
    products: { name: string; sku: string; stockQuantity: number; lowStockThreshold: number }[];
  };
}

export type TemplateName = keyof TemplateDataMap;

interface TemplateSource {
  subject: string;
  html: string;
  text: string;
}

const itemsHtml = `
<table width="100%" cellpadding="6" style="border-collapse:collapse;font-size:14px">
  <tr style="background:#f3f4f6;text-align:left"><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
  {{#each items}}<tr style="border-top:1px solid #e5e7eb"><td>{{name}}</td><td>{{quantity}}</td><td>{{money unitPriceCents ../currency}}</td><td>{{money lineTotalCents ../currency}}</td></tr>{{/each}}
  <tr style="border-top:2px solid #111"><td colspan="3"><strong>Total</strong></td><td><strong>{{money totalCents currency}}</strong></td></tr>
</table>`;

const itemsText = `{{#each items}}- {{name}} x{{quantity}} @ {{money unitPriceCents ../currency}} = {{money lineTotalCents ../currency}}
{{/each}}Total: {{money totalCents currency}}`;

const button = (label: string) =>
  `<p style="margin:24px 0"><a href="{{url}}" style="background:#db0007;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${label}</a></p>
<p style="font-size:12px;color:#6b7280">If the button doesn't work, paste this link into your browser:<br>{{url}}</p>`;

const sources: Record<TemplateName, TemplateSource> = {
  verifyEmail: {
    subject: 'Verify your email for {{storeName}}',
    html: `<p>Hi {{name}},</p><p>Welcome to {{storeName}}! Please confirm your email address to start placing orders.</p>${button('Verify email')}<p>This link expires in 24 hours.</p>`,
    text: `Hi {{name}},\n\nWelcome to {{storeName}}! Confirm your email address to start placing orders:\n{{url}}\n\nThis link expires in 24 hours.`,
  },
  passwordReset: {
    subject: 'Reset your {{storeName}} password',
    html: `<p>Hi {{name}},</p><p>We received a request to reset your password.</p>${button('Reset password')}<p>This link expires in {{expiresInMinutes}} minutes and can only be used once. If you didn't request this, you can ignore this email.</p>`,
    text: `Hi {{name}},\n\nReset your password here (expires in {{expiresInMinutes}} minutes, single use):\n{{url}}\n\nIf you didn't request this, ignore this email.`,
  },
  passwordChanged: {
    subject: 'Your {{storeName}} password was changed',
    html: `<p>Hi {{name}},</p><p>Your password was just changed. If this was you, no action is needed.</p><p><strong>If you didn't do this</strong>, reset your password immediately and contact support.</p>`,
    text: `Hi {{name}},\n\nYour password was just changed. If this wasn't you, reset your password immediately and contact support.`,
  },
  accountLocked: {
    subject: 'Your {{storeName}} account was temporarily locked',
    html: `<p>Hi {{name}},</p><p>We locked your account for {{minutes}} minutes after several failed sign-in attempts.</p><p>If this wasn't you, we recommend resetting your password once the lock expires.</p>`,
    text: `Hi {{name}},\n\nWe locked your account for {{minutes}} minutes after several failed sign-in attempts. If this wasn't you, reset your password once the lock expires.`,
  },
  orderConfirmation: {
    subject: 'Order confirmed — #{{orderId}}',
    html: `<p>Hi {{name}},</p><p>Thanks for your order! Here's your summary:</p>${itemsHtml}<p>Order reference: <strong>{{orderId}}</strong></p>`,
    text: `Hi {{name}},\n\nThanks for your order #{{orderId}}!\n\n${itemsText}`,
  },
  adminNewOrder: {
    subject: 'New order #{{orderId}} — {{money totalCents currency}}',
    html: `<p>New order from <strong>{{customerName}}</strong> ({{customerEmail}}).</p>${itemsHtml}<p>Order: {{orderId}}</p>`,
    text: `New order #{{orderId}} from {{customerName}} <{{customerEmail}}>\n\n${itemsText}`,
  },
  orderStatusChanged: {
    subject: 'Your order #{{orderId}} is now {{lower status}}',
    html: `<p>Hi {{name}},</p><p>Your order <strong>#{{orderId}}</strong> changed from {{lower previousStatus}} to <strong>{{lower status}}</strong>.</p>{{#if note}}<p>Note: {{note}}</p>{{/if}}`,
    text: `Hi {{name}},\n\nYour order #{{orderId}} changed from {{lower previousStatus}} to {{lower status}}.{{#if note}}\nNote: {{note}}{{/if}}`,
  },
  lowStockAlert: {
    subject: 'Low stock alert: {{products.length}} product(s)',
    html: `<p>These products are at or below their low-stock threshold:</p><ul>{{#each products}}<li><strong>{{name}}</strong> ({{sku}}) — {{stockQuantity}} left (threshold {{lowStockThreshold}})</li>{{/each}}</ul>`,
    text: `These products are at or below their low-stock threshold:\n{{#each products}}- {{name}} ({{sku}}): {{stockQuantity}} left (threshold {{lowStockThreshold}})\n{{/each}}`,
  },
};

const layout = hbs.compile(`<!doctype html>
<html><body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="600" cellpadding="24" style="background:#fff;border-radius:8px;max-width:100%">
<tr><td style="border-bottom:3px solid #db0007"><strong style="font-size:18px">{{storeName}}</strong></td></tr>
<tr><td style="font-size:15px;line-height:1.5">{{{body}}}</td></tr>
<tr><td style="font-size:12px;color:#6b7280">You're receiving this email because of activity on your {{storeName}} account.</td></tr>
</table></td></tr></table></body></html>`);

type Compiled = {
  subject: HandlebarsTemplateDelegate;
  html: HandlebarsTemplateDelegate;
  text: HandlebarsTemplateDelegate;
};
const compiled = Object.fromEntries(
  Object.entries(sources).map(([name, src]) => [
    name,
    {
      // Subject and plain-text bodies are not HTML: escaping would corrupt links (`=` → `&#x3D;`).
      subject: hbs.compile(src.subject, { noEscape: true }),
      html: hbs.compile(src.html),
      text: hbs.compile(src.text, { noEscape: true }),
    },
  ]),
) as Record<TemplateName, Compiled>;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderTemplate<N extends TemplateName>(
  name: N,
  data: TemplateDataMap[N],
): RenderedEmail {
  const tpl = compiled[name];
  const ctx = { ...data, storeName: env.STORE_NAME };
  return {
    subject: tpl.subject(ctx),
    html: layout({ storeName: env.STORE_NAME, body: tpl.html(ctx) }),
    text: tpl.text(ctx),
  };
}
