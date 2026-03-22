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

        currentPaletteData = { colors, palettes, neutrals };

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

    function renderResults({ colors, palettes, neutrals }) {
        renderDominantColors(colors);
        renderPalettes(palettes);
        renderNeutrals(neutrals);
        renderThemeJSON(colors, palettes);
        renderDashboardPreview(colors, palettes);
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

    function renderThemeJSON(colors, palettes) {
        // Build Power BI theme JSON
        const dataColors = colors.map(c => c.hex);

        // Create foreground / background from neutrals
        const theme = {
            name: "Custom Brand Theme",
            dataColors: dataColors,
            background: "#ffffff",
            foreground: "#1a1a1a",
            tableAccent: colors[0]?.hex || "#6366f1",
            maximum: colors[0]?.hex || "#6366f1",
            center: palettes[0]?.shades[3]?.hex || "#a0a0a0",
            minimum: palettes[0]?.shades[1]?.hex || "#e0e0e0",
            good: colors.length > 1 ? colors[1].hex : "#34d399",
            neutral: "#a1a1aa",
            bad: "#ef4444",
            visualStyles: {
                "*": {
                    "*": {
                        "*": [{
                            fontSize: 10,
                            fontFamily: "Segoe UI",
                            color: { solid: { color: "#333333" } }
                        }]
                    }
                },
                page: {
                    "*": {
                        background: [{
                            color: { solid: { color: "#f8f9fa" } },
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
            a.download = 'power-bi-theme.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast('✅ Tema baixado!');
        };
    }

    function renderDashboardPreview(colors, palettes) {
        const c = colors;
        const primary = c[0]?.hex || '#6366f1';
        const secondary = c[1]?.hex || '#a855f7';
        const tertiary = c[2]?.hex || '#34d399';
        const quaternary = c[3]?.hex || '#f59e0b';

        const lightShades = palettes.map(p => p.shades[1]?.hex || '#f0f0f0');
        const darkShades = palettes.map(p => p.shades[7]?.hex || '#333333');

        dashboardPreview.innerHTML = `
            <div class="preview-header">
                <div class="preview-title">
                    <div class="preview-title-dot" style="background:${primary}"></div>
                    Dashboard Comercial
                </div>
                <span class="preview-date">Mar 2026</span>
            </div>

            <div class="preview-kpis">
                <div class="preview-kpi" style="background: ${lightShades[0] || '#f0f0f0'}; color: ${darkShades[0] || '#333'}">
                    <div class="preview-kpi::before" style="background:${primary}"></div>
                    <div class="preview-kpi-label" style="color: ${ColorExtractor.getContrastColor(lightShades[0] || '#f0f0f0')}; opacity: 0.7;">Receita</div>
                    <div class="preview-kpi-value" style="color: ${ColorExtractor.getContrastColor(lightShades[0] || '#f0f0f0')}">R$ 2.4M</div>
                </div>
                <div class="preview-kpi" style="background: ${lightShades[1] || lightShades[0] || '#f0f0f0'}; color: ${darkShades[1] || '#333'}">
                    <div class="preview-kpi-label" style="color: ${ColorExtractor.getContrastColor(lightShades[1] || lightShades[0] || '#f0f0f0')}; opacity: 0.7;">Margem</div>
                    <div class="preview-kpi-value" style="color: ${ColorExtractor.getContrastColor(lightShades[1] || lightShades[0] || '#f0f0f0')}">34.2%</div>
                </div>
                <div class="preview-kpi" style="background: ${lightShades[2] || lightShades[0] || '#f0f0f0'}; color: ${darkShades[2] || '#333'}">
                    <div class="preview-kpi-label" style="color: ${ColorExtractor.getContrastColor(lightShades[2] || lightShades[0] || '#f0f0f0')}; opacity: 0.7;">Clientes</div>
                    <div class="preview-kpi-value" style="color: ${ColorExtractor.getContrastColor(lightShades[2] || lightShades[0] || '#f0f0f0')}">1.847</div>
                </div>
                <div class="preview-kpi" style="background: ${lightShades[3] || lightShades[0] || '#f0f0f0'}; color: ${darkShades[3] || '#333'}">
                    <div class="preview-kpi-label" style="color: ${ColorExtractor.getContrastColor(lightShades[3] || lightShades[0] || '#f0f0f0')}; opacity: 0.7;">Ticket Médio</div>
                    <div class="preview-kpi-value" style="color: ${ColorExtractor.getContrastColor(lightShades[3] || lightShades[0] || '#f0f0f0')}">R$ 189</div>
                </div>
            </div>

            <div class="preview-charts">
                <div class="preview-chart">
                    <div class="preview-chart-title">Vendas por Mês</div>
                    <div class="preview-bars">
                        ${generateBars(colors)}
                    </div>
                </div>
                <div class="preview-chart">
                    <div class="preview-chart-title">Distribuição</div>
                    <div class="preview-donut-wrapper">
                        ${generateDonut(colors)}
                    </div>
                </div>
            </div>
        `;

        // Add KPI top border
        dashboardPreview.querySelectorAll('.preview-kpi').forEach((kpi, i) => {
            const color = colors[i % colors.length]?.hex || primary;
            kpi.style.position = 'relative';
            kpi.style.overflow = 'hidden';
            kpi.style.borderRadius = '10px';
            const bar = document.createElement('div');
            bar.style.cssText = `position:absolute;top:0;left:0;right:0;height:3px;background:${color};`;
            kpi.prepend(bar);
        });
    }

    function generateBars(colors) {
        const heights = [45, 65, 55, 80, 70, 90, 75, 85, 60, 70, 55, 95];
        return heights.map((h, i) => {
            const color = colors[i % colors.length]?.hex || '#6366f1';
            return `<div class="preview-bar" style="height:${h}%;background:${color};"></div>`;
        }).join('');
    }

    function generateDonut(colors) {
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
                        <div style="width:18px;height:18px;border-radius:50%;background:#1c1c20;"></div>
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
