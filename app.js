/**
 * PBI Palette — Main Application Logic
 */

(function () {
    'use strict';

    // DOM Elements
    const uploadArea = document.getElementById('upload-area');
    const uploadContent = document.getElementById('upload-content');
    const uploadPreview = document.getElementById('upload-preview');
    const previewImage = document.getElementById('preview-image');
    const fileInput = document.getElementById('file-input');
    const removeBtn = document.getElementById('remove-btn');
    const colorCountSelector = document.getElementById('color-count-selector');
    const countBtns = document.querySelectorAll('.count-btn');
    const generateBtn = document.getElementById('generate-btn');
    const resultsSection = document.getElementById('results-section');
    const dominantColorsEl = document.getElementById('dominant-colors');
    const paletteContainer = document.getElementById('palette-container');
    const neutralsGrid = document.getElementById('neutrals-grid');
    const themeJsonEl = document.getElementById('theme-json');
    const copyJsonBtn = document.getElementById('copy-json-btn');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const dashboardPreview = document.getElementById('dashboard-preview');
    const newUploadBtn = document.getElementById('new-upload-btn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    let selectedColorCount = 6;
    let currentImageSrc = null;
    let currentPaletteData = null;
    let themeMode = 'light'; // 'light' | 'dark'

    // =========================================
    // Theme Mode Toggle (claro/escuro)
    // =========================================

    const modeBtns = document.querySelectorAll('.mode-btn');
    const ruleBar = document.getElementById('rule-bar');
    const ruleGrid = document.getElementById('rule-grid');

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => setThemeMode(btn.dataset.mode));
    });

    function setThemeMode(mode) {
        if (mode === themeMode) return;
        themeMode = mode;
        modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        // Re-render results if a palette already exists
        if (currentPaletteData) {
            currentPaletteData.roles = assignRoles(currentPaletteData.colors, themeMode);
            renderResults(currentPaletteData);
        }
    }

    // =========================================
    // 60-30-10 Role Assignment
    // =========================================

    function hueDistance(h1, h2) {
        const d = Math.abs(h1 - h2) % 360;
        return d > 180 ? 360 - d : d;
    }

    function vibrancy(color) {
        const [, s, l] = ColorExtractor.rgbToHsl(...color.rgb);
        return s * (1 - Math.abs(l - 50) / 50);
    }

    /**
     * Assign 60-30-10 roles:
     * 60% = neutral base (canvas/surface/text) derived from brand hue + mode
     * 30% = main data color (most vibrant, most present)
     * 10% = accent (vibrant, hue-distinct from main)
     */
    function assignRoles(colors, mode) {
        const ranked = [...colors].sort((a, b) => vibrancy(b) - vibrancy(a));
        const main = ranked[0] || colors[0];
        const [mainH] = ColorExtractor.rgbToHsl(...main.rgb);

        // Accent: most vibrant color with hue far enough from main
        let accent = ranked.slice(1).find(c => {
            const [h] = ColorExtractor.rgbToHsl(...c.rgb);
            return hueDistance(h, mainH) > 30 && vibrancy(c) > 5;
        }) || ranked[1] || main;

        // Average brand hue for tinting neutrals
        let avgH = 0, hCount = 0;
        for (const c of colors) {
            const [h, s] = ColorExtractor.rgbToHsl(...c.rgb);
            if (s > 5) { avgH += h; hCount++; }
        }
        avgH = hCount > 0 ? avgH / hCount : 0;

        const hsl = (h, s, l) => ColorExtractor.rgbToHex(ColorExtractor.hslToRgb(h, s, l));

        const base = mode === 'light'
            ? {
                canvas: hsl(avgH, 8, 97),
                surface: '#ffffff',
                text: hsl(avgH, 12, 15),
                textSecondary: hsl(avgH, 8, 40),
                border: hsl(avgH, 8, 88)
            }
            : {
                canvas: hsl(avgH, 14, 8),
                surface: hsl(avgH, 12, 13),
                text: hsl(avgH, 6, 95),
                textSecondary: hsl(avgH, 6, 65),
                border: hsl(avgH, 10, 24)
            };

        const others = colors.filter(c => c.hex !== main.hex && c.hex !== accent.hex);

        return { base, main, accent, others, mode };
    }

    // =========================================
    // Render 60-30-10 Block
    // =========================================

    function renderRule(roles) {
        const { base, main, accent } = roles;

        ruleBar.innerHTML = `
            <div class="rule-bar-segment" style="width:60%;background:${base.canvas};color:${ColorExtractor.getContrastColor(base.canvas)}">60%</div>
            <div class="rule-bar-segment" style="width:30%;background:${main.hex};color:${ColorExtractor.getContrastColor(main.hex)}">30%</div>
            <div class="rule-bar-segment" style="width:10%;background:${accent.hex};color:${ColorExtractor.getContrastColor(accent.hex)}">10%</div>
        `;

        const cards = [
            {
                percent: '60%',
                title: 'Base / Fundo',
                desc: 'Fundo da página, cartões e áreas neutras',
                swatches: [
                    { hex: base.canvas, label: 'Fundo da página' },
                    { hex: base.surface, label: 'Fundo dos visuais' },
                    { hex: base.text, label: 'Texto' },
                    { hex: base.border, label: 'Bordas' }
                ]
            },
            {
                percent: '30%',
                title: 'Cor Principal',
                desc: 'Gráficos de barras, linhas e séries principais',
                swatches: [{ hex: main.hex, label: 'Principal' }]
            },
            {
                percent: '10%',
                title: 'Destaque',
                desc: 'KPIs, alertas e pontos de atenção',
                swatches: [{ hex: accent.hex, label: 'Destaque' }]
            }
        ];

        ruleGrid.innerHTML = cards.map(card => `
            <div class="rule-card">
                <div class="rule-card-percent">${card.percent}</div>
                <div class="rule-card-title">${card.title}</div>
                <div class="rule-card-desc">${card.desc}</div>
                <div class="rule-card-swatches">
                    ${card.swatches.map(s => `
                        <div class="rule-swatch" data-hex="${s.hex}" title="${s.label}">
                            <div class="rule-swatch-color" style="background:${s.hex}"></div>
                            <span class="rule-swatch-hex">${s.hex.toUpperCase()}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        ruleGrid.querySelectorAll('.rule-swatch').forEach(sw => {
            sw.addEventListener('click', () => copyColor(sw.dataset.hex, sw));
        });
    }

    // =========================================
    // Upload Handling
    // =========================================

    uploadArea.addEventListener('click', (e) => {
        if (e.target.closest('.remove-btn')) return;
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // Drag & Drop
    uploadArea.addEventListener('dragenter', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFile(file);
        }
    });

    function handleFile(file) {
        if (file.size > 10 * 1024 * 1024) {
            showToast('⚠️ Arquivo muito grande. Máximo: 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageSrc = e.target.result;
            previewImage.src = currentImageSrc;
            uploadContent.style.display = 'none';
            uploadPreview.style.display = 'flex';
            colorCountSelector.style.display = 'block';
            resultsSection.style.display = 'none';

            // Animate in
            uploadPreview.style.opacity = '0';
            uploadPreview.style.transform = 'scale(0.95)';
            requestAnimationFrame(() => {
                uploadPreview.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                uploadPreview.style.opacity = '1';
                uploadPreview.style.transform = 'scale(1)';
            });
        };
        reader.readAsDataURL(file);
    }

    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetUpload();
    });

    function resetUpload() {
        currentImageSrc = null;
        fileInput.value = '';
        previewImage.src = '';
        uploadContent.style.display = 'flex';
        uploadPreview.style.display = 'none';
        colorCountSelector.style.display = 'none';
        resultsSection.style.display = 'none';
    }

    // Color count buttons
    countBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            countBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedColorCount = parseInt(btn.dataset.count);
        });
    });

    // =========================================
    // Generate Palette
    // =========================================

    generateBtn.addEventListener('click', () => {
        if (!currentImageSrc) return;

        generateBtn.classList.add('loading');
        generateBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Processando...
        `;

        // Use setTimeout to allow UI update before heavy computation
        setTimeout(() => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    processImage(img);
                } catch (err) {
                    console.error(err);
                    showToast('❌ Erro ao processar a imagem');
                }
                generateBtn.classList.remove('loading');
                generateBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    Gerar Paleta
                `;
            };
            img.onerror = () => {
                showToast('❌ Erro ao carregar imagem');
                generateBtn.classList.remove('loading');
            };
            img.src = currentImageSrc;
        }, 100);
    });

    function processImage(img) {
        // Extract dominant colors
        let colors = ColorExtractor.extract(img, selectedColorCount + 4);
        colors = ColorExtractor.deduplicateColors(colors);
        colors = colors.slice(0, selectedColorCount);

        // Re-calculate percentages
        const total = colors.reduce((s, c) => s + c.percent, 0);
        colors.forEach(c => c.percent = Math.round((c.percent / total) * 100));

        // Generate shades for each dominant color
        const palettes = colors.map(c => ({
            base: c,
            shades: ColorExtractor.generateShades(c.hex, 10)
        }));

        // Generate neutrals
        const neutrals = ColorExtractor.generateNeutrals(colors);

        // Assign 60-30-10 roles based on selected mode
        const roles = assignRoles(colors, themeMode);

        currentPaletteData = { colors, palettes, neutrals, roles };

        renderResults(currentPaletteData);

        // Scroll to results
        resultsSection.style.display = 'block';
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // =========================================
    // Render Results
    // =========================================

    function renderResults({ colors, palettes, neutrals, roles }) {
        renderRule(roles);
        renderDominantColors(colors);
        renderPalettes(palettes);
        renderNeutrals(neutrals);
        renderThemeJSON(colors, palettes, roles);
        renderDashboardPreview(colors, palettes, roles);
    }

    function renderDominantColors(colors) {
        dominantColorsEl.innerHTML = '';
        colors.forEach((c, i) => {
            const card = document.createElement('div');
            card.className = 'color-card';
            card.style.animationDelay = `${i * 0.05}s`;
            card.innerHTML = `
                <div class="color-swatch" style="background-color: ${c.hex}"></div>
                <div class="color-info">
                    <div class="color-hex">${c.hex.toUpperCase()}</div>
                    <div class="color-percent">${c.percent}% do logo</div>
                </div>
            `;
            card.addEventListener('click', () => copyColor(c.hex, card));
            dominantColorsEl.appendChild(card);
        });
    }

    function renderPalettes(palettes) {
        paletteContainer.innerHTML = '';
        palettes.forEach((p, pi) => {
            const row = document.createElement('div');
            row.className = 'palette-row';
            row.style.animationDelay = `${pi * 0.08}s`;

            row.innerHTML = `
                <div class="palette-row-header">
                    <div class="palette-row-swatch" style="background-color: ${p.base.hex}"></div>
                    <span class="palette-row-label">Cor ${pi + 1}</span>
                    <span class="palette-row-hex">${p.base.hex.toUpperCase()}</span>
                </div>
                <div class="palette-shades">
                    ${p.shades.map(s => `
                        <div class="palette-shade" data-hex="${s.hex}">
                            <div class="shade-color" style="background-color: ${s.hex}"></div>
                            <span class="shade-label">${s.label}</span>
                            <span class="shade-hex">${s.hex.toUpperCase()}</span>
                        </div>
                    `).join('')}
                </div>
            `;

            row.querySelectorAll('.palette-shade').forEach(shade => {
                shade.addEventListener('click', () => {
                    copyColor(shade.dataset.hex, shade);
                });
            });

            paletteContainer.appendChild(row);
        });
    }

    function renderNeutrals(neutrals) {
        neutralsGrid.innerHTML = '';
        neutrals.forEach((n, i) => {
            const card = document.createElement('div');
            card.className = 'neutral-card';
            card.innerHTML = `
                <div class="neutral-swatch" style="background-color: ${n.hex}"></div>
                <div class="neutral-label">${n.label}</div>
                <div class="neutral-hex">${n.hex.toUpperCase()}</div>
            `;
            card.addEventListener('click', () => copyColor(n.hex, card));
            neutralsGrid.appendChild(card);
        });
    }

    function renderThemeJSON(colors, palettes, roles) {
        const { base, main, accent, others, mode } = roles;
        const isDark = mode === 'dark';

        // Data colors ordered by 60-30-10: main (30%) first, accent (10%) second, then the rest
        const dataColors = [main.hex, accent.hex, ...others.map(c => c.hex)]
            .filter((hex, i, arr) => arr.indexOf(hex) === i);

        const mainPalette = palettes.find(p => p.base.hex === main.hex) || palettes[0];

        const theme = {
            name: `RW Brand Theme — ${isDark ? 'Escuro' : 'Claro'} (60-30-10)`,
            dataColors: dataColors,
            background: base.surface,
            foreground: base.text,
            tableAccent: accent.hex,
            maximum: main.hex,
            center: mainPalette?.shades[4]?.hex || main.hex,
            minimum: isDark
                ? (mainPalette?.shades[8]?.hex || base.surface)
                : (mainPalette?.shades[1]?.hex || base.canvas),
            good: "#22c55e",
            neutral: base.textSecondary,
            bad: "#ef4444",
            textClasses: {
                title: { color: base.text, fontFace: "Segoe UI Semibold", fontSize: 14 },
                label: { color: base.textSecondary, fontFace: "Segoe UI", fontSize: 10 },
                callout: { color: base.text, fontFace: "Segoe UI", fontSize: 28 },
                header: { color: base.text, fontFace: "Segoe UI Semibold", fontSize: 12 }
            },
            visualStyles: {
                "*": {
                    "*": {
                        "*": [{
                            fontSize: 10,
                            fontFamily: "Segoe UI",
                            color: { solid: { color: base.text } }
                        }],
                        background: [{
                            color: { solid: { color: base.surface } },
                            transparency: 0
                        }],
                        border: [{
                            show: true,
                            color: { solid: { color: base.border } },
                            radius: 8
                        }],
                        title: [{
                            show: true,
                            fontColor: { solid: { color: base.text } },
                            background: { solid: { color: base.surface } },
                            fontSize: 12
                        }]
                    }
                },
                page: {
                    "*": {
                        background: [{
                            color: { solid: { color: base.canvas } },
                            transparency: 0
                        }],
                        outspace: [{
                            color: { solid: { color: base.canvas } },
                            transparency: 0
                        }]
                    }
                }
            }
        };

        const jsonStr = JSON.stringify(theme, null, 2);
        themeJsonEl.textContent = jsonStr;

        // Copy JSON button
        copyJsonBtn.onclick = () => {
            navigator.clipboard.writeText(jsonStr).then(() => {
                showToast('✅ JSON copiado!');
                copyJsonBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copiado!
                `;
                setTimeout(() => {
                    copyJsonBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copiar JSON
                    `;
                }, 2000);
            });
        };

        // Download JSON button
        downloadJsonBtn.onclick = () => {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `power-bi-theme-${themeMode === 'dark' ? 'escuro' : 'claro'}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('✅ Tema baixado!');
        };
    }

    function renderDashboardPreview(colors, palettes, roles) {
        const { base, main, accent } = roles;
        const kpiText = ColorExtractor.getContrastColor(base.surface);

        // 60% = canvas + surfaces | 30% = main color on charts | 10% = accent highlights
        dashboardPreview.style.background = base.canvas;
        dashboardPreview.style.borderColor = base.border;

        const kpis = [
            { label: 'Receita', value: 'R$ 2.4M', highlight: false },
            { label: 'Margem', value: '34.2%', highlight: false },
            { label: 'Clientes', value: '1.847', highlight: false },
            { label: 'Ticket Médio', value: 'R$ 189', highlight: true }
        ];

        dashboardPreview.innerHTML = `
            <div class="preview-header" style="border-color:${base.border}">
                <div class="preview-title" style="color:${ColorExtractor.getContrastColor(base.canvas)}">
                    <div class="preview-title-dot" style="background:${accent.hex}"></div>
                    Dashboard Comercial
                </div>
                <span class="preview-date" style="color:${base.textSecondary}">Mar 2026</span>
            </div>

            <div class="preview-kpis">
                ${kpis.map(k => {
                    const bg = k.highlight ? accent.hex : base.surface;
                    const txt = k.highlight ? ColorExtractor.getContrastColor(accent.hex) : kpiText;
                    const topBar = k.highlight ? 'transparent' : main.hex;
                    return `
                        <div class="preview-kpi" style="background:${bg};border:1px solid ${base.border}">
                            <div class="preview-kpi-topbar" style="background:${topBar}"></div>
                            <div class="preview-kpi-label" style="color:${txt};opacity:0.7;">${k.label}</div>
                            <div class="preview-kpi-value" style="color:${txt}">${k.value}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="preview-charts">
                <div class="preview-chart" style="background:${base.surface};border-color:${base.border}">
                    <div class="preview-chart-title" style="color:${base.textSecondary}">Vendas por Mês</div>
                    <div class="preview-bars">
                        ${generateBars(main.hex, accent.hex)}
                    </div>
                </div>
                <div class="preview-chart" style="background:${base.surface};border-color:${base.border}">
                    <div class="preview-chart-title" style="color:${base.textSecondary}">Distribuição</div>
                    <div class="preview-donut-wrapper">
                        ${generateDonut(colors, base.surface)}
                    </div>
                </div>
            </div>

            <div class="preview-rule-legend">
                <span class="preview-legend-item" style="color:${base.textSecondary}">
                    <span class="preview-legend-dot" style="background:${base.canvas};border:1px solid ${base.border}"></span>
                    60% Base
                </span>
                <span class="preview-legend-item" style="color:${base.textSecondary}">
                    <span class="preview-legend-dot" style="background:${main.hex}"></span>
                    30% Principal
                </span>
                <span class="preview-legend-item" style="color:${base.textSecondary}">
                    <span class="preview-legend-dot" style="background:${accent.hex}"></span>
                    10% Destaque
                </span>
            </div>
        `;
    }

    function generateBars(mainHex, accentHex) {
        const heights = [45, 65, 55, 80, 70, 90, 75, 85, 60, 70, 55, 95];
        const maxH = Math.max(...heights);
        // 30% color on all bars; 10% accent only on the peak
        return heights.map(h => {
            const color = h === maxH ? accentHex : mainHex;
            return `<div class="preview-bar" style="height:${h}%;background:${color};"></div>`;
        }).join('');
    }

    function generateDonut(colors, holeColor) {
        const total = colors.length;
        const segments = colors.map((c, i) => {
            const percent = c.percent || (100 / total);
            return { color: c.hex, percent };
        });

        // Normalize
        const sum = segments.reduce((a, b) => a + b.percent, 0);
        segments.forEach(s => s.percent = (s.percent / sum) * 100);

        let cumulativePercent = 0;
        const gradientParts = [];

        segments.forEach(s => {
            const start = cumulativePercent;
            cumulativePercent += s.percent;
            gradientParts.push(`${s.color} ${start}% ${cumulativePercent}%`);
        });

        const gradient = `conic-gradient(${gradientParts.join(', ')})`;

        return `
            <svg class="preview-donut" viewBox="0 0 36 36">
                <foreignObject x="0" y="0" width="36" height="36">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="
                        width:36px;height:36px;border-radius:50%;
                        background:${gradient};
                        display:flex;align-items:center;justify-content:center;
                    ">
                        <div style="width:18px;height:18px;border-radius:50%;background:${holeColor};"></div>
                    </div>
                </foreignObject>
            </svg>
        `;
    }

    // =========================================
    // Copy Color
    // =========================================

    function copyColor(hex, element) {
        navigator.clipboard.writeText(hex.toUpperCase()).then(() => {
            showToast(`✅ ${hex.toUpperCase()} copiado!`);

            element.classList.add('copied');
            setTimeout(() => {
                element.classList.remove('copied');
            }, 1500);
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = hex.toUpperCase();
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast(`✅ ${hex.toUpperCase()} copiado!`);
        });
    }

    // =========================================
    // Toast
    // =========================================

    let toastTimeout;
    function showToast(message) {
        clearTimeout(toastTimeout);
        toastMessage.textContent = message;
        toast.classList.add('show');
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    // =========================================
    // New Upload
    // =========================================

    newUploadBtn.addEventListener('click', () => {
        resetUpload();
        document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' });
    });

    // =========================================
    // CSS for spinner animation
    // =========================================
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .spin {
            animation: spin 1s linear infinite;
        }
        
        .color-card, .palette-row, .neutral-card {
            animation: cardFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        
        @keyframes cardFadeIn {
            from {
                opacity: 0;
                transform: translateY(16px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

})();
