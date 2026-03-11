import { verifyAuth } from "../_utils.js";
import { readContent, saveContent } from "../_content-utils.js";

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
    const { title, body, imageUrl } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const content = await readContent();
    const post = {
      id: `p-${Date.now()}`,
      title: String(title).trim(),
      body: String(body).trim(),
      imageUrl: imageUrl ? String(imageUrl).trim() : "",
      createdAt: new Date().toISOString(),
      published: true
    };

    content.posts.unshift(post);
    await saveContent(content);

    return res.status(201).json({ ok: true, post });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not publish post" });
  }
}
