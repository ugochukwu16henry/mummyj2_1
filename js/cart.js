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
let touchStartX = 0;
let activeTouchCard = null;
let previousTotal = 0;

const cartList = document.getElementById("cart-items");
const savedList = document.getElementById("saved-items");
const upsellList = document.getElementById("upsell-track");
const promoToggle = document.getElementById("promo-toggle");
const promoSection = document.getElementById("promo-field");
const toast = document.getElementById("cart-toast");

function animateCurrencyChange(elementId, startValue, endValue, duration = 240) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  if (startValue === endValue) {
    element.textContent = formatNaira(endValue);
    return;
  }

  const startTime = performance.now();
  const valueDelta = endValue - startValue;

  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const easedProgress = 1 - ((1 - progress) ** 2);
    const nextValue = startValue + (valueDelta * easedProgress);
    element.textContent = formatNaira(nextValue);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function formatPrice(value) {
  if (typeof value === "number") {
    return `₦${value.toLocaleString("en-NG")}`;
  }
  return value || "₦0";
}

function normalizeProducts(rawPayload) {
  const sourceItems = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(rawPayload?.products)
      ? rawPayload.products
      : [];

  return sourceItems.map((item, index) => {
    const stock = Number(item.stock || 0);
    const outOfStock = Boolean(item.out_of_stock) || stock <= 0;
    const lowStock = !outOfStock && stock > 0 && stock <= 10;
    const stockRank = outOfStock ? 2 : lowStock ? 1 : 0;

    return {
      id: item.id ?? `item-${index + 1}`,
      name: item.name || "Untitled Product",
      category: item.category || "General",
      price: formatPrice(item.price),
      desc: item.desc || item.description || "",
      img: item.img || item.image || "images/placeholder.png",
      orderOnly: Boolean(item.order_only),
      stock,
      outOfStock,
      lowStock,
      stockRank
    };
  });
}

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
  animateCurrencyChange("order-total", previousTotal, totals.total);

  const progress = document.getElementById("shipping-progress-fill");
  const progressText = document.getElementById("shipping-progress-text");
  const progressPercent = Math.min(100, (totals.subtotal / SHIPPING_THRESHOLD) * 100);
  if (progress) {
    progress.style.width = `${progressPercent}%`;
  }
  const progressMessage = totals.remainingForFreeShipping > 0
    ? `Add ${formatNaira(totals.remainingForFreeShipping)} for free shipping`
    : "You unlocked free shipping";
  if (progressText) {
    progressText.textContent = progressMessage;
  }

  const mobileProgress = document.getElementById("mobile-shipping-progress-fill");
  const mobileProgressText = document.getElementById("mobile-shipping-progress-text");
  if (mobileProgress) {
    mobileProgress.style.width = `${progressPercent}%`;
  }
  if (mobileProgressText) {
    mobileProgressText.textContent = progressMessage;
  }

  const mobileStickyTotal = document.getElementById("mobile-subtotal");
  if (mobileStickyTotal) {
    animateCurrencyChange("mobile-subtotal", previousTotal, totals.total);
  }

  const mobileTitle = document.getElementById("mobile-cart-title");
  if (mobileTitle) {
    mobileTitle.textContent = `Your Cart (${items.length} item${items.length === 1 ? "" : "s"})`;
  }

  previousTotal = totals.total;
}

function renderCartItems() {
  const state = getCartState();
  const { items, saved } = state;
  const sortedItems = items
    .slice()
    .sort((a, b) => {
      const rankA = typeof a.stock_rank === "number" ? a.stock_rank : 0;
      const rankB = typeof b.stock_rank === "number" ? b.stock_rank : 0;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  if (!cartList) {
    return;
  }

  if (sortedItems.length === 0) {
    cartList.innerHTML = `
      <article class="cart-empty">
        <h2>Your cart is empty</h2>
        <p>Add products from the menu to see them here.</p>
        <a href="menu.html" class="btn btn-primary">Browse Menu</a>
      </article>
    `;
  } else {
    cartList.innerHTML = sortedItems.map((item) => `
      <article class="cart-item" data-id="${item.id}">
        <div class="cart-item-shell">
          <img src="${item.img}" alt="${item.name}">
          <div class="cart-item-content">
            <div class="cart-item-top">
              <div>
                <h3>${item.name}</h3>
                <p class="cart-meta">${item.category}</p>
                ${item.order_request ? `<p class="cart-meta">Need: ${item.order_request.date} ${item.order_request.time} • Qty: ${item.order_request.qty}</p>` : ""}
                ${item.order_request?.notes ? `<p class="cart-meta">Note: ${item.order_request.notes}</p>` : ""}
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
        </div>
        <button type="button" class="swipe-delete" data-swipe-remove="${item.id}" aria-label="Delete ${item.name}">Delete</button>
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

  updateSummary(sortedItems);
  updateCartBadge();
}

function attachCartEvents() {
  document.addEventListener("click", (event) => {
    const swipedDeleteBtn = event.target.closest("button[data-swipe-remove]");
    if (swipedDeleteBtn) {
      const id = swipedDeleteBtn.dataset.swipeRemove;
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

    const cartCard = event.target.closest(".cart-item");
    if (!cartCard) {
      document.querySelectorAll(".cart-item.swiped").forEach((item) => {
        item.classList.remove("swiped");
      });
    }

    const qtyBtn = event.target.closest("button[data-qty]");
    if (qtyBtn) {
      const id = qtyBtn.dataset.id;
      const delta = Number(qtyBtn.dataset.qty);
      adjustItemQuantity(id, delta);
      renderCartItems();
      return;
    }

    const removeBtn = event.target.closest("button[data-remove]");
    if (removeBtn) {
      const id = removeBtn.dataset.remove;
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
      moveItemToSaved(saveBtn.dataset.save);
      renderCartItems();
      showToast("Item saved for later");
      return;
    }

    const moveBtn = event.target.closest("button[data-move]");
    if (moveBtn) {
      moveSavedToCart(moveBtn.dataset.move);
      renderCartItems();
      showToast("Item moved to cart");
      return;
    }

    const upsellBtn = event.target.closest("button[data-upsell]");
    if (upsellBtn) {
      const id = upsellBtn.dataset.upsell;
      const item = menuItems.find((entry) => String(entry.id) === String(id));
      if (item) {
        addItemToCart(item);
        renderCartItems();
        showToast(`${item.name} added to cart`);
      }
    }
  });

  document.addEventListener("touchstart", (event) => {
    const card = event.target.closest(".cart-item");
    if (!card) {
      return;
    }
    touchStartX = event.changedTouches[0].clientX;
    activeTouchCard = card;
  }, { passive: true });

  document.addEventListener("touchend", (event) => {
    const card = event.target.closest(".cart-item") || activeTouchCard;
    if (!card) {
      return;
    }

    const touchEndX = event.changedTouches[0].clientX;
    const deltaX = touchStartX - touchEndX;

    if (deltaX > 55) {
      document.querySelectorAll(".cart-item.swiped").forEach((item) => {
        if (item !== card) {
          item.classList.remove("swiped");
        }
      });
      card.classList.add("swiped");
    } else if (deltaX < -35) {
      card.classList.remove("swiped");
    }

    activeTouchCard = null;
  }, { passive: true });
}

async function loadMenuData() {
  const response = await fetch("data/catalog.json");
  if (!response.ok) {
    throw new Error("Could not load menu data");
  }
  const rawPayload = await response.json();
  menuItems = normalizeProducts(rawPayload);
}

function renderUpsells() {
  if (!upsellList) {
    return;
  }

  const { items } = getCartState();
  const idsInCart = new Set(items.map((item) => String(item.id)));
  const suggestions = menuItems
    .filter((item) => !idsInCart.has(String(item.id)) && !item.orderOnly)
    .slice(0, 8);

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
