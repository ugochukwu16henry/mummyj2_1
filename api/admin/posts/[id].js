import { verifyAuth } from "../../_utils.js";
import { readContent, saveContent } from "../../_content-utils.js";

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
    const id = req.query?.id;
    const content = await readContent();
    const nextPosts = content.posts.filter((post) => post.id !== id);

    if (nextPosts.length === content.posts.length) {
      return res.status(404).json({ error: "Post not found" });
    }

    content.posts = nextPosts;
    await saveContent(content);

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not delete post" });
  }
}
