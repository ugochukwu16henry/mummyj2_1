// main.js – ES Module
import { loadMenu } from "./menu.js";
import { initModal, openModal, closeModal } from "./modal.js";

document.addEventListener("DOMContentLoaded", () => {
  // Hamburger menu
  const hamburger = document.querySelector(".hamburger");
  const navUL = document.querySelector("nav ul");
  if (hamburger) {
    hamburger.addEventListener("click", () => navUL.classList.toggle("show"));
  }

  // Load menu on menu.html and index.html
  const menuContainer = document.getElementById("menu-grid");
  if (menuContainer) loadMenu(menuContainer);

  // Modal triggers
  document.querySelectorAll("[data-modal]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.modal));
  });

  // Visit counter with localStorage
  let visits = localStorage.getItem("mjt-visits") || 0;
  visits = parseInt(visits) + 1;
  localStorage.setItem("mjt-visits", visits);
  const counter = document.getElementById("visit-counter");
  if (counter) counter.textContent = visits;
});
