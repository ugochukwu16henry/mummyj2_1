import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || "mjt-admin-secret";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_CATALOG_PATH = process.env.GITHUB_CATALOG_PATH || "data/catalog.json";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOG_PATH = path.resolve(__dirname, "../data/catalog.json");
const CONTENT_PATH = path.resolve(__dirname, "../data/content.json");
const AUTH_CONFIG_PATH = path.resolve(__dirname, "../data/admin-auth.json");

app.use(cors());
app.use(express.json({ limit: "30mb" }));

function sanitizeCatalog(data) {
  if (!data || typeof data !== "object") {
    return { categories: [], products: [], category_images: {}, orders: [] };
  }

  const categories = Array.isArray(data.categories)
    ? data.categories.filter((item) => typeof item === "string")
    : [];

  const allowedCategories = new Set(categories);

  return {
    categories,
    products: Array.isArray(data.products)
      ? data.products.filter((item) => item && typeof item === "object")
      : [],
    category_images: data.category_images && typeof data.category_images === "object"
      ? Object.fromEntries(
        Object.entries(data.category_images).filter(
          ([key, value]) => typeof key === "string"
            && allowedCategories.has(key)
            && typeof value === "string"
        )
      )
      : {},
    orders: Array.isArray(data.orders)
      ? data.orders.filter((entry) => entry && typeof entry === "object")
      : []
  };
}

async function readCatalog() {
  const raw = await fs.readFile(CATALOG_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return sanitizeCatalog(parsed);
}

async function writeCatalog(catalog) {
  const output = `${JSON.stringify(sanitizeCatalog(catalog), null, 2)}\n`;
  await fs.writeFile(CATALOG_PATH, output, "utf-8");
}

async function readContent() {
  try {
    const raw = await fs.readFile(CONTENT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid content file");
    }
    return {
      testimonials: Array.isArray(parsed.testimonials) ? parsed.testimonials : [],
      posts: Array.isArray(parsed.posts) ? parsed.posts : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { testimonials: [], posts: [] };
    }
    console.warn("Failed to read content.json:", error.message);
    return { testimonials: [], posts: [] };
  }
}

async function writeContent(nextContent) {
  const safe = {
    testimonials: Array.isArray(nextContent.testimonials) ? nextContent.testimonials : [],
    posts: Array.isArray(nextContent.posts) ? nextContent.posts : []
  };
  const output = `${JSON.stringify(safe, null, 2)}\n`;
  await fs.writeFile(CONTENT_PATH, output, "utf-8");
  return safe;
}

function isGithubSyncEnabled() {
  return Boolean(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);
}

function buildGithubContentUrl() {
  const encodedPath = GITHUB_CATALOG_PATH
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedPath}`;
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `GitHub request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function getRemoteCatalogSnapshot() {
  const url = `${buildGithubContentUrl()}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (response.status === 404) {
    return { sha: null, decodedContent: null };
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `Could not fetch remote file sha (${response.status})`;
    throw new Error(message);
  }

  const base64Content = typeof payload?.content === "string"
    ? payload.content.replace(/\n/g, "")
    : "";
  const decodedContent = base64Content
    ? Buffer.from(base64Content, "base64").toString("utf-8")
    : null;

  return {
    sha: payload?.sha || null,
    decodedContent
  };
}

async function commitCatalogToGithub(catalog, actorEmail = "admin@mummyj2treats.com") {
  if (!isGithubSyncEnabled()) {
    return {
      enabled: false,
      committed: false,
      message: "GitHub sync skipped. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO to enable."
    };
  }

  const snapshot = await getRemoteCatalogSnapshot();
  const content = `${JSON.stringify(sanitizeCatalog(catalog), null, 2)}\n`;

  if (snapshot.decodedContent === content) {
    return {
      enabled: true,
      committed: false,
      message: "No changes detected in catalog.json"
    };
  }

  const body = {
    message: `chore(catalog): update catalog.json (${new Date().toISOString()})`,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: GITHUB_BRANCH,
    committer: {
      name: "mummyj2Treats Admin",
      email: actorEmail
    }
  };

  if (snapshot.sha) {
    body.sha = snapshot.sha;
  }

  const response = await githubRequest(buildGithubContentUrl(), {
    method: "PUT",
    body: JSON.stringify(body)
  });

  return {
    enabled: true,
    committed: true,
    commitSha: response?.commit?.sha || "",
    commitUrl: response?.commit?.html_url || ""
  };
}

async function readAdminAuth() {
  try {
    const raw = await fs.readFile(AUTH_CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid admin auth file");
    }
    return {
      email: String(parsed.email || "admin@mummyj2treats.com").trim(),
      password: String(parsed.password || "admin123")
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    console.warn("Failed to read admin auth config:", error.message);
    return null;
  }
}

async function writeAdminAuth(nextAuth) {
  const safeAuth = {
    email: String(nextAuth.email || "admin@mummyj2treats.com").trim(),
    password: String(nextAuth.password || "admin123")
  };
  const output = `${JSON.stringify(safeAuth, null, 2)}\n`;
  await fs.writeFile(AUTH_CONFIG_PATH, output, "utf-8");
  return safeAuth;
}


function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  const stored = await readAdminAuth();
  const expectedEmail = stored?.email || "admin@mummyj2treats.com";
  const expectedPassword = stored?.password || "admin123";

  if (email !== expectedEmail || password !== expectedPassword) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  const token = jwt.sign(
    {
      sub: "admin-user",
      role: "admin",
      email: expectedEmail
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({ token, user: { email: expectedEmail, role: "admin" } });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const stored = await readAdminAuth();
  const email = stored?.email || "admin@mummyj2treats.com";
  res.json({ email, role: "admin" });
});

app.post("/api/auth/change-credentials", authMiddleware, async (req, res) => {
  const { currentPassword, newEmail, newPassword } = req.body || {};

  if (!currentPassword || !newEmail || !newPassword) {
    return res.status(400).json({ error: "currentPassword, newEmail, and newPassword are required" });
  }

  const stored = await readAdminAuth();
  const expectedPassword = stored?.password || "admin123";

  if (String(currentPassword) !== String(expectedPassword)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const nextAuth = await writeAdminAuth({
    email: newEmail,
    password: newPassword
  });

  return res.json({
    ok: true,
    email: nextAuth.email
  });
});

app.get("/api/content", async (_req, res) => {
  const content = await readContent();
  const approvedTestimonials = content.testimonials.filter((item) => item.approved);
  const publishedPosts = content.posts.filter((post) => post.published);
  res.json({
    testimonials: approvedTestimonials,
    posts: publishedPosts
  });
});

app.post("/api/testimonials", async (req, res) => {
  const { name, message, imageUrl, videoUrl } = req.body || {};

  if (!name || !message) {
    return res.status(400).json({ error: "Name and message are required" });
  }

  const content = await readContent();
  const testimonial = {
    id: `t-${Date.now()}`,
    name: String(name).trim(),
    message: String(message).trim(),
    imageUrl: imageUrl ? String(imageUrl).trim() : "",
    videoUrl: videoUrl ? String(videoUrl).trim() : "",
    createdAt: new Date().toISOString(),
    approved: false
  };

  content.testimonials.unshift(testimonial);
  await writeContent(content);

  res.status(201).json({ ok: true, testimonial });
});

app.get("/api/admin/content", authMiddleware, async (_req, res) => {
  const content = await readContent();
  res.json(content);
});

app.post("/api/admin/testimonials/:id/approve", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const content = await readContent();
  const index = content.testimonials.findIndex((item) => item.id === id);
  if (index < 0) {
    return res.status(404).json({ error: "Testimonial not found" });
  }

  content.testimonials[index].approved = true;
  content.testimonials[index].approvedAt = new Date().toISOString();
  await writeContent(content);

  res.json({ ok: true, testimonial: content.testimonials[index] });
});

app.delete("/api/admin/testimonials/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const content = await readContent();
  const next = content.testimonials.filter((item) => item.id !== id);
  if (next.length === content.testimonials.length) {
    return res.status(404).json({ error: "Testimonial not found" });
  }
  content.testimonials = next;
  await writeContent(content);
  res.json({ ok: true });
});

app.post("/api/admin/posts", authMiddleware, async (req, res) => {
  const { title, body, imageUrl, videoUrl } = req.body || {};

  if (!title || !body) {
    return res.status(400).json({ error: "Title and body are required" });
  }

  const content = await readContent();
  const post = {
    id: `p-${Date.now()}`,
    title: String(title).trim(),
    body: String(body).trim(),
    imageUrl: imageUrl ? String(imageUrl).trim() : "",
    videoUrl: videoUrl ? String(videoUrl).trim() : "",
    createdAt: new Date().toISOString(),
    published: true
  };

  content.posts.unshift(post);
  await writeContent(content);

  res.status(201).json({ ok: true, post });
});

app.delete("/api/admin/posts/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const content = await readContent();
  const next = content.posts.filter((post) => post.id !== id);
  if (next.length === content.posts.length) {
    return res.status(404).json({ error: "Post not found" });
  }
  content.posts = next;
  await writeContent(content);
  res.json({ ok: true });
});

app.get("/api/products", authMiddleware, async (_req, res) => {
  try {
    const catalog = await readCatalog();
    return res.json(catalog.products || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not read products" });
  }
});

app.post("/api/products", authMiddleware, async (req, res) => {
  try {
    const newProduct = req.body || {};
    const catalog = await readCatalog();

    const productWithMeta = {
      ...newProduct,
      id: Date.now().toString(),
      last_updated: new Date().toISOString()
    };

    const nextCatalog = {
      ...catalog,
      products: [...(catalog.products || []), productWithMeta]
    };

    if (
      productWithMeta.category &&
      typeof productWithMeta.category === "string" &&
      !nextCatalog.categories.includes(productWithMeta.category)
    ) {
      nextCatalog.categories = [...nextCatalog.categories, productWithMeta.category];
    }

    await writeCatalog(nextCatalog);

    const github = await commitCatalogToGithub(nextCatalog, req.user?.email);

    return res
      .status(201)
      .json({ message: "Product added successfully!", product: productWithMeta, github });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not add product" });
  }
});

app.get("/api/catalog", authMiddleware, async (_req, res) => {
  try {
    const catalog = await readCatalog();
    res.json(catalog);
  } catch (error) {
    res.status(500).json({ error: "Could not read catalog.json" });
  }
});

app.put("/api/catalog", authMiddleware, async (req, res) => {
  try {
    await writeCatalog(req.body);
    const github = await commitCatalogToGithub(req.body, req.user?.email);
    res.json({ ok: true, syncedAt: new Date().toISOString(), github });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not write catalog.json" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const catalog = await readCatalog();
    const incoming = req.body || {};
    const orders = Array.isArray(catalog.orders) ? catalog.orders : [];

    const order = {
      orderId: String(incoming.orderId || `ORD-${Date.now()}`),
      productId: String(incoming.productId || ""),
      productName: String(incoming.productName || ""),
      qty: Number(incoming.qty) > 0 ? Number(incoming.qty) : 1,
      date: String(incoming.date || ""),
      time: String(incoming.time || ""),
      customerName: String(incoming.customerName || ""),
      phone: String(incoming.phone || ""),
      notes: String(incoming.notes || ""),
      status: String(incoming.status || "pending"),
      createdAt: incoming.createdAt || new Date().toISOString()
    };

    const nextCatalog = {
      ...catalog,
      orders: [order, ...orders]
    };

    await writeCatalog(nextCatalog);
    const github = await commitCatalogToGithub(nextCatalog, "customer@mummyj2treats.com");
    return res.status(201).json({ ok: true, order, github });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not submit order" });
  }
});

app.get("/api/orders", authMiddleware, async (_req, res) => {
  try {
    const catalog = await readCatalog();
    return res.json({ orders: Array.isArray(catalog.orders) ? catalog.orders : [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load orders" });
  }
});

app.listen(PORT, () => {
  console.log(`Admin API running at http://localhost:${PORT}`);
});
