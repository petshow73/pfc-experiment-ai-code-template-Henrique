// order-processor.js

/**
 * @typedef {{ id?: string, price?: number, quantity?: number }} OrderItem
 * @typedef {{ items?: OrderItem[] }} OrderData
 * @typedef {{ type?: 'VIP'|'GOLD'|'SILVER'|'BRONZE'|'REGULAR', state?: string, level?: 'PREMIUM'|'STANDARD'|'BASIC', email?: string, id?: string, address?: any, location?: 'EUROPE'|'USA'|'ASIA' }} UserInfo
 * @typedef {{ method?: 'CREDIT_CARD'|'DEBIT_CARD'|'PAYPAL'|'BANK_TRANSFER'|'CRYPTO', type?: 'CARD'|'BANK'|'DIGITAL', amount?: number }} PaymentInfo
 * @typedef {{ type?: 'EXPRESS'|'STANDARD'|'ECONOMY'|'PICKUP', speed?: 'FAST'|'MEDIUM'|'SLOW' }} ShippingInfo
 * @typedef {{ code?: 'SAVE10'|'SAVE20'|'SAVE30'|'SAVE50'|'FREESHIP'|'BOGO', discount?: number }} PromoInfo
 * @typedef {{ checkStock?: (id: string, qty: number) => boolean }} Inventory
 */

/**
 * Util: arredonda para 2 casas com segurança.
 */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Soma subtotal dos itens válidos.
 */
function computeSubtotal(items = []) {
  return items
    .filter(it => it && typeof it.price === 'number' && typeof it.quantity === 'number' && it.price > 0 && it.quantity > 0)
    .reduce((acc, it) => acc + it.price * it.quantity, 0);
}

/**
 * Descontos por tipo de usuário (versão "processOrder").
 */
const USER_TIER_DISCOUNT = {
  VIP: 0.15,
  GOLD: 0.10,
  SILVER: 0.05,
  BRONZE: 0.02,
  REGULAR: 0.0
};

/**
 * Frete por tipo.
 */
const SHIPPING_BY_TYPE = {
  EXPRESS: 25,
  STANDARD: 15,
  ECONOMY: 8,
  PICKUP: 0
};

/**
 * Taxas por estado (fallback 5%).
 */
const TAX_BY_STATE = {
  CA: 0.0875,
  NY: 0.08,
  TX: 0.0625,
  FL: 0.0
};

/**
 * Taxa por método de pagamento (versão "processOrder").
 */
const PAY_FEE_BY_METHOD = {
  CREDIT_CARD: 0.029,
  DEBIT_CARD: 0.015,
  PAYPAL: 0.034,
  BANK_TRANSFER: 0.0,
  CRYPTO: 0.01
};

/**
 * Promos comuns.
 * Retorna { addDiscountRate?: number, freeShipping?: boolean }
 */
function resolvePromo(code) {
  switch (code) {
    case 'SAVE10': return { addDiscountRate: 0.10 };
    case 'SAVE20': return { addDiscountRate: 0.20 };
    case 'SAVE30': return { addDiscountRate: 0.30 };
    case 'SAVE50': return { addDiscountRate: 0.50 };
    case 'FREESHIP': return { freeShipping: true };
    case 'BOGO': return { addDiscountRate: 0.50 }; // simplificado
    default: return {};
  }
}

/**
 * Motor de cálculo genérico.
 * Aceita duas “dialetos” porque você tinha dois métodos duplicados com nomes diferentes.
 * Use os campos que tiver, o motor se adapta.
 *
 * @param {{ order?: OrderData, user?: UserInfo, payment?: PaymentInfo, shipping?: ShippingInfo, promo?: PromoInfo }} ctx
 * @param {'A'|'B'} dialect - 'A' replica regras de processOrder; 'B' replica calculateOrderTotal
 */
function computeTotals(ctx, dialect = 'A') {
  const order = ctx.order ?? ctx.orderData;
  const user = ctx.user ?? ctx.userInfo ?? ctx.customer;
  const payment = ctx.payment ?? ctx.paymentInfo;
  const shipping = ctx.shipping ?? ctx.shippingInfo ?? ctx.delivery;
  const promo = ctx.promo ?? ctx.promoInfo ?? ctx.coupon;

  const items = order?.items ?? order?.products ?? [];
  const subtotal = computeSubtotal(items.map(p => ({
    price: p.price ?? p.cost,
    quantity: p.quantity ?? p.count
  })));

  // Desconto base por usuário
  let baseDiscountRate = 0;
  if (dialect === 'A') {
    if (user?.type && USER_TIER_DISCOUNT[user.type] != null) {
      baseDiscountRate = USER_TIER_DISCOUNT[user.type];
    }
  } else {
    // dialect B: PREMIUM 20%, STANDARD 10%, BASIC 5%
    if (user?.level === 'PREMIUM') baseDiscountRate = 0.20;
    else if (user?.level === 'STANDARD') baseDiscountRate = 0.10;
    else if (user?.level === 'BASIC') baseDiscountRate = 0.05;
  }
  const discountUser = subtotal * baseDiscountRate;

  // Desconto via cupom/promo
  let discountPromo = 0;
  let freeShipping = false;

  if (dialect === 'A') {
    const { addDiscountRate = 0, freeShipping: fs } = resolvePromo(promo?.code);
    freeShipping = Boolean(fs);
    discountPromo = subtotal * addDiscountRate;
  } else {
    // dialect B: coupon.discount é uma taxa (0.05, 0.10, etc.)
    if (typeof promo?.discount === 'number' && promo.discount > 0) {
      discountPromo = subtotal * promo.discount;
    }
  }

  const discount = discountUser + discountPromo;

  // Frete
  let shippingCost = 0;
  if (dialect === 'A') {
    shippingCost = SHIPPING_BY_TYPE[shipping?.type] ?? 0;
  } else {
    const MAP = { FAST: 30, MEDIUM: 15, SLOW: 5 };
    shippingCost = MAP[shipping?.speed] ?? 0;
  }
  if (freeShipping) shippingCost = 0;

  // Taxa
  let taxableBase = Math.max(0, subtotal - discount);
  let taxRate = 0;
  if (dialect === 'A') {
    taxRate = TAX_BY_STATE[user?.state] ?? 0.05;
  } else {
    const MAP = { EUROPE: 0.20, USA: 0.10, ASIA: 0.15 };
    taxRate = MAP[user?.location] ?? 0.0;
  }
  const tax = taxableBase * taxRate;

  // Tarifa pagamento
  let payFeeRate = 0;
  if (dialect === 'A') {
    payFeeRate = PAY_FEE_BY_METHOD[payment?.method] ?? 0;
  } else {
    const MAP = { CARD: 0.03, BANK: 0.0, DIGITAL: 0.02 };
    payFeeRate = MAP[payment?.type] ?? 0.0;
  }
  const paymentFee = taxableBase * payFeeRate;

  // Total
  let total = subtotal - discount + tax + shippingCost + paymentFee;
  total = Math.max(0, round2(total));

  return {
    subtotal: round2(subtotal),
    discountUser: round2(discountUser),
    discountPromo: round2(discountPromo),
    discount: round2(discount),
    tax: round2(tax),
    shipping: round2(shippingCost),
    paymentFee: round2(paymentFee),
    total
  };
}

/**
 * Validação de pedido: sem ninho de ifs, early-return, mensagens claras.
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
function validateOrder(order, user, payment, inventory) {
  const errors = [];
  const warnings = [];

  // Pedido e itens
  if (!order) {
    errors.push('Pedido não informado');
    return { isValid: false, errors, warnings };
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    errors.push('Pedido sem itens');
    return { isValid: false, errors, warnings };
  }

  for (const item of order.items) {
    if (!item) {
      errors.push('Item inválido');
      continue;
    }
    if (!item.id) errors.push('ID do item não informado');
    if (!(item.quantity > 0)) errors.push(`Quantidade inválida para item ${item.id ?? '?'}`);
    if (!(item.price > 0)) errors.push(`Preço inválido para item ${item.id ?? '?'}`);

    // estoque, se disponível
    if (inventory?.checkStock && item?.id && item?.quantity > 0) {
      const ok = inventory.checkStock(String(item.id), Number(item.quantity));
      if (!ok) errors.push(`Item ${item.id} não disponível`);
    }
  }

  // Usuário
  if (!user) {
    errors.push('Usuário não informado');
  } else {
    if (!user.id) errors.push('ID do usuário não informado');
    if (!user.email) errors.push('Email do usuário não informado');
    if (!user.address) errors.push('Endereço do usuário não informado');
  }

  // Pagamento
  if (!payment) {
    errors.push('Informações de pagamento não fornecidas');
  } else {
    if (!payment.method && !payment.type) errors.push('Método de pagamento não informado');
    if (!(payment.amount > 0)) errors.push('Valor do pagamento inválido ou não informado');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

class OrderProcessor {
  /**
   * Compatível com o antigo processOrder.
   * @param {OrderData} orderData
   * @param {UserInfo} userInfo
   * @param {PaymentInfo} paymentInfo
   * @param {ShippingInfo} shippingInfo
   * @param {PromoInfo} promoInfo
   * @returns {number} total arredondado
   */
  processOrder(orderData, userInfo, paymentInfo, shippingInfo, promoInfo) {
    return computeTotals(
      { order: orderData, user: userInfo, payment: paymentInfo, shipping: shippingInfo, promo: promoInfo },
      'A'
    ).total;
  }

  /**
   * Compatível com o antigo calculateOrderTotal.
   * @returns {number} total arredondado
   */
  calculateOrderTotal(order, customer, payment, delivery, coupon) {
    return computeTotals(
      { order, user: customer, payment, shipping: delivery, promo: coupon },
      'B'
    ).total;
  }

  /**
   * Novo: retorna breakdown completo, útil para exibir em UI ou auditar.
   */
  calculateOrderBreakdown(order, user, payment, shipping, promo, dialect = 'A') {
    return computeTotals({ order, user, payment, shipping, promo }, dialect);
  }

  /**
   * Valida pedido e dados essenciais.
   * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
   */
  validateAndProcessOrder(order, user, payment, shipping, promo, inventory) {
    return validateOrder(order, user, payment, inventory);
  }
}

module.exports = { OrderProcessor, computeTotals, validateOrder };
