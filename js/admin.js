const API_BASE = "http://localhost:5050/api";
const TOKEN_KEY = "mjt-admin-token";
const JSON_SCHEMA = [
  { key: "id", label: "ID", type: "text", placeholder: "p017", required: true },
  { key: "name", label: "Name", type: "text", placeholder: "Product name", required: true },
  { key: "price", label: "Price", type: "number", placeholder: "5000", required: true },
  { key: "category", label: "Category", type: "text", placeholder: "Cakes", required: true },
  { key: "stock", label: "Stock", type: "number", placeholder: "20", required: true },
  { key: "tags", label: "Tags (comma-separated)", type: "text", placeholder: "fresh,popular", required: false },
  { key: "description", label: "Description", type: "textarea", placeholder: "Short description", required: true },
  { key: "image", label: "Image path", type: "text", placeholder: "images/item.jpg", required: true }
];

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  catalog: { categories: [], products: [] },
  filteredProducts: [],
  editingId: null
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
  return {
    ...product,
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    tags: Array.isArray(product.tags)
      ? product.tags
      : String(product.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
    last_updated: product.last_updated || new Date().toISOString().slice(0, 10)
  };
}

function renderSchemaForm() {
  productForm.innerHTML = JSON_SCHEMA.map((field) => {
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
  }).join("") + '<button class="btn primary" type="submit">Add Product</button>';
}

function getStockClass(stock) {
  return stock > 10 ? "in" : "low";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
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
      <td><span class="stock-chip ${getStockClass(product.stock)}">${product.stock > 10 ? "In Stock" : "Low Stock"}</span></td>
    </tr>
  `).join("");
}

function renderCategories() {
  categoryList.innerHTML = state.catalog.categories.map((category) => `
    <div class="category-row">
      <input type="text" value="${category}" data-old-category="${category}">
      <button class="btn ghost" data-rename-category="${category}">Rename</button>
    </div>
  `).join("");
}

function renderJsonPreview() {
  jsonPreview.textContent = JSON.stringify(state.catalog, null, 2);
}

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    state.filteredProducts = [...state.catalog.products];
  } else {
    state.filteredProducts = state.catalog.products.filter((product) => {
      const tags = Array.isArray(product.tags) ? product.tags.join(" ") : "";
      const haystack = `${product.name} ${product.category} ${tags}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  renderProductsTable();
}

function openDrawer(product) {
  state.editingId = product.id;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.getElementById("drawer-price").value = String(product.price);
  document.getElementById("drawer-category").value = product.category;
  drawerPreview.textContent = JSON.stringify(
    {
      before: { price: product.price, category: product.category },
      after: { price: product.price, category: product.category }
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

async function loadCatalog() {
  const payload = await apiFetch("/catalog");
  state.catalog = {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    products: Array.isArray(payload.products) ? payload.products.map(normalizeProduct) : []
  };

  state.filteredProducts = [...state.catalog.products];
  renderProductsTable();
  renderCategories();
  renderJsonPreview();
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
}

function showLogin() {
  dashboard.hidden = true;
  loginPanel.hidden = false;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  loginError.textContent = "";
  try {
    await login(email, password);
    showDashboard();
    await loadCatalog();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const product = {};

  JSON_SCHEMA.forEach((field) => {
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

  product.last_updated = new Date().toISOString().slice(0, 10);

  state.catalog.products.unshift(normalizeProduct(product));
  applyFilter();
  renderJsonPreview();
  productForm.reset();
});

productsTable.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) {
    return;
  }

  const product = state.catalog.products.find((item) => item.id === row.dataset.id);
  if (product) {
    openDrawer(product);
  }
});

addCategoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("new-category");
  const value = input.value.trim();
  if (!value || state.catalog.categories.includes(value)) {
    return;
  }

  state.catalog.categories.push(value);
  renderCategories();
  renderJsonPreview();
  input.value = "";
});

categoryList.addEventListener("click", (event) => {
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

  state.catalog.categories = state.catalog.categories.map((value) => (value === oldCategory ? nextCategory : value));
  state.catalog.products = state.catalog.products.map((product) => {
    if (product.category === oldCategory) {
      return { ...product, category: nextCategory, last_updated: new Date().toISOString().slice(0, 10) };
    }
    return product;
  });

  applyFilter();
  renderCategories();
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
  const nextCategory = document.getElementById("drawer-category").value || product.category;

  drawerPreview.textContent = JSON.stringify(
    {
      before: { price: product.price, category: product.category },
      after: { price: nextPrice, category: nextCategory }
    },
    null,
    2
  );
});

drawerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.editingId) {
    return;
  }

  const nextPrice = Number(document.getElementById("drawer-price").value || 0);
  const nextCategory = document.getElementById("drawer-category").value.trim();

  state.catalog.products = state.catalog.products.map((product) => {
    if (product.id !== state.editingId) {
      return product;
    }

    return {
      ...product,
      price: nextPrice,
      category: nextCategory,
      last_updated: new Date().toISOString().slice(0, 10)
    };
  });

  if (nextCategory && !state.catalog.categories.includes(nextCategory)) {
    state.catalog.categories.push(nextCategory);
  }

  applyFilter();
  renderCategories();
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
  showLogin();
});

searchInput.addEventListener("input", applyFilter);

renderSchemaForm();

(async function bootstrap() {
  if (!state.token) {
    showLogin();
    return;
  }

  try {
    showDashboard();
    await loadCatalog();
  } catch (_error) {
    localStorage.removeItem(TOKEN_KEY);
    state.token = "";
    showLogin();
  }
})();
