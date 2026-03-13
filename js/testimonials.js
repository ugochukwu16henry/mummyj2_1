const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:5050/api"
  : "https://mummyj21-frontend-production.up.railway.app/api";

const MAX_TESTIMONIAL_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

async function fetchContent() {
  const response = await fetch(`${API_BASE}/content`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load stories");
  }
  return response.json();
}

function renderSyncStatus(date, hasError = false) {
  const syncStatus = document.getElementById("content-sync-status");
  if (!syncStatus) return;

  if (hasError) {
    syncStatus.textContent = "Last synced: unavailable";
    syncStatus.classList.remove("ok");
    return;
  }

  const formatter = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  syncStatus.textContent = `Last synced: ${formatter.format(date)}`;
  syncStatus.classList.add("ok");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not process image"));
    image.src = dataUrl;
  });
}

async function compressImageForUpload(file) {
  const sourceDataUrl = await fileToDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);

  const maxWidth = 960;
  const maxHeight = 960;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (blob) {
    return blob;
  }

  const fallbackDataUrl = canvas.toDataURL("image/jpeg", 0.78);
  const fallbackResponse = await fetch(fallbackDataUrl);
  return fallbackResponse.blob();
}

async function uploadFileToBucket(fileOrBlob, fileName, fileType, folder, onProgress) {
  if (!fileOrBlob) {
    return "";
  }

  const total = fileOrBlob.size || 1;
  if (typeof onProgress === "function") {
    onProgress(0, total);
  }

  const dataUrl = await fileToDataUrl(fileOrBlob);

  if (typeof onProgress === "function") {
    onProgress(total, total);
  }

  return dataUrl;
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
    renderSyncStatus(new Date(), true);
    return;
  }

  const testimonials = Array.isArray(content.testimonials) ? content.testimonials : [];
  const posts = Array.isArray(content.posts) ? content.posts : [];

  renderHomeTestimonials(testimonials);
  renderPageTestimonials(testimonials);
  renderBlog(posts);
  renderSyncStatus(new Date());
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
  const imagePreview = document.getElementById("testimonial-image-preview");
  const skipMediaBtn = document.getElementById("story-skip-media");
  const confettiLayer = document.getElementById("testimonial-confetti");
  const uploadProgress = document.getElementById("story-upload-progress");
  const uploadProgressFill = document.getElementById("story-upload-fill");
  const uploadProgressText = document.getElementById("story-upload-text");

  let currentStep = 0;

  function setupConfetti() {
    if (!confettiLayer || confettiLayer.childElementCount > 0) return;
    const palette = ["#E07A5F", "#D97706", "#2D9B72", "#FFD89B", "#2D3142"];
    for (let index = 0; index < 18; index += 1) {
      const bit = document.createElement("span");
      bit.className = "confetti-bit";
      bit.style.left = `${(index * 5.2) + Math.random() * 10}%`;
      bit.style.background = palette[index % palette.length];
      bit.style.animationDelay = `${Math.random() * 0.22}s`;
      confettiLayer.appendChild(bit);
    }
  }

  function burstConfetti() {
    if (!confettiLayer) return;
    confettiLayer.classList.remove("burst");
    void confettiLayer.offsetWidth;
    confettiLayer.classList.add("burst");
    setTimeout(() => {
      confettiLayer.classList.remove("burst");
    }, 1200);
  }

  function updateUploadProgress(percent = 0, label = "Uploading...") {
    if (!uploadProgress || !uploadProgressFill || !uploadProgressText) {
      return;
    }
    uploadProgress.hidden = false;
    uploadProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    uploadProgressText.textContent = label;
  }

  function hideUploadProgress() {
    if (!uploadProgress || !uploadProgressFill || !uploadProgressText) {
      return;
    }
    uploadProgress.hidden = true;
    uploadProgressFill.style.width = "0%";
    uploadProgressText.textContent = "Preparing upload...";
  }

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
    status.classList.remove("ok");

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

  skipMediaBtn?.addEventListener("click", () => {
    form.requestSubmit();
  });

  if (messageField) {
    messageField.addEventListener("input", autoGrowTextarea);
    autoGrowTextarea();
  }

  bindFilePreview(imageInput, imagePreview, "image");
  setupConfetti();
  hideUploadProgress();
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

    const imageError = validateFileSize(imageFile, MAX_TESTIMONIAL_IMAGE_BYTES);
    if (imageError) {
      status.textContent = imageError;
      return;
    }

    try {
      let imageUrl = "";
      const uploadSteps = [imageFile].filter(Boolean).length;
      let completedSteps = 0;

      const makeProgressUpdater = (label) => (loaded, total) => {
        if (!uploadSteps) return;
        const base = (completedSteps / uploadSteps) * 100;
        const fraction = total > 0 ? (loaded / total) : 0;
        const percent = Math.min(99, Math.round(base + (fraction * (100 / uploadSteps))));
        updateUploadProgress(percent, `${label} ${percent}%`);
      };

      if (uploadSteps) {
        updateUploadProgress(2, "Preparing upload...");
      }

      if (imageFile) {
        const imageBlob = await compressImageForUpload(imageFile);
        imageUrl = await uploadFileToBucket(
          imageBlob,
          imageFile.name || `photo-${Date.now()}.jpg`,
          "image/jpeg",
          "testimonials/images",
          makeProgressUpdater("Uploading photo")
        );
        completedSteps += 1;
      }

      if (uploadSteps) {
        updateUploadProgress(100, "Upload complete");
      }

      const response = await fetch(`${API_BASE}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, imageUrl })
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

      currentStep = 2;
      showStep(0, "back");
      autoGrowTextarea();
      status.textContent = "❤ Thank you! We’re reviewing your story now.";
      status.classList.add("ok");
      burstConfetti();
      setTimeout(() => hideUploadProgress(), 500);
    } catch (error) {
      status.textContent = error.message;
      status.classList.remove("ok");
      hideUploadProgress();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTestimonials();
  setupTestimonialForm();
});

