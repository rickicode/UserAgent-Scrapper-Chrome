# 📦 Chrome Extension Packing Guide
## User Agent Scraper v1.0.0

### 🎯 Cara Pack Extension Chrome

#### Metode 1: Menggunakan Script Otomatis (Recommended)
```bash
./pack-extension.sh
```

Script ini akan:
- ✅ Membuat folder `dist/` yang bersih
- ✅ Copy semua file yang diperlukan
- ✅ Generate archive `user-agent-scraper-v1.0.0.tar.gz`

#### Metode 2: Manual Pack via Chrome Developer Tools

1. **Buka Chrome Extensions**
   - Ketik `chrome://extensions/` di address bar
   - Atau Menu > More Tools > Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" di pojok kanan atas

3. **Load Extension**
   - Klik "Load unpacked"
   - Pilih folder `dist/` (bukan root folder)

4. **Pack Extension (Optional)**
   - Klik "Pack extension"
   - Root directory: pilih folder `dist/`
   - Chrome akan generate file `.crx` dan `.pem`

#### Metode 3: Manual Pack untuk Chrome Web Store

1. **Siapkan Files**
   ```bash
   # Buat zip file dari folder dist
   cd dist
   zip -r ../user-agent-scraper-store.zip .
   ```

2. **Upload ke Chrome Web Store**
   - Login ke [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Upload file zip
   - Isi metadata dan publish

### 📁 File Structure Extension

```
user-agent-scraper/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── content.js            # Content script for useragents.io
├── popup.html            # Side panel HTML
├── popup.js              # Side panel JavaScript
├── styles.css            # Styling
├── icon.png              # Extension icon
└── README.md             # Documentation
```

### 🔧 Testing Extension

1. **Load di Chrome**
   - Load unpacked dari folder `dist/`
   - Check di Extensions page: extension harus aktif

2. **Test Functionality**
   - Buka https://useragents.io/
   - Klik extension icon untuk buka side panel
   - Test scraping functionality

3. **Check Console**
   - F12 > Console untuk check errors
   - Background page console: chrome://extensions > Details > background page

### 🚀 Distribution Options

#### Option A: Direct Install
- Share folder `dist/` atau file `user-agent-scraper-v1.0.0.tar.gz`
- User load unpacked di Chrome

#### Option B: Chrome Web Store
- Upload zip ke Chrome Web Store
- Review process ~3-7 hari
- Public distribution

#### Option C: Enterprise Distribution
- Pack as `.crx` file
- Deploy via Group Policy
- Internal company distribution

### 🛠️ Troubleshooting

#### "Package is invalid"
- Check `manifest.json` syntax
- Pastikan semua file referenced ada
- Icon file harus valid PNG/JPG

#### "Manifest version not supported"
- Extension menggunakan Manifest v3 (latest)
- Compatible dengan Chrome 88+

#### Extension tidak muncul
- Check Developer mode enabled
- Reload extension di Extensions page
- Check console untuk errors

### 📋 Checklist Pre-Distribution

- [ ] Extension tested dan working
- [ ] All permissions necessary (tidak berlebihan)
- [ ] Icon tersedia dalam ukuran 16px, 48px, 128px
- [ ] Manifest.json valid
- [ ] No console errors
- [ ] README.md up to date
- [ ] Version number consistent

### 🔐 Security Notes

- Extension meminta permission:
  - `tabs` - untuk access tab info
  - `activeTab` - untuk interact dengan current tab
  - `storage` - untuk save scraped data
  - `scripting` - untuk inject content script
  - `sidePanel` - untuk side panel UI
  - `downloads` - untuk export data
  - Host permission: `https://useragents.io/*`

- Semua permissions justified untuk functionality
- No broad permissions yang tidak perlu

### 📞 Support

Jika ada issues:
1. Check TROUBLESHOOTING.md
2. Verify Chrome version compatibility
3. Test di Incognito mode
4. Check extension console logs
