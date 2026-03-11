import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "mjt-admin-secret";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_CATALOG_PATH = process.env.GITHUB_CATALOG_PATH || "data/catalog.json";

export function sanitizeCatalog(data) {
  if (!data || typeof data !== "object") {
    return { categories: [], products: [], category_images: {} };
  }

  return {
    categories: Array.isArray(data.categories)
      ? data.categories.filter((item) => typeof item === "string")
      : [],
    products: Array.isArray(data.products)
      ? data.products.filter((item) => item && typeof item === "object")
      : [],
    category_images: data.category_images && typeof data.category_images === "object"
      ? Object.fromEntries(
        Object.entries(data.category_images).filter(
          ([key, value]) => typeof key === "string" && typeof value === "string"
        )
      )
      : {}
  };
}

export function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

export function verifyAuth(req, res) {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
}

export function createLoginToken(email) {
  return jwt.sign(
    {
      sub: "admin-user",
      role: "admin",
      email
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
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

async function githubFetch(url, options = {}) {
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
    const message = payload?.message || `Could not fetch remote catalog (${response.status})`;
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

export async function readCatalog() {
  if (isGithubSyncEnabled()) {
    try {
      const snapshot = await getRemoteCatalogSnapshot();
      if (snapshot.decodedContent) {
        return sanitizeCatalog(JSON.parse(snapshot.decodedContent));
      }
    } catch (error) {
      console.warn("Falling back to local catalog read:", error.message);
    }
  }

  const localPath = path.resolve(process.cwd(), "data/catalog.json");
  const raw = await fs.readFile(localPath, "utf-8");
  return sanitizeCatalog(JSON.parse(raw));
}

export async function commitCatalogToGithub(catalog, actorEmail = "admin@mummyj2treats.com") {
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

  const response = await githubFetch(buildGithubContentUrl(), {
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
