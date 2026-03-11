import { verifyAuth } from "../_utils.js";
import { readContent } from "../_content-utils.js";

export default async function handler(req, res) {
  const user = verifyAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const content = await readContent();
    return res.status(200).json(content);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load admin content" });
  }
}
