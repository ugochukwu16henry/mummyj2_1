import {
  addItemToCart,
  adjustItemQuantity,
  formatNaira,
  getCartState,
  moveItemToSaved,
  moveSavedToCart,
  parsePrice,
  removeItemFromCart,
  saveCartState,
  restoreRemovedItem,
  updateCartBadge
} from "./cart-store.js";

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5050/api"
    : "https://mummyj21-frontend-production.up.railway.app/api";
const ADMIN_WHATSAPP_NUMBER = "2349068042947";
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

let menuItems = [];
let undoTimer = null;
let touchStartX = 0;
let touchStartY = 0;
let activeTouchCard = null;
let previousTotal = 0;

const cartList = document.getElementById("cart-items");
const savedList = document.getElementById("saved-items");
const upsellList = document.getElementById("upsell-track");
const promoToggle = document.getElementById("promo-toggle");
const promoSection = document.getElementById("promo-field");
const toast = document.getElementById("cart-toast");
const checkoutPanel = document.getElementById("checkout-panel");
const checkoutForm = document.getElementById("checkout-form");
const checkoutMessage = document.getElementById("checkout-message");
const checkoutEmailInput = document.getElementById("checkout-email");
const checkoutReceiptInput = document.getElementById("checkout-receipt");
const checkoutReceiptName = document.getElementById("checkout-receipt-name");
const confirmPaymentButton = document.getElementById("confirm-payment-btn");

function getLinkedOrderRequests(items) {
  return items
    .map((item) => item?.order_request)
    .filter((request) => request && typeof request === "object");
}

function getUniqueLinkedOrderRequestIds(requests) {
  return Array.from(
    new Set(
      requests
        .map((request) => String(request.orderRequestId || request.orderId || "").trim())
        .filter(Boolean)
    )
  );
}

async function fileToDataUrl(file) {
  if (!file) {
    return "";
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read receipt file"));
    reader.readAsDataURL(file);
  });
}

function setCheckoutMessage(message, type = "") {
  if (!checkoutMessage) {
    return;
  }

  checkoutMessage.textContent = message;
  checkoutMessage.classList.remove("ok", "error");
  if (type) {
    checkoutMessage.classList.add(type);
  }
}

function setCheckoutProcessing(isProcessing) {
  if (!confirmPaymentButton) {
    return;
  }
  confirmPaymentButton.classList.toggle("is-processing", isProcessing);
  confirmPaymentButton.disabled = isProcessing;
}

function openCheckoutPanel() {
  const { items } = getCartState();
  if (!items.length) {
    showToast("Your cart is empty. Add items before checkout.");
    return;
  }

  if (checkoutPanel) {
    checkoutPanel.removeAttribute("hidden");
    checkoutPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.body.classList.add("checkout-focus");
  setCheckoutMessage("");

  const checkoutNameInput = document.getElementById("checkout-name");
  if (checkoutNameInput && !checkoutNameInput.value) {
    checkoutNameInput.focus();
  }
}

function closeCheckoutPanel() {
  if (checkoutPanel) {
    checkoutPanel.setAttribute("hidden", "hidden");
  }
  document.body.classList.remove("checkout-focus");
}

function setupCheckoutForm() {
  if (!checkoutForm) {
    return;
  }

  checkoutReceiptInput?.addEventListener("change", () => {
    const file = checkoutReceiptInput.files?.[0] || null;
    if (checkoutReceiptName) {
      checkoutReceiptName.textContent = file
        ? `Selected receipt: ${file.name}`
        : "";
    }
  });

  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const { items, saved } = getCartState();
    if (!items.length) {
      setCheckoutMessage("Your cart is empty. Add products before checkout.", "error");
      return;
    }

    const receiptFile = checkoutReceiptInput?.files?.[0] || null;
    if (!receiptFile) {
      setCheckoutMessage("Please upload your bank transfer receipt.", "error");
      return;
    }

    if (receiptFile.size > MAX_RECEIPT_BYTES) {
      setCheckoutMessage("Receipt file is too large. Please upload a file under 5MB.", "error");
      return;
    }

    const email = String(document.getElementById("checkout-email")?.value || "").trim();
    const customerName = String(document.getElementById("checkout-name")?.value || "").trim();
    const phone = String(document.getElementById("checkout-phone")?.value || "").trim();
    const bankReference = String(document.getElementById("checkout-reference")?.value || "").trim();

    if (!customerName || !phone) {
      setCheckoutMessage("Please fill all required checkout fields.", "error");
      return;
    }

    setCheckoutProcessing(true);
    setCheckoutMessage("Submitting payment confirmation...");

    try {
      const receiptUrl = await fileToDataUrl(receiptFile);
      const totals = calcTotals(items);
      const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
      const orderLineLabels = items.map((item) => `${item.name} x${Number(item.qty) || 1}`);
      const linkedOrderRequests = getLinkedOrderRequests(items);
      const linkedOrderRequestIds = getUniqueLinkedOrderRequestIds(linkedOrderRequests);
      const primaryLinkedRequest = linkedOrderRequests.length === 1 ? linkedOrderRequests[0] : null;
      const orderId = `ORD-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const linkedRequestSummary = linkedOrderRequests
        .map((request) => {
          const requestId = String(request.orderRequestId || request.orderId || "").trim();
          const needDate = String(request.date || "").trim();
          const needTime = String(request.time || "").trim();
          const neededAt = `${needDate}${needTime ? ` ${needTime}` : ""}`.trim() || "unspecified";
          const qtyNeeded = Number(request.qty) > 0 ? Number(request.qty) : 1;
          return `${requestId || "N/A"} (${String(request.productName || "Item")} x${qtyNeeded} - ${neededAt})`;
        })
        .join(" | ");

      const notesParts = [
        `Bank transfer submitted by ${customerName}. Items: ${orderLineLabels.join(" | ")}`
      ];
      if (linkedOrderRequestIds.length) {
        notesParts.push(`Linked order request IDs: ${linkedOrderRequestIds.join(", ")}`);
      }
      if (linkedRequestSummary) {
        notesParts.push(`Requested schedule: ${linkedRequestSummary}`);
      }

      const orderPayload = {
        orderId,
        orderSource: linkedOrderRequestIds.length ? "order_only_checkout" : "cart_checkout",
        productId: items[0]?.product_id || items[0]?.id || "",
        productName: orderLineLabels.join(", "),
        qty: totalQty,
        date: primaryLinkedRequest?.date || "",
        time: primaryLinkedRequest?.time || "",
        customerName,
        customerEmail: email,
        phone,
        notes: notesParts.join(" • "),
        status: "awaiting_bank_transfer",
        paymentStatus: "proof_submitted",
        paymentMethod: "bank_transfer",
        amountDue: totals.total,
        bankName: "Opay",
        bankAccountNumber: "9068042947",
        bankAccountName: "Marylou Ihechi Okechukwu",
        bankReference,
        receiptImage: receiptUrl,
        linkedOrderRequestIds,
        linkedOrderRequests: linkedOrderRequests.map((request) => ({
          orderRequestId: String(request.orderRequestId || request.orderId || ""),
          productId: String(request.productId || ""),
          productName: String(request.productName || ""),
          qty: Number(request.qty) > 0 ? Number(request.qty) : 1,
          date: String(request.date || ""),
          time: String(request.time || ""),
          customerName: String(request.customerName || ""),
          phone: String(request.phone || ""),
          notes: String(request.notes || "")
        })),
        orderLines: items.map((item) => ({
          id: item.id,
          productId: item.product_id || item.id,
          productName: item.name,
          qty: Number(item.qty) || 1,
          unitPrice: parsePrice(item.price),
          total: parsePrice(item.price) * (Number(item.qty) || 1)
        })),
        createdAt
      };

      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderPayload)
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not submit payment confirmation");
      }

      saveCartState({ items: [], saved });
      renderCartItems();
      checkoutForm.reset();
      if (checkoutReceiptName) {
        checkoutReceiptName.textContent = "";
      }
      closeCheckoutPanel();
      setCheckoutMessage("Payment submitted. Awaiting admin verification.", "ok");
      showToast("Payment confirmation submitted. We will verify and update your order.");

      const adminMessage = encodeURIComponent(
        [
          "New bank transfer order submitted.",
          `Order ID: ${orderId}`,
          `Customer: ${customerName}`,
          `Email: ${email}`,
          `Phone: ${phone}`,
          `Total: ${formatNaira(totals.total)}`,
          `Reference: ${bankReference}`
        ].join("\n")
      );
      window.open(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${adminMessage}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      setCheckoutMessage(error.message || "Could not submit payment confirmation.", "error");
    } finally {
      setCheckoutProcessing(false);
    }
  });
}

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

function getUpsellStatusBadge(item) {
  if (item.outOfStock) {
    return '<p class="upsell-stock-badge out" aria-label="Out of stock">Out of Stock</p>';
  }
  if (item.lowStock) {
    return '<p class="upsell-stock-badge low" aria-label="Low stock">Low Stock</p>';
  }
  return '<p class="upsell-stock-badge in" aria-label="In stock">In Stock</p>';
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
  return { subtotal, total: subtotal };
}

function updateSummary(items) {
  const totals = calcTotals(items);

  document.getElementById("subtotal").textContent = formatNaira(totals.subtotal);
  animateCurrencyChange("order-total", previousTotal, totals.total);

  const mobileStickyTotal = document.getElementById("mobile-subtotal");
  if (mobileStickyTotal) {
    animateCurrencyChange("mobile-subtotal", previousTotal, totals.total);
  }

  const mobileTitle = document.getElementById("mobile-cart-title");
  if (mobileTitle) {
    const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    mobileTitle.textContent = `Your Cart (${totalQty} item${totalQty === 1 ? "" : "s"})`;
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

  if (!sortedItems.length) {
    closeCheckoutPanel();
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
    const openCheckoutBtn = event.target.closest("[data-open-checkout]");
    if (openCheckoutBtn) {
      openCheckoutPanel();
      return;
    }

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
    touchStartY = event.changedTouches[0].clientY;
    activeTouchCard = card;
  }, { passive: true });

  document.addEventListener("touchend", (event) => {
    const card = event.target.closest(".cart-item") || activeTouchCard;
    if (!card) {
      return;
    }

    const isMobileLayout = window.matchMedia("(max-width: 1100px)").matches || document.body.classList.contains("force-mobile");
    if (isMobileLayout) {
      card.classList.remove("swiped");
      activeTouchCard = null;
      return;
    }

    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY;

    const mostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    if (!mostlyHorizontal) {
      activeTouchCard = null;
      return;
    }

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
  // Prefer live catalog from backend so stock/order-only flags match admin dashboard
  try {
    const apiRes = await fetch("/api/catalog-public", { cache: "no-store" });
    if (apiRes.ok) {
      const rawPayload = await apiRes.json();
      menuItems = normalizeProducts(rawPayload);
      return;
    }
  } catch {
    // fall through to static JSON
  }

  const candidatePaths = ["data/catalog.json", "./data/catalog.json", "data/menu.json", "./data/menu.json"];

  let response = null;
  for (const candidate of candidatePaths) {
    try {
      const attempt = await fetch(candidate, { cache: "no-store" });
      if (attempt.ok) {
        response = attempt;
        break;
      }
    } catch {
      // try next source
    }
  }

  if (!response || !response.ok) {
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
  const idsInCart = new Set(items.map((item) => String(item.product_id || item.id)));
  const suggestions = menuItems
    .filter((item) => !idsInCart.has(String(item.id)) && !item.orderOnly)
    .sort((a, b) => {
      if (a.stockRank !== b.stockRank) {
        return a.stockRank - b.stockRank;
      }

      const categoryDiff = a.category.localeCompare(b.category);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  upsellList.innerHTML = suggestions.map((item) => `
    <article class="upsell-card">
      <img src="${item.img}" alt="${item.name}">
      ${getUpsellStatusBadge(item)}
      <h4>${item.name}</h4>
      <p class="cart-meta">${item.category}</p>
      <p>${item.price}</p>
      <button type="button" class="btn btn-primary" data-upsell="${item.id}" ${item.outOfStock ? "disabled" : ""}>${item.outOfStock ? "Unavailable" : "Quick Add"}</button>
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
  setupCheckoutForm();
  setupPromoToggle();

  const openCheckoutParam = new URLSearchParams(window.location.search).get("openCheckout");
  if (openCheckoutParam === "1") {
    openCheckoutPanel();
    const nextUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, "", nextUrl);
  }
}

document.addEventListener("DOMContentLoaded", initCartPage);
