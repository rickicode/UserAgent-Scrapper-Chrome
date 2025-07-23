// Index script untuk User Agent Scraper Extension
document.addEventListener('DOMContentLoaded', function() {
    
    // Debug Log Functions (defined first)
    function addDebugLog(type, message) {
        const debugLog = document.getElementById('debugLog');
        if (!debugLog) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `debug-entry ${type}`;
        
        entry.innerHTML = `
            <span class="debug-timestamp">[${timestamp}]</span>
            <span class="debug-message">${message}</span>
        `;
        
        debugLog.appendChild(entry);
        
        // Auto-scroll to bottom
        debugLog.scrollTop = debugLog.scrollHeight;
        
        // Limit log entries to 100 to prevent memory issues
        const entries = debugLog.querySelectorAll('.debug-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }
    
    function clearDebugLog() {
        const debugLog = document.getElementById('debugLog');
        if (debugLog) {
            debugLog.innerHTML = '';
            addDebugLog('info', 'Debug log cleared');
        }
    }

    // Override console methods to also show in debug log
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.log = function(...args) {
        addDebugLog('info', args.join(' '));
        originalConsoleLog.apply(console, args);
    };
    
    console.error = function(...args) {
        addDebugLog('error', args.join(' '));
        originalConsoleError.apply(console, args);
    };
    
    console.warn = function(...args) {
        addDebugLog('warning', args.join(' '));
        originalConsoleWarn.apply(console, args);
    };

    addDebugLog('info', 'Extension initialized and ready');
    
    // Get DOM elements
    const elements = {
        targetCount: document.getElementById('targetCount'),
        filterAndroid: document.getElementById('filterAndroid'),
        filterWindows: document.getElementById('filterWindows'),
        filterIOS: document.getElementById('filterIOS'),
        singleTabMode: document.getElementById('singleTabMode'),
        dualTabMode: document.getElementById('dualTabMode'),
        quadTabMode: document.getElementById('quadTabMode'),
        tabModeDescription: document.getElementById('tabModeDescription'),
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        checkDuplicatesBtn: document.getElementById('checkDuplicatesBtn'),
        copyBtn: document.getElementById('copyBtn'),
        clearBtn: document.getElementById('clearBtn'),
        progressText: document.getElementById('progressText'),
        statsText: document.getElementById('statsText'),
        progressFill: document.getElementById('progressFill'),
        uniqueCount: document.getElementById('uniqueCount'),
        totalCount: document.getElementById('totalCount'),
        refreshCount: document.getElementById('refreshCount'),
        resultsTextarea: document.getElementById('resultsTextarea'),
        statusText: document.getElementById('statusText'),
        autoSaveEnabled: document.getElementById('autoSaveEnabled'),
        savePathConfig: document.getElementById('savePathConfig'),
        savePath: document.getElementById('savePath'),
        subfolders: document.getElementById('subfolders'),
        validatePathsBtn: document.getElementById('validatePathsBtn'),
        validationResult: document.getElementById('validationResult'),
        duplicateNotification: document.getElementById('duplicateNotification'),
        debugLog: document.getElementById('debugLog'),
        clearLogBtn: document.getElementById('clearLogBtn')
    };

    // State variables
    let currentState = {
        isRunning: false,
        targetCount: 0,
        userAgents: [],
        uniqueCount: 0,
        totalScraped: 0,
        refreshCount: 0,
        progress: 0,
        filters: {
            android: true,
            windows: false,
            ios: true
        },
        autoSave: {
            enabled: false,
            basePath: '',
            selectedFolders: [],
            directoryHandles: []
        }
    };

    // Initialize popup
    init();

    // Event listeners
    elements.startBtn.addEventListener('click', handleStartScraping);
    elements.stopBtn.addEventListener('click', handleStopScraping);
    elements.checkDuplicatesBtn.addEventListener('click', handleRemoveDuplicates);
    elements.copyBtn.addEventListener('click', handleCopyResults);
    elements.clearBtn.addEventListener('click', handleClearData);
    elements.targetCount.addEventListener('input', handleTargetCountChange);
    elements.autoSaveEnabled.addEventListener('change', handleAutoSaveToggle);
    elements.validatePathsBtn.addEventListener('click', handleValidatePaths);
    elements.clearLogBtn.addEventListener('click', clearDebugLog);
    
    // Tab mode selection event listeners
    elements.singleTabMode.addEventListener('change', handleTabModeChange);
    elements.dualTabMode.addEventListener('change', handleTabModeChange);
    elements.quadTabMode.addEventListener('change', handleTabModeChange);

    // Listen untuk updates dari background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'scrapingUpdate') {
            handleScrapingUpdate(message.type, message.data);
        }
        sendResponse({ received: true });
    });

    // Initialize popup state
    async function init() {
        try {
            console.log('Popup: Initializing...');
            
            await loadCurrentState();
            await loadAutoSavePreferences(); // Load preferences before updateUI
            updateUI();
            
            // Start periodic state updates with longer interval to reduce load
            setInterval(loadCurrentState, 5000); // Increased from 2000ms to 5000ms
            
        } catch (error) {
            console.error('Popup: Error initializing:', error);
            setStatus('error', 'Failed to initialize extension');
        }
    }

    // Load current state from background
    async function loadCurrentState() {
        try {
            const response = await sendMessageToBackground('getScrapingState');
            if (response.success) {
                // Preserve auto-save configuration and directory handles when loading state
                const preservedAutoSave = currentState.autoSave;
                
                // Update scraping-related state from background
                currentState.isRunning = response.state.isRunning || false;
                currentState.targetCount = response.state.targetCount || 0;
                currentState.userAgents = response.state.userAgents || [];
                currentState.uniqueCount = response.state.uniqueCount || 0;
                currentState.totalScraped = response.state.totalScraped || 0;
                currentState.refreshCount = response.state.refreshCount || 0;
                currentState.progress = response.state.progress || 0;
                currentState.filters = response.state.filters || currentState.filters;
                
                // Preserve auto-save configuration (don't overwrite with background state)
                if (preservedAutoSave) {
                    currentState.autoSave = preservedAutoSave;
                }
                
                updateUI();
            }
        } catch (error) {
            console.error('Popup: Error loading state:', error);
        }
    }

    // Handle start scraping
    async function handleStartScraping() {
        try {
            const targetCount = parseInt(elements.targetCount.value);
            
            if (!targetCount || targetCount < 100) {
                alert('Please enter a valid target count (minimum 100)');
                return;
            }

            // Get filter settings
            const filters = {
                android: elements.filterAndroid.checked,
                windows: elements.filterWindows.checked,
                ios: elements.filterIOS.checked
            };

            // Validate at least one filter is selected
            if (!filters.android && !filters.windows && !filters.ios) {
                alert('Please select at least one device filter');
                return;
            }

            // Get tab mode setting
            const tabMode = getSelectedTabMode();
            
            console.log('Popup: Starting scraping with target:', targetCount, 'filters:', filters, 'tabMode:', tabMode);
            setStatus('running', getStartingMessage(tabMode));
            
            const response = await sendMessageToBackground('startScraping', {
                targetCount,
                filters,
                tabMode
            });
            
            if (response.success) {
                console.log('Popup: Scraping started successfully');
                elements.startBtn.disabled = true;
                elements.stopBtn.disabled = false;
                elements.targetCount.disabled = true;
                setStatus('running', 'Scraping in progress...');
            } else {
                console.error('Popup: Failed to start scraping:', response.error);
                setStatus('error', `Failed to start: ${response.error}`);
            }
            
        } catch (error) {
            console.error('Popup: Error starting scraping:', error);
            setStatus('error', `Error: ${error.message}`);
        }
    }

    // Handle stop scraping
    async function handleStopScraping() {
        try {
            console.log('Popup: Stopping scraping...');
            setStatus('running', 'Stopping...');
            
            const response = await sendMessageToBackground('stopScraping');
            
            if (response.success) {
                console.log('Popup: Scraping stopped successfully');
                elements.startBtn.disabled = false;
                elements.stopBtn.disabled = true;
                elements.targetCount.disabled = false;
                setStatus('success', 'Scraping stopped');
            } else {
                console.error('Popup: Failed to stop scraping:', response.error);
                setStatus('error', `Failed to stop: ${response.error}`);
            }
            
        } catch (error) {
            console.error('Popup: Error stopping scraping:', error);
            setStatus('error', `Error: ${error.message}`);
        }
    }

    // Show duplicate notification (permanent until manually dismissed)
    function showDuplicateNotification(type, message) {
        if (!elements.duplicateNotification) return;
        
        // Clear existing classes and add new type
        elements.duplicateNotification.className = `duplicate-notification ${type}`;
        
        // Add close button to message
        const closeBtn = '<span style="float: right; cursor: pointer; font-weight: bold; margin-left: 10px;" onclick="this.parentElement.classList.add(\'hidden\')">&times;</span>';
        elements.duplicateNotification.innerHTML = closeBtn + message;
        
        // Show notification with animation
        elements.duplicateNotification.classList.remove('hidden');
        
        // No auto-hide - notification stays until manually closed
    }

    // Handle remove duplicates
    async function handleRemoveDuplicates() {
        try {
            console.log('Popup: Removing duplicates...');
            setStatus('running', 'Removing duplicates...');
            
            const response = await sendMessageToBackground('removeDuplicates');
            
            if (response.success) {
                const { beforeCount, afterCount, removedCount, message } = response;
                
                // Update current state with new count
                currentState.uniqueCount = afterCount;
                currentState.userAgents = currentState.userAgents || [];
                
                setStatus('success', message);
                
                // Show notification instead of alert
                if (removedCount === 0) {
                    showDuplicateNotification('warning', `✅ No duplicates found. All ${afterCount} user agents are unique.`);
                } else {
                    showDuplicateNotification('success', `✅ Removed ${removedCount} duplicates. ${afterCount} unique user agents remaining.`);
                }
                
                // Reload current state to get updated data
                await loadCurrentState();
                
            } else {
                console.error('Popup: Failed to remove duplicates:', response.error);
                setStatus('error', `Failed to remove duplicates: ${response.error}`);
                showDuplicateNotification('error', `❌ Failed to remove duplicates: ${response.error}`);
            }
            
        } catch (error) {
            console.error('Popup: Error removing duplicates:', error);
            setStatus('error', `Error: ${error.message}`);
            showDuplicateNotification('error', `❌ Error: ${error.message}`);
        }
    }

    // Handle copy results
    async function handleCopyResults() {
        try {
            const userAgents = elements.resultsTextarea.value;
            
            if (!userAgents.trim()) {
                alert('No user agents to copy');
                return;
            }

            await navigator.clipboard.writeText(userAgents);
            setStatus('success', `Copied ${currentState.uniqueCount} user agents to clipboard`);
            
            // Visual feedback
            const originalText = elements.copyBtn.textContent;
            elements.copyBtn.textContent = 'Copied!';
            elements.copyBtn.style.background = '#28a745';
            
            setTimeout(() => {
                elements.copyBtn.textContent = originalText;
                elements.copyBtn.style.background = '';
            }, 2000);
            
        } catch (error) {
            console.error('Popup: Error copying to clipboard:', error);
            setStatus('error', 'Failed to copy to clipboard');
        }
    }

    // Handle clear data
    async function handleClearData() {
        try {
            if (!confirm('Are you sure you want to clear all data?')) {
                return;
            }

            console.log('Popup: Clearing data...');
            setStatus('running', 'Clearing data...');
            
            const response = await sendMessageToBackground('clearData');
            
            if (response.success) {
                console.log('Popup: Data cleared successfully');
                elements.resultsTextarea.value = '';
                setStatus('success', 'Data cleared');
                await loadCurrentState();
            } else {
                console.error('Popup: Failed to clear data:', response.error);
                setStatus('error', `Failed to clear: ${response.error}`);
            }
            
        } catch (error) {
            console.error('Popup: Error clearing data:', error);
            setStatus('error', `Error: ${error.message}`);
        }
    }

    // Handle target count change
    function handleTargetCountChange() {
        const targetCount = parseInt(elements.targetCount.value);
        if (targetCount > 0) {
            const estimatedRefreshes = Math.ceil(targetCount / 1500);
            const estimatedTime = estimatedRefreshes * 3; // 3 seconds per refresh
            elements.targetCount.title = `Estimated: ${estimatedRefreshes} refreshes, ~${estimatedTime} seconds`;
        }
    }

    // Handle scraping updates from background
    function handleScrapingUpdate(type, data) {
        console.log('Popup: Received scraping update:', type, data);
        
        switch (type) {
            case 'progress':
                currentState.uniqueCount = data.uniqueCount;
                currentState.totalScraped = data.totalScraped;
                currentState.refreshCount = data.refreshCount;
                currentState.progress = data.progress;
                updateUI();
                setStatus('running', `Scraping... ${data.refreshCount} refreshes completed`);
                break;
                
            case 'completed':
                currentState.isRunning = false;
                elements.startBtn.disabled = false;
                elements.stopBtn.disabled = true;
                elements.targetCount.disabled = false;
                setStatus('success', data);
                
                // Debug auto-save conditions
                console.log('Scraping completed, checking auto-save conditions:');
                console.log('Auto-save enabled:', currentState.autoSave.enabled);
                console.log('Selected folders count:', currentState.autoSave.selectedFolders.length);
                console.log('Selected folders:', currentState.autoSave.selectedFolders);
                
                // Auto-save with automatic duplicate removal if enabled
                if (currentState.autoSave.enabled) {
                    console.log('Auto-save enabled, starting auto remove duplicates + save...');
                    setTimeout(() => handleAutoRemoveDuplicatesAndSave(), 1000);
                } else {
                    console.log('Auto-save skipped - not enabled');
                }
                
                loadCurrentState(); // Reload full state after auto-save
                break;
                
            case 'error':
                // Don't stop scraping for timeout errors, just show warning
                if (typeof data === 'string' && data.includes('timeout')) {
                    setStatus('error', `${data} - Extension will retry automatically`);
                } else {
                    currentState.isRunning = false;
                    elements.startBtn.disabled = false;
                    elements.stopBtn.disabled = true;
                    elements.targetCount.disabled = false;
                    setStatus('error', data);
                }
                break;
                
            case 'stopped':
                currentState.isRunning = false;
                elements.startBtn.disabled = false;
                elements.stopBtn.disabled = true;
                elements.targetCount.disabled = false;
                setStatus('success', data);
                break;

            case 'warning':
                // Handle auto duplicate removal start notifications
                if (typeof data === 'string' && data.includes('Auto-removing duplicates')) {
                    setStatus('running', data);
                    showDuplicateNotification('info', data);
                } else {
                    setStatus('warning', data);
                }
                break;

            case 'success':
                // Handle auto duplicate removal completion notifications
                if (typeof data === 'string' && (data.includes('Auto-removal complete') || data.includes('No duplicates found'))) {
                    showDuplicateNotification('success', data);
                    // Also reload current state to get updated counts
                    setTimeout(() => loadCurrentState(), 500);
                } else {
                    setStatus('success', data);
                }
                break;
        }
    }

    // Update UI with current state
    function updateUI() {
        try {
            // Update progress
            const progress = Math.min(currentState.progress || 0, 100);
            elements.progressFill.style.width = `${progress}%`;
            
            // Update progress text
            if (currentState.isRunning) {
                elements.progressText.textContent = 'Scraping in progress...';
                elements.statsText.textContent = `${currentState.uniqueCount} / ${currentState.targetCount}`;
            } else if (currentState.uniqueCount > 0) {
                elements.progressText.textContent = 'Scraping completed';
                elements.statsText.textContent = `${currentState.uniqueCount} collected`;
            } else {
                elements.progressText.textContent = 'Ready to start...';
                elements.statsText.textContent = '0 / 0';
            }
            
            // Update stats
            elements.uniqueCount.textContent = `Unique: ${currentState.uniqueCount}`;
            elements.totalCount.textContent = `Total: ${currentState.totalScraped}`;
            elements.refreshCount.textContent = `Refreshes: ${currentState.refreshCount}`;
            
            // Update buttons
            elements.startBtn.disabled = currentState.isRunning;
            elements.stopBtn.disabled = !currentState.isRunning;
            elements.targetCount.disabled = currentState.isRunning;
            elements.copyBtn.disabled = currentState.uniqueCount === 0;
            elements.checkDuplicatesBtn.disabled = currentState.uniqueCount === 0;
            
            // Update results
            if (currentState.userAgents && currentState.userAgents.length > 0) {
                elements.resultsTextarea.value = currentState.userAgents.join('\n');
            }
            
            // Auto-scroll results to bottom
            elements.resultsTextarea.scrollTop = elements.resultsTextarea.scrollHeight;
            
        } catch (error) {
            console.error('Popup: Error updating UI:', error);
        }
    }

    // Set status message
    function setStatus(type, message) {
        elements.statusText.textContent = message;
        elements.statusText.className = `status ${type}`;
    }

    // Send message to background script
    function sendMessageToBackground(action, data = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action, ...data }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Handle auto-save toggle
    function handleAutoSaveToggle() {
        console.log('Auto-save toggle clicked:', elements.autoSaveEnabled.checked);
        console.log('Current state:', currentState);
        
        // Ensure autoSave object exists
        if (!currentState.autoSave) {
            currentState.autoSave = {
                enabled: false,
                basePath: '',
                selectedFolders: [],
                directoryHandles: []
            };
        }
        
        currentState.autoSave.enabled = elements.autoSaveEnabled.checked;
        
        // Check if element exists before accessing style
        if (elements.savePathConfig) {
            elements.savePathConfig.style.display = currentState.autoSave.enabled ? 'block' : 'none';
            console.log('Set savePathConfig display to:', currentState.autoSave.enabled ? 'block' : 'none');
        } else {
            console.error('savePathConfig element not found!');
        }
        
        saveAutoSavePreferences();
    }


    // Handle automatic remove duplicates + auto-save (simplified for Downloads API)
    async function handleAutoRemoveDuplicatesAndSave() {
        try {
            console.log('Auto-save: Starting automatic duplicate removal + save process...');
            setStatus('running', 'Auto-removing duplicates before save...');
            
            // Step 1: Remove duplicates first
            const duplicateResponse = await sendMessageToBackground('removeDuplicates');
            
            if (duplicateResponse.success) {
                const { beforeCount, afterCount, removedCount } = duplicateResponse;
                console.log(`Auto-save: Removed ${removedCount} duplicates. ${afterCount} unique user agents remaining.`);
                
                // Update current state with new deduplicated count
                currentState.uniqueCount = afterCount;
                
                // Reload current state to get updated user agents array
                await loadCurrentState();
                
                // Show duplicate removal status
                if (removedCount > 0) {
                    setStatus('running', `Auto-removed ${removedCount} duplicates. Now saving clean data...`);
                    showDuplicateNotification('success', `✅ Auto-removed ${removedCount} duplicates before save.`);
                } else {
                    setStatus('running', 'No duplicates found. Proceeding with auto-save...');
                }
                
                // Step 2: Proceed with simplified auto-save using Downloads API
                await handleDownloadsAutoSave();
                
            } else {
                console.error('Auto-save: Failed to remove duplicates:', duplicateResponse.error);
                setStatus('error', `Auto-save failed: Could not remove duplicates - ${duplicateResponse.error}`);
                showDuplicateNotification('error', `❌ Auto-save failed: ${duplicateResponse.error}`);
            }
            
        } catch (error) {
            console.error('Auto-save: Error in automatic duplicate removal + save:', error);
            setStatus('error', `Auto-save failed: ${error.message}`);
            showDuplicateNotification('error', `❌ Auto-save failed: ${error.message}`);
        }
    }

    // Handle auto-save using Downloads API with multiple folder support
    async function handleDownloadsAutoSave() {
        try {
            console.log('Auto-save: Using Downloads API...');
            
            // Get user agents data
            let userAgentsArray = [];
            
            if (currentState.userAgents && Array.isArray(currentState.userAgents) && currentState.userAgents.length > 0) {
                userAgentsArray = currentState.userAgents;
            } else if (elements.resultsTextarea && elements.resultsTextarea.value.trim()) {
                userAgentsArray = elements.resultsTextarea.value.trim().split('\n').filter(ua => ua.trim());
            } else {
                console.error('No user agents found for auto-save');
                setStatus('error', 'No user agents to save');
                return;
            }

            const userAgentsText = userAgentsArray.join('\n');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

            // Get base path and subfolders
            const basePath = elements.savePath ? elements.savePath.value.trim() : '';
            const subfoldersInput = elements.subfolders ? elements.subfolders.value.trim() : '';
            
            // Parse subfolders
            const subfolders = subfoldersInput ? 
                subfoldersInput.split(',').map(name => name.trim()).filter(name => name) : [];

            if (subfolders.length > 0) {
                // Multiple folder saving
                console.log(`Auto-save: Saving to ${subfolders.length} subfolders`);
                setStatus('running', `Auto-saving ${userAgentsArray.length} user agents to ${subfolders.length} folders...`);

                let savedCount = 0;
                const downloadPromises = [];

                for (const subfolder of subfolders) {
                    try {
                        // Generate filename for this subfolder
                        let filename;
                        if (basePath) {
                            const basePathSafe = basePath.replace(/[\\/:*?"<>|]/g, '-');
                            const subfolderSafe = subfolder.replace(/[\\/:*?"<>|]/g, '-');
                            filename = `USER_AGENTS_${basePathSafe}-${subfolderSafe}_${timestamp}.txt`;
                        } else {
                            const subfolderSafe = subfolder.replace(/[\\/:*?"<>|]/g, '-');
                            filename = `USER_AGENTS_${subfolderSafe}_${timestamp}.txt`;
                        }

                        // Create blob and download URL
                        const blob = new Blob([userAgentsText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        
                        // Add download promise
                        const downloadPromise = chrome.downloads.download({
                            url: url,
                            filename: filename,
                            saveAs: false
                        }).then((downloadId) => {
                            // Clean up blob URL
                            URL.revokeObjectURL(url);
                            console.log(`Successfully saved: ${filename} (Download ID: ${downloadId})`);
                            savedCount++;
                            return { success: true, filename, subfolder };
                        }).catch((error) => {
                            URL.revokeObjectURL(url);
                            console.error(`Failed to save ${filename}:`, error);
                            return { success: false, filename, subfolder, error: error.message };
                        });

                        downloadPromises.push(downloadPromise);
                        
                    } catch (error) {
                        console.error(`Error preparing download for ${subfolder}:`, error);
                    }
                }

                // Wait for all downloads to complete
                const results = await Promise.all(downloadPromises);
                
                // Show results
                const successCount = results.filter(r => r.success).length;
                const failCount = results.length - successCount;
                
                if (successCount > 0) {
                    if (failCount === 0) {
                        setStatus('success', `Auto-saved ${userAgentsArray.length} user agents to ${successCount} folders in Downloads`);
                    } else {
                        setStatus('warning', `Auto-saved to ${successCount}/${results.length} folders. ${failCount} failed.`);
                    }
                } else {
                    setStatus('error', 'Auto-save failed: All folder saves failed');
                }
                
            } else {
                // Single file saving (original behavior)
                let filename;
                let statusMessage;

                if (basePath) {
                    const pathReference = basePath.replace(/[\\/:*?"<>|]/g, '-');
                    filename = `USER_AGENTS_${pathReference}_${timestamp}.txt`;
                    statusMessage = `Auto-saving ${userAgentsArray.length} user agents with path reference: ${basePath}`;
                } else {
                    filename = `USER_AGENTS_${timestamp}.txt`;
                    statusMessage = `Auto-saving ${userAgentsArray.length} user agents to Downloads folder`;
                }

                setStatus('running', statusMessage);

                // Create blob and download URL
                const blob = new Blob([userAgentsText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                
                // Trigger download
                const downloadResponse = await chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: false
                });
                
                // Clean up blob URL
                URL.revokeObjectURL(url);
                
                console.log(`Auto-save completed: Download ID ${downloadResponse}`);
                
                if (basePath) {
                    setStatus('success', `Auto-saved ${userAgentsArray.length} user agents to Downloads/${filename} (for ${basePath})`);
                } else {
                    setStatus('success', `Auto-saved ${userAgentsArray.length} user agents to Downloads/${filename}`);
                }
            }
            
        } catch (error) {
            console.error('Auto-save: Downloads API error:', error);
            setStatus('error', `Auto-save failed: ${error.message}`);
        }
    }


    // Save auto-save preferences (with multiple folder support)
    async function saveAutoSavePreferences() {
        try {
            const userPath = elements.savePath ? elements.savePath.value.trim() : '';
            const subfolders = elements.subfolders ? elements.subfolders.value.trim() : '';
            await chrome.storage.local.set({
                autoSaveEnabled: currentState.autoSave.enabled,
                autoSavePath: userPath,
                autoSaveSubfolders: subfolders
            });
            console.log('Popup: Auto-save preferences saved (path + subfolders)');
        } catch (error) {
            console.error('Popup: Error saving auto-save preferences:', error);
        }
    }

    // Load auto-save preferences on init (with multiple folder support)
    async function loadAutoSavePreferences() {
        try {
            const result = await chrome.storage.local.get([
                'autoSaveEnabled',
                'autoSavePath',
                'autoSaveSubfolders'
            ]);
            
            if (result.autoSaveEnabled) {
                currentState.autoSave.enabled = result.autoSaveEnabled;
                elements.autoSaveEnabled.checked = true;
                elements.savePathConfig.style.display = 'block';
            }
            
            if (result.autoSavePath && elements.savePath) {
                elements.savePath.value = result.autoSavePath;
                console.log('Popup: Restored save path from storage:', result.autoSavePath);
            }
            
            if (result.autoSaveSubfolders && elements.subfolders) {
                elements.subfolders.value = result.autoSaveSubfolders;
                console.log('Popup: Restored subfolders from storage:', result.autoSaveSubfolders);
            }
        } catch (error) {
            console.error('Popup: Error loading auto-save preferences:', error);
        }
    }

    // Tab mode helper functions
    function getSelectedTabMode() {
        if (elements.singleTabMode.checked) return 'single';
        if (elements.dualTabMode.checked) return 'dual';
        if (elements.quadTabMode.checked) return 'quad';
        return 'single'; // default
    }

    function getStartingMessage(tabMode) {
        switch (tabMode) {
            case 'dual':
                return 'Starting dual tab scraping (2x faster)...';
            case 'quad':
                return 'Starting quad tab scraping (4x faster)...';
            default:
                return 'Starting single tab scraping...';
        }
    }

    function handleTabModeChange() {
        const tabMode = getSelectedTabMode();
        updateTabModeDescription(tabMode);
    }

    function updateTabModeDescription(tabMode) {
        const descriptions = {
            single: 'Standard single tab scraping. Reliable and stable.',
            dual: 'Uses 2 tabs simultaneously for 2x faster scraping. Recommended for targets > 5000.',
            quad: 'Uses 4 tabs simultaneously for 4x faster scraping. Recommended for targets > 10000. High performance mode.'
        };

        if (elements.tabModeDescription) {
            elements.tabModeDescription.textContent = descriptions[tabMode] || descriptions.single;
        }
    }

    // Handle validate paths - check if folders exist
    async function handleValidatePaths() {
        try {
            console.log('Validate paths clicked');
            
            // Get base path and subfolders
            const basePath = elements.savePath ? elements.savePath.value.trim() : '';
            const subfoldersInput = elements.subfolders ? elements.subfolders.value.trim() : '';
            
            // Validate inputs
            if (!basePath) {
                showValidationResult('error', 'Please enter a base path first');
                setStatus('error', 'Base path is required');
                return;
            }
            
            if (!subfoldersInput) {
                showValidationResult('error', 'Please enter subfolder names');
                setStatus('error', 'Subfolders are required');
                return;
            }
            
            // Parse subfolders
            const subfolders = subfoldersInput.split(',').map(name => name.trim()).filter(name => name);
            if (subfolders.length === 0) {
                showValidationResult('error', 'No valid subfolder names found');
                setStatus('error', 'Invalid subfolder format');
                return;
            }
            
            console.log('Validating paths:', { basePath, subfolders });
            setStatus('running', `Validating ${subfolders.length} folders...`);
            showValidationResult('info', `Checking ${subfolders.length} folders...`);
            
            // Send validation request to background script
            const response = await sendMessageToBackground('validateFolders', {
                basePath: basePath,
                subfolders: subfolders
            });
            
            if (response.success) {
                const { validFolders, invalidFolders, results } = response;
                
                if (validFolders.length === subfolders.length) {
                    // All folders exist
                    showValidationResult('success', `✅ All ${validFolders.length} folders exist and are accessible`);
                    setStatus('success', `Validated ${validFolders.length} folders successfully`);
                    
                    // Store validated folders for auto-save
                    currentState.autoSave.selectedFolders = validFolders.map(folder => `${basePath}\\${folder}`);
                    
                } else if (validFolders.length > 0) {
                    // Some folders exist
                    const message = `⚠️ Found ${validFolders.length}/${subfolders.length} folders. Missing: ${invalidFolders.join(', ')}`;
                    showValidationResult('warning', message);
                    setStatus('warning', `${validFolders.length} folders found, ${invalidFolders.length} missing`);
                    
                    // Store only valid folders
                    currentState.autoSave.selectedFolders = validFolders.map(folder => `${basePath}\\${folder}`);
                    
                } else {
                    // No folders exist
                    showValidationResult('error', `❌ No folders found. Missing: ${invalidFolders.join(', ')}`);
                    setStatus('error', 'No valid folders found');
                    currentState.autoSave.selectedFolders = [];
                }
                
                // Save updated preferences
                await saveAutoSavePreferences();
                
            } else {
                console.error('Validation failed:', response.error);
                showValidationResult('error', `Validation failed: ${response.error}`);
                setStatus('error', 'Folder validation failed');
            }
            
        } catch (error) {
            console.error('Error validating paths:', error);
            showValidationResult('error', `Error: ${error.message}`);
            setStatus('error', 'Validation error occurred');
        }
    }
    
    // Show validation result with styling
    function showValidationResult(type, message) {
        if (!elements.validationResult) return;
        
        // Clear previous classes
        elements.validationResult.className = 'validation-result';
        
        if (type && message) {
            elements.validationResult.className += ` validation-${type}`;
            elements.validationResult.textContent = message;
            elements.validationResult.style.display = 'block';
        } else {
            elements.validationResult.textContent = '';
            elements.validationResult.style.display = 'none';
        }
    }

    // Initialize tab mode description on load
    updateTabModeDescription('single');

    addDebugLog('success', 'Extension initialization complete');
});
