import { readContent, saveContent } from "./_content-utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, message, imageUrl } = req.body || {};

    if (!name || !message) {
      return res.status(400).json({ error: "Name and message are required" });
    }

    const content = await readContent();
    const testimonial = {
      id: `t-${Date.now()}`,
      name: String(name).trim(),
      message: String(message).trim(),
      imageUrl: imageUrl ? String(imageUrl).trim() : "",
      createdAt: new Date().toISOString(),
      approved: false
    };

    content.testimonials.unshift(testimonial);
    await saveContent(content);

    return res.status(201).json({ ok: true, testimonial });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not submit testimony" });
  }
}
