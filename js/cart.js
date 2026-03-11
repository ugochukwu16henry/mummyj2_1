import {
  addItemToCart,
  adjustItemQuantity,
  formatNaira,
  getCartState,
  moveItemToSaved,
  moveSavedToCart,
  parsePrice,
  removeItemFromCart,
  restoreRemovedItem,
  updateCartBadge
} from "./cart-store.js";

const SHIPPING_THRESHOLD = 15000;
const SHIPPING_FEE = 2500;
const TAX_RATE = 0.075;

let menuItems = [];
let undoTimer = null;

const cartList = document.getElementById("cart-items");
const savedList = document.getElementById("saved-items");
const upsellList = document.getElementById("upsell-track");
const promoToggle = document.getElementById("promo-toggle");
const promoSection = document.getElementById("promo-field");
const toast = document.getElementById("cart-toast");

function showToast(message, withUndo = false, onUndo = null) {
  if (!toast) {
    return;
  }

  toast.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  if (withUndo && onUndo) {
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.className = "toast-undo";
    undoButton.textContent = "Undo";
    undoButton.addEventListener("click", () => {
      onUndo();
      hideToast();
    });
    toast.appendChild(undoButton);
  }

  toast.classList.add("show");
  if (undoTimer) {
    clearTimeout(undoTimer);
  }

  undoTimer = setTimeout(() => {
    hideToast();
  }, 4500);
}

function hideToast() {
  if (!toast) {
    return;
  }
  toast.classList.remove("show");
}

function calcTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + parsePrice(item.price) * (Number(item.qty) || 1), 0);
  const shipping = subtotal === 0 ? 0 : subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + shipping + tax;
  const remainingForFreeShipping = Math.max(0, SHIPPING_THRESHOLD - subtotal);
  return { subtotal, shipping, tax, total, remainingForFreeShipping };
}

function updateSummary(items) {
  const totals = calcTotals(items);

  document.getElementById("subtotal").textContent = formatNaira(totals.subtotal);
  document.getElementById("shipping").textContent = totals.shipping === 0 ? "Free" : formatNaira(totals.shipping);
  document.getElementById("tax").textContent = formatNaira(totals.tax);
  document.getElementById("order-total").textContent = formatNaira(totals.total);

  const progress = document.getElementById("shipping-progress-fill");
  const progressText = document.getElementById("shipping-progress-text");
  const progressPercent = Math.min(100, (totals.subtotal / SHIPPING_THRESHOLD) * 100);
  progress.style.width = `${progressPercent}%`;
  progressText.textContent = totals.remainingForFreeShipping > 0
    ? `Add ${formatNaira(totals.remainingForFreeShipping)} for free shipping`
    : "You unlocked free shipping";

  const mobileTotal = document.getElementById("mobile-total");
  mobileTotal.textContent = formatNaira(totals.total);
}

function renderCartItems() {
  const state = getCartState();
  const { items, saved } = state;

  if (!cartList) {
    return;
  }

  if (items.length === 0) {
    cartList.innerHTML = `
      <article class="cart-empty">
        <h2>Your cart is empty</h2>
        <p>Add products from the menu to see them here.</p>
        <a href="menu.html" class="btn btn-primary">Browse Menu</a>
      </article>
    `;
  } else {
    cartList.innerHTML = items.map((item) => `
      <article class="cart-item" data-id="${item.id}">
        <img src="${item.img}" alt="${item.name}">
        <div class="cart-item-content">
          <div class="cart-item-top">
            <div>
              <h3>${item.name}</h3>
              <p class="cart-meta">${item.category}</p>
              <button class="save-later" data-save="${item.id}">Save for later</button>
            </div>
            <p class="cart-price">${item.price}</p>
          </div>
          <div class="cart-item-actions">
            <div class="qty-control" aria-label="Quantity controls for ${item.name}">
              <button type="button" data-qty="-1" data-id="${item.id}" aria-label="Decrease quantity">-</button>
              <span>${item.qty}</span>
              <button type="button" data-qty="1" data-id="${item.id}" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="remove-item" data-remove="${item.id}" aria-label="Remove ${item.name}">Remove</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  if (savedList) {
    savedList.innerHTML = saved.length
      ? saved.map((item) => `
        <article class="saved-item">
          <img src="${item.img}" alt="${item.name}">
          <div>
            <h4>${item.name}</h4>
            <p>${item.price}</p>
            <button type="button" class="move-to-cart" data-move="${item.id}">Move to cart</button>
          </div>
        </article>
      `).join("")
      : "<p class=\"saved-empty\">No saved items yet.</p>";
  }

  updateSummary(items);
  updateCartBadge();
}

function attachCartEvents() {
  document.addEventListener("click", (event) => {
    const qtyBtn = event.target.closest("button[data-qty]");
    if (qtyBtn) {
      const id = Number(qtyBtn.dataset.id);
      const delta = Number(qtyBtn.dataset.qty);
      adjustItemQuantity(id, delta);
      renderCartItems();
      return;
    }

    const removeBtn = event.target.closest("button[data-remove]");
    if (removeBtn) {
      const id = Number(removeBtn.dataset.remove);
      const { removed, index } = removeItemFromCart(id);
      renderCartItems();
      if (removed) {
        showToast(`${removed.name} removed from cart`, true, () => {
          restoreRemovedItem(removed, index);
          renderCartItems();
        });
      }
      return;
    }

    const saveBtn = event.target.closest("button[data-save]");
    if (saveBtn) {
      moveItemToSaved(Number(saveBtn.dataset.save));
      renderCartItems();
      showToast("Item saved for later");
      return;
    }

    const moveBtn = event.target.closest("button[data-move]");
    if (moveBtn) {
      moveSavedToCart(Number(moveBtn.dataset.move));
      renderCartItems();
      showToast("Item moved to cart");
      return;
    }

    const upsellBtn = event.target.closest("button[data-upsell]");
    if (upsellBtn) {
      const id = Number(upsellBtn.dataset.upsell);
      const item = menuItems.find((entry) => entry.id === id);
      if (item) {
        addItemToCart(item);
        renderCartItems();
        showToast(`${item.name} added to cart`);
      }
    }
  });

  let touchStartX = 0;
  document.addEventListener("touchstart", (event) => {
    const card = event.target.closest(".cart-item");
    if (!card) {
      return;
    }
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  document.addEventListener("touchend", (event) => {
    const card = event.target.closest(".cart-item");
    if (!card) {
      return;
    }

    const touchEndX = event.changedTouches[0].clientX;
    if (touchStartX - touchEndX > 80) {
      const id = Number(card.dataset.id);
      const { removed, index } = removeItemFromCart(id);
      renderCartItems();
      if (removed) {
        showToast(`${removed.name} removed`, true, () => {
          restoreRemovedItem(removed, index);
          renderCartItems();
        });
      }
    }
  }, { passive: true });
}

async function loadMenuData() {
  const response = await fetch("data/menu.json");
  if (!response.ok) {
    throw new Error("Could not load menu data");
  }
  menuItems = await response.json();
}

function renderUpsells() {
  if (!upsellList) {
    return;
  }

  const { items } = getCartState();
  const idsInCart = new Set(items.map((item) => item.id));
  const suggestions = menuItems.filter((item) => !idsInCart.has(item.id)).slice(0, 8);

  upsellList.innerHTML = suggestions.map((item) => `
    <article class="upsell-card">
      <img src="${item.img}" alt="${item.name}">
      <h4>${item.name}</h4>
      <p>${item.price}</p>
      <button type="button" class="btn btn-primary" data-upsell="${item.id}">Quick Add</button>
    </article>
  `).join("");
}

function setupPromoToggle() {
  if (!promoToggle || !promoSection) {
    return;
  }

  promoToggle.addEventListener("click", () => {
    const isHidden = promoSection.hasAttribute("hidden");
    if (isHidden) {
      promoSection.removeAttribute("hidden");
      promoToggle.setAttribute("aria-expanded", "true");
    } else {
      promoSection.setAttribute("hidden", "hidden");
      promoToggle.setAttribute("aria-expanded", "false");
    }
  });
}

async function initCartPage() {
  try {
    await loadMenuData();
  } catch (error) {
    console.warn(error.message);
  }

  renderCartItems();
  renderUpsells();
  attachCartEvents();
  setupPromoToggle();
}

document.addEventListener("DOMContentLoaded", initCartPage);
