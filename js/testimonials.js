const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:5050/api"
  : "/api";

async function fetchContent() {
  const response = await fetch(`${API_BASE}/content`);
  if (!response.ok) {
    throw new Error("Could not load stories");
  }
  return response.json();
}

function renderHomeTestimonials(testimonials) {
  const container = document.getElementById("home-testimonials");
  if (!container) return;

  if (!testimonials.length) {
    container.innerHTML = "<p>No stories yet. Be the first to share!</p>";
    return;
  }

  const featured = testimonials.slice(0, 3);
  container.innerHTML = featured
    .map((t) => `
      <article class="card" aria-label="Testimony from ${t.name}">
        ${t.imageUrl ? `<img src="${t.imageUrl}" alt="${t.name}" loading="lazy">` : ""}
        <div style="padding:1rem;">
          <h3>${t.name}</h3>
          <p>"${t.message}"</p>
          ${t.videoUrl ? `<p><a href="${t.videoUrl}" target="_blank" rel="noopener" class="btn">Watch Video</a></p>` : ""}
        </div>
      </article>
    `)
    .join("");
}

function renderPageTestimonials(testimonials) {
  const container = document.getElementById("testimonials-grid");
  if (!container) return;

  if (!testimonials.length) {
    container.innerHTML = "<p>No testimonials yet. Check back soon.</p>";
    return;
  }

  container.innerHTML = testimonials
    .map((t) => `
      <article class="card" aria-label="Testimony from ${t.name}">
        ${t.imageUrl ? `<img src="${t.imageUrl}" alt="${t.name}" loading="lazy">` : ""}
        <div style="padding:1rem;">
          <h3>${t.name}</h3>
          <p>"${t.message}"</p>
          ${t.videoUrl ? `<p><a href="${t.videoUrl}" target="_blank" rel="noopener" class="btn">Watch Video</a></p>` : ""}
        </div>
      </article>
    `)
    .join("");
}

function renderBlog(posts) {
  const container = document.getElementById("blog-list");
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = "<p>No blog posts yet.</p>";
    return;
  }

  container.innerHTML = posts
    .map((post) => `
      <article class="card" aria-label="${post.title}">
        ${post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}" loading="lazy">` : ""}
        <div style="padding:1rem;">
          <h3>${post.title}</h3>
          <p>${post.body}</p>
          ${post.videoUrl ? `<p><a href="${post.videoUrl}" target="_blank" rel="noopener" class="btn">Watch Video</a></p>` : ""}
        </div>
      </article>
    `)
    .join("");
}

async function initTestimonials() {
  let content;
  try {
    content = await fetchContent();
  } catch (error) {
    console.warn(error.message);
    return;
  }

  const testimonials = Array.isArray(content.testimonials) ? content.testimonials : [];
  const posts = Array.isArray(content.posts) ? content.posts : [];

  renderHomeTestimonials(testimonials);
  renderPageTestimonials(testimonials);
  renderBlog(posts);
}

function setupTestimonialForm() {
  const form = document.getElementById("testimonial-form");
  const status = document.getElementById("testimonial-status");
  if (!form || !status) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";

    const name = document.getElementById("testimonial-name").value.trim();
    const message = document.getElementById("testimonial-message").value.trim();
    const imageUrl = document.getElementById("testimonial-image").value.trim();
    const videoUrl = document.getElementById("testimonial-video").value.trim();

    if (!name || !message) {
      status.textContent = "Please enter your name and testimony.";
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, imageUrl, videoUrl })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not submit testimony");
      }

      form.reset();
      status.textContent = "Thank you! Your testimony has been sent for approval.";
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTestimonials();
  setupTestimonialForm();
});

