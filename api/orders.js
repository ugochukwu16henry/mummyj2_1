import { commitCatalogToGithub, readCatalog, sanitizeCatalog, verifyAuth } from "./_utils.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const incoming = req.body || {};
      const catalog = await readCatalog();
      const orders = Array.isArray(catalog.orders) ? catalog.orders : [];

      const parsedAmount = Number(incoming.amountDue);
      const linkedOrderRequestIds = Array.isArray(incoming.linkedOrderRequestIds)
        ? Array.from(
            new Set(
              incoming.linkedOrderRequestIds
                .map((value) => String(value || "").trim())
                .filter(Boolean)
            )
          )
        : [];
      const linkedOrderRequests = Array.isArray(incoming.linkedOrderRequests)
        ? incoming.linkedOrderRequests
            .filter((entry) => entry && typeof entry === "object")
            .map((entry) => ({
              orderRequestId: String(entry.orderRequestId || entry.orderId || ""),
              productId: String(entry.productId || ""),
              productName: String(entry.productName || ""),
              qty: Number(entry.qty) > 0 ? Number(entry.qty) : 1,
              date: String(entry.date || ""),
              time: String(entry.time || ""),
              customerName: String(entry.customerName || ""),
              phone: String(entry.phone || ""),
              notes: String(entry.notes || "")
            }))
        : [];
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
        orderRequestId: String(incoming.orderRequestId || ""),
        orderSource: String(incoming.orderSource || ""),
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
        paymentStatus: String(incoming.paymentStatus || ""),
        paymentMethod: String(incoming.paymentMethod || ""),
        amountDue: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        bankName: String(incoming.bankName || ""),
        bankAccountNumber: String(incoming.bankAccountNumber || ""),
        bankAccountName: String(incoming.bankAccountName || ""),
        bankReference: String(incoming.bankReference || ""),
        receiptImage: String(incoming.receiptImage || ""),
        linkedOrderRequestIds,
        linkedOrderRequests,
        orderLines,
        createdAt: incoming.createdAt || new Date().toISOString()
      };

      const checkoutOrderId = String(order.orderId || "").trim();
      const updatedOrders = linkedOrderRequestIds.length
        ? orders.map((existingOrder) => {
            const existingRequestId = String(
              existingOrder.orderRequestId || existingOrder.orderId || ""
            ).trim();
            if (!existingRequestId || !linkedOrderRequestIds.includes(existingRequestId)) {
              return existingOrder;
            }

            return {
              ...existingOrder,
              status: "merged_to_checkout",
              paymentStatus: "linked_to_checkout",
              linkedCheckoutOrderId: checkoutOrderId,
              linkedCheckoutAt: new Date().toISOString()
            };
          })
        : orders;

      const nextCatalog = sanitizeCatalog({
        ...catalog,
        orders: [order, ...updatedOrders]
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
