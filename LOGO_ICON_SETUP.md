# Logo & Icon Setup untuk NaffDev ClipLoop Studio

## 📋 Instruksi Membuat Logo

Saya tidak bisa generate image karena quota habis, tapi berikut instruksi untuk membuat logo sendiri:

### Option 1: Menggunakan Tool Online (Rekomendasi - Termudah!)
1. **Buka Canva.com** (gratis)
2. Pilih template "Logo" atau "App Icon"
3. Design dengan tema:
   - **Warna**: Gradient Purple → Blue (#6366f1 → #3b82f6)
   - **Simbol**: Infinity loop (∞) atau circular arrow
   - **Gaya**: Modern, minimalist, clean
   - **Text** (untuk banner): "ClipLoop Studio"
4. Export sebagai PNG (800x800 pixel)
5. Save ke: `f:\coding\js\API\looping\assets\logo.png`

### Option 2: Menggunakan Figma/Photoshop
Buat logo dengan specs:
- **Size**: 800x800 px (square)
- **Background**: Transparent/White
- **Colors**:
  - Primary: #6366f1 (indigo)
  - Secondary: #3b82f6 (blue)
  - Accent: #8b5cf6 (purple)
- **Icon**: Infinity loop atau video frames loop
- **Style**: Flat, modern, minimalist

### Option 3: Download dari Situs Icon (Gratis)
1. **Flaticon.com** atau **Icons8.com**
2. Cari keyword: "video loop", "infinity", "repeat video"
3. Download format PNG 512x512 atau lebih besar
4. Edit warna jadi purple/blue gradient
5. Save ke `assets/logo.png`

---

## 🎯 Setup App Icon (Electron)

### Untuk Windows (.ico)
1. **Convert PNG ke ICO**:
   - Tool online: https://convertico.com
   - Upload logo.png
   - Download sebagai `icon.ico`
   - Ukuran: 256x256 minimum

2. **Simpan di**:
   ```
   f:\coding\js\API\looping\assets\icon.ico
   ```

3. **Update forge.config.js**:
   ```javascript
   icon: './assets/icon.ico'
   ```

---

## 📁 Struktur Assets yang Dibutuhkan

```
assets/
├── logo.png         (800x800) - untuk UI di aplikasi
├── icon.ico         (256x256) - untuk Windows app icon
└── qris.png         (existing) - untuk donasi
```

---

## ✅ Yang Sudah Saya Setup

1. ✅ HTML sudah diupdate dengan logo di header
2. ✅ CSS styling untuk logo (80x80, hover effect, drop shadow)
3. ✅ Logo akan muncul di atas title "NaffDev ClipLoop Studio"
4. ✅ Fallback: jika logo.png tidak ada, akan otomatis hide

---

## 🚀 Quick Start

**Cara Tercepat:**
1. Download icon dari **Icons8.com**:
   - Search: "video loop purple"
   - Download PNG 512x512
   - Rename jadi `logo.png`
   - Copy ke `assets/logo.png`

2. Convert ke .ico:
   - Upload ke convertico.com
   - Download `icon.ico`
   - Copy ke `assets/icon.ico`

3. Restart aplikasi → Logo akan muncul!

---

## 🎨 Rekomendasi Design

**Konsep Logo yang Cocok:**
- ∞ Infinity symbol dengan gradient purple-blue
- 🔄 Circular arrows forming a loop
- 🎬 Film strip yang looping
- 📹 Video camera dengan infinity symbol

**Font untuk Text (jika mau banner):**
- Poppins Bold
- Inter Bold
- Montserrat SemiBold

**Color Palette:**
- Primary: #6366f1 (Indigo)
- Secondary: #3b82f6 (Blue)  
- Accent: #8b5cf6 (Purple)
- Gradient: linear-gradient(135deg, #6366f1, #3b82f6)

---

## 📝 Notes

- Logo sudah di-setup di HTML & CSS
- Tinggal create/download logonya
- Format PNG untuk UI, ICO untuk app icon
- Ukuran 800x800 untuk logo.png
- Ukuran 256x256 untuk icon.ico

**Status:** ⏳ Tinggal create logo PNG & ICO, lalu copy ke folder assets!
