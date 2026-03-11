// main.js – ES Module
// Main application entry point for Mummy J's Treats website
import { loadMenu } from "./menu.js";
import { openModal, closeModal } from "./modal.js";
import { updateCartBadge } from "./cart-store.js";

function applyMobileLayoutFallback() {
  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const compactPhysicalScreen = Math.min(window.screen.width, window.screen.height) <= 1200;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const shouldForceMobile = hasTouch && compactPhysicalScreen && coarsePointer;

  document.body.classList.toggle("force-mobile", shouldForceMobile);
}

document.addEventListener("DOMContentLoaded", () => {
  applyMobileLayoutFallback();
  updateCartBadge();

  // Hamburger menu toggle with accessibility
  const hamburger = document.querySelector(".hamburger");
  const navUL = document.querySelector("nav ul");
  
  if (hamburger && navUL) {
    hamburger.addEventListener("click", () => {
      const isExpanded = navUL.classList.toggle("show");
      hamburger.setAttribute("aria-expanded", isExpanded);
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!hamburger.contains(e.target) && !navUL.contains(e.target)) {
        navUL.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Load menu dynamically on pages that have menu-grid
  const menuContainer = document.getElementById("menu-grid");
  if (menuContainer) {
    loadMenu(menuContainer);
  }

  // Visit counter with localStorage
  const counter = document.getElementById("visit-counter");
  if (counter) {
    try {
      let visits = localStorage.getItem("mjt-visits") || 0;
      visits = parseInt(visits) + 1;
      localStorage.setItem("mjt-visits", visits.toString());
      counter.textContent = visits;
    } catch (error) {
      console.warn("LocalStorage not available:", error);
      counter.textContent = "1";
    }
  }
});
