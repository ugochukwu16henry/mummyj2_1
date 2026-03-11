const CART_KEY = "mjt-cart-v1";

function normalizeState(state) {
  if (!state || typeof state !== "object") {
    return { items: [], saved: [] };
  }

  if (Array.isArray(state)) {
    return { items: state, saved: [] };
  }

  return {
    items: Array.isArray(state.items) ? state.items : [],
    saved: Array.isArray(state.saved) ? state.saved : []
  };
}

export function parsePrice(value) {
  const numeric = String(value).replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(numeric || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNaira(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
}

export function getCartState() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn("Could not read cart state:", error);
    return { items: [], saved: [] };
  }
}

export function saveCartState(state) {
  const normalized = normalizeState(state);
  localStorage.setItem(CART_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getCartCount() {
  const { items } = getCartState();
  return items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

export function updateCartBadge() {
  const badge = document.getElementById("cart-count");
  if (!badge) {
    return;
  }

  const count = getCartCount();
  badge.textContent = String(count);
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

function upsertItem(list, incoming) {
  const existing = list.find((item) => item.id === incoming.id);
  if (existing) {
    existing.qty += incoming.qty;
    return list;
  }
  return [...list, incoming];
}

export function addItemToCart(item) {
  const state = getCartState();
  const prepared = {
    id: Number(item.id),
    name: item.name,
    img: item.img,
    category: item.category || "",
    price: item.price,
    qty: Number(item.qty) > 0 ? Number(item.qty) : 1
  };

  state.items = upsertItem(state.items, prepared);
  saveCartState(state);
  updateCartBadge();
  return state;
}

export function adjustItemQuantity(id, delta) {
  const state = getCartState();
  const target = state.items.find((item) => item.id === Number(id));
  if (!target) {
    return state;
  }

  target.qty = Math.max(1, (Number(target.qty) || 1) + Number(delta));
  saveCartState(state);
  updateCartBadge();
  return state;
}

export function removeItemFromCart(id) {
  const state = getCartState();
  const index = state.items.findIndex((item) => item.id === Number(id));
  if (index < 0) {
    return { state, removed: null, index: -1 };
  }

  const [removed] = state.items.splice(index, 1);
  saveCartState(state);
  updateCartBadge();
  return { state, removed, index };
}

export function restoreRemovedItem(removed, index) {
  if (!removed) {
    return getCartState();
  }

  const state = getCartState();
  const insertAt = Math.max(0, Math.min(index, state.items.length));
  state.items.splice(insertAt, 0, removed);
  saveCartState(state);
  updateCartBadge();
  return state;
}

export function moveItemToSaved(id) {
  const state = getCartState();
  const index = state.items.findIndex((item) => item.id === Number(id));
  if (index < 0) {
    return state;
  }

  const [item] = state.items.splice(index, 1);
  state.saved = upsertItem(state.saved, { ...item, qty: 1 });
  saveCartState(state);
  updateCartBadge();
  return state;
}

export function moveSavedToCart(id) {
  const state = getCartState();
  const index = state.saved.findIndex((item) => item.id === Number(id));
  if (index < 0) {
    return state;
  }

  const [item] = state.saved.splice(index, 1);
  state.items = upsertItem(state.items, { ...item, qty: 1 });
  saveCartState(state);
  updateCartBadge();
  return state;
}
