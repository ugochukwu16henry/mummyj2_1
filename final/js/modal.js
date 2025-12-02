// modal.js
// Modal dialog functionality for displaying menu item details
const modal = document.getElementById("item-modal");
const modalContent = document.getElementById("modal-body");
const closeBtn = document.querySelector(".close");

// Track the last focused element before opening modal
let lastFocusedElement = null;

export function openModal(id, dataArray) {
  if (!modal || !modalContent) return;
  
  const item = dataArray ? dataArray.find((i) => i.id == id) : null;
  if (!item) {
    console.warn("Item not found:", id);
    return;
  }

  // Store the element that triggered the modal
  lastFocusedElement = document.activeElement;

  // Update modal content with proper semantic structure
  modalContent.innerHTML = `
    <h2 id="modal-title">${item.name}</h2>
    <img src="${item.img}" alt="${item.name}" loading="lazy" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin:1rem 0;">
    <div style="margin:1.5rem 0;">
      <p><strong>Category:</strong> ${item.category}</p>
      <p><strong>Price:</strong> <span class="price">${item.price}</span></p>
      <p style="margin-top:1rem;">${item.desc}</p>
    </div>
    <a href="about.html#contact" class="btn btn-primary" style="display:inline-block;text-align:center;">Order Now</a>
  `;

  // Show modal with proper ARIA attributes
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
  
  // Focus management for accessibility
  const firstFocusable = modal.querySelector("button, a, [tabindex='0']");
  if (firstFocusable) {
    firstFocusable.focus();
  }

  // Prevent body scroll when modal is open
  document.body.style.overflow = "hidden";
}

export function closeModal() {
  if (!modal) return;
  
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
  
  // Restore body scroll
  document.body.style.overflow = "";
  
  // Return focus to the element that opened the modal
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// Close button event listener
if (closeBtn) {
  closeBtn.addEventListener("click", closeModal);
}

// Close when clicking outside modal
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// Close modal with ESC key for accessibility
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal && modal.getAttribute("aria-hidden") === "false") {
    closeModal();
  }
});
