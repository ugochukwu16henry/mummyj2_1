// menu.js
// Dynamic menu loading and display functionality
import { openModal } from "./modal.js";

export async function loadMenu(container) {
  if (!container) {
    console.error("Menu container not found");
    return;
  }

  // Show loading state
  container.innerHTML = '<p class="loading">Loading menu...</p>';

  try {
    // Fetch JSON file - try multiple path formats for maximum compatibility
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    
    // Try different path formats
    const pathsToTry = [
      basePath + 'data/Menu.json',           // Relative to current directory
      '/wdd231/final/data/Menu.json',        // Absolute from repo root
      './data/Menu.json',                    // Simple relative
      'data/Menu.json'                       // Relative without ./
    ];
    
    let res;
    let lastError;
    let successfulPath;
    
    for (const path of pathsToTry) {
      try {
        const fullUrl = path.startsWith('http') ? path : new URL(path, window.location.origin).href;
        console.log(`Trying path: ${path} -> ${fullUrl}`);
        res = await fetch(fullUrl);
        
        if (res.ok) {
          successfulPath = fullUrl;
          break;
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    
    if (!res || !res.ok) {
      const errorMsg = `Failed to load menu: ${res ? res.status + ' ' + res.statusText : 'All paths failed'}`;
      console.error("Fetch Error Details:");
      console.error("- Current URL:", window.location.href);
      console.error("- Current pathname:", currentPath);
      console.error("- Base path:", basePath);
      console.error("- Tried paths:", pathsToTry);
      if (lastError) console.error("- Last error:", lastError);
      throw new Error(errorMsg);
    }
    
    console.log(`Successfully loaded menu from: ${successfulPath}`);
    
    const items = await res.json();

    // Validate data structure
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Menu data is empty or invalid");
    }

    // Generate menu cards with proper accessibility
    container.innerHTML = items
      .map(
        (item) => `
      <article class="card" tabindex="0" role="article" aria-label="${item.name}">
        <img src="${item.img}" alt="${item.name}" loading="lazy">
        <div style="padding:1rem;">
          <h3>${item.name}</h3>
          <p>${item.desc}</p>
          <p class="price">${item.price}</p>
          <button data-modal="${item.id}" class="view-details" aria-label="View details for ${item.name}">View Details</button>
        </div>
      </article>
    `
      )
      .join("");

    // Attach modal open handlers after cards are created
    document.querySelectorAll("[data-modal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openModal(btn.dataset.modal, items);
      });
      
      // Keyboard accessibility - Enter key support
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(btn.dataset.modal, items);
        }
      });
    });

    // Add keyboard navigation for cards
    container.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const button = card.querySelector("[data-modal]");
          if (button) {
            button.click();
          }
        }
      });
    });

  } catch (err) {
    console.error("Error loading menu:", err);
    container.innerHTML = `
      <div class="loading" style="color:#dc3545;">
        <p><strong>Error loading menu:</strong> ${err.message}</p>
        <p>Please refresh the page or contact us if the problem persists.</p>
      </div>
    `;
  }
}
