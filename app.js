// app.js

document.addEventListener('DOMContentLoaded', () => {
    // Basic DOM elements
    const mapElement = document.getElementById('map');
    const resetBtn = document.getElementById('reset-view');
    const layerStatus = document.getElementById('layer-status');
    const selectionPrompt = document.getElementById('selection-prompt');
    const detailsPanel = document.getElementById('details-panel');
    
    // Details panel DOM elements
    const detailSectorTitle = document.getElementById('detail-sector-title');
    const tagTrinchera = document.getElementById('tag-trinchera');
    const tagUnidad = document.getElementById('tag-unidad');
    const tagExt = document.getElementById('tag-ext');
    const galleryCount = document.getElementById('gallery-count');
    const imageGallery = document.getElementById('image-gallery');
    
    // Search elements
    const searchInput = document.getElementById('search-rasgo');
    const searchBtn = document.getElementById('search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    
    // Modal DOM elements
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalCaption = document.getElementById('modal-caption');
    const closeModal = document.querySelector('.close-modal');

    // State
    let geojsonData = null;
    let imagesData = null;
    let geojsonLayer = null;
    let map = null;
    
    // Style configurations for GeoJSON Polygons
    const styles = {
        default: {
            color: '#f0f2f5',       // Stroke Color
            weight: 1.5,            // Stroke Weight
            fillColor: '#cba86a',   // Fill Color (Primary)
            fillOpacity: 0.4        // Fill Opacity
        },
        hover: {
            color: '#ffffff',
            weight: 2,
            fillColor: '#e0be81',
            fillOpacity: 0.7
        },
        active: {
            color: '#cba86a',
            weight: 3,
            fillColor: '#cba86a',
            fillOpacity: 0.8
        }
    };
    
    let activeFeature = null;

    // 1. Initialize Leaflet Map
    function initMap() {
        // Dark themed base map provider (CartoDB Dark Matter)
        const darkBasemap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        });

        // Initialize map (Centered on Ecuador roughly, but bounds will auto-adjust)
        map = L.map('map', {
            center: [-0.94, -77.86], 
            zoom: 15,
            layers: [darkBasemap],
            zoomControl: false // Disable default to move it via CSS later if needed
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        loadData();
    }

    // 2. Load Data (GeoJSON and Images JSON) via globally included scripts
    async function loadData() {
        try {
            layerStatus.textContent = "Cargando componentes...";
            
            // Access variables from the loaded scripts
            if (typeof window.geojsonData === 'undefined' || typeof window.imagesData === 'undefined') {
                throw new Error("Local data vars missing. Ensure data_geojson.js and data_images.js are loaded.");
            }
            
            geojsonData = window.geojsonData;
            imagesData = window.imagesData;
            
            renderGeoJSON();
            layerStatus.textContent = "Datos cargados y sincronizados";
            
        } catch (error) {
            console.error("Data load error:", error);
            layerStatus.textContent = "Error al cargar datos";
            layerStatus.style.color = "#ff6b6b";
        }
    }

    // 3. Render GeoJSON to Map
    function renderGeoJSON() {
        if (geojsonLayer) {
            map.removeLayer(geojsonLayer);
        }

        geojsonLayer = L.geoJSON(geojsonData, {
            style: styles.default,
            onEachFeature: onEachFeature
        }).addTo(map);

        // Fit map bounds to the loaded GeoJSON data
        if (geojsonLayer.getBounds().isValid()) {
            map.fitBounds(geojsonLayer.getBounds(), { padding: [50, 50] });
        }
    }

    // 4. Handle Polygon Interactions
    function onEachFeature(feature, layer) {
        // Create tooltip
        const sectorName = feature.properties.Sector ? `Sector ${feature.properties.Sector}` : "Sector Desconocido";
        const trincheraName = feature.properties.Trinchera ? ` - Trinchera ${feature.properties.Trinchera}` : "";
        
        layer.bindTooltip(`${sectorName}${trincheraName}`, {
            className: 'arch-tooltip',
            direction: 'top',
            sticky: true
        });

        // Events
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: selectFeature
        });
    }

    function highlightFeature(e) {
        const layer = e.target;
        if (activeFeature !== layer) {
            layer.setStyle(styles.hover);
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        }
    }

    function resetHighlight(e) {
        const layer = e.target;
        if (activeFeature !== layer) {
            geojsonLayer.resetStyle(layer);
        }
    }

    function selectFeature(e) {
        const layer = e.target;
        
        // Reset previously active feature style
        if (activeFeature) {
            geojsonLayer.resetStyle(activeFeature);
        }
        
        // Set new active feature
        activeFeature = layer;
        layer.setStyle(styles.active);
        
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }

        // Zoom slightly to feature
        map.fitBounds(layer.getBounds(), { padding: [100, 100], maxZoom: 18 });

        // Update UI
        updateSidebar(layer.feature.properties || {});
    }

    // 5. Update Sidebar Content
    function updateSidebar(properties) {
        // Toggle view
        selectionPrompt.classList.add('hidden');
        detailsPanel.classList.remove('hidden');
        
        // Update texts
        const sector = properties.Sector || 'Desconocido';
        const trinchera = properties.Trinchera || 'N/A';
        const ext = properties.Ext || '0';
        const unidad = properties.Unidad || 'N/A';
        
        detailSectorTitle.textContent = `Sector ${sector}`;
        tagTrinchera.textContent = `Trinchera: ${trinchera}`;
        tagExt.textContent = `Extensión: ${ext}`;
        tagUnidad.textContent = `Unidad: ${unidad}`;
        
        // Load Gallery
        loadGallery(sector, trinchera);
    }

    // 6. Construct Image Gallery
    function loadGallery(sectorId, trincheraId, specificRasgo = null) {
        imageGallery.innerHTML = ''; // Clear previous
        let images = [];
        
        if (specificRasgo && imagesData.Rasgos && imagesData.Rasgos[specificRasgo]) {
            images = imagesData.Rasgos[specificRasgo];
            galleryCount.textContent = `${images.length} fotos encontradas para el Rasgo ${specificRasgo}`;
            detailSectorTitle.textContent = `Búsqueda: Rasgo ${specificRasgo}`;
            tagTrinchera.textContent = images[0].trinchera ? `Trinchera: ${images[0].trinchera}` : 'Varios';
            tagExt.textContent = ``;
            tagUnidad.textContent = ``;
        } else if (imagesData && imagesData.Trincheras && imagesData.Trincheras[trincheraId]) {
            images = imagesData.Trincheras[trincheraId];
            galleryCount.textContent = `${images.length} fotos disponibles para Trinchera ${trincheraId}`;
        }

        if (images.length === 0) {
            let msg = specificRasgo ? `No se encontraron imágenes para el Rasgo ${specificRasgo}.` : `No hay registro fotográfico para Trinchera ${trincheraId}.`;
            galleryCount.textContent = "0 fotos disponibles";
            imageGallery.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); padding: 20px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: var(--border-radius-sm);">${msg}</div>`;
            return;
        }

        images.forEach(imgObj => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            const img = document.createElement('img');
            img.src = imgObj.src;
            img.alt = `Fotografía Rasgo ${imgObj.rasgo || 'N/A'}`;
            img.loading = "lazy";
            
            item.appendChild(img);
            
            // Text overlay for Rasgo tag
            if (imgObj.rasgo) {
                const badge = document.createElement('div');
                badge.style.position = 'absolute';
                badge.style.top = '8px';
                badge.style.right = '8px';
                badge.style.background = 'rgba(203,168,106,0.85)';
                badge.style.color = '#121418';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '4px';
                badge.style.fontSize = '11px';
                badge.style.fontWeight = 'bold';
                badge.style.zIndex = '3';
                badge.textContent = `R: ${imgObj.rasgo}`;
                item.appendChild(badge);
            }
            
            // Text overlay for Description
            if (imgObj.descripcion) {
                const descBadge = document.createElement('div');
                descBadge.style.position = 'absolute';
                descBadge.style.bottom = '0';
                descBadge.style.left = '0';
                descBadge.style.right = '0';
                descBadge.style.background = 'rgba(0,0,0,0.7)';
                descBadge.style.color = 'var(--text-main)';
                descBadge.style.padding = '6px 8px';
                descBadge.style.fontSize = '12px';
                descBadge.style.zIndex = '2';
                
                // Allow overflow or truncate
                descBadge.style.whiteSpace = 'nowrap';
                descBadge.style.overflow = 'hidden';
                descBadge.style.textOverflow = 'ellipsis';

                descBadge.textContent = imgObj.descripcion;
                item.appendChild(descBadge);
            }
            
            // Click to open modal
            item.addEventListener('click', () => {
                let desc = imgObj.descripcion ? ` - ${imgObj.descripcion}` : '';
                let title = imgObj.rasgo ? `Rasgo ${imgObj.rasgo}` : `Trinchera ${imgObj.trinchera}`;
                openModal(imgObj.src, `${title}${desc}`);
            });
            
            imageGallery.appendChild(item);
        });
    }

    // 7. Reset View Button
    resetBtn.addEventListener('click', () => {
        if (geojsonLayer && geojsonLayer.getBounds().isValid()) {
            map.fitBounds(geojsonLayer.getBounds(), { padding: [50, 50] });
        }
        
        if (activeFeature) {
            geojsonLayer.resetStyle(activeFeature);
            activeFeature = null;
        }
        
        detailsPanel.classList.add('hidden');
        selectionPrompt.classList.remove('hidden');
    });

    // 8. Modal Handlers
    function openModal(src, caption) {
        modalImg.src = src;
        modalCaption.textContent = caption;
        modal.classList.remove('hidden');
    }

    function closeImageModal() {
        modal.classList.add('hidden');
        setTimeout(() => { modalImg.src = ''; }, 200);
    }

    closeModal.addEventListener('click', closeImageModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
            closeImageModal();
        }
    });
    
    // Listen for Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeImageModal();
        }
    });

    // 9. Search Functionality
    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        
        if (activeFeature) {
            geojsonLayer.resetStyle(activeFeature);
            activeFeature = null;
        }
        
        if (imagesData && imagesData.Rasgos && imagesData.Rasgos[query]) {
            selectionPrompt.classList.add('hidden');
            detailsPanel.classList.remove('hidden');
            clearSearchBtn.classList.remove('hidden');
            
            loadGallery(null, null, query);
            
            // Highlight Trinchera on map if exists
            const featureTrinchera = imagesData.Rasgos[query][0].trinchera;
            if (featureTrinchera && geojsonLayer) {
                const layers = geojsonLayer.getLayers();
                const targetLayer = layers.find(l => l.feature.properties.Trinchera == featureTrinchera);
                if (targetLayer) {
                    activeFeature = targetLayer;
                    targetLayer.setStyle(styles.active);
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        targetLayer.bringToFront();
                    }
                    map.fitBounds(targetLayer.getBounds(), { padding: [100, 100], maxZoom: 18 });
                }
            }
        } else {
            alert(`No se encontró el rasgo ${query}`);
        }
    }
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        resetBtn.click(); // reuse reset logic
    });

    // Boot Up
    initMap();
});
