/**
 * map.js — Leaflet.js Mapping Layer
 * Handles Karachi map rendering, pin coloring, and popups.
 */

'use strict';

const BloodMap = (() => {
  let mapInstance = null;
  let markerGroup = null;
  let routeGroup = null;

  // Center coordinate of Karachi: [latitude, longitude]
  const KARACHI_CENTER = [24.8607, 67.0011];
  const DEFAULT_ZOOM = 12;

  /**
   * Initialize Leaflet map.
   * @param {string} elementId - Container HTML element ID
   * @returns {Object|null} Map instance or null if element not found
   */
  function init(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return null;

    // Avoid double initialization
    if (mapInstance) {
      mapInstance.remove();
    }

    // Initialize Map with custom options
    mapInstance = L.map(elementId, {
      zoomControl: true,
      scrollWheelZoom: true,
      fadeAnimation: true
    }).setView(KARACHI_CENTER, DEFAULT_ZOOM);

    // Modern light-mode clinical tile layer: CartoDB Positron
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstance);

    routeGroup = L.layerGroup().addTo(mapInstance);
    markerGroup = L.layerGroup().addTo(mapInstance);
    return mapInstance;
  }

  function drawTopologyRoutes(features) {
    if (!mapInstance || !routeGroup) return;

    routeGroup.clearLayers();

    const criticalNodes = features
      .filter(feature => feature.properties.hasCriticalShortage)
      .map(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        return {
          lat,
          lng,
          name: feature.properties.name,
          branch: feature.properties.branch,
          criticalCount: feature.properties.criticalTypes ? feature.properties.criticalTypes.length : 0
        };
      })
      .sort((a, b) => b.criticalCount - a.criticalCount)
      .slice(0, 6);

    for (let i = 0; i < criticalNodes.length - 1; i += 1) {
      const from = criticalNodes[i];
      const to = criticalNodes[i + 1];
      const route = L.polyline(
        [
          [from.lat, from.lng],
          [to.lat, to.lng]
        ],
        {
          color: '#760009',
          weight: 3,
          opacity: 0.55,
          dashArray: '8 10',
          lineCap: 'round',
          interactive: true
        }
      ).bindTooltip(
        `${from.name}${from.branch ? ` (${from.branch})` : ''} -> ${to.name}${to.branch ? ` (${to.branch})` : ''}`,
        { sticky: true, className: 'clinical-popup' }
      );

      routeGroup.addLayer(route);
    }
  }

  /**
   * Fetch blood bank geo data and plot on the map
   */
  async function loadMapPins() {
    if (!mapInstance || !markerGroup) return;

    try {
      markerGroup.clearLayers();
      const geoData = await API.getMapData();

      if (geoData.success && geoData.features) {
        drawTopologyRoutes(geoData.features);

        geoData.features.forEach(feature => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties;

          // Determine marker color based on shortage status
          let markerColor = '#10b981'; // Green (No critical shortage)
          let statusText = 'Normal Stock';
          let borderStyle = 'border-emerald-500';

          if (props.hasCriticalShortage) {
            markerColor = '#ba1a1a'; // Red (Critical shortage)
            const criticalCount = props.criticalTypes ? props.criticalTypes.length : 0;
            statusText = `${criticalCount} CRITICAL TYPE${criticalCount === 1 ? '' : 'S'}`;
            borderStyle = 'border-rose-600 animate-pulse';
          } else if (props.totalUnits < props.alertThreshold * 2) {
            markerColor = '#f59e0b'; // Amber (Low stock)
            statusText = 'Low Inventory';
            borderStyle = 'border-amber-500';
          }

          // Custom DivIcon for clinical glowing blips instead of generic Leaflet pins
          const customIcon = L.divIcon({
            className: 'custom-blip',
            html: `
              <div class="relative flex items-center justify-center w-8 h-8">
                <div class="absolute w-8 h-8 rounded-full bg-white border-2 ${borderStyle} shadow-lg flex items-center justify-center">
                  <span class="material-symbols-outlined text-[16px]" style="color: ${markerColor}; font-variation-settings: 'FILL' 1;">water_drop</span>
                </div>
                <div class="absolute w-4 h-4 rounded-full" style="background-color: ${markerColor}; opacity: 0.3; transform: scale(1.5); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          // Build inventory summary HTML
          let inventoryHtml = '';
          if (props.inventory) {
            inventoryHtml = Object.entries(props.inventory)
              .map(([type, entry]) => {
                const isCritical = props.criticalTypes.includes(type);
                const bg = isCritical ? 'bg-rose-100 text-rose-800 font-bold' : 'bg-slate-100 text-slate-700';
                return `<span class="px-2 py-0.5 rounded text-xs ${bg}">${Utils.formatBloodType(type)}: ${entry.units}</span>`;
              })
              .join(' ');
          }

          const popupContent = `
            <div class="p-3 max-w-xs font-sans text-slate-800">
              <div class="flex justify-between items-start mb-2 gap-sm">
                <div>
                  <h4 class="text-sm font-bold text-slate-900">${props.name}</h4>
                  <p class="text-[11px] text-slate-500">${props.branch || 'Main Branch'}</p>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style="background-color: ${markerColor}20; color: ${markerColor}; border: 1px solid ${markerColor}40">
                  ${statusText}
                </span>
              </div>
              <p class="text-xs text-slate-600 mb-2"><span class="font-semibold">Address:</span> ${props.address}</p>
              <p class="text-xs text-slate-600 mb-2"><span class="font-semibold">Contact:</span> ${props.contact}</p>
              <div class="mb-3">
                <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Stock Availability</p>
                <div class="flex flex-wrap gap-1">
                  ${inventoryHtml || '<span class="text-xs text-slate-400">Empty</span>'}
                </div>
              </div>
              <p class="text-[11px] text-slate-500 mb-3">
                Map color reflects this facility's local stock status. The homepage counter counts city-wide blood-type groups.
              </p>
              <button data-schedule-donation="${props.id}" class="schedule-donation-btn w-full text-center bg-[#760009] text-white py-1.5 rounded text-xs font-bold hover:bg-opacity-95 transition-opacity">
                Schedule Donation Here
              </button>
            </div>
          `;

          const marker = L.marker([lat, lng], { icon: customIcon })
            .bindPopup(popupContent, { maxWidth: 280, className: 'clinical-popup' });

          markerGroup.addLayer(marker);
        });
      }
    } catch (error) {
      console.error('Failed to load map pins:', error);
    }
  }

  /**
   * Search for blood bank with specified type and zoom map to it
   */
  async function searchAndFocus(bloodType, neighborhood) {
    if (!mapInstance) return;

    try {
      const searchRes = await API.searchBlood(bloodType, neighborhood);
      if (searchRes.success && searchRes.data.length > 0) {
        // Clear highlights
        loadMapPins();

        // Get the first matching bank
        const topBank = searchRes.data[0];
        const [lng, lat] = topBank.location.coordinates;

        // Focus map and pop open the bubble
        mapInstance.flyTo([lat, lng], 14, { duration: 1.5 });
        
        // Find marker to open popup (simulated delay for camera panning)
        setTimeout(() => {
          markerGroup.eachLayer(marker => {
            const latLng = marker.getLatLng();
            if (Math.abs(latLng.lat - lat) < 0.0001 && Math.abs(latLng.lng - lng) < 0.0001) {
              marker.openPopup();
            }
          });
        }, 1600);

        return searchRes.data;
      } else {
        Utils.showToast(`No active supply found for ${Utils.formatBloodType(bloodType)} in the selected region.`, 'warning');
        return [];
      }
    } catch (e) {
      Utils.showToast('Search query failed. Please try again.', 'error');
    }
  }

  return {
    init,
    loadMapPins,
    searchAndFocus,
    getMapInstance() { return mapInstance; }
  };
})();

// Handle schedule donation button clicks
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('schedule-donation-btn')) {
    const bankId = e.target.getAttribute('data-schedule-donation');
    window.location.href = `/login.html?redirect=donor-dashboard.html&bankId=${bankId}`;
  }
});
