// menu.js
// Dynamic menu loading and display functionality
import { openModal } from "./modal.js";
import { addItemToCart, updateCartBadge } from "./cart-store.js";

let addToastTimer = null;
const ORDER_API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:5050/api"
  : "/api";

function formatPrice(value) {
  if (typeof value === "number") {
    return `₦${value.toLocaleString("en-NG")}`;
  }
  return value || "₦0";
}

function normalizeCatalogPayload(rawPayload) {
  const sourceItems = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(rawPayload?.products)
      ? rawPayload.products
      : [];

  return sourceItems.map((item, index) => ({
    id: item.id ?? `item-${index + 1}`,
    name: item.name || "Untitled Product",
    category: item.category || "General",
    price: formatPrice(item.price),
    desc: item.desc || item.description || "",
    img: item.img || item.image || "images/placeholder.png",
    orderOnly: Boolean(item.order_only),
    outOfStock: Boolean(item.out_of_stock) || Number(item.stock || 0) <= 0
  }));
}

async function submitOrderRequest(orderPayload) {
  try {
    await fetch(`${ORDER_API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });
  } catch (error) {
    console.warn("Could not send order request to API:", error.message);
  }
}

function getOrderModal() {
  let modal = document.getElementById("order-only-modal");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "order-only-modal";
  modal.className = "modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="modal-content order-modal-content">
      <button type="button" class="close" data-close-order-modal aria-label="Close order form">&times;</button>
      <h3>Order Request</h3>
      <p id="order-only-product-name"></p>
      <form id="order-only-form" class="order-only-form">
        <label>Your Name
          <input type="text" id="order-customer-name" required>
        </label>
        <label>Phone Number
          <input type="tel" id="order-phone" required>
        </label>
        <label>Quantity
          <input type="number" id="order-qty" min="1" value="1" required>
        </label>
        <label>Date Needed
          <input type="date" id="order-date" required>
        </label>
        <label>Time Needed
          <input type="time" id="order-time" required>
        </label>
        <label>Notes (optional)
          <textarea id="order-notes" placeholder="Color, pickup, delivery notes..."></textarea>
        </label>
        <button type="submit" class="btn btn-primary">Add Order to Cart</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close-order-modal]")) {
      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";
    }
  });

  return modal;
}

function openOrderOnlyForm(item) {
  const modal = getOrderModal();
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");

  const nameTarget = document.getElementById("order-only-product-name");
  nameTarget.textContent = `${item.name} is order-only. Fill details to continue.`;

  const form = document.getElementById("order-only-form");
  if (!form) {
    return;
  }

  form.dataset.itemId = String(item.id);
  form.dataset.itemName = item.name;
  form.dataset.itemPrice = item.price;
  form.dataset.itemImg = item.img;
  form.dataset.itemCategory = item.category;
}

function showAddToCartToast(message) {
  const existing = document.getElementById("cart-toast");
  const toast = existing || document.createElement("div");
  toast.id = "cart-toast";
  toast.className = "cart-toast";
  toast.innerHTML = "";

  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  const action = document.createElement("a");
  action.href = "cart.html";
  action.className = "toast-link";
  action.textContent = "View Cart";
  toast.appendChild(action);

  if (!existing) {
    document.body.appendChild(toast);
  }

  toast.classList.add("show");
  if (addToastTimer) {
    window.clearTimeout(addToastTimer);
  }

  addToastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

export async function loadMenu(container) {
  if (!container) {
    console.error("Menu container not found");
    return;
  }

  // Show loading state
  container.innerHTML = '<p class="loading">Loading menu...</p>';

  try {
    // Fetch JSON file - use multiple strategies for maximum compatibility
    // Strategy 1: Use import.meta.url for ES module base path (most reliable)
    // Strategy 2: Use window.location for HTML document base path
    // Strategy 3: Try absolute paths
    
    const scriptBaseUrl = new URL('.', import.meta.url).href;
    const documentBaseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    
    // Try different path formats for maximum compatibility
    const pathsToTry = [
      // New catalog source
      new URL('../data/catalog.json', import.meta.url).href,
      // Using script location (ES module base)
      new URL('../data/Menu.json', import.meta.url).href,
      new URL('../data/menu.json', import.meta.url).href,
      // Using document location
      new URL('data/catalog.json', documentBaseUrl).href,
      new URL('data/Menu.json', documentBaseUrl).href,
      new URL('data/menu.json', documentBaseUrl).href,
      // Absolute paths for GitHub Pages
      '/wdd231/final/data/Menu.json',
      '/wdd231/final/data/menu.json',
      // Simple relative paths
      './data/catalog.json',
      './data/Menu.json',
      './data/menu.json',
      'data/catalog.json',
      'data/Menu.json',
      'data/menu.json'
    ].map(path => path.startsWith('http') ? path : new URL(path, window.location.origin).href);
    
    let res;
    let lastError;
    let successfulPath = null;
    const attemptedUrls = [];
    
    console.log('🔍 Attempting to load menu data...');
    console.log('Script base URL:', scriptBaseUrl);
    console.log('Document base URL:', documentBaseUrl);
    
    for (const fullUrl of pathsToTry) {
      try {
        attemptedUrls.push(fullUrl);
        console.log(`Trying: ${fullUrl}`);
        res = await fetch(fullUrl, { method: 'HEAD' }); // Try HEAD first to check if file exists
        
        if (res.ok) {
          // File exists, now fetch it properly
          res = await fetch(fullUrl);
          if (res.ok) {
            successfulPath = fullUrl;
            console.log(`✅ Successfully loaded menu from: ${successfulPath}`);
            break;
          }
        } else {
          console.warn(`❌ Failed with status ${res.status}: ${fullUrl}`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Error: ${fullUrl}`, err.message);
        continue;
      }
    }
    
    if (!res || !res.ok) {
      const errorMsg = `Failed to load menu: ${res ? res.status + ' ' + res.statusText : 'All paths failed'}`;
      console.error("\n❌ Fetch Error Summary:");
      console.error("- Current page URL:", window.location.href);
      console.error("- Script base:", scriptBaseUrl);
      console.error("- Document base:", documentBaseUrl);
      console.error("- Attempted URLs:", attemptedUrls);
      if (lastError) console.error("- Last error:", lastError);
      console.error("\n💡 Troubleshooting Steps:");
      console.error("1. Open browser console and check the attempted URLs above");
      console.error("2. Try accessing the JSON directly: https://ugochukwu16henry.github.io/wdd231/final/data/Menu.json");
      console.error("3. Verify file exists: https://github.com/ugochukwu16henry/wdd231/tree/main/final/data");
      console.error("4. Ensure Menu.json is committed and pushed to GitHub");
      console.error("5. Wait 1-2 minutes for GitHub Pages to rebuild after pushing");
      throw new Error(errorMsg);
    }
    
    const rawPayload = await res.json();
    const items = normalizeCatalogPayload(rawPayload);

    // Validate data structure
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Menu data is empty or invalid");
    }

    // Generate menu cards with proper accessibility
    container.innerHTML = items
      .map(
        (item) => `
      <article class="card" tabindex="0" role="article" aria-label="${item.name}">
        <img src="${item.img}" alt="${item.name}" loading="lazy">
        <div style="padding:1rem;">
          ${item.outOfStock ? '<p class="card-stock-badge" aria-label="Out of stock">Out of Stock</p>' : ""}
          <h3>${item.name}</h3>
          <p>${item.desc}</p>
          <p class="price">${item.price}</p>
          ${item.orderOnly ? '<p class="card-stock-badge" aria-label="Order only">Order Only</p>' : ""}
          <div class="card-actions">
            <button data-modal="${item.id}" class="view-details" aria-label="View details for ${item.name}">View Details</button>
            <button data-add-cart="${item.id}" class="add-to-cart" aria-label="Add ${item.name} to cart" ${item.outOfStock ? "disabled" : ""}>${item.outOfStock ? "Unavailable" : item.orderOnly ? "Order Only" : "Add to Cart"}</button>
          </div>
        </div>
      </article>
    `
      )
      .join("");

    // Attach modal open handlers after cards are created
    document.querySelectorAll("[data-modal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openModal(btn.dataset.modal, items);
      });
      
      // Keyboard accessibility - Enter key support
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(btn.dataset.modal, items);
        }
      });
    });

    document.querySelectorAll("[data-add-cart]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = items.find((entry) => entry.id == btn.dataset.addCart);
        if (!item) {
          return;
        }

        if (item.outOfStock) {
          showAddToCartToast(`${item.name} is currently out of stock`);
          return;
        }

        if (item.orderOnly) {
          openOrderOnlyForm(item);
          return;
        }

        addItemToCart(item);
        updateCartBadge();
        showAddToCartToast(`${item.name} added to cart`);
      });
    });

    const orderForm = document.getElementById("order-only-form");
    if (orderForm && !orderForm.dataset.bound) {
      orderForm.dataset.bound = "1";
      orderForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const itemId = orderForm.dataset.itemId;
        const item = items.find((entry) => String(entry.id) === String(itemId));
        if (!item) {
          return;
        }

        const qty = Number(document.getElementById("order-qty")?.value || 1);
        const date = document.getElementById("order-date")?.value || "";
        const time = document.getElementById("order-time")?.value || "";
        const customerName = document.getElementById("order-customer-name")?.value.trim() || "";
        const phone = document.getElementById("order-phone")?.value.trim() || "";
        const notes = document.getElementById("order-notes")?.value.trim() || "";

        if (!customerName || !phone || !date || !time || qty <= 0) {
          showAddToCartToast("Please fill all required order details");
          return;
        }

        const order = {
          orderId: `ORD-${Date.now()}`,
          productId: String(item.id),
          productName: item.name,
          qty,
          date,
          time,
          customerName,
          phone,
          notes,
          createdAt: new Date().toISOString(),
          status: "pending"
        };

        addItemToCart({
          ...item,
          qty,
          cart_line_id: `${item.id}-${Date.now()}`,
          order_request: order
        });
        updateCartBadge();
        showAddToCartToast(`${item.name} order added to cart`);

        await submitOrderRequest(order);

        const modal = document.getElementById("order-only-modal");
        if (modal) {
          modal.setAttribute("aria-hidden", "true");
          modal.style.display = "none";
        }
        orderForm.reset();
      });
    }

    // Add keyboard navigation for cards
    container.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const button = card.querySelector("[data-modal]");
          if (button) {
            button.click();
          }
        }
      });
    });

  } catch (err) {
    console.error("Error loading menu:", err);
    container.innerHTML = `
      <div class="loading" style="color:#dc3545;">
        <p><strong>Error loading menu:</strong> ${err.message}</p>
        <p>Please refresh the page or contact us if the problem persists.</p>
      </div>
    `;
  }
}
