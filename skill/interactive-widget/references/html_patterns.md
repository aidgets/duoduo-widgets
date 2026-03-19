# Widget HTML Patterns

## Typography

- Body: 16px, weight 400, line-height 1.6, color `#e0e0e0`
- h1: 28px, weight 500, color `#fff`
- h2: 22px, weight 500, color `#fff`
- h3: 18px, weight 500, color `#e0e0e0`
- Code: `font-family: ui-monospace, monospace`
- Two weights only: 400 (regular), 500 (bold). Never 600+
- Sentence case always. Never Title Case or ALL CAPS

## Color system

### Backgrounds
- Page: `#1a1a1a`
- Surface/card: `#2a2a2a`
- Elevated: `#333`
- Accent surface: use with low opacity, e.g. `rgba(74, 153, 153, 0.15)`

### Text
- Primary: `#e0e0e0`
- Secondary/muted: `#999`
- Hint: `#666`
- Success: `#6fca6f`
- Warning: `#f5a623`
- Error: `#e55`
- Info/accent: `#4a9`

### Accent palette
- Teal: `#4a9` (primary accent)
- Orange: `#f90` (highlight, code)
- Green: `#6fca6f` (success)
- Red: `#e55` (error/danger)
- Blue: `#5b8def` (links)

## Components

### Card

```html
<div style="background:#2a2a2a; padding:16px; border-radius:8px; margin-bottom:12px;">
  <h3 style="margin:0 0 8px; color:#fff; font-size:16px; font-weight:500;">Title</h3>
  <p style="margin:0; color:#999; font-size:14px;">Description</p>
</div>
```

### Status badge

```html
<span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px;
  font-weight:500; background:rgba(111,202,111,0.15); color:#6fca6f;">Active</span>
```

### Data table

```html
<table style="width:100%; border-collapse:collapse; font-size:14px;">
  <thead>
    <tr style="border-bottom:1px solid #333;">
      <th style="text-align:left; padding:8px 12px; color:#999; font-weight:500;">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #2a2a2a;">
      <td style="padding:8px 12px; color:#e0e0e0;">Value</td>
    </tr>
  </tbody>
</table>
```

### Submit button (primary)

```html
<button onclick="window.duoduo.submit('confirm', {key: 'value'})"
  style="background:#4a9; color:#fff; border:none; padding:10px 24px;
  border-radius:6px; font-size:14px; font-weight:500; cursor:pointer;">
  Confirm
</button>
```

### Button group (approve/reject)

```html
<div style="display:flex; gap:12px; margin-top:16px;">
  <button onclick="window.duoduo.submit('approve', {approved: true})"
    style="background:#4a9; color:#fff; border:none; padding:10px 24px;
    border-radius:6px; font-size:14px; cursor:pointer;">Approve</button>
  <button onclick="window.duoduo.submit('reject', {approved: false})"
    style="background:transparent; color:#e55; border:1px solid #e55; padding:10px 24px;
    border-radius:6px; font-size:14px; cursor:pointer;">Reject</button>
</div>
```

### Code block

```html
<pre style="background:#111; padding:16px; border-radius:8px; overflow-x:auto;
  font-family:ui-monospace,monospace; font-size:13px; line-height:1.5; color:#e0e0e0;">
<code>const result = await analyze(data);</code></pre>
```

### Chart.js

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<canvas id="chart" style="max-height:400px;"></canvas>
<script>
new Chart(document.getElementById('chart'), {
  type: 'bar',
  data: { labels: ['A','B','C'], datasets: [{ data: [10,20,30], backgroundColor: '#4a9' }] },
  options: {
    plugins: { legend: { labels: { color: '#999' } } },
    scales: {
      x: { ticks: { color: '#999' }, grid: { color: '#333' } },
      y: { ticks: { color: '#999' }, grid: { color: '#333' } }
    }
  }
});
</script>
```

## Bridge API

```js
window.duoduo.submit(action, payload)  // Submit structured data
window.duoduo.openLink(url)            // Open external link safely
```

## Anti-patterns

- No `position: fixed` (viewer sizes to content flow)
- No `fetch()` / `XMLHttpRequest` / `WebSocket` (blocked by CSP)
- No `eval()` / `new Function()` (security)
- No gradients, shadows, blur, glow (keep flat)
- No emoji (use CSS shapes or SVG)
- No font-size below 11px
