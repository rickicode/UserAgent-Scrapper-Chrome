# User Agent Scraper Chrome Extension

Chrome extension untuk scraping user agents dari [useragents.io](https://useragents.io/random?limit=1500) dengan fitur auto-refresh dan deduplication.

## 🚀 Fitur

- **Auto Scraping**: Otomatis membuka tab useragents.io dan scraping data
- **Target Fleksibel**: Set target jumlah user agents (100 - 100,000)
- **Fast Auto Refresh**: Refresh otomatis secepat mungkin untuk mengumpulkan data baru
- **Deduplication**: Otomatis menghilangkan user agents duplikat
- **Progress Tracking**: Real-time progress bar dan statistik
- **Manual Check**: Tombol manual untuk check duplicates
- **Copy to Clipboard**: Copy semua hasil dengan satu klik
- **Auto-Save**: Otomatis menyimpan USER_AGENTS.txt ke folder yang dipilih
- **Multiple Directory Support**: Simpan ke beberapa folder sekaligus
- **Responsive UI**: Interface yang clean dan user-friendly

## 📦 Instalasi

1. Download atau clone repository ini
2. Buka Chrome dan pergi ke `chrome://extensions/`
3. Aktifkan "Developer mode" di pojok kanan atas
4. Klik "Load unpacked" dan pilih folder extension ini
5. Extension akan muncul di toolbar Chrome

## 🎯 Cara Penggunaan

1. **Set Target**: Masukkan jumlah user agents yang diinginkan (contoh: 10000)
2. **Start Scraping**: Klik tombol "Start Scraping"
3. **Monitor Progress**: Lihat progress bar dan statistik real-time
4. **Auto Process**: Extension akan otomatis:
   - Membuka tab useragents.io
   - Mengekstrak user agents dari tabel
   - Refresh halaman setiap 2-3 detik
   - Menghilangkan duplikasi otomatis
   - Berhenti ketika target tercapai
5. **Setup Auto-Save (Opsional)**:
   - Centang "Auto-save to USER_AGENTS.TXT when complete"
   - Klik "Select Directory" untuk memilih folder tujuan
   - Bisa memilih beberapa folder untuk menyimpan ke multiple lokasi
   - File akan otomatis tersimpan ketika scraping selesai
6. **Copy Results**: Klik "Copy All" untuk copy semua user agents
7. **Check Duplicates**: Klik "Check Duplicates" untuk manual verification

## 📊 Perhitungan Otomatis

Extension menghitung jumlah refresh yang diperlukan:
- **1,000 UA** = 1 refresh (ambil 1,000 dari 1,500)
- **10,000 UA** = 7 refresh (7 × 1,500 = 10,500 UA)
- **50,000 UA** = 34 refresh (34 × 1,500 = 51,000 UA)

Estimasi waktu: ~1-2 detik per refresh (optimized untuk kecepatan maksimal)

## 🔧 Struktur File

```
user-agent-scraper/
├── manifest.json          # Konfigurasi extension
├── popup.html             # UI popup extension
├── popup.js               # Logic popup
├── styles.css             # Styling UI
├── content.js             # Script scraping di useragents.io
├── background.js          # Service worker koordinasi
└── README.md              # Dokumentasi
```

## ⚡ Fitur Teknis

- **Manifest V3**: Menggunakan service worker terbaru
- **Auto Deduplication**: Menggunakan Set() untuk performa optimal
- **Error Handling**: Comprehensive error handling
- **Memory Efficient**: Optimized untuk handling data besar
- **Cross-tab Communication**: Koordinasi antara popup dan content script
- **Persistent Storage**: Data tersimpan selama session

## 🛡️ Permissions

Extension memerlukan permissions berikut:
- `tabs`: Untuk membuka dan mengontrol tab
- `activeTab`: Untuk akses tab aktif
- `storage`: Untuk menyimpan data sementara
- `scripting`: Untuk inject content script
- `host_permissions`: Akses ke useragents.io

## 🎨 UI Components

- **Input Target**: Set jumlah user agents yang diinginkan
- **Control Buttons**: Start, Stop, Check Duplicates
- **Progress Bar**: Visual progress indicator
- **Statistics**: Unique count, total scraped, refresh count
- **Results Textarea**: Display semua user agents (scrollable)
- **Action Buttons**: Copy All, Clear Data
- **Status Bar**: Real-time status updates

## 🚦 Status Indicators

- **Ready**: Extension siap digunakan
- **Running**: Scraping sedang berjalan
- **Success**: Operasi berhasil
- **Error**: Ada error yang terjadi

## 📋 Tips Penggunaan

1. **Target Realistic**: Set target sesuai kebutuhan untuk menghindari overload
2. **Monitor Progress**: Pantau progress bar untuk estimasi waktu
3. **Jangan Close Tab**: Jangan tutup tab scraping saat proses berjalan
4. **Check Results**: Gunakan "Check Duplicates" untuk verifikasi
5. **Save Results**: Copy hasil sebelum clear data

## 🔍 Troubleshooting

**Extension tidak start?**
- Pastikan permissions sudah diberikan
- Reload extension di chrome://extensions/

**Scraping lambat?**
- Extension sudah dioptimasi untuk kecepatan maksimal
- Kecepatan tergantung koneksi internet dan performa browser
- Larger target = longer time

**Data tidak muncul?**
- Check console untuk error messages
- Pastikan useragents.io accessible

**Tab tertutup tiba-tiba?**
- Extension akan auto-stop jika tab tertutup
- Restart scraping jika perlu

**Auto-save tidak bekerja?**
- Pastikan menggunakan Chrome 86+ (untuk File System Access API)
- Berikan permission untuk mengakses folder yang dipilih
- Pilih folder dengan klik "Select Directory" sebelum scraping
- Pastikan auto-save diaktifkan dengan centang checkbox

**File tidak tersimpan ke folder yang benar?**
- Extension menggunakan File System Access API yang menyimpan langsung ke folder yang dipilih
- Tidak lagi menggunakan download folder default
- Pastikan permission folder sudah diberikan saat dialog muncul

## 📝 Changelog

### Version 1.1.0
- **NEW**: Auto-save functionality menggunakan File System Access API
- **NEW**: Multiple directory support untuk menyimpan ke beberapa folder
- **IMPROVED**: UI yang lebih user-friendly untuk konfigurasi auto-save
- **FIXED**: File sekarang tersimpan langsung ke folder yang dipilih, bukan download folder
- **ENHANCED**: Error handling yang lebih baik untuk auto-save operations
- **ADDED**: Validation dan feedback untuk directory selection

### Version 1.0.0
- Initial release
- Basic scraping functionality
- Auto-refresh dengan optimasi kecepatan maksimal
- Deduplication otomatis
- Progress tracking
- Copy to clipboard
- Manual duplicate check
- Performance optimized untuk scraping cepat

## 🤝 Contributing

Contributions welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT License - feel free to use and modify.
