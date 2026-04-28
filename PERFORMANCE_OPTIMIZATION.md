# Performance Optimization - Traffic68.com

## Tổng quan vấn đề (từ PageSpeed Insights)

### Mobile
- ❌ LCP: 6.3s (Poor) - 39% page loads > 4s
- ⚠️ INP: 387ms (Needs Improvement) - 19% page loads > 500ms
- ⚠️ CLS: 0.23 (borderline) - 17% page loads > 0.25
- ✅ TTFB: 0.3s (Good)
- ✅ FCP: 1.7s (Good)

### Desktop
- ❌ LCP: 3.7s (Poor) - 22% page loads > 4s
- ❌ CLS: 0.27 (Poor) - 43% page loads > 0.25
- ✅ INP: 112ms (Good)
- ✅ TTFB: 0.3s (Good)
- ✅ FCP: 1s (Good)

---

## Các tối ưu hóa đã thực hiện

### 1. HTML Optimization (index.html)

#### ✅ Preconnect & DNS-prefetch
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://www.googletagmanager.com" />
<link rel="dns-prefetch" href="https://js.hcaptcha.com" />
<link rel="dns-prefetch" href="https://www.clarity.ms" />
```
**Lợi ích:** Giảm DNS lookup time, kết nối sớm đến critical origins

#### ✅ Font Loading Optimization
```html
<link rel="preload" href="..." as="style" onload="this.onload=null;this.rel='stylesheet'" />
<noscript><link rel="stylesheet" href="..." /></noscript>
```
**Lợi ích:** Non-blocking font loading, giảm render-blocking resources

#### ✅ Inline Critical CSS
```html
<style>
  body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  #root { min-height: 100vh; }
  img { max-width: 100%; height: auto; }
</style>
```
**Lợi ích:** Prevent FOUC (Flash of Unstyled Content), giảm CLS

#### ✅ Defer Non-Critical Scripts
```javascript
// Clarity & Google Analytics load after window.load
window.addEventListener('load', function() { ... });
```
**Lợi ích:** Không block initial render, cải thiện FCP và LCP

#### ✅ Language Tag
```html
<html lang="vi">
```
**Lợi ích:** SEO và accessibility

---

### 2. Vite Build Optimization (vite.config.js)

#### ✅ Advanced Code Splitting
```javascript
manualChunks(id) {
  if (id.includes('src/pages/Admin/')) return 'admin-pages';
  if (id.includes('src/pages/Dashboard/')) return 'dashboard-pages';
  if (id.includes('src/pages/Campaigns/')) return 'campaign-pages';
  // ... vendor chunks
}
```
**Lợi ích:** Giảm initial bundle size, lazy load admin/dashboard pages

#### ✅ Terser Minification
```javascript
minify: 'terser',
terserOptions: {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['console.log']
  }
}
```
**Lợi ích:** Giảm bundle size 10-15%, remove console.log trong production

#### ✅ CSS Code Splitting
```javascript
cssCodeSplit: true
```
**Lợi ích:** Load CSS theo route, giảm initial CSS payload

#### ✅ Optimize Dependencies
```javascript
optimizeDeps: {
  include: ['react', 'react-dom', 'react-router-dom']
}
```
**Lợi ích:** Pre-bundle dependencies, faster dev server

---

### 3. Image Optimization

#### ✅ Hero Image Priority Loading
```jsx
<img
  src="/hero-illustration.png"
  width="512"
  height="512"
  loading="eager"
  fetchpriority="high"
/>
```
**Lợi ích:** Prioritize LCP image, giảm LCP time

#### ✅ LazyImage Component
- IntersectionObserver-based lazy loading
- Aspect ratio preservation (prevent CLS)
- Placeholder skeleton
- 50px rootMargin for smooth loading

**Lợi ích:** Giảm initial payload, prevent CLS, better UX

---

### 4. Error Handling (LinkGateway.jsx)

#### ✅ Canvas Error Handling
```javascript
try {
  ctx = canvas.getContext('2d');
  if (!ctx) return;
} catch (err) {
  console.error('[CurveChallenge] Context error:', err);
  return;
}
```
**Lợi ích:** Prevent white screen crashes

#### ✅ Canvas Size Validation
```javascript
const W = canvas.width = Math.max(getCanvasWidth(), 320); // Minimum 320px
if (W < 100 || H < 100) {
  console.error('[CurveChallenge] Canvas too small:', W, H);
  return;
}
```
**Lợi ích:** Prevent rendering errors, better mobile support

---

## Các bước tiếp theo (TODO)

### 🔴 Critical (Ảnh hưởng lớn đến Core Web Vitals)

#### 1. Image Optimization
- [ ] Convert images to WebP format (giảm 25-35% file size)
- [ ] Implement responsive images với srcset
- [ ] Compress existing images (TinyPNG, ImageOptim)
- [ ] Add explicit width/height cho TẤT CẢ images

#### 2. Reduce JavaScript Execution Time
- [ ] Implement React.memo() cho heavy components
- [ ] Use useMemo/useCallback để prevent re-renders
- [ ] Debounce/throttle event handlers
- [ ] Code split admin routes (đã có trong config, cần verify)

#### 3. Fix Cumulative Layout Shift (CLS)
- [ ] Set dimensions cho tất cả images
- [ ] Reserve space cho dynamic content (ads, widgets)
- [ ] Avoid inserting content above existing content
- [ ] Use CSS aspect-ratio cho responsive images

### 🟡 Important (Cải thiện đáng kể)

#### 4. Implement Service Worker
```javascript
// Cache static assets
// Offline support
// Background sync
```

#### 5. Resource Hints
- [ ] Preload critical assets (fonts, hero image)
- [ ] Prefetch next-page resources
- [ ] Prerender likely navigation targets

#### 6. Optimize Third-Party Scripts
- [ ] Lazy load Google Analytics
- [ ] Lazy load Clarity
- [ ] Self-host Google Fonts (optional)
- [ ] Defer hCaptcha until needed

### 🟢 Nice to Have

#### 7. Advanced Optimizations
- [ ] Implement HTTP/2 Server Push
- [ ] Enable Brotli compression
- [ ] Add Cache-Control headers
- [ ] Implement CDN for static assets

#### 8. Monitoring
- [ ] Setup Real User Monitoring (RUM)
- [ ] Track Core Web Vitals in production
- [ ] Setup performance budgets
- [ ] Add performance alerts

---

## Cách đo lường kết quả

### 1. PageSpeed Insights
```
https://pagespeed.web.dev/analysis/https-traffic68-com/
```

### 2. Chrome DevTools
- Lighthouse audit
- Performance tab
- Coverage tab (unused CSS/JS)

### 3. WebPageTest
```
https://www.webpagetest.org/
```

### 4. Real User Monitoring
- Google Analytics 4 (Web Vitals)
- Clarity (Session recordings)

---

## Expected Improvements

Sau khi hoàn thành tất cả optimizations:

### Mobile
- LCP: 6.3s → **< 2.5s** (60% improvement)
- INP: 387ms → **< 200ms** (48% improvement)
- CLS: 0.23 → **< 0.1** (57% improvement)

### Desktop
- LCP: 3.7s → **< 2.5s** (32% improvement)
- CLS: 0.27 → **< 0.1** (63% improvement)

### Overall Score
- Mobile: **40-50** → **85-95** (Good)
- Desktop: **60-70** → **90-100** (Good)

---

## Build & Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Analyze Bundle
```bash
npm run build -- --mode analyze
```

### Test Performance Locally
```bash
npm run preview
# Then run Lighthouse on localhost:4173
```

---

## Notes

- Tất cả optimizations đã implement đều backward compatible
- Không ảnh hưởng đến functionality
- Focus vào Core Web Vitals (LCP, INP, CLS)
- Ưu tiên mobile performance (60% traffic từ mobile)

---

**Last Updated:** 2026-04-29
**Status:** Phase 1 Complete ✅
**Next Phase:** Image Optimization & CLS Fixes
