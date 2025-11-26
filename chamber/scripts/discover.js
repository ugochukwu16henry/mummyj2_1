import { discoverItems } from '../data/discover-items.mjs';

// Display visit message based on localStorage
function displayVisitMessage() {
    try {
        const lastVisit = localStorage.getItem('lastVisit');
        const currentDate = Date.now();
        const messageElement = document.getElementById('visit-message');
        
        if (!messageElement) {
            console.warn('Visit message element not found');
            return;
        }
        
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
    } catch (error) {
        console.error('Error displaying visit message:', error);
        // Fallback message if localStorage is not available
        const messageElement = document.getElementById('visit-message');
        if (messageElement) {
            messageElement.textContent = "Welcome to our discover page!";
        }
    }
}

// Create discover cards
function createDiscoverCards() {
    try {
        const grid = document.getElementById('discover-grid');
        
        if (!grid) {
            console.error('Discover grid element not found');
            return;
        }
        
        if (!discoverItems || !Array.isArray(discoverItems)) {
            console.error('Discover items data is invalid');
            return;
        }
        
        discoverItems.forEach((item, index) => {
            if (!item || typeof item !== 'object') {
                console.warn(`Invalid item at index ${index}:`, item);
                return;
            }
            
            const card = document.createElement('div');
            card.className = 'discover-card';
            card.setAttribute('role', 'article');
            
            // Sanitize data to prevent XSS
            const sanitizedName = escapeHtml(item.name || 'Unknown Location');
            const sanitizedAddress = escapeHtml(item.address || 'Address not available');
            const sanitizedDescription = escapeHtml(item.description || 'Description not available');
            const sanitizedImage = escapeHtml(item.image || 'images/placeholder.jpg');
            
            card.innerHTML = `
                <h2>${sanitizedName}</h2>
                <figure>
                    <img src="${sanitizedImage}" alt="${sanitizedName}" loading="lazy" onerror="this.src='images/placeholder.jpg'; this.alt='Image not available';">
                </figure>
                <address>${sanitizedAddress}</address>
                <p>${sanitizedDescription}</p>
                <button class="learn-more-btn" data-index="${index}" aria-label="Learn more about ${sanitizedName}">Learn More</button>
            `;
            
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error creating discover cards:', error);
        displayErrorMessage('Unable to load location information. Please try again later.');
    }
}

// Utility function to escape HTML and prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Display error message to user
function displayErrorMessage(message) {
    const grid = document.getElementById('discover-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="error-message" role="alert">
                <h2>Error</h2>
                <p>${message}</p>
            </div>
        `;
    }
}

// Modal functionality
function setupModal() {
    try {
        const modal = document.getElementById('info-modal');
        const closeBtn = document.querySelector('.close-modal');
        
        if (!modal || !closeBtn) {
            console.warn('Modal elements not found');
            return;
        }
        
        // Add event listeners to all Learn More buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('learn-more-btn')) {
                const index = parseInt(e.target.dataset.index);
                if (index >= 0 && index < discoverItems.length) {
                    showModal(discoverItems[index]);
                } else {
                    console.error('Invalid item index:', index);
                }
            }
        });
        
        // Close modal events
        closeBtn.addEventListener('click', closeModal);
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                closeModal();
            }
        });
        
    } catch (error) {
        console.error('Error setting up modal:', error);
    }
}

function showModal(item) {
    try {
        if (!item || typeof item !== 'object') {
            console.error('Invalid item data for modal:', item);
            return;
        }
        
        const modal = document.getElementById('info-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalImage = document.getElementById('modal-image');
        const modalAddress = document.getElementById('modal-address');
        const modalDescription = document.getElementById('modal-description');
        
        if (!modal || !modalTitle || !modalImage || !modalAddress || !modalDescription) {
            console.error('Modal content elements not found');
            return;
        }
        
        // Populate modal with sanitized data
        modalTitle.textContent = item.name || 'Unknown Location';
        modalImage.src = item.image || 'images/placeholder.jpg';
        modalImage.alt = item.name || 'Location image';
        modalAddress.textContent = item.address || 'Address not available';
        modalDescription.textContent = item.description || 'Description not available';
        
        // Show modal with accessibility attributes
        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
        
        // Focus management for accessibility
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.focus();
        }
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error showing modal:', error);
    }
}

function closeModal() {
    try {
        const modal = document.getElementById('info-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            
            // Restore body scroll
            document.body.style.overflow = '';
            
            // Return focus to the button that opened the modal
            const activeButton = document.querySelector('.learn-more-btn:focus');
            if (activeButton) {
                activeButton.focus();
            }
        }
    } catch (error) {
        console.error('Error closing modal:', error);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize core functionality
        displayVisitMessage();
        createDiscoverCards();
        setupModal();
        
        // Update last modified date
        updateLastModified();
        
        // Add loading state management
        removeLoadingState();
        
        // Initialize performance monitoring
        if ('performance' in window) {
            window.addEventListener('load', () => {
                const loadTime = performance.now();
                console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);
            });
        }
        
    } catch (error) {
        console.error('Error initializing page:', error);
        displayErrorMessage('Page failed to load properly. Please refresh the page.');
    }
});

// Update last modified date
function updateLastModified() {
    try {
        const lastModified = document.getElementById('last-modified');
        if (lastModified) {
            const modifiedDate = new Date(document.lastModified);
            const formattedDate = modifiedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            lastModified.textContent = `Last Modification: ${formattedDate}`;
        }
    } catch (error) {
        console.error('Error updating last modified date:', error);
    }
}

// Remove loading state
function removeLoadingState() {
    try {
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(element => {
            element.classList.remove('loading');
        });
    } catch (error) {
        console.error('Error removing loading state:', error);
    }
}

// Service Worker registration for PWA capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}