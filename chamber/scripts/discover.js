import { discoverItems } from '../data/discover-items.mjs';

// Display visit message based on localStorage
function displayVisitMessage() {
    const lastVisit = localStorage.getItem('lastVisit');
    const currentDate = Date.now();
    const messageElement = document.getElementById('visit-message');
    
    if (!lastVisit) {
        messageElement.textContent = "Welcome! Let us know if you have any questions.";
    } else {
        const daysDifference = Math.floor((currentDate - parseInt(lastVisit)) / (1000 * 60 * 60 * 24));
        
        if (daysDifference < 1) {
            messageElement.textContent = "Back so soon! Awesome!";
        } else if (daysDifference === 1) {
            messageElement.textContent = "You last visited 1 day ago.";
        } else {
            messageElement.textContent = `You last visited ${daysDifference} days ago.`;
        }
    }
    
    // Store current visit date
    localStorage.setItem('lastVisit', currentDate.toString());
}

// Create discover cards
function createDiscoverCards() {
    const grid = document.getElementById('discover-grid');
    
    discoverItems.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'discover-card';
        
        card.innerHTML = `
            <h2>${item.name}</h2>
            <figure>
                <img src="${item.image}" alt="${item.name}" loading="lazy">
            </figure>
            <address>${item.address}</address>
            <p>${item.description}</p>
            <button class="learn-more-btn" data-index="${index}">Learn More</button>
        `;
        
        grid.appendChild(card);
    });
}

// Modal functionality
function setupModal() {
    const modal = document.getElementById('info-modal');
    const closeBtn = document.querySelector('.close-modal');
    
    // Add event listeners to all Learn More buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('learn-more-btn')) {
            const index = parseInt(e.target.dataset.index);
            showModal(discoverItems[index]);
        }
    });
    
    // Close modal events
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function showModal(item) {
    const modal = document.getElementById('info-modal');
    document.getElementById('modal-title').textContent = item.name;
    document.getElementById('modal-image').src = item.image;
    document.getElementById('modal-image').alt = item.name;
    document.getElementById('modal-address').textContent = item.address;
    document.getElementById('modal-description').textContent = item.description;
    modal.style.display = 'block';
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    displayVisitMessage();
    createDiscoverCards();
    setupModal();
    
    // Update last modified date
    const lastModified = document.getElementById('last-modified');
    if (lastModified) {
        lastModified.textContent = `Last Modification: ${document.lastModified}`;
    }
});