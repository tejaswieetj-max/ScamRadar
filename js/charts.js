/**
 * ScamRadar High-Performance SVG Chart Engine
 * - Timeline Surveillance Chart (Observed solid vs Nowcast-Corrected dashed + shaded unreported zone)
 * - Language Distribution Donut Chart
 * - Reporting Delay Calibration Curve Preview
 */

const ChartRenderer = {
  // Render dual-curve Timeline Chart with shaded estimated unreported area
  renderTimeline(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { dates, observed, nowcast, unreported } = data;
    if (!dates || dates.length === 0) {
      container.innerHTML = `<div class="chart-empty">No timeline data available</div>`;
      return;
    }

    const width = container.clientWidth || 680;
    const height = 280;
    const padding = { top: 30, right: 30, bottom: 45, left: 50 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(...nowcast, 10) * 1.15;
    const n = dates.length;

    const getX = (i) => padding.left + (i / (n - 1)) * chartWidth;
    const getY = (val) => padding.top + chartHeight - (val / maxVal) * chartHeight;

    // Generate Points
    const obsPoints = observed.map((v, i) => `${getX(i)},${getY(v)}`);
    const nowPoints = nowcast.map((v, i) => `${getX(i)},${getY(v)}`);

    // Shaded Area path between observed and nowcast:
    // Follow nowPoints forward, then obsPoints backward
    const forwardNow = nowPoints.join(' L ');
    const backwardObs = [...obsPoints].reverse().join(' L ');
    const areaPath = `M ${forwardNow} L ${backwardObs} Z`;

    // Horizontal grid lines
    const gridTicks = [0, 0.25, 0.5, 0.75, 1.0];
    const gridLines = gridTicks.map(t => {
      const yVal = Math.round(maxVal * t);
      const yPos = getY(yVal);
      return `
        <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="#1E293B" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${yPos + 4}" fill="#64748B" font-size="10" text-anchor="end">${yVal}</text>
      `;
    }).join('');

    // X-axis labels (every 2-3 points to avoid crowding)
    const xLabels = dates.map((d, i) => {
      if (i % 2 !== 0 && i !== n - 1) return '';
      return `<text x="${getX(i)}" y="${height - 12}" fill="#94A3B8" font-size="11" text-anchor="middle">${d}</text>`;
    }).join('');

    // Data points interactive pins
    const pins = nowcast.map((v, i) => {
      const x = getX(i);
      const yNow = getY(v);
      const yObs = getY(observed[i]);
      const diff = unreported[i];
      return `
        <g class="chart-point-group" tabindex="0">
          <circle cx="${x}" cy="${yObs}" r="3.5" fill="#38BDF8" stroke="#0F172A" stroke-width="1.5" />
          <circle cx="${x}" cy="${yNow}" r="4" fill="#F43F5E" stroke="#0F172A" stroke-width="1.5" />
          <title>${dates[i]}&#10;Observed: ${observed[i]}&#10;Nowcast-Corrected: ${v}&#10;Estimated Unreported: +${diff}</title>
        </g>
      `;
    }).join('');

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="sr-svg-chart" style="width: 100%; height: 100%;">
        <defs>
          <linearGradient id="unreportedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#F43F5E" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.06" />
          </linearGradient>
        </defs>

        <!-- Grid Lines & Axes -->
        ${gridLines}

        <!-- Shaded Area: Estimated Unreported -->
        <path d="${areaPath}" fill="url(#unreportedGradient)" />

        <!-- Nowcast-Corrected Curve (Dashed Crimson) -->
        <path d="M ${nowPoints.join(' L ')}" fill="none" stroke="#F43F5E" stroke-width="2.5" stroke-dasharray="5,4" />

        <!-- Observed Complaints Curve (Solid Cyan) -->
        <path d="M ${obsPoints.join(' L ')}" fill="none" stroke="#38BDF8" stroke-width="2.5" />

        <!-- Interactive Pins -->
        ${pins}

        <!-- X Axis Labels -->
        ${xLabels}

        <!-- Shaded Area Label Annotation -->
        <g transform="translate(${getX(Math.floor(n * 0.72))}, ${getY(nowcast[Math.floor(n * 0.72)]) + 22})">
          <rect x="-65" y="-14" width="130" height="20" rx="4" fill="#0A1128" fill-opacity="0.85" stroke="#F43F5E" stroke-width="0.8" />
          <text x="0" y="0" fill="#FDA4AF" font-size="9.5" font-weight="600" text-anchor="middle">Estimated Unreported</text>
        </g>
      </svg>
    `;
  },

  // Render Donut Chart for Language Distribution
  renderLanguageDonut(containerId, langDist) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const entries = Object.entries(langDist || {});
    if (entries.length === 0) {
      container.innerHTML = `<div class="chart-empty">No language distribution data</div>`;
      return;
    }

    const total = entries.reduce((s, [, v]) => s + v, 0);
    const colors = {
      "Hindi": "#F59E0B",     // Amber
      "Tamil": "#10B981",     // Emerald
      "Telugu": "#8B5CF6",    // Purple
      "Hinglish": "#EC4899",  // Pink
      "English": "#38BDF8",   // Sky
      "Kannada": "#06B6D4"    // Cyan
    };

    const size = 200;
    const center = size / 2;
    const radius = 70;
    const strokeWidth = 26;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = 0;
    const slices = entries.map(([lang, count]) => {
      const pct = count / total;
      const strokeDash = pct * circumference;
      const strokeOffset = circumference - accumulatedAngle;
      accumulatedAngle += strokeDash;
      const color = colors[lang] || "#94A3B8";

      return `
        <circle cx="${center}" cy="${center}" r="${radius}"
          fill="transparent"
          stroke="${color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${strokeDash} ${circumference}"
          stroke-dashoffset="${strokeOffset}"
          class="donut-slice"
        >
          <title>${lang}: ${count} (${Math.round(pct * 100)}%)</title>
        </circle>
      `;
    }).join('');

    const legendItems = entries.map(([lang, count]) => {
      const pct = Math.round((count / total) * 100);
      const color = colors[lang] || "#94A3B8";
      return `
        <div class="donut-legend-item">
          <span class="legend-color-dot" style="background-color: ${color}"></span>
          <span class="legend-lang-name">${lang}</span>
          <span class="legend-lang-pct">${pct}%</span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="donut-wrapper">
        <svg viewBox="0 0 ${size} ${size}" class="donut-svg" style="width: 140px; height: 140px; transform: rotate(-90deg);">
          ${slices}
          <g style="transform: rotate(90deg); transform-origin: center;">
            <text x="${center}" y="${center - 4}" text-anchor="middle" fill="#94A3B8" font-size="10">LANGUAGES</text>
            <text x="${center}" y="${center + 14}" text-anchor="middle" fill="#F8FAFC" font-size="14" font-weight="700">${entries.length}</text>
          </g>
        </svg>
        <div class="donut-legend-grid">
          ${legendItems}
        </div>
      </div>
    `;
  },

  // Render Reporting Delay Calibration CDF Curve Preview
  renderDelayCalibrationCurve(containerId, calibration) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { instantPercent, delayedPercent, severeTailPercent } = calibration;
    const width = container.clientWidth || 520;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 35, left: 45 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Timeline days 0 to 30
    const points = [];
    const days = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30];

    days.forEach(d => {
      let cdf = 0;
      if (d === 0) {
        cdf = (instantPercent * 0.7) / 100;
      } else if (d <= 1) {
        cdf = instantPercent / 100;
      } else if (d <= 5) {
        const span = (d - 1) / 4;
        cdf = (instantPercent + delayedPercent * span) / 100;
      } else {
        const span = Math.min(1, (d - 5) / 25);
        cdf = (instantPercent + delayedPercent + severeTailPercent * span) / 100;
      }
      points.push({ day: d, cdf: Math.min(1.0, cdf) });
    });

    const getX = (d) => padding.left + (d / 30) * chartWidth;
    const getY = (cdf) => padding.top + chartHeight - (cdf * chartHeight);

    const svgPoints = points.map(p => `${getX(p.day)},${getY(p.cdf)}`).join(' L ');
    const areaPath = `M ${getX(0)},${getY(0)} L ${svgPoints} L ${getX(30)},${getY(0)} Z`;

    const effectiveMultiplier = (1 + (delayedPercent * 0.007 + severeTailPercent * 0.012)).toFixed(2);

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="sr-svg-chart" style="width: 100%; height: 100%;">
        <defs>
          <linearGradient id="cdfGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#1E3A8A" stop-opacity="0.05" />
          </linearGradient>
        </defs>

        <!-- Baseline axes -->
        <line x1="${padding.left}" y1="${getY(0)}" x2="${width - padding.right}" y2="${getY(0)}" stroke="#334155" stroke-width="1" />
        <line x1="${padding.left}" y1="${getY(1)}" x2="${width - padding.right}" y2="${getY(1)}" stroke="#1E293B" stroke-dasharray="2,2" />
        <text x="${padding.left - 6}" y="${getY(1) + 4}" fill="#64748B" font-size="9" text-anchor="end">100%</text>
        <text x="${padding.left - 6}" y="${getY(0.5) + 4}" fill="#64748B" font-size="9" text-anchor="end">50%</text>

        <!-- Area & Curve -->
        <path d="${areaPath}" fill="url(#cdfGradient)" />
        <path d="M ${svgPoints}" fill="none" stroke="#60A5FA" stroke-width="2.5" />

        <!-- Key Annotations -->
        <circle cx="${getX(0.25)}" cy="${getY(instantPercent / 100)}" r="3" fill="#34D399" />
        <circle cx="${getX(5)}" cy="${getY((instantPercent + delayedPercent) / 100)}" r="3" fill="#FBBF24" />
        <circle cx="${getX(30)}" cy="${getY(1.0)}" r="3" fill="#F87171" />

        <!-- X ticks -->
        <text x="${getX(0)}" y="${height - 10}" fill="#94A3B8" font-size="9" text-anchor="middle">0d (6h)</text>
        <text x="${getX(5)}" y="${height - 10}" fill="#94A3B8" font-size="9" text-anchor="middle">5d (lag)</text>
        <text x="${getX(15)}" y="${height - 10}" fill="#94A3B8" font-size="9" text-anchor="middle">15d</text>
        <text x="${getX(30)}" y="${height - 10}" fill="#94A3B8" font-size="9" text-anchor="middle">30d (tail)</text>

        <!-- Multiplier pill -->
        <g transform="translate(${width - 150}, ${padding.top + 10})">
          <rect width="130" height="24" rx="4" fill="#1E293B" stroke="#3B82F6" stroke-width="0.8" />
          <text x="65" y="16" fill="#93C5FD" font-size="10" font-weight="600" text-anchor="middle">Avg Nowcast: ×${effectiveMultiplier}</text>
        </g>
      </svg>
    `;
  }
};
