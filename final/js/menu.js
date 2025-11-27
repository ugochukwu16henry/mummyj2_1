// menu.js
export async function loadMenu(container) {
  try {
    const res = await fetch("../data/menu.json");
    if (!res.ok) throw new Error("Menu data not found");
    const items = await res.json();

    container.innerHTML = items
      .map(
        (item) => `
      <div class="card" tabindex="0">
        <img src="${item.img}" alt="${item.name}" loading="lazy">
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
        <p class="price">${item.price}</p>
        <button data-modal="${item.id}" class="view-details">View Details</button>
      </div>
    `
      )
      .join("");

    // Attach modal open after cards exist
    document.querySelectorAll("[data-modal]").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.modal, items));
    });
  } catch (err) {
    container.innerHTML = `<p style="text-align:center;color:red;">Error loading menu: ${err.message}</p>`;
  }
}
