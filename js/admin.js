const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5050/api"
    : "https://mummyj21-frontend-production.up.railway.app/api";
const TOKEN_KEY = "mjt-admin-token";
const JSON_SCHEMA = [
  { key: "id", label: "ID", type: "text", placeholder: "p017", required: true },
  { key: "name", label: "Name", type: "text", placeholder: "Product name", required: true },
  { key: "price", label: "Price", type: "number", placeholder: "5000", required: true },
  { key: "category", label: "Category", type: "text", placeholder: "Cakes", required: true },
  { key: "stock", label: "Stock", type: "number", placeholder: "20", required: true },
  { key: "out_of_stock", label: "Out of Stock", type: "checkbox", required: false },
  { key: "order_only", label: "Order Only", type: "checkbox", required: false },
  { key: "tags", label: "Tags (comma-separated)", type: "text", placeholder: "fresh,popular", required: false },
  { key: "description", label: "Description", type: "textarea", placeholder: "Short description", required: true },
  { key: "image", label: "Image path", type: "text", placeholder: "images/item.jpg", required: true }
];

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  catalog: { categories: [], products: [], category_images: {}, orders: [] },
  filteredProducts: [],
  editingId: null,
  stockFilter: "all",
  orderFilter: "all",
  currentAdminEmail: "admin@mummyj2treats.com"
};

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const syncBar = document.getElementById("sync-bar");
const productForm = document.getElementById("product-form");
const productsTable = document.getElementById("products-table");
const jsonPreview = document.getElementById("json-preview");
const categoryList = document.getElementById("category-list");
const addCategoryForm = document.getElementById("add-category-form");
const drawer = document.getElementById("drawer");
const drawerForm = document.getElementById("drawer-form");
const drawerPreview = document.getElementById("drawer-preview");
const closeDrawerBtn = document.getElementById("close-drawer");
const commitBtn = document.getElementById("commit-btn");
const logoutBtn = document.getElementById("logout-btn");
const searchInput = document.getElementById("search-input");
const stockFilterButtons = Array.from(document.querySelectorAll("button[data-stock-filter]"));
const accountEmail = document.getElementById("account-email");
const accountForm = document.getElementById("account-form");
const accountMessage = document.getElementById("account-message");
const pendingTestimonials = document.getElementById("pending-testimonials");
const allTestimonials = document.getElementById("all-testimonials");
const blogForm = document.getElementById("blog-form");
const blogMessage = document.getElementById("blog-message");
const blogUploadStatus = document.getElementById("blog-upload-status");
const blogImageFileInput = document.getElementById("blog-image-file");
const blogImagePreview = document.getElementById("blog-image-preview");
const blogImageClearBtn = document.getElementById("blog-image-clear");
const blogPostsAdmin = document.getElementById("blog-posts-admin");
const ordersTable = document.getElementById("orders-table");
const ordersPanel = document.getElementById("orders-panel");
const ordersFilterButtons = Array.from(document.querySelectorAll("button[data-order-filter]"));
const ordersQueueMeta = document.getElementById("orders-queue-meta");
const exportCatalogBtn = document.getElementById("export-catalog-btn");
const exportContentBtn = document.getElementById("export-content-btn");
let ordersRefreshTimer = null;

const IMAGE_LIMITS = {
  product: { maxWidth: 1200, maxHeight: 1200, quality: 0.78 },
  category: { maxWidth: 720, maxHeight: 720, quality: 0.74 },
  preview: { maxWidth: 360, maxHeight: 360, quality: 0.7 }
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB per image (catalog/category)
const MAX_BLOG_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per blog cover image

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** power);
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

async function fileToDataUrl(file) {
  if (!file) {
    return "";
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = dataUrl;
  });
}

async function canvasToDataUrl(canvas, mimeType, quality) {
  if (canvas.toBlob) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (blob) {
      return readFileAsDataUrl(blob);
    }
  }
  return canvas.toDataURL(mimeType, quality);
}

async function uploadToS3(file, _folder, onProgress) {
  // Fallback: store media directly as data URL in JSON,
  // but still report "progress" so the UI feels responsive.
  if (!file) {
    return "";
  }

  const total = file.size || 1;
  if (typeof onProgress === "function") {
    onProgress(0, total);
  }

  const dataUrl = await fileToDataUrl(file);

  if (typeof onProgress === "function") {
    onProgress(total, total);
  }

  return dataUrl;
}

function setBlogMediaPreview(input, preview, type = "image") {
  if (!input || !preview) {
    return;
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0] || null;
    if (!file) {
      preview.hidden = true;
      preview.removeAttribute("src");
      if (type === "image" && blogImageClearBtn) {
        blogImageClearBtn.hidden = true;
      }
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.hidden = false;
    if (type === "image" && blogImageClearBtn) {
      blogImageClearBtn.hidden = false;
    }
  });
}

function clearBlogMedia(input, preview, clearBtn) {
  if (!input || !preview) {
    return;
  }
  input.value = "";
  preview.hidden = true;
  preview.removeAttribute("src");
  if (clearBtn) {
    clearBtn.hidden = true;
  }
}

async function optimizeImageFile(file, profile = "product") {
  if (!file) {
    return "";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is too large (${formatBytes(file.size)}). Max allowed is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
  }

  const { maxWidth, maxHeight, quality } = IMAGE_LIMITS[profile] || IMAGE_LIMITS.product;
  const sourceDataUrl = await fileToDataUrl(file);
  const image = await loadImageFromDataUrl(sourceDataUrl);

  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);

  const originalType = String(file.type || "").toLowerCase();
  const hasAlpha = originalType.includes("png") || originalType.includes("webp");
  const outputType = hasAlpha ? "image/webp" : "image/jpeg";
  return canvasToDataUrl(canvas, outputType, quality);
}

function showSyncing(show, message = "Syncing catalog.json...") {
  syncBar.textContent = message;
  syncBar.hidden = !show;
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function normalizeProduct(product) {
  const stock = Number(product.stock) || 0;
  return {
    ...product,
    price: Number(product.price) || 0,
    stock,
    out_of_stock: Boolean(product.out_of_stock) || stock <= 0,
    order_only: Boolean(product.order_only),
    tags: Array.isArray(product.tags)
      ? product.tags
      : String(product.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
    last_updated: product.last_updated || new Date().toISOString().slice(0, 10)
  };
}

function renderMediaPreview(url, maxHeight) {
  if (!url) {
    return "";
  }
  const safeUrl = String(url);
  return `<img src="${safeUrl}" alt="" style="width:100%;max-height:${maxHeight}px;object-fit:cover;border-radius:10px;margin-top:0.4rem;">`;
}

function renderSchemaForm() {
  productForm.innerHTML = JSON_SCHEMA.map((field) => {
    if (field.type === "checkbox") {
      return `
        <label class="toggle-row">
          <input type="checkbox" name="${field.key}">
          ${field.label}
        </label>
      `;
    }

    if (field.type === "textarea") {
      return `
        <label>${field.label}
          <textarea name="${field.key}" placeholder="${field.placeholder}" ${field.required ? "required" : ""}></textarea>
        </label>
      `;
    }

    return `
      <label>${field.label}
        <input type="${field.type}" name="${field.key}" placeholder="${field.placeholder}" ${field.required ? "required" : ""}>
      </label>
    `;
  }).join("") + `
    <label>Upload Product Image (optional)
      <input type="file" id="product-image-upload" accept="image/*" capture="environment">
    </label>
    <img id="product-image-preview" alt="Product preview" hidden>
    <button class="btn primary" type="submit">Add Product</button>
  `;

  const statusEl = document.createElement("p");
  statusEl.id = "product-publish-status";
  statusEl.className = "account-message";
  statusEl.setAttribute("aria-live", "polite");
  productForm.appendChild(statusEl);
}

function getStockClass(stock) {
  if (stock <= 0) {
    return "out";
  }
  return stock > 10 ? "in" : "low";
}

function getStockLabel(product) {
  if (product.order_only) {
    return "Order Only";
  }
  if (product.out_of_stock || product.stock <= 0) {
    return "Out of Stock";
  }
  return product.stock > 10 ? "In Stock" : "Low Stock";
}

function getPaymentLabel(order) {
  const method = String(order.paymentMethod || "").toLowerCase();
  if (method === "bank_transfer") {
    return "Bank Transfer";
  }
  if (!method) {
    return "-";
  }
  return method.replace(/_/g, " ");
}

function getOrderStatusClass(status) {
  const normalized = String(status || "pending").toLowerCase();
  if (normalized === "confirmed" || normalized === "paid") {
    return "paid";
  }
  if (normalized === "flagged" || normalized === "failed") {
    return "flagged";
  }
  return "pending";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
}

function getOrderLines(order) {
  if (Array.isArray(order.orderLines) && order.orderLines.length) {
    return order.orderLines;
  }

  return [{
    productName: order.productName || "-",
    qty: Number(order.qty) > 0 ? Number(order.qty) : 1,
    total: Number.isFinite(Number(order.amountDue)) ? Number(order.amountDue) : 0
  }];
}

function getOrderAmount(order) {
  const explicitAmount = Number(order.amountDue);
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
    return explicitAmount;
  }

  return getOrderLines(order).reduce((sum, line) => {
    const lineTotal = Number(line.total);
    return Number.isFinite(lineTotal) && lineTotal > 0 ? sum + lineTotal : sum;
  }, 0);
}

function getOrderCustomerEmail(order) {
  return String(
    order.customerEmail
    || order.email
    || order.customer_email
    || order.customer?.email
    || ""
  ).trim();
}

function toWhatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("234")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  return digits;
}

function buildCustomerReceiptText(order) {
  const lines = getOrderLines(order)
    .map((line) => `- ${line.productName || "Item"} x${Number(line.qty) || 1}`)
    .join("\n");
  const total = formatCurrency(getOrderAmount(order) || 0);

  return [
    "mummyj2Treats Receipt",
    `Order ID: ${order.orderId || "-"}`,
    `Customer: ${order.customerName || "-"}`,
    "Items:",
    lines,
    `Total: ${total}`,
    `Status: ${order.status || "Confirmed"}`
  ].join("\n");
}

function openReceiptPrintView(order) {
  const linesHtml = getOrderLines(order)
    .map((line) => `<li>${line.productName || "Item"} × ${Number(line.qty) || 1}</li>`)
    .join("");
  const total = formatCurrency(getOrderAmount(order) || 0);
  const receiptWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!receiptWindow) {
    return false;
  }

  receiptWindow.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${order.orderId || ""}</title>
<style>
body{font-family:Arial,sans-serif;padding:24px;color:#1f2937}
h1{margin:0 0 8px}
ul{padding-left:18px}
.meta{margin:6px 0}
.box{border:1px solid #d1d5db;border-radius:10px;padding:14px;margin-top:12px}
</style></head><body>
<h1>mummyj2Treats Receipt</h1>
<p class="meta">Order ID: ${order.orderId || "-"}</p>
<p class="meta">Customer: ${order.customerName || "-"}</p>
<p class="meta">Email: ${order.customerEmail || "-"}</p>
<div class="box"><strong>Items</strong><ul>${linesHtml}</ul><p><strong>Total: ${total}</strong></p></div>
</body></html>`);
  receiptWindow.document.close();
  receiptWindow.focus();
  setTimeout(() => receiptWindow.print(), 180);
  return true;
}

function renderProductsTable() {
  productsTable.innerHTML = state.filteredProducts.map((product) => `
    <tr data-id="${product.id}">
      <td><img src="${product.image}" alt="${product.name}"></td>
      <td>
        <strong>${product.name}</strong><br>
        <small class="mono">${product.id}</small>
      </td>
      <td>${product.category}</td>
      <td class="mono">${formatCurrency(product.price)}</td>
      <td><span class="stock-chip ${product.order_only ? "order" : getStockClass(product.out_of_stock ? 0 : product.stock)}">${getStockLabel(product)}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn mini danger" data-delete-product="${product.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderOrders() {
  if (!ordersTable) {
    return;
  }

  const allOrders = Array.isArray(state.catalog.orders) ? [...state.catalog.orders] : [];
  allOrders.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const pendingCount = allOrders.filter((order) => String(order.status || "").toLowerCase() === "awaiting_bank_transfer").length;
  const flaggedCount = allOrders.filter((order) => String(order.status || "").toLowerCase() === "flagged").length;
  const confirmedCount = allOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "confirmed" || status === "paid";
  }).length;

  const orders = allOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    if (state.orderFilter === "pending_verification") {
      return status === "awaiting_bank_transfer";
    }
    if (state.orderFilter === "flagged") {
      return status === "flagged";
    }
    if (state.orderFilter === "confirmed") {
      return status === "confirmed" || status === "paid";
    }
    return true;
  });

  if (ordersQueueMeta) {
    if (state.orderFilter === "pending_verification") {
      ordersQueueMeta.textContent = `Pending verification: ${pendingCount}`;
    } else if (state.orderFilter === "flagged") {
      ordersQueueMeta.textContent = `Flagged orders: ${flaggedCount}`;
    } else if (state.orderFilter === "confirmed") {
      ordersQueueMeta.textContent = `Confirmed orders: ${confirmedCount}`;
    } else {
      ordersQueueMeta.textContent = `All orders: ${allOrders.length} • Pending: ${pendingCount} • Flagged: ${flaggedCount}`;
    }
  }

  if (!orders.length) {
    ordersTable.innerHTML = '<tr><td colspan="15">No orders found for this filter.</td></tr>';
    return;
  }

  ordersTable.innerHTML = orders.map((order) => `
    <tr>
      <td class="mono">${order.orderId || "-"}</td>
      <td>${getOrderLines(order).map((line) => `<div>${line.productName || "Item"} <strong>x${Number(line.qty) || 1}</strong></div>`).join("")}</td>
      <td>${order.customerName || "-"}</td>
      <td>${getOrderCustomerEmail(order) || "-"}</td>
      <td>${order.phone || "-"}</td>
      <td>${getPaymentLabel(order)}</td>
      <td><span class="status-badge ${getOrderStatusClass(order.status)}">${order.status || "pending"}</span></td>
      <td class="mono">${getOrderAmount(order) > 0 ? formatCurrency(getOrderAmount(order)) : "-"}</td>
      <td class="mono">${order.bankReference || "-"}</td>
      <td>
        ${order.receiptImage
          ? `<button type="button" class="btn mini" data-open-receipt="${order.orderId || ""}">Open</button>${String(order.receiptImage).startsWith("data:image") ? `<img class="receipt-thumb" src="${order.receiptImage}" alt="Receipt proof">` : ""}`
          : "-"}
      </td>
      <td>
        ${(() => {
          const status = String(order.status || "").toLowerCase();
          if (status === "awaiting_bank_transfer") {
            return `<div class="row-actions"><button type="button" class="btn mini primary" data-approve-send-order="${order.orderId || ""}">Approve + Send WA</button><button type="button" class="btn mini" data-approve-order="${order.orderId || ""}">Approve Only</button><button type="button" class="btn mini danger" data-flag-order="${order.orderId || ""}">Flag</button></div>`;
          }
          if (status === "flagged") {
            return `<div class="row-actions"><button type="button" class="btn mini" data-unflag-order="${order.orderId || ""}">Move to Pending</button></div>`;
          }
          if (status === "confirmed" || status === "paid") {
            return `<div class="row-actions"><button type="button" class="btn mini" data-send-whatsapp="${order.orderId || ""}">WhatsApp</button><button type="button" class="btn mini" data-send-email="${order.orderId || ""}">Email</button><button type="button" class="btn mini" data-print-receipt="${order.orderId || ""}">PDF</button></div>`;
          }
          return "-";
        })()}
      </td>
      <td>${order.qty || 1}</td>
      <td>${order.date || "-"}</td>
      <td>${order.time || "-"}</td>
      <td>${(() => {
        const baseNotes = String(order.notes || "").trim();
        const reason = String(order.flaggedReason || "").trim();
        if (reason) {
          const prefix = baseNotes ? `${baseNotes} • ` : "";
          return `${prefix}Flag reason: ${reason}`;
        }
        return baseNotes || "-";
      })()}</td>
    </tr>
  `).join("");
}

async function approveOrderPayment(orderId) {
  const orders = Array.isArray(state.catalog.orders) ? [...state.catalog.orders] : [];
  const targetIndex = orders.findIndex((entry) => String(entry.orderId) === String(orderId));
  if (targetIndex < 0) {
    throw new Error("Order not found");
  }

  const target = orders[targetIndex];
  const targetStatus = String(target.status || "").toLowerCase();
  if (targetStatus !== "awaiting_bank_transfer") {
    throw new Error("Only pending bank transfer orders can be approved");
  }

  const approvedBy = state.currentAdminEmail || "admin@mummyj2treats.com";
  const approvedAt = new Date().toISOString();

  orders[targetIndex] = {
    ...target,
    status: "Confirmed",
    approvedAt,
    approvedBy
  };

  const updatedOrder = orders[targetIndex];

  state.catalog = {
    ...state.catalog,
    orders
  };

  renderOrders();
  renderJsonPreview();
  await saveCatalog();
  return updatedOrder;
}

function openWhatsappForOrder(order) {
  const whatsappNumber = toWhatsappNumber(order?.phone);
  if (!whatsappNumber) {
    showSyncing(true, "Customer phone is missing or invalid.");
    setTimeout(() => showSyncing(false), 1700);
    return false;
  }

  const text = encodeURIComponent(buildCustomerReceiptText(order));
  window.open(`https://wa.me/${whatsappNumber}?text=${text}`, "_blank", "noopener,noreferrer");
  return true;
}

async function approveAndSendWhatsApp(orderId, actionButton) {
  const disabledButton = actionButton || null;
  if (disabledButton) {
    disabledButton.disabled = true;
  }

  try {
    const approvedOrder = await approveOrderPayment(orderId);
    openReceiptPrintView(approvedOrder);
    openWhatsappForOrder(approvedOrder);
    showSyncing(true, "Payment approved, receipt generated, and WhatsApp opened.");
    setTimeout(() => showSyncing(false), 1500);
  } catch (error) {
    if (disabledButton) {
      disabledButton.disabled = false;
    }
    showSyncing(true, `Could not complete action: ${error.message}`);
    setTimeout(() => showSyncing(false), 1800);
  }
}

async function updateOrderStatus(orderId, nextStatus, reason = "") {
  const orders = Array.isArray(state.catalog.orders) ? [...state.catalog.orders] : [];
  const targetIndex = orders.findIndex((entry) => String(entry.orderId) === String(orderId));
  if (targetIndex < 0) {
    throw new Error("Order not found");
  }

  const target = orders[targetIndex];
  const updated = {
    ...target,
    status: nextStatus
  };

  if (nextStatus === "flagged") {
    updated.flaggedAt = new Date().toISOString();
    updated.flaggedBy = state.currentAdminEmail || "admin@mummyj2treats.com";
    updated.flaggedReason = String(reason || "").trim();
  }

  orders[targetIndex] = updated;
  state.catalog = {
    ...state.catalog,
    orders
  };

  renderOrders();
  renderJsonPreview();
  await saveCatalog();
}

function renderCategories() {
  categoryList.innerHTML = state.catalog.categories.map((category) => `
    <div class="category-row">
      <div class="category-main">
        <input type="text" value="${category}" data-old-category="${category}">
        <div class="category-media-row">
          ${state.catalog.category_images?.[category]
            ? `<img src="${state.catalog.category_images[category]}" alt="${category} image" class="category-thumb">`
            : "<span class=\"category-thumb placeholder\">No image</span>"}
          <input type="file" accept="image/*" capture="environment" data-category-image-upload="${category}">
        </div>
      </div>
      <div class="category-actions">
        <button class="btn ghost mini" data-rename-category="${category}">Rename</button>
        <button class="btn mini danger" data-delete-category="${category}">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderJsonPreview() {
  jsonPreview.textContent = JSON.stringify(state.catalog, null, 2);
}

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();
  state.filteredProducts = state.catalog.products.filter((product) => {
    const tags = Array.isArray(product.tags) ? product.tags.join(" ") : "";
    const haystack = `${product.name} ${product.category} ${tags}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);

    const isOut = Boolean(product.out_of_stock) || product.stock <= 0;
    const matchesStock = (() => {
      if (state.stockFilter === "out") {
        return isOut;
      }
      if (state.stockFilter === "in") {
        return !isOut && product.stock > 10;
      }
      if (state.stockFilter === "low") {
        return !isOut && product.stock > 0 && product.stock <= 10;
      }
      return true;
    })();

    return matchesSearch && matchesStock;
  });

  renderProductsTable();
}

function openDrawer(product) {
  state.editingId = product.id;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.getElementById("drawer-price").value = String(product.price);
  const drawerStockInput = document.getElementById("drawer-stock");
  if (drawerStockInput) {
    drawerStockInput.value = String(product.stock ?? 0);
  }
  document.getElementById("drawer-category").value = product.category;
  document.getElementById("drawer-image").value = product.image || "";
  const drawerImageUpload = document.getElementById("drawer-image-upload");
  if (drawerImageUpload) {
    drawerImageUpload.value = "";
  }
  const drawerImagePreview = document.getElementById("drawer-image-preview");
  if (drawerImagePreview) {
    drawerImagePreview.src = product.image || "";
    drawerImagePreview.hidden = !product.image;
  }
  document.getElementById("drawer-out-of-stock").checked = Boolean(product.out_of_stock);
  document.getElementById("drawer-order-only").checked = Boolean(product.order_only);
  const drawerStatus = document.getElementById("drawer-stock-status");
  if (drawerStatus) {
    drawerStatus.textContent = `Current status: ${getStockLabel(product)}`;
  }
  drawerPreview.textContent = JSON.stringify(
    {
      before: {
        price: product.price,
        category: product.category,
        image: product.image,
        out_of_stock: Boolean(product.out_of_stock),
        order_only: Boolean(product.order_only)
      },
      after: {
        price: product.price,
        category: product.category,
        image: product.image,
        out_of_stock: Boolean(product.out_of_stock),
        order_only: Boolean(product.order_only)
      }
    },
    null,
    2
  );
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  state.editingId = null;
}

async function login(email, password) {
  const payload = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  state.token = payload.token;
  localStorage.setItem(TOKEN_KEY, payload.token);
}

async function loadAccount() {
  if (!accountEmail) {
    return;
  }

  try {
    const payload = await apiFetch("/auth/me");
    const span = accountEmail.querySelector("span");
    if (span && payload?.email) {
      span.textContent = payload.email;
      state.currentAdminEmail = payload.email;
    }
  } catch {
    // ignore – account section is optional
  }
}

async function loadContent() {
  if (!pendingTestimonials && !allTestimonials && !blogPostsAdmin) {
    return;
  }

  try {
    const payload = await apiFetch("/admin/content");
    const testimonials = Array.isArray(payload.testimonials) ? payload.testimonials : [];
    const posts = Array.isArray(payload.posts) ? payload.posts : [];
    const pending = testimonials.filter((t) => !t.approved);

    if (pendingTestimonials) {
      pendingTestimonials.innerHTML = pending.length
        ? pending
            .map((t) => `
              <div>
                <strong>${t.name}</strong><br>
                <small>${new Date(t.createdAt || Date.now()).toLocaleString()}</small>
                <p>${t.message}</p>
                ${renderMediaPreview(t.imageUrl, 120)}
                <button type="button" class="btn mini" data-approve-testimonial="${t.id}">Approve</button>
                <button type="button" class="btn mini danger" data-delete-testimonial="${t.id}">Delete</button>
              </div>
            `)
            .join("")
        : "<p>No pending testimonials.</p>";
    }

    if (allTestimonials) {
      const approved = testimonials.filter((t) => t.approved);
      allTestimonials.innerHTML = approved.length
        ? approved
            .map((t) => `
              <div>
                <strong>${t.name}</strong><br>
                <small>${new Date(t.approvedAt || t.createdAt || Date.now()).toLocaleString()}</small>
                <p>${t.message}</p>
                ${renderMediaPreview(t.imageUrl, 120)}
                <button type="button" class="btn mini danger" data-delete-testimonial="${t.id}">Delete</button>
              </div>
            `)
            .join("")
        : "<p>No approved testimonials yet.</p>";
    }

    if (blogPostsAdmin) {
      blogPostsAdmin.innerHTML = posts.length
        ? posts
            .map((post) => `
              <div>
                <strong>${post.title}</strong><br>
                <small>${new Date(post.createdAt || Date.now()).toLocaleString()}</small>
                <p>${post.body}</p>
                ${renderMediaPreview(post.imageUrl, 120)}
                <button type="button" class="btn mini danger" data-delete-post="${post.id}">Delete</button>
              </div>
            `)
            .join("")
        : "<p>No blog posts yet.</p>";
    }
  } catch (error) {
    if (pendingTestimonials) {
      pendingTestimonials.innerHTML = `<p>Could not load testimonials: ${error.message}</p>`;
    }
    if (allTestimonials) {
      allTestimonials.innerHTML = `<p>Could not load testimonials: ${error.message}</p>`;
    }
    if (blogPostsAdmin) {
      blogPostsAdmin.innerHTML = `<p>Could not load posts: ${error.message}</p>`;
    }
  }
}

async function loadCatalog() {
  const payload = await apiFetch("/catalog");
  state.catalog = {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    products: Array.isArray(payload.products) ? payload.products.map(normalizeProduct) : [],
    category_images: payload.category_images && typeof payload.category_images === "object"
      ? payload.category_images
      : {},
    orders: Array.isArray(payload.orders) ? payload.orders : []
  };

  state.filteredProducts = [...state.catalog.products];
  renderProductsTable();
  renderCategories();
  renderOrders();
  renderJsonPreview();
}

async function loadOrdersOnly() {
  const payload = await apiFetch("/orders");
  state.catalog = {
    ...state.catalog,
    orders: Array.isArray(payload.orders) ? payload.orders : []
  };
  renderOrders();
  renderJsonPreview();
}

function startOrdersAutoRefresh() {
  if (ordersRefreshTimer) {
    clearInterval(ordersRefreshTimer);
  }

  ordersRefreshTimer = setInterval(async () => {
    if (!state.token || dashboard.hidden) {
      return;
    }

    try {
      await loadOrdersOnly();
    } catch {
      // ignore transient refresh errors
    }
  }, 15000);
}

function stopOrdersAutoRefresh() {
  if (!ordersRefreshTimer) {
    return;
  }
  clearInterval(ordersRefreshTimer);
  ordersRefreshTimer = null;
}

async function saveCatalog() {
  showSyncing(true);
  try {
    const result = await apiFetch("/catalog", {
      method: "PUT",
      body: JSON.stringify(state.catalog)
    });
    renderJsonPreview();

    if (result?.github?.committed) {
      showSyncing(true, `Synced and committed (${result.github.commitSha.slice(0, 7)})`);
      setTimeout(() => showSyncing(false), 1400);
      return;
    }

    if (result?.github?.enabled === false) {
      showSyncing(true, "Synced locally. GitHub auto-commit not configured.");
      setTimeout(() => showSyncing(false), 1600);
      return;
    }

    showSyncing(true, "Synced to catalog.json");
    setTimeout(() => showSyncing(false), 900);
  } catch (error) {
    showSyncing(true, `Sync failed: ${error.message}`);
    setTimeout(() => showSyncing(false), 1800);
    throw error;
  }
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  if (ordersPanel) {
    ordersPanel.hidden = false;
  }
}

function showLogin() {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  if (ordersPanel) {
    ordersPanel.hidden = true;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  loginError.textContent = "";
  try {
    await login(email, password);
    state.currentAdminEmail = email || state.currentAdminEmail;
    showDashboard();
    await loadCatalog();
    startOrdersAutoRefresh();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const publishStatus = document.getElementById("product-publish-status");
  if (publishStatus) {
    publishStatus.textContent = "";
    publishStatus.classList.remove("ok", "error");
  }
  const formData = new FormData(productForm);
  const product = {};

  JSON_SCHEMA.forEach((field) => {
    if (field.type === "checkbox") {
      product[field.key] = formData.get(field.key) === "on";
      return;
    }

    const value = formData.get(field.key);
    if (field.key === "price" || field.key === "stock") {
      product[field.key] = Number(value);
    } else if (field.key === "tags") {
      product[field.key] = String(value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else {
      product[field.key] = String(value || "").trim();
    }
  });

  try {
    const uploadedImage = document.getElementById("product-image-upload")?.files?.[0] || null;
    if (uploadedImage) {
      product.image = await optimizeImageFile(uploadedImage, "product");
    }
  } catch (error) {
    showSyncing(true, `Image upload failed: ${error.message} Try a smaller image.`);
    setTimeout(() => showSyncing(false), 1800);
    return;
  }

  if (!product.image) {
    showSyncing(true, "Set an image path or upload an image before adding product.");
    setTimeout(() => showSyncing(false), 1800);
    return;
  }

  product.last_updated = new Date().toISOString().slice(0, 10);

  state.catalog.products.unshift(normalizeProduct(product));
  applyFilter();
  renderOrders();
  renderJsonPreview();
  productForm.reset();

  const preview = document.getElementById("product-image-preview");
  if (preview) {
    preview.hidden = true;
    preview.removeAttribute("src");
  }

  try {
    if (publishStatus) {
      publishStatus.textContent = "Publishing product...";
    }
    await saveCatalog();
    if (publishStatus) {
      publishStatus.textContent = "Published ✅ Product saved to catalog.json";
      publishStatus.classList.remove("error");
      publishStatus.classList.add("ok");
    }
    showSyncing(true, "Product added and published to catalog.json");
    setTimeout(() => showSyncing(false), 1400);
  } catch (error) {
    if (publishStatus) {
      publishStatus.textContent = `Publish failed: ${error.message}`;
      publishStatus.classList.remove("ok");
      publishStatus.classList.add("error");
    }
    showSyncing(true, `Product added locally, but publish failed: ${error.message}`);
    setTimeout(() => showSyncing(false), 2200);
  }
});

productForm.addEventListener("change", async (event) => {
  const fileInput = event.target.closest("#product-image-upload");
  if (!fileInput) {
    return;
  }

  const preview = document.getElementById("product-image-preview");
  const selected = fileInput.files?.[0] || null;
  if (!preview) {
    return;
  }

  if (!selected) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }

  try {
    preview.src = await optimizeImageFile(selected, "preview");
    preview.hidden = false;
  } catch (_error) {
    preview.hidden = true;
    preview.removeAttribute("src");
  }
});

productsTable.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("button[data-delete-product]");
  if (deleteButton) {
    event.stopPropagation();
    const productId = deleteButton.dataset.deleteProduct;
    state.catalog.products = state.catalog.products.filter((product) => String(product.id) !== String(productId));
    applyFilter();
    renderOrders();
    renderJsonPreview();
    showSyncing(true, "Product deleted. Click Commit Changes to publish.");
    setTimeout(() => showSyncing(false), 1500);
    return;
  }

  const row = event.target.closest("tr[data-id]");
  if (!row) {
    return;
  }

  const product = state.catalog.products.find((item) => item.id === row.dataset.id);
  if (product) {
    openDrawer(product);
  }
});

addCategoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("new-category");
  const imageInput = document.getElementById("new-category-image");
  const value = input.value.trim();
  if (!value || state.catalog.categories.includes(value)) {
    return;
  }

  state.catalog.categories.push(value);

  try {
    const uploaded = imageInput?.files?.[0] || null;
    if (uploaded) {
      if (!state.catalog.category_images || typeof state.catalog.category_images !== "object") {
        state.catalog.category_images = {};
      }
      state.catalog.category_images[value] = await optimizeImageFile(uploaded, "category");
    }
  } catch (error) {
    showSyncing(true, `Category image upload failed: ${error.message} Try a smaller image.`);
    setTimeout(() => showSyncing(false), 1800);
  }

  renderCategories();
  renderOrders();
  renderJsonPreview();
  input.value = "";
  if (imageInput) {
    imageInput.value = "";
  }
});

categoryList.addEventListener("change", async (event) => {
  const fileInput = event.target.closest("input[data-category-image-upload]");
  if (!fileInput) {
    return;
  }

  const category = fileInput.dataset.categoryImageUpload;
  const selected = fileInput.files?.[0] || null;
  if (!category || !selected) {
    return;
  }

  try {
    if (!state.catalog.category_images || typeof state.catalog.category_images !== "object") {
      state.catalog.category_images = {};
    }
    state.catalog.category_images[category] = await optimizeImageFile(selected, "category");
    renderCategories();
    renderJsonPreview();
    showSyncing(true, `Updated image for ${category}. Click Commit Changes to publish.`);
    setTimeout(() => showSyncing(false), 1500);
  } catch (error) {
    showSyncing(true, `Image update failed: ${error.message} Try a smaller image.`);
    setTimeout(() => showSyncing(false), 1800);
  }
});

categoryList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("button[data-delete-category]");
  if (deleteButton) {
    const category = deleteButton.dataset.deleteCategory;
    const inUseCount = state.catalog.products.filter((product) => product.category === category).length;

    if (inUseCount > 0) {
      const confirmed = window.confirm(`${category} has ${inUseCount} product(s). Delete it and move products to Uncategorized?`);
      if (!confirmed) {
        return;
      }

      if (!state.catalog.categories.includes("Uncategorized")) {
        state.catalog.categories.push("Uncategorized");
      }

      state.catalog.products = state.catalog.products.map((product) => (
        product.category === category
          ? { ...product, category: "Uncategorized", last_updated: new Date().toISOString().slice(0, 10) }
          : product
      ));
    }

    state.catalog.categories = state.catalog.categories.filter((value) => value !== category);
    if (state.catalog.category_images && typeof state.catalog.category_images === "object") {
      delete state.catalog.category_images[category];
    }
    applyFilter();
    renderCategories();
    renderOrders();
    renderJsonPreview();
    showSyncing(true, "Category deleted. Click Commit Changes to publish.");
    setTimeout(() => showSyncing(false), 1500);
    return;
  }

  const button = event.target.closest("button[data-rename-category]");
  if (!button) {
    return;
  }

  const oldCategory = button.dataset.renameCategory;
  const input = categoryList.querySelector(`input[data-old-category="${oldCategory}"]`);
  if (!input) {
    return;
  }

  const nextCategory = input.value.trim();
  if (!nextCategory) {
    return;
  }

  if (nextCategory !== oldCategory && state.catalog.categories.includes(nextCategory)) {
    return;
  }

  state.catalog.categories = state.catalog.categories.map((value) => (value === oldCategory ? nextCategory : value));
  if (state.catalog.category_images && typeof state.catalog.category_images === "object") {
    const currentImage = state.catalog.category_images[oldCategory];
    if (currentImage) {
      state.catalog.category_images[nextCategory] = currentImage;
    }
    if (nextCategory !== oldCategory) {
      delete state.catalog.category_images[oldCategory];
    }
  }
  state.catalog.products = state.catalog.products.map((product) => {
    if (product.category === oldCategory) {
      return { ...product, category: nextCategory, last_updated: new Date().toISOString().slice(0, 10) };
    }
    return product;
  });

  applyFilter();
  renderCategories();
  renderOrders();
  renderJsonPreview();
});

drawerForm.addEventListener("input", () => {
  if (!state.editingId) {
    return;
  }

  const product = state.catalog.products.find((item) => item.id === state.editingId);
  if (!product) {
    return;
  }

  const nextPrice = Number(document.getElementById("drawer-price").value || product.price);
  const nextStock = Number(document.getElementById("drawer-stock")?.value || product.stock || 0);
  const nextCategory = document.getElementById("drawer-category").value || product.category;
  const nextImage = document.getElementById("drawer-image").value || product.image;
  const nextOutOfStock = document.getElementById("drawer-out-of-stock").checked;
  const nextOrderOnly = document.getElementById("drawer-order-only").checked;

  const drawerStatus = document.getElementById("drawer-stock-status");
  if (drawerStatus) {
    drawerStatus.textContent = `Current status: ${getStockLabel({
      ...product,
      stock: nextStock,
      out_of_stock: nextOutOfStock,
      order_only: nextOrderOnly
    })}`;
  }

  drawerPreview.textContent = JSON.stringify(
    {
      before: {
        price: product.price,
        stock: product.stock,
        category: product.category,
        image: product.image,
        out_of_stock: Boolean(product.out_of_stock),
        order_only: Boolean(product.order_only)
      },
      after: {
        price: nextPrice,
        stock: nextStock,
        category: nextCategory,
        image: nextImage,
        out_of_stock: nextOutOfStock,
        order_only: nextOrderOnly
      }
    },
    null,
    2
  );
});

drawerForm.addEventListener("change", async (event) => {
  const fileInput = event.target.closest("#drawer-image-upload");
  if (!fileInput) {
    return;
  }

  const selected = fileInput.files?.[0] || null;
  const preview = document.getElementById("drawer-image-preview");
  if (!preview) {
    return;
  }

  if (!selected) {
    const existing = document.getElementById("drawer-image")?.value || "";
    preview.src = existing;
    preview.hidden = !existing;
    return;
  }

  try {
    const optimized = await optimizeImageFile(selected, "product");
    document.getElementById("drawer-image").value = optimized;
    preview.src = optimized;
    preview.hidden = false;
  } catch (error) {
    showSyncing(true, `Image update failed: ${error.message} Try a smaller image.`);
    setTimeout(() => showSyncing(false), 1800);
    fileInput.value = "";
  }
});

drawerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.editingId) {
    return;
  }

  const nextPrice = Number(document.getElementById("drawer-price").value || 0);
  const nextStock = Number(document.getElementById("drawer-stock")?.value || 0);
  const nextCategory = document.getElementById("drawer-category").value.trim();
  const drawerImageInput = document.getElementById("drawer-image");
  const drawerImageUpload = document.getElementById("drawer-image-upload");
  let nextImage = (drawerImageInput?.value || "").trim();

  try {
    const uploaded = drawerImageUpload?.files?.[0] || null;
    if (uploaded) {
      nextImage = await optimizeImageFile(uploaded, "product");
    }
  } catch (error) {
    showSyncing(true, `Image update failed: ${error.message} Try a smaller image.`);
    setTimeout(() => showSyncing(false), 1800);
    return;
  }

  const nextOutOfStock = document.getElementById("drawer-out-of-stock").checked;
  const nextOrderOnly = document.getElementById("drawer-order-only").checked;

  state.catalog.products = state.catalog.products.map((product) => {
    if (product.id !== state.editingId) {
      return product;
    }

    return {
      ...product,
      price: nextPrice,
      stock: nextStock,
      category: nextCategory,
      image: nextImage || product.image,
      out_of_stock: nextOutOfStock,
      order_only: nextOrderOnly,
      last_updated: new Date().toISOString().slice(0, 10)
    };
  });

  if (nextCategory && !state.catalog.categories.includes(nextCategory)) {
    state.catalog.categories.push(nextCategory);
  }

  applyFilter();
  renderCategories();
  renderOrders();
  renderJsonPreview();
  closeDrawer();
});

closeDrawerBtn.addEventListener("click", closeDrawer);

commitBtn.addEventListener("click", async () => {
  await saveCatalog();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  state.token = "";
  stopOrdersAutoRefresh();
  showLogin();
});

if (accountForm) {
  accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!accountMessage) {
      return;
    }

    accountMessage.textContent = "";
    accountMessage.classList.remove("ok", "error");

    const currentPassword = document.getElementById("current-password").value;
    const newEmail = document.getElementById("new-email").value.trim();
    const newPassword = document.getElementById("new-password").value;

    if (!currentPassword || !newEmail || !newPassword) {
      accountMessage.textContent = "All fields are required.";
      accountMessage.classList.add("error");
      return;
    }

    try {
      const payload = await apiFetch("/auth/change-credentials", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newEmail, newPassword })
      });

      const span = accountEmail?.querySelector("span");
      if (span && payload?.email) {
        span.textContent = payload.email;
      }

      accountMessage.textContent = "Login updated. Use the new email and password next time you sign in.";
      accountMessage.classList.add("ok");
      accountForm.reset();
    } catch (error) {
      accountMessage.textContent = error.message || "Could not update login.";
      accountMessage.classList.add("error");
    }
  });
}

if (pendingTestimonials) {
  pendingTestimonials.addEventListener("click", async (event) => {
    const approveBtn = event.target.closest("button[data-approve-testimonial]");
    const deleteBtn = event.target.closest("button[data-delete-testimonial]");

    if (approveBtn) {
      const id = approveBtn.dataset.approveTestimonial;
      try {
        await apiFetch(`/admin/testimonials/${id}/approve`, { method: "POST" });
        await loadContent();
      } catch (error) {
        alert(error.message || "Could not approve testimonial");
      }
      return;
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.deleteTestimonial;
      if (!window.confirm("Delete this testimonial? This cannot be undone.")) {
        return;
      }
      try {
        await apiFetch(`/admin/testimonials/${id}`, { method: "DELETE" });
        await loadContent();
      } catch (error) {
        alert(error.message || "Could not delete testimonial");
      }
    }
  });
}

if (allTestimonials) {
  allTestimonials.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("button[data-delete-testimonial]");
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.deleteTestimonial;
    if (!window.confirm("Delete this testimonial? This cannot be undone.")) {
      return;
    }
    try {
      await apiFetch(`/admin/testimonials/${id}`, { method: "DELETE" });
      await loadContent();
    } catch (error) {
      alert(error.message || "Could not delete testimonial");
    }
  });
}

if (blogForm && blogMessage) {
  setBlogMediaPreview(blogImageFileInput, blogImagePreview, "image");

  blogImageClearBtn?.addEventListener("click", () => {
    clearBlogMedia(blogImageFileInput, blogImagePreview, blogImageClearBtn);
  });

  blogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    blogMessage.textContent = "";
    if (blogUploadStatus) {
      blogUploadStatus.textContent = "";
      blogUploadStatus.classList.remove("error", "ok");
    }

    const title = document.getElementById("blog-title").value.trim();
    const body = document.getElementById("blog-body").value.trim();
    const imageFile = document.getElementById("blog-image-file")?.files?.[0] || null;

    if (imageFile && imageFile.size > MAX_BLOG_IMAGE_BYTES) {
      const maxMb = formatBytes(MAX_BLOG_IMAGE_BYTES);
      blogMessage.textContent = `Image is too large. Max allowed is ${maxMb}.`;
      blogMessage.classList.remove("ok");
      blogMessage.classList.add("error");
      return;
    }

    if (!title || !body) {
      blogMessage.textContent = "Title and body are required.";
      blogMessage.classList.remove("ok");
      blogMessage.classList.add("error");
      return;
    }

    try {
      let imageUrl = "";

      const mediaSteps = [imageFile].filter(Boolean).length;
      let completedSteps = 0;
      const announceUpload = (label) => (loaded, total) => {
        if (!blogUploadStatus || !mediaSteps) return;
        const base = (completedSteps / mediaSteps) * 100;
        const fraction = total > 0 ? loaded / total : 0;
        const percent = Math.min(99, Math.round(base + (fraction * (100 / mediaSteps))));
        blogUploadStatus.textContent = `${label} ${percent}%`;
      };

      if (blogUploadStatus && mediaSteps) {
        blogUploadStatus.textContent = "Preparing media upload...";
      }

      if (imageFile) {
        imageUrl = await uploadToS3(imageFile, "blog-images", announceUpload("Uploading image"));
        completedSteps += 1;
      }

      if (blogUploadStatus && mediaSteps) {
        blogUploadStatus.textContent = "Upload complete";
        blogUploadStatus.classList.add("ok");
      }

      await apiFetch("/admin/posts", {
        method: "POST",
        body: JSON.stringify({ title, body, imageUrl })
      });
      blogForm.reset();
      if (blogImagePreview) {
        blogImagePreview.hidden = true;
        blogImagePreview.removeAttribute("src");
      }
      if (blogImageClearBtn) {
        blogImageClearBtn.hidden = true;
      }
      blogMessage.textContent = "Post published. It now appears on the stories page.";
      blogMessage.classList.remove("error");
      blogMessage.classList.add("ok");
    } catch (error) {
      blogMessage.textContent = error.message || "Could not publish post.";
      blogMessage.classList.remove("ok");
      blogMessage.classList.add("error");
      if (blogUploadStatus) {
        blogUploadStatus.classList.remove("ok");
        blogUploadStatus.classList.add("error");
      }
    }
  });
}

if (blogPostsAdmin) {
  blogPostsAdmin.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("button[data-delete-post]");
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.deletePost;
    if (!window.confirm("Delete this post? This cannot be undone.")) {
      return;
    }

    try {
      await apiFetch(`/admin/posts/${id}`, { method: "DELETE" });
      await loadContent();
    } catch (error) {
      alert(error.message || "Could not delete post");
    }
  });
}

// Simple export helpers for backing up JSON files
function triggerDownload(path, filename) {
  const url = `${API_BASE}${path}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

if (exportCatalogBtn) {
  exportCatalogBtn.addEventListener("click", () => {
    triggerDownload("/admin/catalog/export", "catalog.json");
  });
}

if (exportContentBtn) {
  exportContentBtn.addEventListener("click", () => {
    triggerDownload("/admin/content/export", "content.json");
  });
}

if (ordersTable) {
  ordersTable.addEventListener("click", async (event) => {
    const receiptButton = event.target.closest("button[data-open-receipt]");
    const approveAndSendButton = event.target.closest("button[data-approve-send-order]");
    const approveButton = event.target.closest("button[data-approve-order]");
    const flagButton = event.target.closest("button[data-flag-order]");
    const unflagButton = event.target.closest("button[data-unflag-order]");
    const whatsappButton = event.target.closest("button[data-send-whatsapp]");
    const emailButton = event.target.closest("button[data-send-email]");
    const printButton = event.target.closest("button[data-print-receipt]");

    if (approveAndSendButton) {
      const orderId = approveAndSendButton.dataset.approveSendOrder;
      if (!orderId) {
        return;
      }

      const confirmed = window.confirm("Approve payment, generate receipt, and open WhatsApp for customer?");
      if (!confirmed) {
        return;
      }

      await approveAndSendWhatsApp(orderId, approveAndSendButton);
      return;
    }

    if (receiptButton) {
      const orderId = receiptButton.dataset.openReceipt;
      const order = (state.catalog.orders || []).find((entry) => String(entry.orderId) === String(orderId));
      if (!order?.receiptImage) {
        showSyncing(true, "Receipt not available for this order.");
        setTimeout(() => showSyncing(false), 1500);
        return;
      }

      const openedWindow = window.open(order.receiptImage, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        showSyncing(true, "Popup blocked. Allow popups and try again.");
        setTimeout(() => showSyncing(false), 1700);
      }
      return;
    }

    if (whatsappButton) {
      const orderId = whatsappButton.dataset.sendWhatsapp;
      const order = (state.catalog.orders || []).find((entry) => String(entry.orderId) === String(orderId));
      if (!order) {
        return;
      }

      openWhatsappForOrder(order);
      return;
    }

    if (emailButton) {
      const orderId = emailButton.dataset.sendEmail;
      const order = (state.catalog.orders || []).find((entry) => String(entry.orderId) === String(orderId));
      if (!order?.customerEmail) {
        showSyncing(true, "Customer email is missing for this order.");
        setTimeout(() => showSyncing(false), 1700);
        return;
      }

      const subject = encodeURIComponent(`mummyj2Treats Receipt - ${order.orderId || "Order"}`);
      const body = encodeURIComponent(buildCustomerReceiptText(order));
      window.location.href = `mailto:${order.customerEmail}?subject=${subject}&body=${body}`;
      return;
    }

    if (printButton) {
      const orderId = printButton.dataset.printReceipt;
      const order = (state.catalog.orders || []).find((entry) => String(entry.orderId) === String(orderId));
      if (!order) {
        return;
      }

      const opened = openReceiptPrintView(order);
      if (!opened) {
        showSyncing(true, "Popup blocked. Allow popups and try again.");
        setTimeout(() => showSyncing(false), 1700);
      }
      return;
    }

    if (flagButton) {
      const orderId = flagButton.dataset.flagOrder;
      if (!orderId) {
        return;
      }

      const reasonInput = window.prompt("Why are you flagging this order?", "");
      const reason = String(reasonInput || "").trim();
      if (!reason) {
        showSyncing(true, "Flag reason is required.");
        setTimeout(() => showSyncing(false), 1500);
        return;
      }

      const confirmed = window.confirm("Flag this order for manual review?");
      if (!confirmed) {
        return;
      }

      try {
        flagButton.disabled = true;
        await updateOrderStatus(orderId, "flagged", reason);
        showSyncing(true, "Order flagged for review and synced");
        setTimeout(() => showSyncing(false), 1400);
      } catch (error) {
        flagButton.disabled = false;
        showSyncing(true, `Could not flag order: ${error.message}`);
        setTimeout(() => showSyncing(false), 1800);
      }
      return;
    }

    if (unflagButton) {
      const orderId = unflagButton.dataset.unflagOrder;
      if (!orderId) {
        return;
      }

      const confirmed = window.confirm("Move this flagged order back to pending verification?");
      if (!confirmed) {
        return;
      }

      try {
        unflagButton.disabled = true;
        await updateOrderStatus(orderId, "awaiting_bank_transfer");
        showSyncing(true, "Order moved to pending verification and synced");
        setTimeout(() => showSyncing(false), 1400);
      } catch (error) {
        unflagButton.disabled = false;
        showSyncing(true, `Could not update order: ${error.message}`);
        setTimeout(() => showSyncing(false), 1800);
      }
      return;
    }

    if (!approveButton) {
      return;
    }

    const orderId = approveButton.dataset.approveOrder;
    if (!orderId) {
      return;
    }

    const confirmed = window.confirm("Approve this bank transfer payment and mark order as Confirmed?");
    if (!confirmed) {
      return;
    }

    try {
      approveButton.disabled = true;
      await approveOrderPayment(orderId);
      showSyncing(true, "Payment approved and synced to catalog.json");
      setTimeout(() => showSyncing(false), 1400);
    } catch (error) {
      approveButton.disabled = false;
      showSyncing(true, `Could not approve payment: ${error.message}`);
      setTimeout(() => showSyncing(false), 1800);
    }
  });
}

searchInput.addEventListener("input", applyFilter);

stockFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.stockFilter = button.dataset.stockFilter || "all";
    stockFilterButtons.forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    applyFilter();
  });
});

ordersFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.orderFilter = button.dataset.orderFilter || "all";
    ordersFilterButtons.forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    renderOrders();
  });
});

renderSchemaForm();

(async function bootstrap() {
  if (!state.token) {
    showLogin();
    return;
  }

  try {
    showDashboard();
    await loadCatalog();
    await loadAccount();
    await loadContent();
    startOrdersAutoRefresh();
  } catch (_error) {
    localStorage.removeItem(TOKEN_KEY);
    state.token = "";
    stopOrdersAutoRefresh();
    showLogin();
  }
})();
