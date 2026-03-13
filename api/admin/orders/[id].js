import { verifyAuth, readCatalog, commitCatalogToGithub, sanitizeCatalog } from "../../_utils.js";

export default async function handler(req, res) {
  const user = verifyAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const id = String(req.query?.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const catalog = await readCatalog();
    const nextOrders = (Array.isArray(catalog.orders) ? catalog.orders : []).filter(
      (entry) => String(entry.orderId || "") !== id
    );

    if (nextOrders.length === (Array.isArray(catalog.orders) ? catalog.orders : []).length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const nextCatalog = sanitizeCatalog({ ...catalog, orders: nextOrders });
    const github = await commitCatalogToGithub(nextCatalog, user.email || "admin@mummyj2treats.com");

    return res.status(200).json({ ok: true, github });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not delete order" });
  }
}
