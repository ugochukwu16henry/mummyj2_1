// modal.js
const modal = document.getElementById("item-modal");
const modalContent = document.getElementById("modal-body");
const closeBtn = document.querySelector(".close");

export function openModal(id, dataArray) {
  const item = dataArray ? dataArray.find((i) => i.id == id) : null;
  if (!item) return;

  modalContent.innerHTML = `
    <h2>${item.name}</h2>
    <img src="${item.img}" alt="${item.name}" loading="lazy">
    <p><strong>Category:</strong> ${item.category}</p>
    <p><strong>Price:</strong> ${item.price}</p>
    <p>${item.desc}</p>
    <button onclick="location.href='about.html#contact'">Order Now</button>
  `;
  modal.style.display = "flex";
}

export function closeModal() {
  modal.style.display = "none";
}

// Close when clicking outside or X
if (closeBtn) closeBtn.addEventListener("click", closeModal);
window.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
