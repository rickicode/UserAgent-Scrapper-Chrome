// Popup script untuk User Agent Scraper Extension
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup: Script loaded');
    
    // Get DOM elements
    const elements = {
        targetCount: document.getElementById('targetCount'),
        filterAndroid: document.getElementById('filterAndroid'),
        filterWindows: document.getElementById('filterWindows'),
        filterIOS: document.getElementById('filterIOS'),
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
        basePath: document.getElementById('basePath'),
        subfolders: document.getElementById('subfolders'),
        selectBaseBtn: document.getElementById('selectBaseBtn'),
        validatePathsBtn: document.getElementById('validatePathsBtn'),
        validationResult: document.getElementById('validationResult'),
        folderList: document.getElementById('folderList')
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
            windows: true,
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
    elements.checkDuplicatesBtn.addEventListener('click', handleCheckDuplicates);
    elements.copyBtn.addEventListener('click', handleCopyResults);
    elements.clearBtn.addEventListener('click', handleClearData);
    elements.targetCount.addEventListener('input', handleTargetCountChange);
    elements.autoSaveEnabled.addEventListener('change', handleAutoSaveToggle);
    elements.selectBaseBtn.addEventListener('click', handleSelectBaseDirectory);
    elements.validatePathsBtn.addEventListener('click', handleValidatePaths);
    
    // Event delegation for remove buttons (fix delete button issue)
    elements.folderList.addEventListener('click', handleFolderListClick);

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
            
            // Validate critical elements exist
            const requiredElements = ['autoSaveEnabled', 'savePathConfig', 'basePath', 'subfolders', 'validatePathsBtn', 'validationResult', 'folderList'];
            const missing = requiredElements.filter(id => !document.getElementById(id));
            
            if (missing.length > 0) {
                console.error('Missing elements:', missing);
            }
            
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

            console.log('Popup: Starting scraping with target:', targetCount, 'filters:', filters);
            setStatus('running', 'Starting scraping...');
            
            const response = await sendMessageToBackground('startScraping', {
                targetCount,
                filters
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

    // Handle check duplicates
    async function handleCheckDuplicates() {
        try {
            console.log('Popup: Checking duplicates...');
            setStatus('running', 'Checking duplicates...');
            
            const response = await sendMessageToBackground('checkDuplicates');
            
            if (response.success) {
                const { duplicateCount, uniqueCount, totalCount } = response;
                
                if (duplicateCount === 0) {
                    setStatus('success', `No duplicates found. All ${uniqueCount} user agents are unique.`);
                } else {
                    setStatus('success', `Found ${duplicateCount} duplicates. ${uniqueCount} unique out of ${totalCount} total.`);
                }
                
                // Show alert dengan detail
                alert(`Duplicate Check Results:\n\nTotal User Agents: ${totalCount}\nUnique User Agents: ${uniqueCount}\nDuplicates Found: ${duplicateCount}`);
                
            } else {
                console.error('Popup: Failed to check duplicates:', response.error);
                setStatus('error', `Failed to check: ${response.error}`);
            }
            
        } catch (error) {
            console.error('Popup: Error checking duplicates:', error);
            setStatus('error', `Error: ${error.message}`);
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
                
                // Auto-save if enabled
                if (currentState.autoSave.enabled && currentState.autoSave.selectedFolders.length > 0) {
                    console.log('Triggering auto-save...');
                    setTimeout(() => handleMultipleAutoSave(), 1000);
                } else {
                    console.log('Auto-save skipped - conditions not met');
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

    // Handle select base directory
    async function handleSelectBaseDirectory() {
        try {
            console.log('Select base directory clicked');
            
            // Check if File System Access API is supported
            if (!('showDirectoryPicker' in window)) {
                showValidationResult('error', 'File System Access API not supported in this browser');
                setStatus('error', 'Please use Chrome 86+ for auto-save feature');
                return;
            }
            
            // Clear previous validation result
            showValidationResult('', '');
            setStatus('running', 'Please select base directory in the dialog...');
            
            try {
                // Show directory picker to select base directory
                const baseDirectoryHandle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                    multiple: false
                });
                
                // Store the base directory handle and update UI
                currentState.autoSave.baseDirectoryHandle = baseDirectoryHandle;
                currentState.autoSave.basePath = baseDirectoryHandle.name;
                elements.basePath.value = baseDirectoryHandle.name;
                
                setStatus('success', `Base directory selected: ${baseDirectoryHandle.name}`);
                showValidationResult('success', `✓ Base directory selected: ${baseDirectoryHandle.name}`);
                
                // Clear previous subfolder configurations
                currentState.autoSave.selectedFolders = [];
                currentState.autoSave.directoryHandles = [];
                updateFolderList();
                
                // Save preferences
                await saveAutoSavePreferences();
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    showValidationResult('info', 'Base directory selection cancelled');
                    setStatus('ready', 'Base directory selection cancelled');
                } else {
                    throw error;
                }
            }
            
        } catch (error) {
            console.error('Popup: Error selecting base directory:', error);
            showValidationResult('error', `Selection failed: ${error.message}`);
            setStatus('error', 'Failed to select base directory');
        }
    }

    // Handle validate paths - new system with base + subfolders
    async function handleValidatePaths() {
        try {
            console.log('Validate paths clicked');
            
            // Check if File System Access API is supported
            if (!('showDirectoryPicker' in window)) {
                showValidationResult('error', 'File System Access API not supported in this browser');
                setStatus('error', 'Please use Chrome 86+ for auto-save feature');
                return;
            }
            
            // Check if base directory is selected
            if (!currentState.autoSave.baseDirectoryHandle) {
                showValidationResult('error', 'Please select base directory first');
                setStatus('error', 'No base directory selected');
                return;
            }
            
            // Get subfolder names from input
            const subfolderInput = elements.subfolders.value.trim();
            if (!subfolderInput) {
                showValidationResult('error', 'Please enter subfolder names');
                setStatus('error', 'No subfolder names provided');
                return;
            }
            
            // Parse subfolder names
            const subfolderNames = subfolderInput.split(',').map(name => name.trim()).filter(name => name);
            if (subfolderNames.length === 0) {
                showValidationResult('error', 'No valid subfolder names found');
                setStatus('error', 'Invalid subfolder names');
                return;
            }
            
            console.log('Validating subfolders:', subfolderNames);
            setStatus('running', `Validating ${subfolderNames.length} subfolders...`);
            
            // Clear previous results
            currentState.autoSave.selectedFolders = [];
            currentState.autoSave.directoryHandles = [];
            
            let validCount = 0;
            let invalidFolders = [];
            
            // Check each subfolder
            for (const subfolderName of subfolderNames) {
                try {
                    // Try to get subfolder handle
                    const subfolderHandle = await currentState.autoSave.baseDirectoryHandle.getDirectoryHandle(subfolderName);
                    
                    // If successful, add to valid list
                    currentState.autoSave.directoryHandles.push(subfolderHandle);
                    currentState.autoSave.selectedFolders.push(`${currentState.autoSave.basePath}\\${subfolderName}`);
                    validCount++;
                    
                } catch (error) {
                    console.warn(`Subfolder '${subfolderName}' not found:`, error);
                    invalidFolders.push(subfolderName);
                }
            }
            
            // Show results
            if (validCount > 0) {
                const message = `✓ Found ${validCount}/${subfolderNames.length} subfolders`;
                const details = invalidFolders.length > 0 ? 
                    `${message}. Missing: ${invalidFolders.join(', ')}` : message;
                
                showValidationResult(
                    invalidFolders.length > 0 ? 'warning' : 'success',
                    details
                );
                
                setStatus('success', `Validated ${validCount} subfolder(s)`);
                
                // Update folder list and save preferences
                updateFolderList();
                await saveAutoSavePreferences();
                
            } else {
                showValidationResult('error', `No valid subfolders found. Missing: ${invalidFolders.join(', ')}`);
                setStatus('error', 'No valid subfolders found');
            }
            
        } catch (error) {
            console.error('Popup: Error validating paths:', error);
            showValidationResult('error', `Validation failed: ${error.message}`);
            setStatus('error', 'Failed to validate paths');
        }
    }
    
    // Show validation result
    function showValidationResult(type, message) {
        if (!elements.validationResult) return;
        
        // Clear previous classes
        elements.validationResult.className = 'validation-result';
        
        if (type && message) {
            elements.validationResult.className += ` validation-${type}`;
            elements.validationResult.textContent = message;
        } else {
            elements.validationResult.textContent = '';
        }
    }

    // Handle folder list clicks (event delegation for remove buttons)
    function handleFolderListClick(event) {
        try {
            if (event.target.classList.contains('remove-folder')) {
                const folderItem = event.target.closest('.folder-item');
                if (folderItem) {
                    const index = Array.from(folderItem.parentNode.children).indexOf(folderItem);
                    removeFolder(index);
                }
            }
        } catch (error) {
            console.error('Popup: Error handling folder list click:', error);
        }
    }

    // Update folder list display (now without inline onclick)
    function updateFolderList() {
        try {
            console.log('Updating folder list');
            
            // Ensure elements exist
            if (!elements.folderList) {
                console.error('folderList element not found');
                return;
            }
            
            // Ensure autoSave object exists
            if (!currentState.autoSave) {
                currentState.autoSave = {
                    enabled: false,
                    basePath: '',
                    selectedFolders: [],
                    directoryHandles: []
                };
            }
            
            const folderList = elements.folderList;
            
            if (!currentState.autoSave.selectedFolders || currentState.autoSave.selectedFolders.length === 0) {
                folderList.innerHTML = '<div class="empty-folder-list">No folders selected</div>';
                return;
            }

            // Use event delegation instead of inline onclick
            folderList.innerHTML = currentState.autoSave.selectedFolders.map((folder, index) => `
                <div class="folder-item" data-index="${index}">
                    <span class="folder-path">${folder}\\USER_AGENTS.TXT</span>
                    <button class="remove-folder" type="button">×</button>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Popup: Error updating folder list:', error);
        }
    }

    // Remove folder from list
    function removeFolder(index) {
        try {
            console.log('Removing folder at index:', index);
            
            // Remove from both arrays
            if (currentState.autoSave.selectedFolders && currentState.autoSave.selectedFolders.length > index) {
                currentState.autoSave.selectedFolders.splice(index, 1);
            }
            if (currentState.autoSave.directoryHandles && currentState.autoSave.directoryHandles.length > index) {
                currentState.autoSave.directoryHandles.splice(index, 1);
            }
            
            updateFolderList();
            saveAutoSavePreferences();
            setStatus('success', 'Directory removed');
            
        } catch (error) {
            console.error('Popup: Error removing folder:', error);
            setStatus('error', 'Failed to remove directory');
        }
    }

    // Handle multiple auto-save using File System Access API
    async function handleMultipleAutoSave() {
        try {
            console.log('Auto-save function called');
            console.log('Current state userAgents:', currentState.userAgents);
            console.log('Results textarea value:', elements.resultsTextarea.value);
            
            // Check if File System Access API is supported
            if (!('showDirectoryPicker' in window)) {
                console.error('File System Access API not supported');
                setStatus('error', 'Auto-save requires Chrome 86+');
                return;
            }
            
            // Try to get user agents from multiple sources
            let userAgentsArray = [];
            
            if (currentState.userAgents && Array.isArray(currentState.userAgents) && currentState.userAgents.length > 0) {
                userAgentsArray = currentState.userAgents;
            } else if (elements.resultsTextarea && elements.resultsTextarea.value.trim()) {
                // Fallback to textarea content
                userAgentsArray = elements.resultsTextarea.value.trim().split('\n').filter(ua => ua.trim());
            } else {
                console.error('No user agents found in any source');
                setStatus('error', 'No user agents to save');
                return;
            }

            console.log('User agents to save:', userAgentsArray.length);

            // Check if we have directory handles
            if (!currentState.autoSave.directoryHandles || currentState.autoSave.directoryHandles.length === 0) {
                console.error('No directory handles available');
                setStatus('error', 'No save directories configured. Please select directories first.');
                return;
            }

            console.log('Popup: Auto-saving to multiple directories...');
            setStatus('running', `Auto-saving to ${currentState.autoSave.directoryHandles.length} directories...`);

            const userAgentsText = userAgentsArray.join('\n');
            let savedCount = 0;
            let errors = [];

            // Save to each configured directory
            for (let i = 0; i < currentState.autoSave.directoryHandles.length; i++) {
                const directoryHandle = currentState.autoSave.directoryHandles[i];
                const folderName = currentState.autoSave.selectedFolders[i];
                
                try {
                    console.log(`Saving to directory: ${folderName}`);
                    
                    // Request permission to write to the directory
                    const permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
                    if (permission !== 'granted') {
                        throw new Error('Permission denied to write to directory');
                    }
                    
                    // Create or get the file handle for USER_AGENTS.txt
                    const fileHandle = await directoryHandle.getFileHandle('USER_AGENTS.txt', {
                        create: true
                    });
                    
                    // Create a writable stream
                    const writableStream = await fileHandle.createWritable();
                    
                    // Write the user agents data
                    await writableStream.write(userAgentsText);
                    
                    // Close the stream
                    await writableStream.close();
                    
                    savedCount++;
                    console.log(`Successfully saved to: ${folderName}`);

                } catch (error) {
                    console.error(`Error saving to ${folderName}:`, error);
                    errors.push(`${folderName}: ${error.message}`);
                }
            }

            // Show result
            if (savedCount > 0) {
                const message = `Successfully saved ${userAgentsArray.length} user agents to ${savedCount}/${currentState.autoSave.directoryHandles.length} directories`;
                setStatus('success', message);
                console.log(`Auto-save completed: ${userAgentsArray.length} user agents saved to ${savedCount} directories`);
                
                if (errors.length > 0) {
                    console.warn('Some saves failed:', errors);
                    setStatus('warning', `Saved to ${savedCount} directories. ${errors.length} failed.`);
                }
            } else {
                setStatus('error', 'All saves failed');
                console.error('Auto-save failed for all directories');
                
                // Show detailed error information
                if (errors.length > 0) {
                    console.error('Detailed errors:', errors);
                }
            }

        } catch (error) {
            console.error('Popup: Error in multiple auto-save:', error);
            setStatus('error', `Auto-save error: ${error.message}`);
        }
    }

    // Save auto-save preferences
    async function saveAutoSavePreferences() {
        try {
            await chrome.storage.local.set({
                autoSaveEnabled: currentState.autoSave.enabled,
                autoSaveBasePath: currentState.autoSave.basePath,
                autoSaveSelectedFolders: currentState.autoSave.selectedFolders
            });
        } catch (error) {
            console.error('Popup: Error saving auto-save preferences:', error);
        }
    }

    // Load auto-save preferences on init
    async function loadAutoSavePreferences() {
        try {
            const result = await chrome.storage.local.get([
                'autoSaveEnabled',
                'autoSaveBasePath',
                'autoSaveSelectedFolders'
            ]);
            
            if (result.autoSaveEnabled) {
                currentState.autoSave.enabled = result.autoSaveEnabled;
                elements.autoSaveEnabled.checked = true;
                elements.savePathConfig.style.display = 'block';
            }
            
            if (result.autoSaveBasePath) {
                currentState.autoSave.basePath = result.autoSaveBasePath;
                if (elements.basePath) {
                    elements.basePath.value = result.autoSaveBasePath;
                }
            }

            if (result.autoSaveSelectedFolders && result.autoSaveSelectedFolders.length > 0) {
                currentState.autoSave.selectedFolders = result.autoSaveSelectedFolders;
                
                // Extract subfolders from full paths and populate input
                if (result.autoSaveBasePath && elements.subfolders) {
                    const subfolders = result.autoSaveSelectedFolders.map(fullPath => {
                        return fullPath.replace(result.autoSaveBasePath + '\\', '');
                    });
                    elements.subfolders.value = subfolders.join(', ');
                }
                
                updateFolderList();
            }
        } catch (error) {
            console.error('Popup: Error loading auto-save preferences:', error);
        }
    }

    console.log('Popup: Script initialization complete');
});
