# 🔧 Troubleshooting Guide - User Agent Scraper

## Debug Mode

### Enable Console Logging
1. Buka Chrome DevTools (F12)
2. Go to Console tab
3. Refresh extension atau reload page
4. Monitor log messages yang dimulai dengan "User Agent Scraper:"

### Key Log Messages
- `Content script loaded` - Content script berhasil inject
- `DOM Content Loaded` - Page ready untuk scraping
- `Table loaded with X rows` - Table data terdeteksi
- `Starting extraction...` - Proses extract dimulai
- `Extracted X UAs` - Data berhasil di-extract

## Common Issues & Solutions

### 1. Extension Tidak Start
**Symptoms:**
- Tombol "Start" tidak respond
- No log messages in console

**Solutions:**
```bash
# Check extension permissions
1. Go to chrome://extensions/
2. Click extension details
3. Verify permissions granted
4. Try reload extension
```

### 2. Scraping Tidak Extract Data
**Symptoms:**
- Progress bar tidak bergerak
- Console shows "Table not found"
- Results textarea kosong

**Solutions:**
1. **Check URL**: Pastikan di https://useragents.io/random?limit=1500
2. **Manual test**: Buka URL manual, pastikan table muncul
3. **Check console**: Look for extraction errors
4. **Reload page**: Refresh manual dan coba lagi

### 3. Tab Navigation Issues
**Symptoms:**
- Extension buka tab baru alih-alih use current tab
- Tab tertutup otomatis

**Current Fix:**
Extension sekarang menggunakan current active tab, bukan membuat tab baru.

### 4. Refresh Tidak Berfungsi
**Symptoms:**
- Stuck di satu halaman
- Progress tidak continue

**Debug Steps:**
```javascript
// Check in console:
// 1. Background script logs
// 2. Content script logs
// 3. Tab refresh logs
```

**Solutions:**
1. **Manual refresh**: Refresh page manual untuk test
2. **Check network**: Pastikan internet connection stabil
3. **Check console**: Look for refresh errors

### 5. Popup Tidak Muncul
**Symptoms:**
- Extension icon tidak show popup
- Popup crashes atau blank

**Solutions:**
1. **Reload extension**: Di chrome://extensions/
2. **Check manifest**: Verify popup.html path correct
3. **Check console**: Look for popup errors
4. **Clear storage**: Reset extension data

## Debugging Commands

### Check Extension State
```javascript
// In popup console:
chrome.runtime.sendMessage({action: 'getScrapingState'}, (response) => {
    console.log('Current state:', response);
});
```

### Test Content Script
```javascript
// In page console (useragents.io):
// Check if content script loaded
console.log('Content script status:', window.userAgentScraperInjected);

// Test extraction manually
chrome.runtime.sendMessage({action: 'extractUserAgents'}, (response) => {
    console.log('Extraction result:', response);
});
```

### Test Page Ready
```javascript
// In page console:
chrome.runtime.sendMessage({action: 'checkPageReady'}, (response) => {
    console.log('Page ready status:', response);
});
```

## Performance Issues

### Slow Scraping
**Causes:**
- Network latency
- Large target numbers
- Browser resource limits

**Solutions:**
1. **Reduce target**: Start with smaller numbers
2. **Close other tabs**: Free up browser resources
3. **Check network**: Ensure stable connection

### Memory Issues
**Symptoms:**
- Browser becomes slow
- Extension crashes
- Tab becomes unresponsive

**Solutions:**
1. **Lower target**: Reduce user agent count
2. **Clear data**: Use "Clear" button regularly
3. **Restart browser**: Close and reopen Chrome

## Site-Specific Issues

### useragents.io Changes
**If site structure changes:**
1. **Check selectors**: Table might use different classes
2. **Update content.js**: Modify extraction logic
3. **Test manually**: Verify site still works

### Rate Limiting
**Symptoms:**
- Requests getting blocked
- 429 errors in network tab

**Solutions:**
1. **Slower requests**: Add delays (though extension optimized for speed)
2. **Different approach**: Use different extraction method
3. **Contact site**: Check if API available

## Manual Testing

### Step-by-Step Test
1. **Install extension**
2. **Go to useragents.io manually**
3. **Open extension popup**
4. **Set target to 100** (small test)
5. **Click Start**
6. **Monitor console logs**
7. **Check if data appears**

### Verification
1. **Count results**: Verify number matches target
2. **Check duplicates**: Use "Check Duplicates" button
3. **Test copy**: Try copy to clipboard
4. **Test clear**: Verify clear functionality

## Getting Help

### Information to Provide
When reporting issues, include:
1. **Chrome version**
2. **Extension version**
3. **Console error messages**
4. **Steps to reproduce**
5. **Expected vs actual behavior**

### Console Export
```javascript
// Export console logs:
console.save = function(data, filename) {
    const blob = new Blob([data], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'console.txt';
    a.click();
};

// Usage:
console.save(JSON.stringify(consoleHistory), 'extension-logs.txt');
```

## Recovery Actions

### Reset Extension
1. Stop current scraping
2. Clear all data
3. Reload extension
4. Restart with small target

### Emergency Reset
1. Disable extension
2. Re-enable extension
3. Clear browser cache
4. Restart browser if needed

## Success Indicators

### Extension Working Properly
✅ Console shows regular extraction logs  
✅ Progress bar moves consistently  
✅ Results appear in textarea  
✅ Target eventually reached  
✅ Copy function works  
✅ No console errors  

### Healthy Scraping Session
- Regular refresh cycles
- Increasing unique count
- No error messages
- Stable memory usage
- Consistent extraction rate