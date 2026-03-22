# Widget HTML Templates

Copy-paste and change data values only. Never design HTML from scratch.

## Design tokens

Page `#1a1a1a` · Card `#2a2a2a` · Text `#e0e0e0` · Muted `#999`
Teal `#4a9` · Green `#6fca6f` · Warning `#f5a623` · Error `#e55` · Blue `#5b8def`
Font: system-ui, 16px/400. Headings: weight 500. No 600+, no ALLCAPS, no emoji.
Badge bg: success `rgba(111,202,111,0.15)`, warning `rgba(245,166,35,0.15)`, error `rgba(238,85,85,0.15)`

## KPI cards (3-column grid)

```html
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
  <div style="background:#2a2a2a;padding:16px;border-radius:8px;">
    <p style="margin:0;color:#999;font-size:12px;text-transform:uppercase;">LABEL</p>
    <p style="margin:8px 0 0;color:#4a9;font-size:28px;font-weight:500;">VALUE</p>
    <p style="margin:4px 0 0;color:#6fca6f;font-size:13px;">+12%</p>
  </div>
  <!-- repeat 2 more cards -->
</div>
```

## Data table

```html
<div style="background:#2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;">
  <h3 style="margin:0 0 12px;color:#fff;font-size:16px;font-weight:500;">Title</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="border-bottom:1px solid #444;">
        <th style="text-align:left;padding:8px 12px;color:#999;font-weight:500;">Col</th>
        <th style="text-align:right;padding:8px 12px;color:#999;font-weight:500;">Col</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:8px 12px;color:#e0e0e0;">Row</td>
        <td style="padding:8px 12px;color:#4a9;text-align:right;">Val</td>
      </tr>
    </tbody>
  </table>
</div>
```

## Progress bar

```html
<div style="background:#2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
    <span style="color:#e0e0e0;font-size:14px;font-weight:500;">Label</span>
    <span style="color:#4a9;font-size:14px;font-weight:500;">67%</span>
  </div>
  <div style="background:#333;border-radius:4px;height:8px;overflow:hidden;">
    <div style="background:#4a9;height:100%;width:67%;border-radius:4px;"></div>
  </div>
</div>
```

## Status list

```html
<div style="background:#2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;">
  <h3 style="margin:0 0 12px;color:#fff;font-size:16px;font-weight:500;">Status</h3>
  <div style="display:flex;flex-direction:column;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="width:8px;height:8px;border-radius:50%;background:#6fca6f;flex-shrink:0;"></span>
      <span style="color:#e0e0e0;font-size:14px;">Item — healthy</span>
    </div>
  </div>
</div>
```

## Key-value details

```html
<div style="background:#2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;">
  <h3 style="margin:0 0 12px;color:#fff;font-size:16px;font-weight:500;">Details</h3>
  <div style="display:grid;grid-template-columns:140px 1fr;gap:8px 16px;font-size:14px;">
    <span style="color:#999;">Field</span><span style="color:#e0e0e0;">Value</span>
  </div>
</div>
```

## Banner

```html
<div
  style="background:rgba(245,166,35,0.1);border-left:3px solid #f5a623;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;"
>
  <p style="margin:0;color:#f5a623;font-size:13px;font-weight:500;">Warning</p>
  <p style="margin:4px 0 0;color:#e0e0e0;font-size:14px;">Message here.</p>
</div>
```

Info: `#f5a623`→`#4a9`. Error: →`#e55`.

## Bar chart (Chart.js)

```html
<div style="background:#2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;">
  <h3 style="margin:0 0 12px;color:#fff;font-size:16px;font-weight:500;">Title</h3>
  <canvas id="myChart" style="max-height:300px;"></canvas>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script>
  new Chart(document.getElementById("myChart"), {
    type: "bar",
    data: {
      labels: ["A", "B", "C"],
      datasets: [{ label: "Series", data: [10, 20, 30], backgroundColor: "#4a9" }],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#999" } } },
      scales: {
        x: { ticks: { color: "#999" }, grid: { color: "#333" } },
        y: { ticks: { color: "#999" }, grid: { color: "#333" } },
      },
    },
  });
</script>
```

For line chart: change `type: 'bar'` to `type: 'line'`, add `borderColor: '#4a9', fill: true, tension: 0.3`.
For doughnut: `type: 'doughnut'`, remove `scales`, use `backgroundColor: ['#4a9','#5b8def','#f5a623']`.

## Action buttons

```html
<div
  style="background:#2a2a2a;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center;"
>
  <p style="margin:0 0 12px;color:#999;font-size:14px;">Choose action</p>
  <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
    <button
      onclick="window.duoduo.submit('approve', {approved:true})"
      style="background:#4a9;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;"
    >
      Approve
    </button>
    <button
      onclick="window.duoduo.submit('reject', {approved:false})"
      style="background:transparent;color:#e55;border:1px solid #e55;padding:10px 24px;border-radius:6px;font-size:14px;cursor:pointer;"
    >
      Reject
    </button>
  </div>
</div>
```

## Anti-patterns

No `position:fixed` · No `fetch()`/`XHR`/`WebSocket` · No `eval()` · No gradients/shadows · No font <11px
