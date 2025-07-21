# 📦 Installation Guide - User Agent Scraper Extension

## Quick Start

### 1. Download Extension
- Download semua file extension ke folder lokal
- Pastikan semua file ada: `manifest.json`, `popup.html`, `popup.js`, `styles.css`, `content.js`, `background.js`

### 2. Install ke Chrome

1. **Buka Chrome Extensions**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Klik toggle "Developer mode" di pojok kanan atas
   - Pastikan status ON (biru)

3. **Load Extension**
   - Klik tombol "Load unpacked"
   - Browse dan pilih folder extension
   - Klik "Select Folder"

4. **Verify Installation**
   - Extension muncul di daftar extensions
   - Icon extension muncul di toolbar Chrome
   - Status harus "Enabled"

### 3. Permissions Setup
Extension akan otomatis meminta permissions:
- ✅ **Read and change data on useragents.io**
- ✅ **Access your tabs and browsing activity**
- ✅ **Store data locally**

Klik **"Allow"** untuk semua permissions.

### 4. First Run Test

1. **Klik extension icon** di toolbar
2. **Set target** kecil dulu (contoh: 500)
3. **Klik "Start Scraping"**
4. **Monitor progress** - extension akan:
   - Buka tab baru useragents.io
   - Mulai scraping otomatis
   - Update progress real-time
5. **Wait for completion**
6. **Test "Copy All"** button

## 🔧 Troubleshooting

### Extension Tidak Muncul?
```bash
# Check browser console (F12)
# Look for error messages
```

**Solutions:**
- Reload extension: klik ↻ pada extension card
- Check file permissions: pastikan folder readable
- Verify all files: pastikan semua file ada

### Permission Denied?
- Klik extension → "Details" → "Site access" → "On all sites"
- Atau manual add: "https://useragents.io/*"

### Scraping Tidak Start?
1. **Check network**: pastikan useragents.io accessible
2. **Clear data**: klik "Clear" button
3. **Restart Chrome**: tutup dan buka ulang
4. **Reload extension**: di chrome://extensions/

### Tab Tertutup Otomatis?
- Normal behavior jika ada error
- Check console log untuk error details
- Pastikan target tidak terlalu besar untuk test

## 🎯 Usage Tips

### First Time Users
1. **Start small**: Test dengan 500-1000 user agents dulu
2. **Watch console**: Buka DevTools untuk monitor
3. **Don't close tabs**: Biarkan extension bekerja
4. **Be patient**: Large targets butuh waktu

### Production Usage
1. **Optimal targets**: 5,000 - 20,000 user agents
2. **Monitor memory**: Large datasets consume RAM
3. **Copy frequently**: Save results periodically
4. **Clear when done**: Clear data setelah selesai

## 📊 Performance Guide

### Target Recommendations
- **Light usage**: 1,000 - 5,000 UA (~2-10 minutes)
- **Medium usage**: 5,000 - 20,000 UA (~10-40 minutes)  
- **Heavy usage**: 20,000+ UA (~40+ minutes)

### System Requirements
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: ~1MB per 10,000 user agents
- **Network**: Stable internet connection
- **Chrome**: Version 88+ (Manifest V3 support)

## 🚫 Common Issues

### Issue: "Extension is not loading"
**Solution:**
1. Check manifest.json syntax
2. Verify all file paths
3. Reload extension
4. Check Chrome version

### Issue: "Scraping stops randomly"
**Causes:**
- Network timeout
- Memory overflow
- Tab closed manually
- Rate limiting from site

**Solutions:**
- Reduce target count
- Check internet connection
- Don't interact with scraping tab
- Wait a bit before restart

### Issue: "No data extracted"
**Causes:**
- Site structure changed
- AdBlocker interference
- JavaScript disabled
- Wrong URL

**Solutions:**
- Check useragents.io manually
- Disable adblockers temporarily
- Enable JavaScript
- Verify URL accessibility

## 🔄 Updates & Maintenance

### Manual Updates
1. Download new files
2. Replace old files
3. Reload extension
4. Test functionality

### Development Mode
- Keep Developer Mode ON
- Check console regularly
- Report bugs if found
- Suggest improvements

## 📞 Support

### Debug Information
Jika ada masalah, collect info berikut:
- Chrome version
- Extension version
- Target count yang digunakan
- Error messages (console)
- Steps to reproduce

### Self-Help
1. **Read error messages** carefully
2. **Check network connection**
3. **Try smaller targets** first
4. **Clear browser cache** if needed
5. **Restart Chrome** completely

## 🏁 Ready to Go!

Extension siap digunakan setelah installation berhasil.
Test dengan target kecil dulu, kemudian scale up sesuai kebutuhan.

Happy scraping! 🕷️