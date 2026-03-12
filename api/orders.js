import { commitCatalogToGithub, readCatalog, sanitizeCatalog, verifyAuth } from "./_utils.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const incoming = req.body || {};
      const catalog = await readCatalog();
      const orders = Array.isArray(catalog.orders) ? catalog.orders : [];

      const parsedAmount = Number(incoming.amountDue);
      const orderLines = Array.isArray(incoming.orderLines)
        ? incoming.orderLines
            .filter((line) => line && typeof line === "object")
            .map((line) => ({
              id: String(line.id || ""),
              productId: String(line.productId || ""),
              productName: String(line.productName || ""),
              qty: Number(line.qty) > 0 ? Number(line.qty) : 1,
              unitPrice: Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice) : 0,
              total: Number.isFinite(Number(line.total)) ? Number(line.total) : 0
            }))
        : [];

      const order = {
        orderId: String(incoming.orderId || `ORD-${Date.now()}`),
        productId: String(incoming.productId || ""),
        productName: String(incoming.productName || ""),
        qty: Number(incoming.qty) > 0 ? Number(incoming.qty) : 1,
        date: String(incoming.date || ""),
        time: String(incoming.time || ""),
        customerName: String(incoming.customerName || ""),
        customerEmail: String(incoming.customerEmail || ""),
        phone: String(incoming.phone || ""),
        notes: String(incoming.notes || ""),
        status: String(incoming.status || "pending"),
        paymentMethod: String(incoming.paymentMethod || ""),
        amountDue: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        bankName: String(incoming.bankName || ""),
        bankAccountNumber: String(incoming.bankAccountNumber || ""),
        bankAccountName: String(incoming.bankAccountName || ""),
        bankReference: String(incoming.bankReference || ""),
        receiptImage: String(incoming.receiptImage || ""),
        orderLines,
        createdAt: incoming.createdAt || new Date().toISOString()
      };

      const nextCatalog = sanitizeCatalog({
        ...catalog,
        orders: [order, ...orders]
      });

      const github = await commitCatalogToGithub(nextCatalog, "customer@mummyj2treats.com");
      return res.status(201).json({ ok: true, order, github });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Could not submit order" });
    }
  }

  if (req.method === "GET") {
    const user = verifyAuth(req, res);
    if (!user) {
      return;
    }

    try {
      const catalog = await readCatalog();
      return res.status(200).json({ orders: Array.isArray(catalog.orders) ? catalog.orders : [] });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Could not load orders" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
