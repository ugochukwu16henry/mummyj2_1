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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function validateFileSize(file, maxBytes) {
  if (!file) return null;
  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1);
    return `File is too large. Max allowed size is ${mb} MB.`;
  }
  return null;
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
          ${
            t.videoUrl
              ? (t.videoUrl.startsWith("data:video")
                  || t.videoUrl.match(/\.(mp4|webm|ogg)(\?|$)/i))
                ? `<video src="${t.videoUrl}" controls style="width:100%;max-height:260px;border-radius:10px;margin-top:0.75rem;"></video>`
                : `<p><a href="${t.videoUrl}" target="_blank" rel="noopener" class="btn">Watch Video</a></p>`
              : ""
          }
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
          ${
            t.videoUrl
              ? (t.videoUrl.startsWith("data:video")
                  || t.videoUrl.match(/\.(mp4|webm|ogg)(\?|$)/i))
                ? `<video src="${t.videoUrl}" controls style="width:100%;max-height:320px;border-radius:10px;margin-top:0.75rem;"></video>`
                : `<p><a href="${t.videoUrl}" target="_blank" rel="noopener" class="btn">Watch Video</a></p>`
              : ""
          }
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
          ${
            post.videoUrl
              ? (post.videoUrl.startsWith("data:video")
                  || post.videoUrl.match(/\.(mp4|webm|ogg)(\?|$)/i))
                ? `<video src="${post.videoUrl}" controls style="width:100%;max-height:360px;border-radius:10px;margin-top:0.75rem;"></video>`
                : `<p><a href="${post.videoUrl}" target="_blank" rel="noopener" class="btn">Watch Video</a></p>`
              : ""
          }
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

  const steps = Array.from(form.querySelectorAll(".story-step"));
  const progressFill = document.getElementById("story-progress-fill");
  const messageField = document.getElementById("testimonial-message");
  const nameField = document.getElementById("testimonial-name");
  const imageInput = document.getElementById("testimonial-image-file");
  const videoInput = document.getElementById("testimonial-video-file");
  const imagePreview = document.getElementById("testimonial-image-preview");
  const videoPreview = document.getElementById("testimonial-video-preview");

  let currentStep = 0;

  function updateProgress() {
    if (!progressFill) return;
    const percent = ((currentStep + 1) / steps.length) * 100;
    progressFill.style.width = `${percent}%`;
  }

  function showStep(nextIndex, direction = "forward") {
    if (nextIndex < 0 || nextIndex >= steps.length || nextIndex === currentStep) {
      return;
    }

    const current = steps[currentStep];
    const incoming = steps[nextIndex];

    current.classList.remove("active", "slide-in-right", "slide-in-left");
    incoming.classList.add("active", direction === "forward" ? "slide-in-right" : "slide-in-left");

    currentStep = nextIndex;
    updateProgress();

    setTimeout(() => {
      incoming.classList.remove("slide-in-right", "slide-in-left");
    }, 240);
  }

  function validateStep(stepIndex) {
    status.textContent = "";

    if (stepIndex === 0 && !String(messageField?.value || "").trim()) {
      status.textContent = "Please tell us what you loved most before continuing.";
      return false;
    }

    if (stepIndex === 1 && !String(nameField?.value || "").trim()) {
      status.textContent = "Please add your name so we can credit your story.";
      return false;
    }

    return true;
  }

  function autoGrowTextarea() {
    if (!messageField) return;
    messageField.style.height = "auto";
    messageField.style.height = `${messageField.scrollHeight}px`;
  }

  function bindFilePreview(input, preview, type = "image") {
    if (!input || !preview) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      if (!file) {
        preview.hidden = true;
        if (type === "video") {
          preview.removeAttribute("src");
        } else {
          preview.removeAttribute("src");
        }
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      preview.hidden = false;
      preview.src = blobUrl;
      if (type === "video") {
        preview.load();
      }
    });
  }

  document.getElementById("story-next-1")?.addEventListener("click", () => {
    if (!validateStep(0)) return;
    showStep(1, "forward");
  });

  document.getElementById("story-next-2")?.addEventListener("click", () => {
    if (!validateStep(1)) return;
    showStep(2, "forward");
  });

  document.getElementById("story-back-2")?.addEventListener("click", () => {
    showStep(0, "back");
  });

  document.getElementById("story-back-3")?.addEventListener("click", () => {
    showStep(1, "back");
  });

  if (messageField) {
    messageField.addEventListener("input", autoGrowTextarea);
    autoGrowTextarea();
  }

  bindFilePreview(imageInput, imagePreview, "image");
  bindFilePreview(videoInput, videoPreview, "video");
  updateProgress();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";

    if (!validateStep(0) || !validateStep(1)) {
      return;
    }

    const name = String(nameField?.value || "").trim();
    const message = String(messageField?.value || "").trim();
    const imageFile = imageInput?.files?.[0] || null;
    const videoFile = videoInput?.files?.[0] || null;

    const imageError = validateFileSize(imageFile, 2 * 1024 * 1024);
    const videoError = validateFileSize(videoFile, 8 * 1024 * 1024);
    if (imageError || videoError) {
      status.textContent = imageError || videoError;
      return;
    }

    try {
      let imageUrl = "";
      let videoUrl = "";

      if (imageFile) {
        imageUrl = await fileToDataUrl(imageFile);
      }

      if (videoFile) {
        videoUrl = await fileToDataUrl(videoFile);
      }

      const response = await fetch(`${API_BASE}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, imageUrl, videoUrl })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const fallbackText = await response.text().catch(() => "");
        throw new Error(
          payload?.error
            || fallbackText
            || `Could not submit testimony (HTTP ${response.status})`
        );
      }

      form.reset();
      if (imagePreview) {
        imagePreview.hidden = true;
        imagePreview.removeAttribute("src");
      }
      if (videoPreview) {
        videoPreview.hidden = true;
        videoPreview.removeAttribute("src");
      }

      currentStep = 2;
      showStep(0, "back");
      autoGrowTextarea();
      status.textContent = "❤ Thank you! We’re reviewing your story now.";
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTestimonials();
  setupTestimonialForm();
});

