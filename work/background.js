// Background Service Worker untuk User Agent Scraper
let scrapingState = {
    isRunning: false,
    targetCount: 0,
    userAgents: [], // Changed from Set to Array for better performance
    totalScraped: 0,
    refreshCount: 0,
    currentTabId: null,
    startTime: null,
    lastRefreshTime: null,
    pageLoadTimeout: null,
    isPageLoading: false,
    tabMode: 'single', // 'single', 'dual', 'quad'
    multiTabs: {
        tabA: { id: null, isActive: false, role: 'A' },
        tabB: { id: null, isActive: false, role: 'B' },
        tabC: { id: null, isActive: false, role: 'C' },
        tabD: { id: null, isActive: false, role: 'D' },
        activeTab: 'A',
        offsetDelay: 1000 // 1 second offset between tabs
    },
    filters: {
        android: true,
        windows: false,
        ios: true
    },
    simpleDelay: 1500, // Simple 1.5 second delay between refreshes
    autoDuplicateRemoval: {
        enabled: true,
        lastCheckCount: 0,
        checkInterval: 25000, // Check every 20K user agents
        isProcessing: false
    }
};

console.log('User Agent Scraper: Background script loaded');

// Storage keys
const STORAGE_KEYS = {
    USER_AGENTS: 'userAgents',
    SCRAPING_STATE: 'scrapingState'
};

// Close all other tabs except extension and keep tabs
async function closeAllOtherTabs(keepTabIds = []) {
    try {
        console.log('Background: Closing all other tabs...');
        const allTabs = await chrome.tabs.query({});
        const extensionUrl = chrome.runtime.getURL('index.html');
        
        console.log(`Background: Found ${allTabs.length} total tabs`);
        
        for (const tab of allTabs) {
            // Skip extension tab (index.html)
            if (tab.url && tab.url.includes('index.html') && tab.url.startsWith('chrome-extension://')) {
                console.log(`Background: Keeping extension tab: ${tab.url}`);
                continue;
            }
            
            // Skip tabs in keepTabIds array
            if (keepTabIds.includes(tab.id)) {
                console.log(`Background: Keeping specified tab ID: ${tab.id}`);
                continue;
            }
            
            try {
                await chrome.tabs.remove(tab.id);
                console.log(`Background: Closed tab: ${tab.url}`);
            } catch (error) {
                console.log(`Background: Could not close tab ${tab.id}: ${error.message}`);
            }
        }
        
        console.log('Background: Finished closing other tabs');
    } catch (error) {
        console.error('Background: Error in closeAllOtherTabs:', error);
    }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('User Agent Scraper: Extension installed');
    resetScrapingState();
});

// Handle action click to open extension in new tab
chrome.action.onClicked.addListener(async (tab) => {
    // First, create extension tab
    const extensionTab = await chrome.tabs.create({
        url: chrome.runtime.getURL('index.html'),
        active: true
    });
    
    // Then close all other tabs (except the new extension tab)
    await closeAllOtherTabs([extensionTab.id]);
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

        case 'removeDuplicates':
            handleRemoveDuplicates(sendResponse);
            break;

        case 'validateFolders':
            handleValidateFolders(message, sendResponse);
            break;

        case 'pageReady':
            handlePageReady(sender, sendResponse);
            break;

        case 'pageIssueDetected':
            handlePageIssueDetected(message, sender, sendResponse);
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
        scrapingState.tabMode = message.tabMode || 'single';
        scrapingState.userAgents = []; // Initialize as empty array
        scrapingState.totalScraped = 0;
        scrapingState.refreshCount = 0;
        scrapingState.startTime = Date.now();

        // Save initial state
        await saveScrapingState();

        if (scrapingState.tabMode === 'dual') {
            // Create dual tabs for faster scraping
            console.log('Background: Starting dual tab mode');
            await initializeMultiTabs(['A', 'B']);
            
            sendResponse({
                success: true,
                message: 'Dual tab scraping started',
                mode: 'dual',
                tabIds: [scrapingState.multiTabs.tabA.id, scrapingState.multiTabs.tabB.id]
            });

            // Start multi tab scraping
            setTimeout(() => startMultiTabScraping(['A', 'B']), 2000);
            
        } else if (scrapingState.tabMode === 'quad') {
            // Create quad tabs for maximum speed
            console.log('Background: Starting quad tab mode');
            await initializeMultiTabs(['A', 'B', 'C', 'D']);
            
            sendResponse({
                success: true,
                message: 'Quad tab scraping started',
                mode: 'quad',
                tabIds: [
                    scrapingState.multiTabs.tabA.id, 
                    scrapingState.multiTabs.tabB.id,
                    scrapingState.multiTabs.tabC.id, 
                    scrapingState.multiTabs.tabD.id
                ]
            });

            // Start multi tab scraping
            setTimeout(() => startMultiTabScraping(['A', 'B', 'C', 'D']), 2000);
            
        } else {
            // Single tab mode - create new tab instead of using current tab
            console.log('Background: Starting single tab mode');
            
            // Get current extension tab before closing others
            const extensionTab = await getCurrentExtensionTab();
            const keepTabs = extensionTab ? [extensionTab.id] : [];
            
            // Close all other tabs except extension tab
            await closeAllOtherTabs(keepTabs);
            
            // Create new tab for scraping
            const scrapingTab = await chrome.tabs.create({
                url: 'https://useragents.io/random?limit=1500',
                active: true
            });

            scrapingState.currentTabId = scrapingTab.id;
            await saveScrapingState();

            sendResponse({
                success: true,
                message: 'Single tab scraping started',
                mode: 'single',
                tabId: scrapingTab.id
            });

            // Start scraping process - wait for page to load
            setTimeout(() => waitForPageReady(), 2000);
        }

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
        
        // Close all useragents.io tabs when stopping
        await closeUserAgentTabs();
        
        // Reset tab references
        scrapingState.currentTabId = null;
        resetMultiTabIds();

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
        sendResponse({
            success: true,
            state: {
                isRunning: scrapingState.isRunning,
                targetCount: scrapingState.targetCount,
                userAgents: scrapingState.userAgents,
                uniqueCount: scrapingState.userAgents.length,
                totalScraped: scrapingState.totalScraped,
                refreshCount: scrapingState.refreshCount,
                progress: scrapingState.targetCount > 0 ? (scrapingState.userAgents.length / scrapingState.targetCount) * 100 : 0
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

// Handle remove duplicates
async function handleRemoveDuplicates(sendResponse) {
    try {
        const beforeCount = scrapingState.userAgents.length;
        console.log(`Background: Removing duplicates from ${beforeCount} user agents...`);
        
        // Efficient deduplication using Map for O(1) lookup
        const uniqueMap = new Map();
        const uniqueArray = [];
        
        scrapingState.userAgents.forEach(ua => {
            if (!uniqueMap.has(ua)) {
                uniqueMap.set(ua, true);
                uniqueArray.push(ua);
            }
        });
        
        const afterCount = uniqueArray.length;
        const removedCount = beforeCount - afterCount;
        
        // Update state with deduplicated array
        scrapingState.userAgents = uniqueArray;
        
        // Save updated state
        await saveScrapingState();
        
        console.log(`Background: Removed ${removedCount} duplicates. ${afterCount} unique user agents remaining.`);
        
        sendResponse({
            success: true,
            beforeCount: beforeCount,
            afterCount: afterCount,
            removedCount: removedCount,
            message: `Removed ${removedCount} duplicates. ${afterCount} unique user agents remaining.`
        });
    } catch (error) {
        console.error('Background: Error removing duplicates:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle validate folders - check if directories exist on filesystem
async function handleValidateFolders(message, sendResponse) {
    try {
        const { basePath, subfolders } = message;
        console.log('Background: Validating folders:', { basePath, subfolders });
        
        if (!basePath || !subfolders || !Array.isArray(subfolders)) {
            sendResponse({
                success: false,
                error: 'Invalid parameters: basePath and subfolders array required'
            });
            return;
        }
        
        // Since browser extensions have limited filesystem access,
        // we'll use a simplified validation approach
        const validFolders = [];
        const invalidFolders = [];
        const results = [];
        
        // For each subfolder, we'll simulate a validation
        // In a real extension, you'd need native messaging or File System Access API
        for (const subfolder of subfolders) {
            try {
                // Validate folder name format
                const isValidName = /^[a-zA-Z0-9_-]+$/.test(subfolder);
                
                if (isValidName && subfolder.length > 0 && subfolder.length <= 50) {
                    // For browser extension, we'll assume folders exist if they have valid names
                    // This is a limitation of browser security model
                    validFolders.push(subfolder);
                    results.push({
                        folder: subfolder,
                        exists: true,
                        path: `${basePath}\\${subfolder}`,
                        message: 'Folder name is valid (actual existence cannot be verified due to browser security)'
                    });
                } else {
                    invalidFolders.push(subfolder);
                    results.push({
                        folder: subfolder,
                        exists: false,
                        path: `${basePath}\\${subfolder}`,
                        message: 'Invalid folder name format'
                    });
                }
            } catch (error) {
                invalidFolders.push(subfolder);
                results.push({
                    folder: subfolder,
                    exists: false,
                    path: `${basePath}\\${subfolder}`,
                    message: `Validation error: ${error.message}`
                });
            }
        }
        
        console.log(`Background: Validation complete - ${validFolders.length} valid, ${invalidFolders.length} invalid`);
        
        sendResponse({
            success: true,
            validFolders: validFolders,
            invalidFolders: invalidFolders,
            results: results,
            message: `Validated ${validFolders.length}/${subfolders.length} folders`
        });
        
    } catch (error) {
        console.error('Background: Error validating folders:', error);
        sendResponse({
            success: false,
            error: error.message
        });
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

// Handle page issue detection (Cloudflare, rate limit, etc.)
function handlePageIssueDetected(message, sender, sendResponse) {
    const { issueType, url } = message;
    const tabId = sender.tab?.id;
    
    console.log(`Background: Page issue detected in tab ${tabId}: ${issueType} at ${url}`);
    
    // Notify popup about the issue
    notifyPopup('warning', `${issueType} detected, auto-refreshing in 3 seconds...`);
    
    // Log the issue for debugging
    console.log(`Background: Handling ${issueType} - page will auto-refresh`);
    
    sendResponse({ success: true, message: `${issueType} detected, handling automatically` });
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
            // Add new user agents to Array (no auto deduplication for performance)
            const initialCount = scrapingState.userAgents.length;
            response.userAgents.forEach(ua => {
                if (ua && ua.trim()) {
                    scrapingState.userAgents.push(ua.trim());
                }
            });

            const newUserAgents = scrapingState.userAgents.length - initialCount;
            scrapingState.totalScraped += response.userAgents.length;
            scrapingState.refreshCount++;

            // Successfully extracted data

            console.log(`Background: Extracted ${response.userAgents.length} UAs, ${newUserAgents} new added, total collected: ${scrapingState.userAgents.length}`);

            // Check if auto duplicate removal should be triggered
            await checkAutoRemoveDuplicates();

            // Save state
            await saveScrapingState();

            // Notify popup
            notifyPopup('progress', {
                uniqueCount: scrapingState.userAgents.length,
                totalScraped: scrapingState.totalScraped,
                refreshCount: scrapingState.refreshCount,
                progress: scrapingState.targetCount > 0 ? (scrapingState.userAgents.length / scrapingState.targetCount) * 100 : 0
            });

            // Check if target reached
            if (scrapingState.userAgents.length >= scrapingState.targetCount) {
                console.log('Background: Target reached!');
                scrapingState.isRunning = false;
                
                // Close all useragents.io tabs when target reached
                await closeUserAgentTabs();
                
                // Reset tab references
                scrapingState.currentTabId = null;
                resetMultiTabIds();
                
                await saveScrapingState();
                notifyPopup('completed', `Target reached! Collected ${scrapingState.userAgents.length} user agents`);
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

// Refresh page and continue scraping (simplified)
async function refreshPageAndContinue() {
    if (!scrapingState.isRunning || !scrapingState.currentTabId) {
        return;
    }

    try {
        console.log(`Background: Waiting ${scrapingState.simpleDelay/1000}s before next refresh...`);
        
        // Wait simple delay before proceeding
        await new Promise(resolve => setTimeout(resolve, scrapingState.simpleDelay));
        
        console.log('Background: Refreshing page...');
        
        // Use Chrome tabs API to refresh the page
        await chrome.tabs.reload(scrapingState.currentTabId);
        
        // Wait for page to start loading then check for readiness
        setTimeout(async () => {
            try {
                await waitForPageReady();
            } catch (error) {
                console.error('Background: Error waiting for page ready:', error);
                // Content script will handle page issues automatically
                // Just try again after a short delay
                if (scrapingState.isRunning) {
                    setTimeout(() => refreshPageAndContinue(), 3000);
                }
            }
        }, 2000);

    } catch (error) {
        console.error('Background: Error refreshing page:', error);
        notifyPopup('error', `Refresh error: ${error.message}`);
        
        // Try again after 3 seconds
        if (scrapingState.isRunning) {
            setTimeout(() => refreshPageAndContinue(), 3000);
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
            ...scrapingState
            // userAgents is already an Array, no conversion needed
        };
        await chrome.storage.local.set({ [STORAGE_KEYS.SCRAPING_STATE]: stateToSave });
    } catch (error) {
        console.error('Background: Error saving state:', error);
    }
}

// Auto remove duplicates when reaching milestone
async function performAutoRemoveDuplicates() {
    if (scrapingState.autoDuplicateRemoval.isProcessing) {
        console.log('Background: Auto duplicate removal already in progress, skipping...');
        return;
    }

    try {
        scrapingState.autoDuplicateRemoval.isProcessing = true;
        const currentCount = scrapingState.userAgents.length;
        
        console.log(`Background: Auto duplicate removal triggered at ${currentCount} user agents`);
        
        // Notify popup that auto removal is starting
        notifyPopup('warning', `🔄 Auto-removing duplicates at ${Math.floor(currentCount / 1000)}K milestone...`);
        
        const beforeCount = scrapingState.userAgents.length;
        
        // Efficient deduplication using Map for O(1) lookup
        const uniqueMap = new Map();
        const uniqueArray = [];
        
        scrapingState.userAgents.forEach(ua => {
            if (!uniqueMap.has(ua)) {
                uniqueMap.set(ua, true);
                uniqueArray.push(ua);
            }
        });
        
        const afterCount = uniqueArray.length;
        const removedCount = beforeCount - afterCount;
        
        // Update state with deduplicated array
        scrapingState.userAgents = uniqueArray;
        
        // Update last check count
        scrapingState.autoDuplicateRemoval.lastCheckCount = afterCount;
        
        // Save updated state
        await saveScrapingState();
        
        console.log(`Background: Auto removed ${removedCount} duplicates. ${afterCount} unique user agents remaining.`);
        
        // Notify popup with detailed results
        if (removedCount === 0) {
            notifyPopup('success', `✅ No duplicates found at ${Math.floor(currentCount / 1000)}K. All ${afterCount} user agents are unique.`);
        } else {
            notifyPopup('success', `✅ Auto-removal complete: Removed ${removedCount} duplicates, ${afterCount} valid user agents remaining`);
        }
        
        return {
            success: true,
            beforeCount: beforeCount,
            afterCount: afterCount,
            removedCount: removedCount
        };
        
    } catch (error) {
        console.error('Background: Error in auto duplicate removal:', error);
        notifyPopup('error', `❌ Auto duplicate removal failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    } finally {
        scrapingState.autoDuplicateRemoval.isProcessing = false;
    }
}

// Check if auto duplicate removal should be triggered
async function checkAutoRemoveDuplicates() {
    if (!scrapingState.autoDuplicateRemoval.enabled || scrapingState.autoDuplicateRemoval.isProcessing) {
        return;
    }
    
    const currentCount = scrapingState.userAgents.length;
    const lastCheckCount = scrapingState.autoDuplicateRemoval.lastCheckCount;
    const checkInterval = scrapingState.autoDuplicateRemoval.checkInterval;
    
    // Check if we've reached the next milestone
    if (currentCount >= lastCheckCount + checkInterval) {
        console.log(`Background: Auto duplicate check triggered - Current: ${currentCount}, Last check: ${lastCheckCount}, Interval: ${checkInterval}`);
        await performAutoRemoveDuplicates();
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
        userAgents: [], // Reset to empty Array instead of Set
        totalScraped: 0,
        refreshCount: 0,
        currentTabId: null,
        startTime: null,
        lastRefreshTime: null,
        pageLoadTimeout: null,
        isPageLoading: false,
        tabMode: 'single',
        multiTabs: {
            tabA: { id: null, isActive: false, role: 'A' },
            tabB: { id: null, isActive: false, role: 'B' },
            tabC: { id: null, isActive: false, role: 'C' },
            tabD: { id: null, isActive: false, role: 'D' },
            activeTab: 'A',
            offsetDelay: 1000 // 1 second offset between tabs
        },
        filters: {
            android: true,
            windows: false,
            ios: true
        },
        simpleDelay: 1500,
        autoDuplicateRemoval: {
            enabled: true,
            lastCheckCount: 0,
            checkInterval: 10000, // Check every 10K user agents
            isProcessing: false
        }
    };
}

// Simple delay calculation for multi-tab mode
function calculateSimpleMultiTabDelay(tabMode) {
    const baseDelay = scrapingState.simpleDelay;
    const tabCount = tabMode === 'dual' ? 2 : 4;
    return Math.max(baseDelay / tabCount, 800); // Minimum 800ms between tab refreshes
}

// Get current progress data for notifications
function getCurrentProgressData() {
    return {
        uniqueCount: scrapingState.userAgents.length,
        totalScraped: scrapingState.totalScraped,
        refreshCount: scrapingState.refreshCount,
        progress: scrapingState.targetCount > 0 ? (scrapingState.userAgents.length / scrapingState.targetCount) * 100 : 0
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

// Multi Tab Functions (supports dual and quad modes)

// Initialize multiple tabs for faster scraping
async function initializeMultiTabs(tabRoles) {
    try {
        console.log(`Background: Initializing ${tabRoles.length} tabs: ${tabRoles.join(', ')}`);
        
        // Get current extension tab before closing others
        const extensionTab = await getCurrentExtensionTab();
        const keepTabs = extensionTab ? [extensionTab.id] : [];
        
        // Close all other tabs except extension tab for multi-tab mode
        await closeAllOtherTabs(keepTabs);
        
        // Create tabs based on the roles provided
        for (const role of tabRoles) {
            const tab = await chrome.tabs.create({
                url: 'https://useragents.io/random?limit=1500',
                active: false
            });
            
            // Store tab ID
            scrapingState.multiTabs[`tab${role}`].id = tab.id;
            console.log(`Background: Created Tab ${role}: ${tab.id}`);
        }
        
        scrapingState.multiTabs.activeTab = tabRoles[0];
        
        console.log(`Background: Created ${tabRoles.length} tabs successfully`);
        await saveScrapingState();
        
    } catch (error) {
        console.error('Background: Error initializing multi tabs:', error);
        throw error;
    }
}

// Start multi tab scraping with staggered schedule
async function startMultiTabScraping(tabRoles) {
    if (!scrapingState.isRunning || scrapingState.tabMode === 'single') {
        return;
    }
    
    console.log(`Background: Starting ${tabRoles.length}-tab scraping coordination...`);
    
    // Start each tab with offset delays
    tabRoles.forEach((role, index) => {
        const delay = 2000 + (index * scrapingState.multiTabs.offsetDelay);
        setTimeout(() => {
            if (scrapingState.isRunning) {
                console.log(`Background: Starting Tab ${role} scraping...`);
                extractFromMultiTab(role);
            }
        }, delay);
    });
}

// Extract user agents from specific multi tab
async function extractFromMultiTab(tabRole) {
    if (!scrapingState.isRunning || scrapingState.tabMode === 'single') {
        return;
    }
    
    const tab = scrapingState.multiTabs[`tab${tabRole}`];
    if (!tab.id) {
        console.error(`Background: Tab ${tabRole} not initialized`);
        return;
    }
    
    try {
        console.log(`Background: Extracting from Tab ${tabRole} (ID: ${tab.id})...`);
        
        // Mark tab as active
        scrapingState.multiTabs[`tab${tabRole}`].isActive = true;
        
        // Send message to content script
        const response = await sendMessageWithRetry(tab.id, {
            action: 'extractUserAgents',
            filters: scrapingState.filters,
            tabRole: tabRole
        });
        
        if (response.success && response.userAgents) {
            // Add new user agents to shared Array (no auto deduplication for performance)
            const initialCount = scrapingState.userAgents.length;
            response.userAgents.forEach(ua => {
                if (ua && ua.trim()) {
                    scrapingState.userAgents.push(ua.trim());
                }
            });
            
            const newUserAgents = scrapingState.userAgents.length - initialCount;
            scrapingState.totalScraped += response.userAgents.length;
            scrapingState.refreshCount++;
            
            // Successfully extracted data from multi-tab
            
            console.log(`Background: Tab ${tabRole} extracted ${response.userAgents.length} UAs, ${newUserAgents} new added, total: ${scrapingState.userAgents.length}`);
            
            // Check if auto duplicate removal should be triggered
            await checkAutoRemoveDuplicates();
            
            // Save state and notify popup
            await saveScrapingState();
            notifyPopup('progress', {
                uniqueCount: scrapingState.userAgents.length,
                totalScraped: scrapingState.totalScraped,
                refreshCount: scrapingState.refreshCount,
                progress: scrapingState.targetCount > 0 ? (scrapingState.userAgents.length / scrapingState.targetCount) * 100 : 0,
                multiTabStatus: `Tab ${tabRole} active`
            });
            
            // Check if target reached
            if (scrapingState.userAgents.length >= scrapingState.targetCount) {
                console.log(`Background: Target reached in ${scrapingState.tabMode} tab mode!`);
                scrapingState.isRunning = false;
                
                // Close all useragents.io tabs when target reached
                await closeUserAgentTabs();
                
                // Reset tab references
                scrapingState.currentTabId = null;
                resetMultiTabIds();
                
                await saveScrapingState();
                notifyPopup('completed', `Target reached! Collected ${scrapingState.userAgents.length} user agents`);
                return;
            }
            
            // Schedule next refresh for this tab
            if (scrapingState.isRunning) {
                scheduleNextMultiTabRefresh(tabRole);
            }
            
        } else {
            console.error(`Background: Tab ${tabRole} failed to extract user agents:`, response);
            
            // Check if this is a page issue that the content script should handle
            if (response && response.error && response.error.includes('Page issue detected')) {
                console.log(`Background: Tab ${tabRole} has page issues, content script will auto-handle`);
                // Content script will handle the page issue automatically
                return;
            }
            
            // Try recovery for this tab
            if (scrapingState.isRunning) {
                setTimeout(() => recoveryMultiTab(tabRole), 2000);
            }
        }
        
    } catch (error) {
        console.error(`Background: Error extracting from Tab ${tabRole}:`, error);
        
        // Try recovery for this tab
        if (scrapingState.isRunning) {
            setTimeout(() => recoveryMultiTab(tabRole), 2000);
        }
    } finally {
        // Mark tab as inactive
        scrapingState.multiTabs[`tab${tabRole}`].isActive = false;
    }
}

// Schedule next refresh for multi tab
function scheduleNextMultiTabRefresh(tabRole) {
    if (!scrapingState.isRunning || scrapingState.tabMode === 'single') {
        return;
    }
    
    // Use simple delay calculation for multi-tab mode
    const multiTabDelay = calculateSimpleMultiTabDelay(scrapingState.tabMode);
    
    console.log(`Background: Scheduling Tab ${tabRole} refresh in ${multiTabDelay/1000}s...`);
    
    setTimeout(async () => {
        if (scrapingState.isRunning && scrapingState.tabMode !== 'single') {
            await refreshMultiTab(tabRole);
        }
    }, multiTabDelay);
}

// Refresh specific multi tab
async function refreshMultiTab(tabRole) {
    if (!scrapingState.isRunning || scrapingState.tabMode === 'single') {
        return;
    }
    
    const tab = scrapingState.multiTabs[`tab${tabRole}`];
    if (!tab.id) {
        console.error(`Background: Tab ${tabRole} not available for refresh`);
        return;
    }
    
    try {
        console.log(`Background: Refreshing Tab ${tabRole}...`);
        
        // Reload the tab
        await chrome.tabs.reload(tab.id);
        
        // Wait for page to load then extract
        setTimeout(() => {
            if (scrapingState.isRunning) {
                extractFromMultiTab(tabRole);
            }
        }, 2500); // Wait 2.5 seconds for page load (faster for multi-tab)
        
    } catch (error) {
        console.error(`Background: Error refreshing Tab ${tabRole}:`, error);
        
        // Try recovery
        if (scrapingState.isRunning) {
            setTimeout(() => recoveryMultiTab(tabRole), 2000);
        }
    }
}

// Recovery for multi tab
async function recoveryMultiTab(tabRole) {
    if (!scrapingState.isRunning || scrapingState.tabMode === 'single') {
        return;
    }
    
    const tab = scrapingState.multiTabs[`tab${tabRole}`];
    if (!tab.id) {
        console.error(`Background: Tab ${tabRole} not available for recovery`);
        return;
    }
    
    try {
        console.log(`Background: Recovering Tab ${tabRole}...`);
        
        // Navigate to fresh URL
        await chrome.tabs.update(tab.id, {
            url: 'https://useragents.io/random?limit=1500'
        });
        
        // Wait longer for recovery then extract
        setTimeout(() => {
            if (scrapingState.isRunning) {
                extractFromMultiTab(tabRole);
            }
        }, 4000); // Faster recovery for multi-tab
        
    } catch (error) {
        console.error(`Background: Error in Tab ${tabRole} recovery:`, error);
        notifyPopup('error', `Tab ${tabRole} recovery failed: ${error.message}`);
    }
}

// Get current extension tab
async function getCurrentExtensionTab() {
    try {
        const allTabs = await chrome.tabs.query({});
        const extensionUrl = chrome.runtime.getURL('index.html');
        
        for (const tab of allTabs) {
            if (tab.url && tab.url.includes('index.html') && tab.url.startsWith('chrome-extension://')) {
                console.log(`Background: Found extension tab: ${tab.id}`);
                return tab;
            }
        }
        
        console.log('Background: No extension tab found');
        return null;
    } catch (error) {
        console.error('Background: Error finding extension tab:', error);
        return null;
    }
}

// Close all useragents.io tabs
async function closeUserAgentTabs() {
    try {
        console.log('Background: Closing all useragents.io tabs...');
        const allTabs = await chrome.tabs.query({});
        
        for (const tab of allTabs) {
            // Close tabs that contain useragents.io
            if (tab.url && tab.url.includes('useragents.io')) {
                try {
                    await chrome.tabs.remove(tab.id);
                    console.log(`Background: Closed useragents.io tab: ${tab.url}`);
                } catch (error) {
                    console.log(`Background: Could not close tab ${tab.id}: ${error.message}`);
                }
            }
        }
        
        console.log('Background: Finished closing useragents.io tabs');
    } catch (error) {
        console.error('Background: Error closing useragents.io tabs:', error);
    }
}

// Reset multi tab IDs
function resetMultiTabIds() {
    scrapingState.multiTabs.tabA.id = null;
    scrapingState.multiTabs.tabB.id = null;
    scrapingState.multiTabs.tabC.id = null;
    scrapingState.multiTabs.tabD.id = null;
    scrapingState.multiTabs.tabA.isActive = false;
    scrapingState.multiTabs.tabB.isActive = false;
    scrapingState.multiTabs.tabC.isActive = false;
    scrapingState.multiTabs.tabD.isActive = false;
    scrapingState.multiTabs.activeTab = 'A';
    console.log('Background: Multi tab IDs reset');
}

console.log('Background: Service worker initialization complete');
