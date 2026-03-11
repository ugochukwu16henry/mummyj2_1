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
    // Fetch JSON file - use multiple strategies for maximum compatibility
    // Strategy 1: Use import.meta.url for ES module base path (most reliable)
    // Strategy 2: Use window.location for HTML document base path
    // Strategy 3: Try absolute paths
    
    const scriptBaseUrl = new URL('.', import.meta.url).href;
    const documentBaseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    
    // Try different path formats for maximum compatibility
    const pathsToTry = [
      // Using script location (ES module base)
      new URL('../data/Menu.json', import.meta.url).href,
      new URL('../data/menu.json', import.meta.url).href,
      // Using document location
      new URL('data/Menu.json', documentBaseUrl).href,
      new URL('data/menu.json', documentBaseUrl).href,
      // Absolute paths for GitHub Pages
      '/wdd231/final/data/Menu.json',
      '/wdd231/final/data/menu.json',
      // Simple relative paths
      './data/Menu.json',
      './data/menu.json',
      'data/Menu.json',
      'data/menu.json'
    ].map(path => path.startsWith('http') ? path : new URL(path, window.location.origin).href);
    
    let res;
    let lastError;
    let successfulPath = null;
    const attemptedUrls = [];
    
    console.log('🔍 Attempting to load menu data...');
    console.log('Script base URL:', scriptBaseUrl);
    console.log('Document base URL:', documentBaseUrl);
    
    for (const fullUrl of pathsToTry) {
      try {
        attemptedUrls.push(fullUrl);
        console.log(`Trying: ${fullUrl}`);
        res = await fetch(fullUrl, { method: 'HEAD' }); // Try HEAD first to check if file exists
        
        if (res.ok) {
          // File exists, now fetch it properly
          res = await fetch(fullUrl);
          if (res.ok) {
            successfulPath = fullUrl;
            console.log(`✅ Successfully loaded menu from: ${successfulPath}`);
            break;
          }
        } else {
          console.warn(`❌ Failed with status ${res.status}: ${fullUrl}`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Error: ${fullUrl}`, err.message);
        continue;
      }
    }
    
    if (!res || !res.ok) {
      const errorMsg = `Failed to load menu: ${res ? res.status + ' ' + res.statusText : 'All paths failed'}`;
      console.error("\n❌ Fetch Error Summary:");
      console.error("- Current page URL:", window.location.href);
      console.error("- Script base:", scriptBaseUrl);
      console.error("- Document base:", documentBaseUrl);
      console.error("- Attempted URLs:", attemptedUrls);
      if (lastError) console.error("- Last error:", lastError);
      console.error("\n💡 Troubleshooting Steps:");
      console.error("1. Open browser console and check the attempted URLs above");
      console.error("2. Try accessing the JSON directly: https://ugochukwu16henry.github.io/wdd231/final/data/Menu.json");
      console.error("3. Verify file exists: https://github.com/ugochukwu16henry/wdd231/tree/main/final/data");
      console.error("4. Ensure Menu.json is committed and pushed to GitHub");
      console.error("5. Wait 1-2 minutes for GitHub Pages to rebuild after pushing");
      throw new Error(errorMsg);
    }
    
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
