// Background Service Worker untuk User Agent Scraper
let scrapingState = {
    isRunning: false,
    targetCount: 0,
    userAgents: new Set(),
    totalScraped: 0,
    refreshCount: 0,
    currentTabId: null,
    startTime: null,
    lastRefreshTime: null,
    pageLoadTimeout: null,
    isPageLoading: false,
    filters: {
        android: true,
        windows: true,
        ios: true
    },
    antiRateLimit: {
        minDelay: 1000,      // Minimum 1 seconds
        maxDelay: 5000,     // Maximum 5 seconds
        currentDelay: 2000,  // Current delay
        consecutiveErrors: 0,
        lastRequestTime: 0
    }
};

console.log('User Agent Scraper: Background script loaded');

// Storage keys
const STORAGE_KEYS = {
    USER_AGENTS: 'userAgents',
    SCRAPING_STATE: 'scrapingState'
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('User Agent Scraper: Extension installed');
    resetScrapingState();
});

// Handle action click to open side panel
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages dari popup dan content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background: Received message:', message);

    switch (message.action) {
        case 'startScraping':
            handleStartScraping(message, sendResponse);
            break;

        case 'stopScraping':
            handleStopScraping(sendResponse);
            break;

        case 'getScrapingState':
            handleGetScrapingState(sendResponse);
            break;

        case 'clearData':
            handleClearData(sendResponse);
            break;

        case 'checkDuplicates':
            handleCheckDuplicates(sendResponse);
            break;

        case 'pageReady':
            handlePageReady(sender, sendResponse);
            break;

        default:
            console.log('Background: Unknown action:', message.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep sendResponse alive for async operations
});

// Handle start scraping
async function handleStartScraping(message, sendResponse) {
    try {
        console.log('Background: Starting scraping with target:', message.targetCount);
        
        if (scrapingState.isRunning) {
            sendResponse({ success: false, error: 'Scraping already running' });
            return;
        }

        // Initialize scraping state
        scrapingState.isRunning = true;
        scrapingState.targetCount = message.targetCount;
        scrapingState.filters = message.filters || { android: true, windows: true, ios: true };
        scrapingState.userAgents = new Set();
        scrapingState.totalScraped = 0;
        scrapingState.refreshCount = 0;
        scrapingState.startTime = Date.now();

        // Save initial state
        await saveScrapingState();

        // Navigate current tab to useragents.io
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.update(currentTab.id, {
            url: 'https://useragents.io/random?limit=1500'
        });

        scrapingState.currentTabId = currentTab.id;
        await saveScrapingState();

        sendResponse({
            success: true,
            message: 'Scraping started',
            tabId: currentTab.id
        });

        // Start scraping process - wait for page to load
        setTimeout(() => waitForPageReady(), 2000);

    } catch (error) {
        console.error('Background: Error starting scraping:', error);
        scrapingState.isRunning = false;
        sendResponse({ success: false, error: error.message });
    }
}

// Handle stop scraping
async function handleStopScraping(sendResponse) {
    try {
        console.log('Background: Stopping scraping');
        scrapingState.isRunning = false;
        
        // Just reset the tab reference (don't close tab since we're using same tab)
        scrapingState.currentTabId = null;

        await saveScrapingState();
        sendResponse({ success: true, message: 'Scraping stopped' });

    } catch (error) {
        console.error('Background: Error stopping scraping:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle get scraping state
async function handleGetScrapingState(sendResponse) {
    try {
        const userAgentsArray = Array.from(scrapingState.userAgents);
        sendResponse({
            success: true,
            state: {
                isRunning: scrapingState.isRunning,
                targetCount: scrapingState.targetCount,
                userAgents: userAgentsArray,
                uniqueCount: scrapingState.userAgents.size,
                totalScraped: scrapingState.totalScraped,
                refreshCount: scrapingState.refreshCount,
                progress: scrapingState.targetCount > 0 ? (scrapingState.userAgents.size / scrapingState.targetCount) * 100 : 0
            }
        });
    } catch (error) {
        console.error('Background: Error getting state:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle clear data
async function handleClearData(sendResponse) {
    try {
        resetScrapingState();
        await saveScrapingState();
        sendResponse({ success: true, message: 'Data cleared' });
    } catch (error) {
        console.error('Background: Error clearing data:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle check duplicates
function handleCheckDuplicates(sendResponse) {
    try {
        const userAgentsArray = Array.from(scrapingState.userAgents);
        const duplicates = [];
        const seen = new Set();
        
        userAgentsArray.forEach(ua => {
            if (seen.has(ua)) {
                duplicates.push(ua);
            } else {
                seen.add(ua);
            }
        });

        sendResponse({
            success: true,
            duplicates: duplicates,
            duplicateCount: duplicates.length,
            uniqueCount: seen.size,
            totalCount: userAgentsArray.length
        });
    } catch (error) {
        console.error('Background: Error checking duplicates:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle page ready notification
function handlePageReady(sender, sendResponse) {
    console.log('Background: Page ready notification from tab:', sender.tab?.id);
    if (scrapingState.isRunning && sender.tab?.id === scrapingState.currentTabId) {
        // Page is ready, start extraction immediately
        setTimeout(() => extractFromCurrentPage(), 200);
    }
    sendResponse({ success: true });
}

// Main scraping process
async function startScrapingProcess() {
    if (!scrapingState.isRunning || !scrapingState.currentTabId) {
        return;
    }

    try {
        console.log('Background: Starting scraping process...');
        await extractFromCurrentPage();
    } catch (error) {
        console.error('Background: Error in scraping process:', error);
        notifyPopup('error', `Scraping error: ${error.message}`);
    }
}

// Extract user agents from current page
async function extractFromCurrentPage() {
    if (!scrapingState.isRunning || !scrapingState.currentTabId) {
        return;
    }

    try {
        console.log('Background: Extracting from current page...');

        // Send message to content script untuk extract data dengan retry
        const response = await sendMessageWithRetry(scrapingState.currentTabId, {
            action: 'extractUserAgents',
            filters: scrapingState.filters
        });

        if (response.success && response.userAgents) {
            // Add new user agents ke Set (auto deduplication)
            const initialSize = scrapingState.userAgents.size;
            response.userAgents.forEach(ua => {
                if (ua && ua.trim()) {
                    scrapingState.userAgents.add(ua.trim());
                }
            });

            const newUserAgents = scrapingState.userAgents.size - initialSize;
            scrapingState.totalScraped += response.userAgents.length;
            scrapingState.refreshCount++;

            // Reset error counter on successful extraction (anti-rate-limit)
            scrapingState.antiRateLimit.consecutiveErrors = 0;

            console.log(`Background: Extracted ${response.userAgents.length} UAs, ${newUserAgents} new unique, total unique: ${scrapingState.userAgents.size}`);

            // Save state
            await saveScrapingState();

            // Notify popup
            notifyPopup('progress', {
                uniqueCount: scrapingState.userAgents.size,
                totalScraped: scrapingState.totalScraped,
                refreshCount: scrapingState.refreshCount,
                progress: scrapingState.targetCount > 0 ? (scrapingState.userAgents.size / scrapingState.targetCount) * 100 : 0
            });

            // Check if target reached
            if (scrapingState.userAgents.size >= scrapingState.targetCount) {
                console.log('Background: Target reached!');
                await handleStopScraping(() => {});
                notifyPopup('completed', `Target reached! Collected ${scrapingState.userAgents.size} unique user agents`);
                return;
            }

            // Continue with next refresh immediately
            if (scrapingState.isRunning && scrapingState.currentTabId) {
                await refreshPageAndContinue();
            }

        } else {
            console.error('Background: Failed to extract user agents:', response);
            notifyPopup('error', 'Failed to extract user agents from page');
            
            // Try recovery if error
            if (scrapingState.isRunning) {
                setTimeout(() => forceRefreshRecovery(), 2000);
            }
        }

    } catch (error) {
        console.error('Background: Error extracting from page:', error);
        notifyPopup('error', `Extraction error: ${error.message}`);
        
        // Try recovery if error
        if (scrapingState.isRunning) {
            setTimeout(() => forceRefreshRecovery(), 2000);
        }
    }
}

// Send message with retry and content script injection
async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Background: Attempt ${attempt} to send message to tab ${tabId}`);
            
            // Try sending message
            const response = await chrome.tabs.sendMessage(tabId, message);
            console.log('Background: Message sent successfully');
            return response;
            
        } catch (error) {
            console.log(`Background: Attempt ${attempt} failed:`, error.message);
            
            if (error.message.includes('Could not establish connection') ||
                error.message.includes('Receiving end does not exist')) {
                
                console.log('Background: Content script not ready, trying to inject...');
                
                try {
                    // Try to inject content script
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content.js']
                    });
                    
                    console.log('Background: Content script injected, waiting...');
                    
                    // Wait longer for content script to initialize properly
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Try sending message again after injection
                    const response = await chrome.tabs.sendMessage(tabId, message);
                    console.log('Background: Message sent successfully after injection');
                    return response;
                    
                } catch (injectionError) {
                    console.error('Background: Failed to inject content script:', injectionError);
                    
                    if (attempt === maxRetries) {
                        throw new Error(`Failed to establish connection after ${maxRetries} attempts: ${error.message}`);
                    }
                }
            } else {
                // Different error, don't retry
                throw error;
            }
            
            // Wait longer before retry to reduce load
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }
    
    throw new Error(`Failed to send message after ${maxRetries} attempts`);
}

// Refresh page and continue scraping
async function refreshPageAndContinue() {
    if (!scrapingState.isRunning || !scrapingState.currentTabId) {
        return;
    }

    try {
        // Calculate intelligent delay based on previous responses
        const intelligentDelay = calculateIntelligentDelay();
        
        console.log(`Background: Waiting ${intelligentDelay/1000}s before refresh (anti-rate-limit)...`);
        notifyPopup('progress', {
            ...getCurrentProgressData(),
            status: `Anti-rate-limit delay: ${intelligentDelay/1000}s`
        });
        
        // Wait intelligent delay before proceeding
        await new Promise(resolve => setTimeout(resolve, intelligentDelay));
        
        console.log('Background: Refreshing page with anti-rate-limit measures...');
        
        // Set refresh tracking
        scrapingState.lastRefreshTime = Date.now();
        scrapingState.isPageLoading = true;
        
        // Clear any existing timeout
        if (scrapingState.pageLoadTimeout) {
            clearTimeout(scrapingState.pageLoadTimeout);
        }
        
        // Set timeout for page loading (30 seconds max for rate-limited responses)
        scrapingState.pageLoadTimeout = setTimeout(() => {
            if (scrapingState.isPageLoading && scrapingState.isRunning) {
                console.log('Background: Page load timeout detected, treating as rate limit...');
                handleRateLimitDetection();
            }
        }, 30000);
        
        // Use Chrome tabs API to refresh the page
        await chrome.tabs.reload(scrapingState.currentTabId);
        
        // Wait longer for page to start loading properly
        setTimeout(async () => {
            try {
                // Wait for page to be ready then extract
                await waitForPageReady();
            } catch (error) {
                console.error('Background: Error waiting for page ready:', error);
                
                // Check if this might be a rate limit error
                if (isRateLimitError(error)) {
                    handleRateLimitDetection();
                } else {
                    notifyPopup('error', `Page ready error: ${error.message}`);
                    if (scrapingState.isRunning) {
                        setTimeout(() => forceRefreshRecovery(), 5000);
                    }
                }
            }
        }, 5000); // Increased to 5000ms for rate-limited responses

    } catch (error) {
        console.error('Background: Error refreshing page:', error);
        
        // Check if this might be a rate limit error
        if (isRateLimitError(error)) {
            handleRateLimitDetection();
        } else {
            notifyPopup('error', `Refresh error: ${error.message}`);
            if (scrapingState.isRunning) {
                setTimeout(() => forceRefreshRecovery(), 5000);
            }
        }
    }
}

// Force refresh recovery when page loading is stuck
async function forceRefreshRecovery() {
    if (!scrapingState.isRunning || !scrapingState.currentTabId) {
        return;
    }

    try {
        console.log('Background: Executing force refresh recovery...');
        
        // Clear existing timeout
        if (scrapingState.pageLoadTimeout) {
            clearTimeout(scrapingState.pageLoadTimeout);
            scrapingState.pageLoadTimeout = null;
        }
        
        // Reset loading state
        scrapingState.isPageLoading = false;
        
        // Try to navigate to URL again (force complete reload)
        await chrome.tabs.update(scrapingState.currentTabId, {
            url: 'https://useragents.io/random?limit=1500'
        });
        
        console.log('Background: Force reload initiated, waiting for page...');
        
        // Wait longer for the forced reload
        setTimeout(async () => {
            try {
                await waitForPageReady();
            } catch (error) {
                console.error('Background: Recovery failed:', error);
                notifyPopup('error', 'Recovery failed, please try manual refresh');
            }
        }, 3000);
        
    } catch (error) {
        console.error('Background: Error in force refresh recovery:', error);
        notifyPopup('error', `Recovery error: ${error.message}`);
    }
}

// Wait for page to be ready
async function waitForPageReady() {
    if (!scrapingState.isRunning || !scrapingState.currentTabId) {
        return;
    }

    let attempts = 0;
    const maxAttempts = 12; // 24 seconds max (12 * 2 seconds)

    const checkReady = async () => {
        try {
            attempts++;
            console.log(`Background: Checking page ready, attempt ${attempts}/${maxAttempts}`);
            
            // Try to send a message to content script to check if page is ready
            const response = await sendMessageWithRetry(scrapingState.currentTabId, {
                action: 'checkPageReady'
            });

            if (response && response.success && response.ready) {
                console.log('Background: Page is ready, starting extraction');
                
                // Clear loading state and timeout
                scrapingState.isPageLoading = false;
                if (scrapingState.pageLoadTimeout) {
                    clearTimeout(scrapingState.pageLoadTimeout);
                    scrapingState.pageLoadTimeout = null;
                }
                
                // Wait a bit more before extracting to ensure page is fully loaded
                setTimeout(() => extractFromCurrentPage(), 1000);
            } else if (attempts >= maxAttempts) {
                console.log('Background: Timeout waiting for page ready, proceeding anyway');
                
                // Clear loading state and timeout
                scrapingState.isPageLoading = false;
                if (scrapingState.pageLoadTimeout) {
                    clearTimeout(scrapingState.pageLoadTimeout);
                    scrapingState.pageLoadTimeout = null;
                }
                
                setTimeout(() => extractFromCurrentPage(), 1000);
            } else {
                setTimeout(checkReady, 2000); // Increased from 500ms to 2000ms
            }
        } catch (error) {
            if (attempts >= maxAttempts) {
                console.log('Background: Max attempts reached, proceeding with extraction');
                
                // Clear loading state and timeout
                scrapingState.isPageLoading = false;
                if (scrapingState.pageLoadTimeout) {
                    clearTimeout(scrapingState.pageLoadTimeout);
                    scrapingState.pageLoadTimeout = null;
                }
                
                setTimeout(() => extractFromCurrentPage(), 200);
            } else {
                setTimeout(checkReady, 500);
            }
        }
    };

    checkReady();
}

// Notify popup about updates
function notifyPopup(type, data) {
    chrome.runtime.sendMessage({
        action: 'scrapingUpdate',
        type: type,
        data: data
    }).catch(error => {
        // Popup might be closed, ignore error
        console.log('Background: Popup not available for notification');
    });
}

// Save scraping state
async function saveScrapingState() {
    try {
        const stateToSave = {
            ...scrapingState,
            userAgents: Array.from(scrapingState.userAgents) // Convert Set to Array for storage
        };
        await chrome.storage.local.set({ [STORAGE_KEYS.SCRAPING_STATE]: stateToSave });
    } catch (error) {
        console.error('Background: Error saving state:', error);
    }
}

// Reset scraping state
function resetScrapingState() {
    // Clear any existing timeout
    if (scrapingState.pageLoadTimeout) {
        clearTimeout(scrapingState.pageLoadTimeout);
    }
    
    scrapingState = {
        isRunning: false,
        targetCount: 0,
        userAgents: new Set(),
        totalScraped: 0,
        refreshCount: 0,
        currentTabId: null,
        startTime: null,
        lastRefreshTime: null,
        pageLoadTimeout: null,
        isPageLoading: false,
        filters: {
            android: true,
            windows: true,
            ios: true
        },
        antiRateLimit: {
            minDelay: 5000,
            maxDelay: 30000,
            currentDelay: 5000,
            consecutiveErrors: 0,
            lastRequestTime: 0
        }
    };
}

// Calculate intelligent delay based on success/failure patterns
function calculateIntelligentDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - scrapingState.antiRateLimit.lastRequestTime;
    
    // If we had consecutive errors, increase delay exponentially
    if (scrapingState.antiRateLimit.consecutiveErrors > 0) {
        const multiplier = Math.min(Math.pow(2, scrapingState.antiRateLimit.consecutiveErrors), 8);
        scrapingState.antiRateLimit.currentDelay = Math.min(
            scrapingState.antiRateLimit.minDelay * multiplier,
            scrapingState.antiRateLimit.maxDelay
        );
    } else {
        // Gradually reduce delay on success, but never below minimum
        scrapingState.antiRateLimit.currentDelay = Math.max(
            scrapingState.antiRateLimit.currentDelay * 0.9,
            scrapingState.antiRateLimit.minDelay
        );
    }
    
    // Ensure minimum time between requests
    const remainingMinDelay = scrapingState.antiRateLimit.minDelay - timeSinceLastRequest;
    const finalDelay = Math.max(remainingMinDelay, scrapingState.antiRateLimit.currentDelay);
    
    scrapingState.antiRateLimit.lastRequestTime = now + finalDelay;
    
    return finalDelay;
}

// Handle rate limit detection
function handleRateLimitDetection() {
    scrapingState.antiRateLimit.consecutiveErrors++;
    const backoffTime = Math.min(60000 * scrapingState.antiRateLimit.consecutiveErrors, 300000); // Max 5 minutes
    
    console.log(`Background: Rate limit detected! Backing off for ${backoffTime/1000} seconds...`);
    notifyPopup('error', `Rate limit detected! Waiting ${backoffTime/1000}s before retry...`);
    
    // Clear loading state
    scrapingState.isPageLoading = false;
    if (scrapingState.pageLoadTimeout) {
        clearTimeout(scrapingState.pageLoadTimeout);
        scrapingState.pageLoadTimeout = null;
    }
    
    // Schedule retry after backoff
    setTimeout(() => {
        if (scrapingState.isRunning) {
            console.log('Background: Retrying after rate limit backoff...');
            refreshPageAndContinue();
        }
    }, backoffTime);
}

// Check if error indicates rate limiting
function isRateLimitError(error) {
    const errorStr = error.message.toLowerCase();
    return errorStr.includes('rate limit') ||
           errorStr.includes('too many requests') ||
           errorStr.includes('cloudflare') ||
           errorStr.includes('403') ||
           errorStr.includes('429') ||
           errorStr.includes('blocked');
}

// Get current progress data for notifications
function getCurrentProgressData() {
    return {
        uniqueCount: scrapingState.userAgents.size,
        totalScraped: scrapingState.totalScraped,
        refreshCount: scrapingState.refreshCount,
        progress: scrapingState.targetCount > 0 ? (scrapingState.userAgents.size / scrapingState.targetCount) * 100 : 0
    };
}

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabId === scrapingState.currentTabId) {
        console.log('Background: Scraping tab was closed');
        scrapingState.isRunning = false;
        scrapingState.currentTabId = null;
        notifyPopup('stopped', 'Scraping tab was closed');
    }
});

console.log('Background: Service worker initialization complete');