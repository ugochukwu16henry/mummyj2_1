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

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function sanitizeCatalog(data) {
  if (!data || typeof data !== "object") {
    return { categories: [], products: [] };
  }

  return {
    categories: Array.isArray(data.categories)
      ? data.categories.filter((item) => typeof item === "string")
      : [],
    products: Array.isArray(data.products)
      ? data.products.filter((item) => item && typeof item === "object")
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

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};

  if (email !== "admin@mummyj2treats.com" || password !== "admin123") {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  const token = jwt.sign(
    {
      sub: "admin-user",
      role: "admin",
      email
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({ token, user: { email, role: "admin" } });
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

app.listen(PORT, () => {
  console.log(`Admin API running at http://localhost:${PORT}`);
});
