// Content script untuk scraping user agents dari useragents.io
(function() {
    'use strict';

    // Flag untuk mencegah multiple execution
    if (window.userAgentScraperInjected) {
        return;
    }
    window.userAgentScraperInjected = true;

    console.log('User Agent Scraper: Content script loaded');

    // Function untuk extract user agents dari halaman
    function extractUserAgents(filters = null) {
        const userAgents = [];
        
        try {
            // Cari table dengan class 'table table-striped'
            const table = document.querySelector('table.table.table-striped');
            if (!table) {
                console.log('User Agent Scraper: Table not found');
                return userAgents;
            }

            // Cari semua baris dalam table body
            const rows = table.querySelectorAll('tbody tr');
            console.log(`User Agent Scraper: Found ${rows.length} rows`);

            rows.forEach((row, index) => {
                try {
                    // Cari link dalam baris
                    const link = row.querySelector('td a');
                    if (link) {
                        // Ambil user agent dari title attribute atau text content
                        let userAgent = link.getAttribute('title') || link.textContent;
                        
                        if (userAgent && userAgent.trim()) {
                            userAgent = userAgent.trim();
                            
                            // Apply filters if provided
                            if (filters && !passesFilter(userAgent, filters)) {
                                console.log(`User Agent Scraper: Filtered out UA ${index + 1}: ${userAgent.substring(0, 50)}...`);
                                return; // Skip this user agent
                            }
                            
                            userAgents.push(userAgent);
                            console.log(`User Agent Scraper: Extracted UA ${index + 1}: ${userAgent.substring(0, 50)}...`);
                        }
                    }
                } catch (error) {
                    console.error(`User Agent Scraper: Error processing row ${index}:`, error);
                }
            });

        } catch (error) {
            console.error('User Agent Scraper: Error extracting user agents:', error);
        }

        console.log(`User Agent Scraper: Total extracted after filtering: ${userAgents.length}`);
        return userAgents;
    }

    // Function untuk check apakah user agent passes filter
    function passesFilter(userAgent, filters) {
        const ua = userAgent.toLowerCase();
        
        // Check Android filter (Android 11+)
        if (filters.android && ua.includes('android')) {
            const androidMatch = ua.match(/android (\d+)/);
            if (androidMatch) {
                const version = parseInt(androidMatch[1]);
                if (version >= 11) {
                    return true;
                }
            }
        }
        
        // Check Windows filter
        if (filters.windows && (ua.includes('windows') || ua.includes('win32') || ua.includes('win64'))) {
            return true;
        }
        
        // Check iOS filter (iOS 15+)
        if (filters.ios && (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios'))) {
            // For iPhone
            const iphoneMatch = ua.match(/iphone os (\d+)_/);
            if (iphoneMatch) {
                const version = parseInt(iphoneMatch[1]);
                if (version >= 15) {
                    return true;
                }
            }
            
            // For iPad
            const ipadMatch = ua.match(/os (\d+)_/);
            if (ipadMatch && ua.includes('ipad')) {
                const version = parseInt(ipadMatch[1]);
                if (version >= 15) {
                    return true;
                }
            }
            
            // Generic iOS check for newer format
            const iosMatch = ua.match(/version\/(\d+)\./);
            if (iosMatch && (ua.includes('iphone') || ua.includes('ipad'))) {
                const version = parseInt(iosMatch[1]);
                if (version >= 15) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // SIMPLE detection - hanya kata-kata spesifik
    function detectSpecificIssues() {
        const bodyText = document.body.textContent.toLowerCase();
        
        // HANYA detect challenge page
        if (bodyText.includes('verifying you are human')) {
            return 'cloudflare';
        }
        
        // HANYA detect rate limit
        if (bodyText.includes('too many requests')) {
            return 'ratelimit';
        }
        
        // Tidak ada logic lain yang mengganggu
        return null;
    }

    // SIMPLE wait for table - minimal logic
    function waitForTableLoad() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10; // 5 seconds max
            
            const checkTable = () => {
                attempts++;
                
                // Cek issue spesifik dulu
                const issueType = detectSpecificIssues();
                if (issueType) {
                    console.log(`User Agent Scraper: ${issueType} detected, auto-refreshing...`);
                    
                    // Notify background
                    chrome.runtime.sendMessage({
                        action: 'pageIssueDetected',
                        issueType: issueType,
                        url: window.location.href
                    }).catch(() => {});
                    
                    // Auto refresh after 3 seconds
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                    
                    reject(new Error(`${issueType} detected`));
                    return;
                }
                
                // Cek table normal
                const table = document.querySelector('table.table.table-striped tbody');
                const rows = table ? table.querySelectorAll('tr') : [];
                
                if (rows.length > 0) {
                    console.log(`User Agent Scraper: Table ready with ${rows.length} rows`);
                    resolve(rows.length);
                } else if (attempts >= maxAttempts) {
                    console.log('User Agent Scraper: Timeout, proceeding anyway');
                    resolve(0);
                } else {
                    setTimeout(checkTable, 500);
                }
            };
            
            checkTable();
        });
    }

    // Listen untuk messages dari background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('User Agent Scraper: Received message:', message);

        switch (message.action) {
            case 'extractUserAgents':
                handleExtractUserAgents(message, sendResponse);
                return true; // Keep sendResponse alive for async response

            case 'refreshPage':
                handleRefreshPage(sendResponse);
                return true;

            case 'checkPageReady':
                handleCheckPageReady(sendResponse);
                return true;

            default:
                console.log('User Agent Scraper: Unknown action:', message.action);
                sendResponse({ success: false, error: 'Unknown action' });
        }
    });

    // Handle extract user agents request
    async function handleExtractUserAgents(message, sendResponse) {
        try {
            console.log('User Agent Scraper: Starting extraction with filters:', message.filters);
            
            // Tunggu table load jika belum ready
            await waitForTableLoad();
            
            // Extract user agents with filters
            const userAgents = extractUserAgents(message.filters);
            
            sendResponse({
                success: true,
                userAgents: userAgents,
                count: userAgents.length,
                url: window.location.href
            });
            
        } catch (error) {
            console.error('User Agent Scraper: Error in extraction:', error);
            sendResponse({
                success: false,
                error: error.message,
                userAgents: [],
                count: 0
            });
        }
    }

    // Handle refresh page request
    function handleRefreshPage(sendResponse) {
        try {
            console.log('User Agent Scraper: Refreshing page...');
            sendResponse({ success: true, message: 'Refreshing...' });
            
            // Refresh halaman setelah response dikirim
            setTimeout(() => {
                window.location.reload();
            }, 100);
            
        } catch (error) {
            console.error('User Agent Scraper: Error refreshing page:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // Handle check page ready request
    async function handleCheckPageReady(sendResponse) {
        try {
            const rowCount = await waitForTableLoad();
            sendResponse({
                success: true,
                ready: true,
                rowCount: rowCount,
                url: window.location.href
            });
        } catch (error) {
            sendResponse({
                success: false,
                ready: false,
                error: error.message
            });
        }
    }

    // Auto-notify background script ketika halaman ready
    document.addEventListener('DOMContentLoaded', () => {
        console.log('User Agent Scraper: DOM Content Loaded');
        setTimeout(() => {
            console.log('User Agent Scraper: Checking if table loads...');
            waitForTableLoad().then(() => {
                console.log('User Agent Scraper: Table loaded, notifying background');
                chrome.runtime.sendMessage({
                    action: 'pageReady',
                    url: window.location.href
                }).catch(error => {
                    console.log('User Agent Scraper: Background script not ready:', error);
                });
            }).catch(error => {
                console.log('User Agent Scraper: Table load failed:', error);
            });
        }, 1000);
    });

    // Fallback jika DOMContentLoaded sudah lewat
    if (document.readyState === 'loading') {
        console.log('User Agent Scraper: Document still loading, waiting for DOMContentLoaded');
    } else {
        console.log('User Agent Scraper: Document already loaded, checking table immediately');
        setTimeout(() => {
            waitForTableLoad().then(() => {
                console.log('User Agent Scraper: Table loaded (fallback), notifying background');
                chrome.runtime.sendMessage({
                    action: 'pageReady',
                    url: window.location.href
                }).catch(error => {
                    console.log('User Agent Scraper: Background script not ready (fallback):', error);
                });
            }).catch(error => {
                console.log('User Agent Scraper: Table load failed (fallback):', error);
            });
        }, 500);
    }

    console.log('User Agent Scraper: Content script initialization complete');
})();
