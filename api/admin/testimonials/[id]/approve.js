import { verifyAuth } from "../../../_utils.js";
import { readContent, saveContent } from "../../../_content-utils.js";

export default async function handler(req, res) {
  const user = verifyAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const id = req.query?.id;
    const content = await readContent();
    const index = content.testimonials.findIndex((item) => item.id === id);

    if (index < 0) {
      return res.status(404).json({ error: "Testimonial not found" });
    }

    content.testimonials[index].approved = true;
    content.testimonials[index].approvedAt = new Date().toISOString();
    await saveContent(content);

    return res.status(200).json({ ok: true, testimonial: content.testimonials[index] });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not approve testimonial" });
  }
}
