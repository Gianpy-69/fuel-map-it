// ============================================
// App – logica principale
// ============================================

// Catalogo foto ad alta risoluzione per marchio
const BRAND_PHOTOS = {
    eni:      'https://investiuser.blob.core.windows.net/public/img/art/xl/21102020110644shutterstock670845049-scaled.jpg',
    q8:       'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQwfPBrpssr0Mk517lbr0XU_Mu7_Wv7JU5IMaP45XHVgg&s=10',
    ip:       'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTC9ZQ--ZwvpHSMltJ2fE3JIbpIyQkW9oGJmSVcoZzxxg&s=10',
    tamoil:   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZNpoLK6WrO8Uz_RVt-Jx4Rsu-Bxo2XHvNlxTZ_-1bog&s=10',
    esso:     'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyJH914sDK3Onv5cduWkU5YyqcZKuK97wOxh1xYE0gpQ&s',
    total:    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSxoAX-X-xqTxbB9aYXmhlfAa5iS26w3tXx65JTR_relA&s=10',
    shell:    'https://www.shell.it/business-customers/shell-fuel-card/helpful-tools/station-locator-and-route-planner/_jcr_content/root/metadata.shellimg.jpeg/1680883986015/shell-station-sunset.jpeg',
    default:  'https://images.unsplash.com/photo-1545459720-aac8509eb02c?auto=format&fit=crop&w=800&q=80'
};

function getBrandPhoto(bandiera) {
    if (!bandiera) return BRAND_PHOTOS.default;
    const b = bandiera.toLowerCase();
    for (const key of Object.keys(BRAND_PHOTOS)) {
        if (b.includes(key)) return BRAND_PHOTOS[key];
    }
    return BRAND_PHOTOS.default;
}

function getLocationSuggestionIcon(kind) {
    if (kind === 'Città') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V7l8-4 8 4v14M2 21h20M8 10h1m6 0h1M8 14h1m6 0h1M10 21v-4h4v4"/></svg>';
    }
    if (kind === 'Via') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3-4 18m12-18 4 18M12 3v3m0 4v4m0 4v3"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
}

// ============================================
// Controller Dynamic Island (Apple Live Activity)
// ============================================
const DynamicIsland = {
    el: null,
    timer: null,
    currentAction: null,

    init() {
        this.el = document.getElementById('dynamicIsland');
        if (!this.el) return;
        this.el.addEventListener('click', () => {
            if (typeof this.currentAction === 'function') {
                this.currentAction();
            }
        });
    },

    show({ icon = '⛽', title, subtitle = '', badge = '', dot = true, duration = 4000, onClick = null, type = 'normal' }) {
        if (!this.el) return;
        clearTimeout(this.timer);

        const iconEl = document.getElementById('islandIcon');
        const dotEl = document.getElementById('islandPulseDot');
        const titleEl = document.getElementById('islandTitle');
        const subEl = document.getElementById('islandSubtitle');
        const badgeEl = document.getElementById('islandBadge');

        if (iconEl) iconEl.textContent = icon;
        if (titleEl) titleEl.textContent = title;
        if (subEl) {
            subEl.textContent = subtitle;
            subEl.classList.toggle('hidden', !subtitle);
        }
        if (badgeEl) {
            badgeEl.textContent = badge;
            badgeEl.classList.toggle('hidden', !badge);
        }
        if (dotEl) dotEl.style.display = dot ? '' : 'none';

        this.currentAction = onClick;

        this.el.className = 'dynamic-island';
        if (type) this.el.classList.add(`island-${type}`);
        this.el.classList.add('island-active');

        if (duration > 0) {
            this.timer = setTimeout(() => this.hide(), duration);
        }
    },

    showDeal(station, distText, isCheapest = false) {
        const carb = App.activeFilters.carburante || 'benzina';
        const price = station[`prezzo_${carb}`] || station.prezzo_benzina || station.prezzo_diesel;
        const priceFormatted = price ? `€ ${parseFloat(price).toFixed(3)}` : 'OFFERTA';
        const brand = station.bandiera || station.nome || 'Distributore';

        this.show({
            icon: isCheapest ? '👑' : '⛽',
            title: brand,
            subtitle: `${isCheapest ? 'Miglior Prezzo' : 'Prezzo Top'} • ${distText}`,
            badge: priceFormatted,
            type: isCheapest ? 'cheapest' : 'deal',
            duration: 8500,
            onClick: () => {
                App.openStationById(station.id);
            }
        });
    },

    showPitStop(station, kmProgress, totalStops = 1) {
        const stopNumber = station.pitStopNumber || 1;
        this.show({
            icon: '🎯',
            title: `Sosta ${stopNumber}/${totalStops} • km ${Math.round(kmProgress)}`,
            subtitle: station.bandiera || station.nome || 'Rifornimento sicuro',
            badge: station.prezzo_benzina ? `€ ${parseFloat(station.prezzo_benzina).toFixed(3)}` : 'TAPPA',
            type: 'pitstop',
            duration: 9000,
            onClick: () => {
                App.openStationById(station.id);
            }
        });
    },

    showStatus(text, icon = '📍', duration = 3000) {
        this.show({
            icon,
            title: text,
            subtitle: '',
            badge: '',
            dot: false,
            duration,
            type: 'compact'
        });
    },

    hide() {
        if (!this.el) return;
        this.el.classList.remove('island-active');
        this.currentAction = null;
    }
};

const App = {
    currentDistributore: null,
    currentLat: 41.9028,
    currentLon: 12.4964,
    isRouteModeActive: false,
    currentRouteStart: null,
    currentRouteDest: null,
    currentPitStops: [],
    isRadarActive: false,
    radarWatchId: null,
    lastGlobalNotificationTime: 0,
    currentDistributoriCache: [],
    favorites: [],
    activeFilters: {
        soloAperti: true,
        soloEconomico: false,
        carburante: null,
        mostraChiusi: false,
        q: ''
    },
    selectedPhotoFile: null,
    selectedTankLiters: 50,
    currentAveragePrice: null,
    cheapestStationId: null,
    currentReportState: {
        stato: null,
        benzina_esaurita: false,
        diesel_esaurito: false,
        coda: null
    },
    searchDebounceTimer: null,
    moveDebounceTimer: null,

    syncFilterControls({ syncRouteFuel = false } = {}) {
        const fuel = this.activeFilters.carburante || 'tutte';
        const fuelLabels = {
            tutte: { text: 'Tutti', dot: '✨' },
            benzina: { text: 'Benzina', dot: '🟢' },
            diesel: { text: 'Diesel', dot: '⚫' },
            gpl: { text: 'GPL', dot: '💧' },
            metano: { text: 'Metano', dot: '💨' }
        };
        const fuelConfig = fuelLabels[fuel] || fuelLabels.tutte;
        const fuelMenu = document.getElementById('fuelDropdownMenu');
        const routeFuelSelect = document.getElementById('routeCarbSelect');
        const fuelLabel = document.getElementById('lblActiveFuel');
        const fuelDot = document.getElementById('activeFuelDot');
        const fuelButton = document.getElementById('btnFuelDropdown');

        if (fuelLabel) fuelLabel.textContent = fuelConfig.text;
        if (fuelDot) fuelDot.textContent = fuelConfig.dot;
        fuelButton?.classList.toggle('active-fuel', fuel !== 'tutte');

        fuelMenu?.querySelectorAll('.dropdown-item').forEach((item) => {
            const isSelected = item.dataset.val === (fuel === 'tutte' ? '' : fuel);
            item.classList.toggle('active', isSelected);
            item.querySelector('.dropdown-check')?.classList.toggle('hidden', !isSelected);
        });

        if (
            routeFuelSelect &&
            (syncRouteFuel || this.activeFilters.carburante) &&
            [...routeFuelSelect.options].some((option) => option.value === fuel)
        ) {
            routeFuelSelect.value = fuel;
        }

        const syncToggle = (ids, isActive) => {
            ids.forEach((id) => {
                const button = document.getElementById(id);
                if (!button) return;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        };

        syncToggle(
            ['btnFilterCheapest', 'btnRouteCheapest'],
            this.activeFilters.soloEconomico
        );
        syncToggle(
            ['btnFilterClosed', 'btnRouteClosed'],
            this.activeFilters.mostraChiusi
        );
    },

    refreshNearbyStations() {
        if (!this.isRouteModeActive) {
            this.loadDistributori(this.currentLat, this.currentLon);
        }
    },

    init() {
        DynamicIsland.init();
        FuelMap.init();

        // Applica prima il filtro salvato, poi carica subito l'area iniziale.
        // La ricerca non deve aspettare che il browser risponda alla richiesta GPS.
        const savedFuel = localStorage.getItem('fuelmap_default_fuel');
        if (savedFuel && savedFuel !== 'tutti') {
            this.activeFilters.carburante = savedFuel;
        }

        this.loadDefault();
        this.bindEvents();
        this.locateUser();
        this.initNotifications();
        this.loadFavorites();
        this.updateFavoritesBadge();
        this.initOnboarding();

        // Registrazione Service Worker per PWA (solo browser web, non su app nativa)
        if ('serviceWorker' in navigator && !window.Capacitor) {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.warn('Service Worker non registrato:', err);
            });
        }

        // Notifiche stato rete (Offline / Online)
        window.addEventListener('offline', () => {
            DynamicIsland.showStatus('Sei offline — uso dati in cache', '📡', 4000);
        });
        window.addEventListener('online', () => {
            DynamicIsland.showStatus('Connessione ripristinata', '🌐', 3000);
            if (this.currentLat && this.currentLon) {
                this.loadDistributori(this.currentLat, this.currentLon);
            }
        });
    },

    bindEvents() {
        this.syncFilterControls();

        // --- Pannello Mappa & Strumenti (Google Maps Layers Style) ---
        const btnTools = document.getElementById('btnTools');
        const toolsModal = document.getElementById('toolsModalCard');
        const btnCloseTools = document.getElementById('btnCloseTools');
        const btnToolFav = document.getElementById('btnToolFavorites');
        const chkRadar = document.getElementById('chkToolRadar');
        const chkSat = document.getElementById('chkToolSatellite');
        const chkTheme = document.getElementById('chkToolTheme');
        const lblFavCount = document.getElementById('lblToolsFavCount');

        const syncToolsState = () => {
            if (chkRadar) chkRadar.checked = this.isRadarActive;
            if (chkSat) chkSat.checked = FuelMap.isSatellite;
            if (chkTheme) chkTheme.checked = FuelMap.isDarkMode;
            if (lblFavCount) {
                const n = this.favorites.length;
                lblFavCount.textContent = `${n} stazion${n === 1 ? 'e salvata' : 'i salvate'}`;
            }
        };

        if (btnTools && toolsModal) {
            btnTools.addEventListener('click', () => {
                syncToolsState();
                toolsModal.classList.toggle('hidden');
            });

            if (btnCloseTools) {
                btnCloseTools.addEventListener('click', () => toolsModal.classList.add('hidden'));
            }

            if (btnToolFav) {
                btnToolFav.addEventListener('click', () => {
                    toolsModal.classList.add('hidden');
                    this.openFavoritesModal();
                });
            }

            if (chkRadar) {
                chkRadar.addEventListener('change', async () => {
                    await this.toggleRadarNotifications();
                    chkRadar.checked = this.isRadarActive;
                });
            }

            if (chkSat) {
                chkSat.addEventListener('change', () => {
                    FuelMap.toggleSatellite();
                });
            }

            if (chkTheme) {
                chkTheme.addEventListener('change', () => {
                    const isDark = FuelMap.toggleDarkMode();
                    document.body.classList.toggle('dark-theme', isDark);
                    localStorage.setItem('fuelmap_theme', isDark ? 'dark' : 'light');
                });
            }

            // Carburante Predefinito all'Avvio (Impostazioni)
            const selDefFuel = document.getElementById('selectDefaultFuel');
            if (selDefFuel) {
                const savedDefFuel = localStorage.getItem('fuelmap_default_fuel') || 'tutti';
                selDefFuel.value = savedDefFuel;
                selDefFuel.addEventListener('change', (e) => {
                    const fuel = e.target.value;
                    localStorage.setItem('fuelmap_default_fuel', fuel);
                    this.applyFuelFilter(fuel);
                    DynamicIsland.showStatus(`Predefinito: ${fuel.toUpperCase()}`, '⛽', 2500);
                });
            }

            // Tasto Invia Feedback nel Pannello Strumenti
            const btnToolFeedback = document.getElementById('btnToolFeedback');
            const feedbackModal = document.getElementById('feedbackModalCard');
            const btnCloseFeedback = document.getElementById('btnCloseFeedback');
            const btnSubmitFeedback = document.getElementById('btnSubmitFeedback');
            const txtFeedbackMsg = document.getElementById('txtFeedbackMsg');
            const txtFeedbackEmail = document.getElementById('txtFeedbackEmail');

            if (btnToolFeedback && feedbackModal) {
                btnToolFeedback.addEventListener('click', () => {
                    toolsModal.classList.add('hidden');
                    feedbackModal.classList.remove('hidden');
                    if (txtFeedbackMsg) txtFeedbackMsg.focus();
                });
            }

            if (btnCloseFeedback && feedbackModal) {
                btnCloseFeedback.addEventListener('click', () => {
                    feedbackModal.classList.add('hidden');
                });
            }

            // Tasto Chi Siamo / About nel Pannello Strumenti
            const btnToolAbout = document.getElementById('btnToolAbout');
            const aboutModal = document.getElementById('aboutModalCard');
            const btnCloseAbout = document.getElementById('btnCloseAbout');

            if (btnToolAbout && aboutModal) {
                btnToolAbout.addEventListener('click', () => {
                    toolsModal.classList.add('hidden');
                    aboutModal.classList.remove('hidden');
                });
            }

            if (btnCloseAbout && aboutModal) {
                btnCloseAbout.addEventListener('click', () => {
                    aboutModal.classList.add('hidden');
                });
            }

            const btnReplayTutorial = document.getElementById('btnReplayTutorial');
            if (btnReplayTutorial && aboutModal) {
                btnReplayTutorial.addEventListener('click', () => {
                    aboutModal.classList.add('hidden');
                    this.openOnboarding(true);
                });
            }

            if (btnSubmitFeedback && txtFeedbackMsg) {
                btnSubmitFeedback.addEventListener('click', async () => {
                    const msg = txtFeedbackMsg.value.trim();
                    const email = txtFeedbackEmail ? txtFeedbackEmail.value.trim() : null;
                    if (msg.length < 3) {
                        this.showToast('⚠️ Scrivi almeno qualche parola nel messaggio');
                        return;
                    }

                    btnSubmitFeedback.disabled = true;
                    btnSubmitFeedback.textContent = 'Invio in corso...';

                    try {
                        await API.inviaFeedback(msg, email);
                        feedbackModal.classList.add('hidden');
                        txtFeedbackMsg.value = '';
                        if (txtFeedbackEmail) txtFeedbackEmail.value = '';
                        DynamicIsland.showStatus('Grazie per il tuo feedback! ❤️', '💬', 3500);
                        this.showToast('✅ Feedback inviato con successo!');
                    } catch (err) {
                        this.showToast(`❌ ${err.message}`);
                    } finally {
                        btnSubmitFeedback.disabled = false;
                        btnSubmitFeedback.innerHTML = '<span>Invia Messaggio</span>';
                    }
                });
            }

            // Auto-adattamento iniziale al tema salvato o all'orario
            this.initAutoTheme();
        }

        // Tasto Chiudi Modal Preferiti
        const btnCloseFav = document.getElementById('btnCloseFavorites');
        if (btnCloseFav) {
            btnCloseFav.addEventListener('click', () => {
                document.getElementById('favoritesModalCard').classList.add('hidden');
            });
        }

        // Tasto Salva/Rimuovi Preferito nel Bottom Sheet
        const btnFav = document.getElementById('btnFavoriteStation');
        if (btnFav) {
            btnFav.addEventListener('click', () => {
                this.toggleFavoriteCurrentStation();
            });
        }

        // Bottone localizzazione
        document.getElementById('btnLocate').addEventListener('click', () => {
            this.locateUser();
        });

        // Tasto Condividi (Web Share API)
        const btnShare = document.getElementById('btnShareStation');
        if (btnShare) {
            btnShare.addEventListener('click', () => {
                this.shareCurrentStation();
            });
        }

        // Selettore Litri Serbatoio per Calcolatore Risparmio
        document.querySelectorAll('.tank-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.tank-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.selectedTankLiters = parseInt(pill.dataset.litri, 10);
                this.updateSavingsBadge();
            });
        });

        // Bottone Cerca in quest'area
        const btnSearchArea = document.getElementById('btnSearchArea');
        if (btnSearchArea) {
            btnSearchArea.addEventListener('click', () => {
                btnSearchArea.classList.add('hidden');
                const { lat, lon, radius } = FuelMap.getCenterAndRadius();
                this.loadDistributori(lat, lon, radius);
            });
        }

        // Input Ricerca con Autocomplete Suggerimenti (Stile Google Maps)
        const searchInput = document.getElementById('searchInput');
        const btnClear = document.getElementById('btnClearSearch');
        const suggestionsWrap = document.getElementById('searchSuggestions');
        const searchBar = searchInput?.closest('.search-bar');

        if (searchInput && btnClear && suggestionsWrap) {
            let currentSuggestions = [];
            let activeSuggestionIndex = -1;
            let suggestionsRequestId = 0;
            let suggestionsController = null;

            const cancelPendingSuggestions = () => {
                clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = null;
                suggestionsRequestId++;

                if (suggestionsController) {
                    suggestionsController.abort();
                    suggestionsController = null;
                }

                return suggestionsRequestId;
            };

            const hideSuggestions = () => {
                suggestionsWrap.classList.add('hidden');
                searchBar?.classList.remove('has-suggestions');
                searchInput.setAttribute('aria-expanded', 'false');
                searchInput.removeAttribute('aria-activedescendant');
                currentSuggestions = [];
                activeSuggestionIndex = -1;
                suggestionsWrap.innerHTML = '';
            };

            const showSuggestions = () => {
                suggestionsWrap.classList.remove('hidden');
                searchBar?.classList.add('has-suggestions');
                searchInput.setAttribute('aria-expanded', 'true');
            };

            const renderEmptyState = (message, icon = '⌕') => {
                suggestionsWrap.innerHTML = `
                    <div class="suggestion-state" role="status" aria-live="polite">
                        <span class="suggestion-state-icon" aria-hidden="true">${icon}</span>
                        <span>${this.escapeHtml(message)}</span>
                    </div>
                `;
                showSuggestions();
            };

            const renderSuggestions = () => {
                suggestionsWrap.innerHTML = currentSuggestions.map((item, index) => `
                    <div id="search-suggestion-${index}" class="suggestion-item" role="option" aria-selected="false" data-index="${index}">
                        <span class="suggestion-icon">${getLocationSuggestionIcon(item.kind)}</span>
                        <span class="suggestion-content">
                            <span class="suggestion-title">${this.escapeHtml(item.title)}</span>
                            <span class="suggestion-subtitle">${this.escapeHtml(item.subtitle)}</span>
                        </span>
                    </div>
                `).join('');
                showSuggestions();
            };

            const setActiveSuggestion = (index) => {
                if (!currentSuggestions.length) return;

                activeSuggestionIndex = index;
                suggestionsWrap.querySelectorAll('.suggestion-item').forEach((element, itemIndex) => {
                    const isActive = itemIndex === activeSuggestionIndex;
                    element.classList.toggle('active', isActive);
                    element.setAttribute('aria-selected', String(isActive));
                });

                searchInput.setAttribute('aria-activedescendant', `search-suggestion-${activeSuggestionIndex}`);
                suggestionsWrap.querySelector('.suggestion-item.active')?.scrollIntoView({ block: 'nearest' });
            };

            const selectSuggestion = (item) => {
                cancelPendingSuggestions();
                hideSuggestions();
                const fullText = item.title + (item.subtitle ? `, ${item.subtitle}` : '');
                searchInput.value = fullText;
                btnClear.classList.remove('hidden');

                this.currentLat = item.lat;
                this.currentLon = item.lon;
                this.activeFilters.q = '';

                FuelMap.flyTo(item.lat, item.lon, item.icon === '🏙️' ? 13 : 15);
                this.loadDistributori(item.lat, item.lon);
                DynamicIsland.showStatus(`Arrivato a ${item.title}`, '📍', 3000);
            };

            suggestionsWrap.addEventListener('click', (event) => {
                const row = event.target.closest('.suggestion-item');
                if (!row) return;

                const index = Number.parseInt(row.dataset.index, 10);
                if (currentSuggestions[index]) {
                    selectSuggestion(currentSuggestions[index]);
                }
            });

            searchInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                btnClear.classList.toggle('hidden', val.length === 0);
                this.activeFilters.q = '';
                const requestId = cancelPendingSuggestions();
                currentSuggestions = [];
                activeSuggestionIndex = -1;
                searchInput.removeAttribute('aria-activedescendant');

                if (val.length < 2) {
                    hideSuggestions();
                    if (!val) this.loadDistributori(this.currentLat, this.currentLon);
                    return;
                }

                renderEmptyState('Cerco luoghi…', '');

                // Debounce e annulla le richieste precedenti per non mostrare risultati fuori ordine.
                this.searchDebounceTimer = setTimeout(async () => {
                    const controller = typeof AbortController === 'function'
                        ? new AbortController()
                        : null;
                    suggestionsController = controller;

                    try {
                        const suggestions = await API.getSearchSuggestions(val, {
                            signal: controller?.signal
                        });
                        if (requestId !== suggestionsRequestId || val !== searchInput.value.trim()) return;

                        currentSuggestions = suggestions;

                        if (!suggestions || suggestions.length === 0) {
                            renderEmptyState('Nessun risultato. Premi Invio per cercare comunque.');
                            return;
                        }

                        renderSuggestions();
                    } catch (err) {
                        if (err?.name === 'AbortError' || requestId !== suggestionsRequestId) return;
                        console.warn('Errore recupero suggerimenti:', err);
                        renderEmptyState('Suggerimenti non disponibili. Premi Invio per cercare.');
                    } finally {
                        if (suggestionsController === controller) suggestionsController = null;
                    }
                }, 300);
            });

            // Invio su input ricerca (Enter)
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' && currentSuggestions.length) {
                    e.preventDefault();
                    const nextIndex = activeSuggestionIndex < 0
                        ? 0
                        : (activeSuggestionIndex + 1) % currentSuggestions.length;
                    setActiveSuggestion(nextIndex);
                    return;
                }

                if (e.key === 'ArrowUp' && currentSuggestions.length) {
                    e.preventDefault();
                    const previousIndex = activeSuggestionIndex < 0
                        ? currentSuggestions.length - 1
                        : (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
                    setActiveSuggestion(previousIndex);
                    return;
                }

                if (e.key === 'Escape') {
                    cancelPendingSuggestions();
                    hideSuggestions();
                    return;
                }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    const selectedSuggestion = currentSuggestions[activeSuggestionIndex] || currentSuggestions[0];
                    if (selectedSuggestion) {
                        selectSuggestion(selectedSuggestion);
                    } else if (searchInput.value.trim().length > 0) {
                        const submittedQuery = searchInput.value.trim();
                        cancelPendingSuggestions();
                        hideSuggestions();
                        API.geocode(submittedQuery).then(loc => {
                            if (searchInput.value.trim() !== submittedQuery) return;
                            this.currentLat = loc.lat;
                            this.currentLon = loc.lon;
                            FuelMap.flyTo(loc.lat, loc.lon, 14);
                            this.loadDistributori(loc.lat, loc.lon);
                            DynamicIsland.showStatus(`Arrivato a ${loc.nome}`, '📍', 3000);
                        }).catch(() => {
                            if (searchInput.value.trim() !== submittedQuery) return;
                            this.activeFilters.q = searchInput.value.trim();
                            this.loadDistributori(this.currentLat, this.currentLon);
                        });
                    }
                }
            });

            // Chiudi suggerimenti cliccando altrove
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-bar')) {
                    cancelPendingSuggestions();
                    hideSuggestions();
                }
            });

            btnClear.addEventListener('click', () => {
                cancelPendingSuggestions();
                searchInput.value = '';
                btnClear.classList.add('hidden');
                hideSuggestions();
                this.activeFilters.q = '';
                this.loadDistributori(this.currentLat, this.currentLon);
            });
        }

        // 1. Custom Dropdown Carburanti Flottante (Stile Fintech / Google Maps)
        const fuelWrap = document.getElementById('fuelDropdownWrap');
        const btnFuelDrop = document.getElementById('btnFuelDropdown');
        const menuFuelDrop = document.getElementById('fuelDropdownMenu');

        if (btnFuelDrop && menuFuelDrop) {
            btnFuelDrop.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = menuFuelDrop.classList.contains('hidden');
                menuFuelDrop.classList.toggle('hidden', !isHidden);
                if (fuelWrap) fuelWrap.classList.toggle('open', isHidden);
            });

            // Selezione carburante dal menu
            menuFuelDrop.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = item.dataset.val;
                    this.activeFilters.carburante = val || null;
                    this.syncFilterControls({ syncRouteFuel: true });

                    // Chiudi il menù
                    menuFuelDrop.classList.add('hidden');
                    if (fuelWrap) fuelWrap.classList.remove('open');

                    // Ricarica la mappa con il nuovo filtro
                    this.refreshNearbyStations();
                });
            });

            // Chiudi al click ovunque all'esterno
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#fuelDropdownWrap')) {
                    menuFuelDrop.classList.add('hidden');
                    if (fuelWrap) fuelWrap.classList.remove('open');
                }
            });
        }

        // 2. Tasto Toggle Più Economico
        const btnCheapest = document.getElementById('btnFilterCheapest');
        if (btnCheapest) {
            btnCheapest.addEventListener('click', () => {
                this.activeFilters.soloEconomico = !this.activeFilters.soloEconomico;
                this.syncFilterControls();
                this.refreshNearbyStations();
            });
        }

        // 3. Tasto Toggle Mostra Chiusi
        const btnClosed = document.getElementById('btnFilterClosed');
        if (btnClosed) {
            btnClosed.addEventListener('click', () => {
                this.activeFilters.mostraChiusi = !this.activeFilters.mostraChiusi;
                this.activeFilters.soloAperti = !this.activeFilters.mostraChiusi;
                this.syncFilterControls();
                this.refreshNearbyStations();
            });
        }

        // Overlay e tasto X chiudono il bottom sheet
        const sheetOverlay = document.getElementById('sheetOverlay');
        if (sheetOverlay) {
            sheetOverlay.addEventListener('click', () => {
                this.closeSheet();
            });
        }
        const btnCloseSheet = document.getElementById('btnCloseSheet');
        if (btnCloseSheet) {
            btnCloseSheet.addEventListener('click', () => {
                this.closeSheet();
            });
        }

        // Gestione allegato foto
        const btnPhoto = document.getElementById('btnTriggerPhoto');
        const inputPhoto = document.getElementById('inputPhoto');
        const previewWrap = document.getElementById('photoPreviewWrap');
        const imgPreview = document.getElementById('imgPreviewUpload');
        const btnRemovePhoto = document.getElementById('btnRemovePhoto');

        if (btnPhoto && inputPhoto) {
            btnPhoto.addEventListener('click', () => inputPhoto.click());

            inputPhoto.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.selectedPhotoFile = file;
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        imgPreview.src = re.target.result;
                        previewWrap.classList.remove('hidden');
                        btnPhoto.classList.add('hidden');
                    };
                    reader.readAsDataURL(file);
                }
                this.updateSubmitButtonState();
            });

            btnRemovePhoto.addEventListener('click', () => {
                this.selectedPhotoFile = null;
                inputPhoto.value = '';
                previewWrap.classList.add('hidden');
                btnPhoto.classList.remove('hidden');
                this.updateSubmitButtonState();
            });
        }

        // Gestione Segmented Control (Aperto / Chiuso)
        document.querySelectorAll('.segment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.val;
                const isSelected = btn.classList.contains('selected');

                document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('selected'));

                if (!isSelected) {
                    btn.classList.add('selected');
                    this.currentReportState.stato = val;
                } else {
                    this.currentReportState.stato = null;
                }
                this.updateSubmitButtonState();
            });
        });

        // Gestione Tag Chips (Pompe a secco & Coda)
        document.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const group = chip.dataset.group;
                const val = chip.dataset.val;
                const isSelected = chip.classList.contains('selected');

                if (group === 'pompa') {
                    chip.classList.toggle('selected', !isSelected);
                    if (val === 'benzina') this.currentReportState.benzina_esaurita = !isSelected;
                    if (val === 'diesel') this.currentReportState.diesel_esaurito = !isSelected;
                } else if (group === 'coda') {
                    document.querySelectorAll('.tag-chip[data-group="coda"]').forEach(c => c.classList.remove('selected'));
                    if (!isSelected) {
                        chip.classList.add('selected');
                        this.currentReportState.coda = parseInt(val, 10);
                    } else {
                        this.currentReportState.coda = null;
                    }
                }
                this.updateSubmitButtonState();
            });
        });

        // Pulsante Invia Segnalazione
        const btnSubmitReport = document.getElementById('btnSubmitReport');
        if (btnSubmitReport) {
            btnSubmitReport.addEventListener('click', () => {
                this.submitFullReport();
            });
        }

        // ============================================
        // Gestione Ricerca Lungo il Percorso (A ➔ B)
        // ============================================
        const btnOpenRoute = document.getElementById('btnOpenRoute');
        const routeModal = document.getElementById('routeModalCard');
        const btnCloseRoute = document.getElementById('btnCloseRoute');
        const btnCalcRoute = document.getElementById('btnCalcRoute');
        const btnClearRoute = document.getElementById('btnClearRoute');
        const startInput = document.getElementById('routeStartInput');
        const destInput = document.getElementById('routeDestInput');
        const routeFuelSelect = document.getElementById('routeCarbSelect');
        const btnRouteCheapest = document.getElementById('btnRouteCheapest');
        const btnRouteClosed = document.getElementById('btnRouteClosed');

        if (btnOpenRoute && routeModal) {
            routeFuelSelect?.addEventListener('change', () => {
                this.activeFilters.carburante = routeFuelSelect.value === 'tutte'
                    ? null
                    : routeFuelSelect.value;
                this.syncFilterControls({ syncRouteFuel: true });
            });

            btnRouteCheapest?.addEventListener('click', () => {
                this.activeFilters.soloEconomico = !this.activeFilters.soloEconomico;
                this.syncFilterControls();
            });

            btnRouteClosed?.addEventListener('click', () => {
                this.activeFilters.mostraChiusi = !this.activeFilters.mostraChiusi;
                this.activeFilters.soloAperti = !this.activeFilters.mostraChiusi;
                this.syncFilterControls();
            });

            const setupRouteAutocomplete = (input, suggestionsWrap) => {
                if (!input || !suggestionsWrap) {
                    return { hide: () => {}, clearSelection: () => {} };
                }

                const searchWrap = input.closest('.route-search-wrap');
                let currentSuggestions = [];
                let activeSuggestionIndex = -1;
                let suggestionsRequestId = 0;
                let debounceTimer = null;
                let suggestionsController = null;

                const clearSelection = () => {
                    delete input.dataset.selectedLocationValue;
                    delete input.dataset.selectedLocationTitle;
                    delete input.dataset.selectedLocationLat;
                    delete input.dataset.selectedLocationLon;
                };

                const cancelPendingSuggestions = () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = null;
                    suggestionsRequestId++;

                    if (suggestionsController) {
                        suggestionsController.abort();
                        suggestionsController = null;
                    }

                    return suggestionsRequestId;
                };

                const hideSuggestions = () => {
                    suggestionsWrap.classList.add('hidden');
                    searchWrap?.classList.remove('has-suggestions');
                    input.setAttribute('aria-expanded', 'false');
                    input.removeAttribute('aria-activedescendant');
                    currentSuggestions = [];
                    activeSuggestionIndex = -1;
                    suggestionsWrap.innerHTML = '';
                };

                const showSuggestions = () => {
                    suggestionsWrap.classList.remove('hidden');
                    searchWrap?.classList.add('has-suggestions');
                    input.setAttribute('aria-expanded', 'true');
                };

                const renderEmptyState = (message, icon = '⌕') => {
                    suggestionsWrap.innerHTML = `
                        <div class="suggestion-state" role="status" aria-live="polite">
                            <span class="suggestion-state-icon" aria-hidden="true">${icon}</span>
                            <span>${this.escapeHtml(message)}</span>
                        </div>
                    `;
                    showSuggestions();
                };

                const renderSuggestions = () => {
                    suggestionsWrap.innerHTML = currentSuggestions.map((item, index) => `
                        <div id="${input.id}-suggestion-${index}" class="suggestion-item" role="option" aria-selected="false" data-index="${index}">
                            <span class="suggestion-icon">${getLocationSuggestionIcon(item.kind)}</span>
                            <span class="suggestion-content">
                                <span class="suggestion-title">${this.escapeHtml(item.title)}</span>
                                <span class="suggestion-subtitle">${this.escapeHtml(item.subtitle)}</span>
                            </span>
                        </div>
                    `).join('');
                    showSuggestions();
                };

                const setActiveSuggestion = (index) => {
                    if (!currentSuggestions.length) return;

                    activeSuggestionIndex = index;
                    suggestionsWrap.querySelectorAll('.suggestion-item').forEach((element, itemIndex) => {
                        const isActive = itemIndex === activeSuggestionIndex;
                        element.classList.toggle('active', isActive);
                        element.setAttribute('aria-selected', String(isActive));
                    });

                    input.setAttribute('aria-activedescendant', `${input.id}-suggestion-${activeSuggestionIndex}`);
                    suggestionsWrap.querySelector('.suggestion-item.active')?.scrollIntoView({ block: 'nearest' });
                };

                const selectSuggestion = (item) => {
                    cancelPendingSuggestions();
                    const fullText = item.title + (item.subtitle ? `, ${item.subtitle}` : '');
                    input.value = fullText;
                    input.dataset.selectedLocationValue = fullText;
                    input.dataset.selectedLocationTitle = item.title;
                    input.dataset.selectedLocationLat = String(item.lat);
                    input.dataset.selectedLocationLon = String(item.lon);
                    hideSuggestions();
                };

                suggestionsWrap.addEventListener('click', (event) => {
                    const row = event.target.closest('.suggestion-item');
                    if (!row) return;

                    const index = Number.parseInt(row.dataset.index, 10);
                    if (currentSuggestions[index]) {
                        selectSuggestion(currentSuggestions[index]);
                    }
                });

                input.addEventListener('input', () => {
                    const val = input.value.trim();
                    if (input.dataset.selectedLocationValue !== val) clearSelection();

                    const requestId = cancelPendingSuggestions();
                    currentSuggestions = [];
                    activeSuggestionIndex = -1;
                    input.removeAttribute('aria-activedescendant');

                    if (val.length < 2) {
                        hideSuggestions();
                        return;
                    }

                    renderEmptyState('Cerco luoghi…', '');
                    debounceTimer = setTimeout(async () => {
                        const controller = typeof AbortController === 'function'
                            ? new AbortController()
                            : null;
                        suggestionsController = controller;

                        try {
                            const suggestions = await API.getSearchSuggestions(val, {
                                signal: controller?.signal
                            });
                            if (requestId !== suggestionsRequestId || val !== input.value.trim()) return;

                            currentSuggestions = suggestions || [];
                            if (!currentSuggestions.length) {
                                renderEmptyState('Nessun risultato. Premi Invio per cercare comunque.');
                                return;
                            }

                            renderSuggestions();
                        } catch (err) {
                            if (err?.name === 'AbortError' || requestId !== suggestionsRequestId) return;
                            console.warn('Errore recupero suggerimenti percorso:', err);
                            renderEmptyState('Suggerimenti non disponibili. Premi Invio per cercare.');
                        } finally {
                            if (suggestionsController === controller) suggestionsController = null;
                        }
                    }, 300);
                });

                input.addEventListener('keydown', (event) => {
                    if (event.key === 'ArrowDown' && currentSuggestions.length) {
                        event.preventDefault();
                        const nextIndex = activeSuggestionIndex < 0
                            ? 0
                            : (activeSuggestionIndex + 1) % currentSuggestions.length;
                        setActiveSuggestion(nextIndex);
                        return;
                    }

                    if (event.key === 'ArrowUp' && currentSuggestions.length) {
                        event.preventDefault();
                        const previousIndex = activeSuggestionIndex < 0
                            ? currentSuggestions.length - 1
                            : (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
                        setActiveSuggestion(previousIndex);
                        return;
                    }

                    if (event.key === 'Escape') {
                        cancelPendingSuggestions();
                        hideSuggestions();
                        return;
                    }

                    if (event.key !== 'Enter') return;

                    const selectedSuggestion = currentSuggestions[activeSuggestionIndex] || currentSuggestions[0];
                    if (selectedSuggestion) {
                        event.preventDefault();
                        selectSuggestion(selectedSuggestion);
                        return;
                    }

                    const query = input.value.trim();
                    const isCurrentLocation = input === startInput && query.toLowerCase().includes('posizione');
                    if (query.length < 2 || isCurrentLocation) return;

                    event.preventDefault();
                    const requestId = cancelPendingSuggestions();
                    hideSuggestions();
                    API.geocode(query).then((location) => {
                        if (requestId !== suggestionsRequestId || input.value.trim() !== query) return;
                        selectSuggestion({
                            title: location.nome || query,
                            subtitle: '',
                            lat: location.lat,
                            lon: location.lon
                        });
                    }).catch(() => {
                        if (requestId !== suggestionsRequestId || input.value.trim() !== query) return;
                        renderEmptyState('Luogo non trovato. Controlla la ricerca.');
                    });
                });

                return {
                    hide() {
                        cancelPendingSuggestions();
                        hideSuggestions();
                    },
                    clearSelection
                };
            };

            const startAutocomplete = setupRouteAutocomplete(
                startInput,
                document.getElementById('routeStartSuggestions')
            );
            const destAutocomplete = setupRouteAutocomplete(
                destInput,
                document.getElementById('routeDestSuggestions')
            );
            const hideRouteSuggestions = () => {
                startAutocomplete.hide();
                destAutocomplete.hide();
            };

            document.addEventListener('click', (event) => {
                if (!event.target.closest('#routeModalCard .route-search-wrap')) {
                    hideRouteSuggestions();
                }
            });

            btnOpenRoute.addEventListener('click', () => {
                if (!routeModal.classList.contains('hidden')) hideRouteSuggestions();
                routeModal.classList.toggle('hidden');
                if (!routeModal.classList.contains('hidden')) {
                    this.syncFilterControls();
                    if (FuelMap.userLat && FuelMap.userLon && (!startInput.value || startInput.value.includes('posizione'))) {
                        startInput.value = 'La mia posizione attuale';
                    }
                    destInput.focus();
                }
            });

            if (btnCloseRoute) {
                btnCloseRoute.addEventListener('click', () => {
                    hideRouteSuggestions();
                    routeModal.classList.add('hidden');
                });
            }

            if (btnClearRoute) {
                btnClearRoute.addEventListener('click', () => {
                    hideRouteSuggestions();
                    this.isRouteModeActive = false;
                    this.currentRouteStart = null;
                    this.currentRouteDest = null;
                    this.currentPitStops = [];
                    FuelMap.clearRoute();
                    btnClearRoute.classList.add('hidden');
                    destInput.value = '';
                    destAutocomplete.clearSelection();
                    routeModal.classList.add('hidden');
                    this.closeSheet();
                    this.loadDistributori(this.currentLat, this.currentLon);
                    this.showToast('Tracciato percorso rimosso');
                });
            }

            // Slider Autonomia Residua (Pit-Stop Planner)
            const sliderAutonomia = document.getElementById('inputAutonomia');
            const lblAutonomia = document.getElementById('lblAutonomiaVal');
            if (sliderAutonomia && lblAutonomia) {
                sliderAutonomia.addEventListener('input', (e) => {
                    lblAutonomia.textContent = `${e.target.value} km`;
                });
            }

            if (btnCalcRoute) {
                btnCalcRoute.addEventListener('click', () => this.calculateRouteAndFindFuel());
            }
        }
    },

    async calculateRouteAndFindFuel() {
        const startInput = document.getElementById('routeStartInput');
        const destInput = document.getElementById('routeDestInput');
        const carbSelect = document.getElementById('routeCarbSelect');
        const typeSelect = document.getElementById('routeTypeSelect');
        const routeModal = document.getElementById('routeModalCard');
        const btnCalc = document.getElementById('btnCalcRoute');
        const btnClear = document.getElementById('btnClearRoute');
        const sliderAutonomia = document.getElementById('inputAutonomia');

        const startVal = startInput.value.trim();
        const destVal = destInput.value.trim();
        const carburante = carbSelect.value;
        const preferenza = typeSelect ? typeSelect.value : 'tutte';
        const includiChiusi = this.activeFilters.mostraChiusi;
        const autonomiaKm = sliderAutonomia ? parseInt(sliderAutonomia.value, 10) : 250;
        const getSelectedLocation = (input, value) => {
            if (!input || input.dataset.selectedLocationValue !== value) return null;

            const lat = Number(input.dataset.selectedLocationLat);
            const lon = Number(input.dataset.selectedLocationLon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

            return {
                lat,
                lon,
                nome: input.dataset.selectedLocationTitle || value
            };
        };

        if (!destVal) {
            this.showToast('⚠️ Inserisci una destinazione (es. Firenze)');
            destInput.focus();
            return;
        }

        btnCalc.disabled = true;
        btnCalc.innerHTML = '<span>⏳ Calcolo rotta e prezzi...</span>';

        try {
            // 1. Coordinate di partenza
            let startCoord = null;
            const selectedStartLocation = getSelectedLocation(startInput, startVal);
            if (startVal.toLowerCase().includes('posizione') && FuelMap.userLat && FuelMap.userLon) {
                startCoord = { lat: FuelMap.userLat, lon: FuelMap.userLon, nome: 'La mia posizione' };
            } else if (selectedStartLocation) {
                startCoord = selectedStartLocation;
            } else if (startVal) {
                startCoord = await API.geocode(startVal);
            } else if (FuelMap.userLat && FuelMap.userLon) {
                startCoord = { lat: FuelMap.userLat, lon: FuelMap.userLon, nome: 'La mia posizione' };
            } else {
                startCoord = { lat: this.currentLat, lon: this.currentLon, nome: 'Roma' };
            }

            // 2. Coordinate di arrivo
            const destCoord = getSelectedLocation(destInput, destVal) || await API.geocode(destVal);

            // Salva coordinate correnti per waypoint Google Maps
            this.currentRouteStart = startCoord;
            this.currentRouteDest = destCoord;

            // 3. Calcola tracciato stradale OSRM
            const route = await API.getOsrmRoute(startCoord.lon, startCoord.lat, destCoord.lon, destCoord.lat);

            // 4. Disegna percorso blu sulla mappa
            FuelMap.drawRoute(route.geometry);

            // 5. Cerca distributori lungo il buffer del tracciato secondo la preferenza (Autostrada / Risparmio)
            const fuelRes = await API.getDistributoriSuPercorso(
                route.geometry,
                carburante,
                preferenza,
                autonomiaKm,
                includiChiusi
            );
            const stations = fuelRes.distributori;

            if (!stations || stations.length === 0) {
                this.showToast('Nessun distributore aperto trovato direttamente sul tracciato');
                return;
            }

            // Attiva la modalità percorso (garantisce che escano SOLO le pompe del percorso)
            this.isRouteModeActive = true;

            const distTotKm = route.distance / 1000;
            const mins = (route.duration / 60).toFixed(0);

            // 6. Calcolo Pit-Stop Planner: progressione e finestra di sosta sicura
            const { cumDist } = this.calculateStationRouteProgress(
                route.geometry.coordinates,
                stations,
                distTotKm
            );
            const routePlan = carburante === 'tutte'
                ? {
                    pitStops: [],
                    safeWindows: [],
                    complete: false,
                    remainingDistanceKm: distTotKm
                }
                : this.planRoutePitStops(
                    stations.filter((station) => station.stato !== 'chiuso'),
                    autonomiaKm,
                    distTotKm,
                    carburante
                );
            const { pitStops, safeWindows, complete, remainingDistanceKm } = routePlan;
            this.currentPitStops = pitStops;
            FuelMap.drawRefuelZones(route.geometry.coordinates, cumDist, safeWindows);

            if (distTotKm > autonomiaKm) {
                if (carburante === 'tutte') {
                    this.showToast('Per suggerire le soste in base all’autonomia, scegli il carburante del veicolo.');
                } else if (complete) {
                    this.showToast(`⛽ Servono ${pitStops.length} soste per ${distTotKm.toFixed(0)} km. Le trovi numerate sulla mappa.`);
                } else if (pitStops.length) {
                    this.showToast(`⚠️ Ho trovato ${pitStops.length} soste, ma non pompe entro autonomia per gli ultimi ${remainingDistanceKm.toFixed(0)} km.`);
                } else {
                    this.showToast(`⚠️ Autonomia insufficiente: non ho trovato pompe entro ${autonomiaKm} km dalla partenza.`);
                }
            } else {
                this.showToast(`🟢 Autonomia sufficiente (${autonomiaKm} km su ${distTotKm.toFixed(0)} km). ${stations.length} pompe sul tragitto (~${mins} min)!`);
            }

            // Trova anche la pompa in assoluto più conveniente dell'intero viaggio
            const routePrice = (station) => {
                if (carburante !== 'tutte') {
                    const price = Number.parseFloat(station[`prezzo_${carburante}`]);
                    return Number.isFinite(price) && price > 0 ? price : Infinity;
                }
                return Infinity;
            };

            let minPrice = Infinity;
            let cheapestStation = null;
            if (carburante !== 'tutte') {
                stations.forEach(d => {
                    const p = routePrice(d);
                    if (p < minPrice) {
                        minPrice = p;
                        cheapestStation = d;
                    }
                });
            }

            const cheapestId = cheapestStation ? cheapestStation.id : null;
            this.cheapestStationId = cheapestId;

            // 7. Mostra ESCLUSIVAMENTE le pompe sul percorso con indicatori sosta/corona
            let displayStations = stations;
            if (this.activeFilters.soloEconomico) {
                if (carburante === 'tutte') {
                    const averagesByFuel = {};
                    ['benzina', 'diesel', 'gpl', 'metano'].forEach((fuel) => {
                        const prices = stations
                            .filter((station) => station[`${fuel}_disponibile`] === true)
                            .map((station) => Number.parseFloat(station[`prezzo_${fuel}`]))
                            .filter((price) => Number.isFinite(price) && price > 0);
                        if (prices.length) {
                            averagesByFuel[fuel] = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                        }
                    });

                    displayStations = stations.filter((station) =>
                        station.isRecommendedPitStop ||
                        Object.entries(averagesByFuel).some(([fuel, average]) => {
                            const price = Number.parseFloat(station[`prezzo_${fuel}`]);
                            return station[`${fuel}_disponibile`] === true &&
                                Number.isFinite(price) &&
                                price > 0 &&
                                price <= average;
                        })
                    );
                } else {
                    const pricedStations = stations
                        .map((station) => ({ station, price: routePrice(station) }))
                        .filter((entry) => Number.isFinite(entry.price));
                    const averagePrice = pricedStations.length
                        ? pricedStations.reduce((sum, entry) => sum + entry.price, 0) / pricedStations.length
                        : null;

                    if (averagePrice !== null) {
                        displayStations = stations.filter((station) =>
                            station.isRecommendedPitStop || routePrice(station) <= averagePrice
                        );
                    }
                }
            }

            FuelMap.renderDistributori(
                displayStations,
                cheapestId,
                carburante === 'tutte' ? null : carburante
            );

            btnClear.classList.remove('hidden');
            routeModal.classList.add('hidden');

            // Evidenzia il piano e la prima sosta consigliata.
            if (pitStops.length) {
                DynamicIsland.showPitStop(
                    pitStops[0],
                    pitStops[0].progressioneKm,
                    pitStops.length
                );
            } else if (cheapestStation) {
                DynamicIsland.showDeal(cheapestStation, `Al km ${Math.round(cheapestStation.progressioneKm || 0)}`, true);
            } else if (carburante === 'tutte') {
                DynamicIsland.showStatus(`${displayStations.length} pompe sul percorso`, '⛽', 5000);
            }

            // 8. Apri subito la sosta consigliata se necessaria per autonomia, oppure la più economica
            const bestToOpen = pitStops[0] || cheapestStation || stations[0];
            if (bestToOpen) {
                setTimeout(() => {
                    this.openSheet(bestToOpen, bestToOpen.id === cheapestId);
                }, 700);
            }

        } catch (err) {
            console.error('Errore percorso:', err);
            this.showToast(`❌ ${err.message || 'Errore durante la ricerca'}`);
        } finally {
            btnCalc.disabled = false;
            btnCalc.innerHTML = '<span>🔍 Trova Pompe sul Percorso</span>';
        }
    },

    planRoutePitStops(stations, autonomyKm, totalDistanceKm, fuel) {
        const safeWindowEndKm = Math.min(
            autonomyKm * 0.9,
            autonomyKm - Math.max(5, autonomyKm * 0.05)
        );
        const safeWindowStartKm = Math.max(
            0,
            safeWindowEndKm - Math.max(5, autonomyKm * 0.1)
        );
        const pitStops = [];
        const safeWindows = [];
        const usedStationIds = new Set();
        let lastStopKm = 0;
        const maxIterations = Math.min(
            100,
            Math.max(1, Math.ceil(totalDistanceKm / Math.max(safeWindowStartKm, 1)) + 1)
        );

        const stationPrice = (station) => {
            const rawPrice = station[`prezzo_${fuel}`] ?? station.prezzo_benzina ?? station.prezzo_diesel;
            const price = Number.parseFloat(rawPrice);
            return Number.isFinite(price) && price > 0 ? price : Infinity;
        };

        const compareCandidates = (first, second) => {
            const firstPrice = stationPrice(first);
            const secondPrice = stationPrice(second);
            const progressDifference = second.progressioneKm - first.progressioneKm;
            const priceToleranceKm = Math.min(3, autonomyKm * 0.05);

            if (Math.abs(progressDifference) > priceToleranceKm) {
                return progressDifference;
            }
            if (firstPrice !== secondPrice) return firstPrice - secondPrice;

            return progressDifference;
        };

        for (let index = 0; index < maxIterations; index++) {
            if (totalDistanceKm - lastStopKm <= autonomyKm) break;

            const windowStartKm = lastStopKm + safeWindowStartKm;
            const windowEndKm = Math.min(
                totalDistanceKm,
                lastStopKm + safeWindowEndKm
            );
            const candidatesInReach = stations.filter((station) => {
                const progressKm = Number(station.progressioneKm);
                return Number.isFinite(progressKm) &&
                    progressKm > lastStopKm + 5 &&
                    progressKm <= windowEndKm &&
                    !usedStationIds.has(String(station.id));
            });
            const safeCandidates = candidatesInReach.filter((station) =>
                station.progressioneKm >= windowStartKm
            );
            const candidates = safeCandidates.length
                ? safeCandidates
                : candidatesInReach;

            if (!candidates.length) break;

            candidates.sort(compareCandidates);
            const stop = candidates[0];
            const stopKm = Number(stop.progressioneKm);
            if (!Number.isFinite(stopKm) || stopKm <= lastStopKm + 5) break;

            stop.isRecommendedPitStop = true;
            stop.pitStopNumber = pitStops.length + 1;
            stop.inSafeZone = safeCandidates.includes(stop);
            stop.safeWindowStartKm = windowStartKm;
            stop.safeWindowEndKm = windowEndKm;
            pitStops.push(stop);
            usedStationIds.add(String(stop.id));

            if (stop.inSafeZone) {
                safeWindows.push({
                    startKm: windowStartKm,
                    endKm: windowEndKm,
                    number: stop.pitStopNumber
                });
            }

            lastStopKm = stopKm;
        }

        const remainingDistanceKm = Math.max(0, totalDistanceKm - lastStopKm);

        return {
            pitStops,
            safeWindows,
            complete: remainingDistanceKm <= autonomyKm,
            remainingDistanceKm
        };
    },

    // Calcola la progressione chilometrica di ogni distributore rispetto al tracciato
    calculateStationRouteProgress(routeCoordinates, stations, totalRouteDistanceKm = null) {
        const cumDist = [0];
        for (let i = 1; i < routeCoordinates.length; i++) {
            const p1 = routeCoordinates[i - 1];
            const p2 = routeCoordinates[i];
            const segDist = this.haversineMeters(p1[1], p1[0], p2[1], p2[0]);
            cumDist.push(cumDist[i - 1] + segDist);
        }

        const geometricDistanceM = cumDist[cumDist.length - 1];
        const expectedDistanceM = Number(totalRouteDistanceKm) * 1000;
        if (
            Number.isFinite(expectedDistanceM) &&
            expectedDistanceM > 0 &&
            geometricDistanceM > 0
        ) {
            const distanceScale = expectedDistanceM / geometricDistanceM;
            for (let index = 1; index < cumDist.length; index++) {
                cumDist[index] *= distanceScale;
            }
        }

        stations.forEach(d => {
            let minDist = Infinity;
            let bestIdx = 0;
            const step = routeCoordinates.length > 3000 ? 2 : 1;
            for (let i = 0; i < routeCoordinates.length; i += step) {
                const pt = routeCoordinates[i];
                const dist = this.haversineMeters(d.lat, d.lon, pt[1], pt[0]);
                if (dist < minDist) {
                    minDist = dist;
                    bestIdx = i;
                }
            }
            const lastIndex = routeCoordinates.length - 1;
            if (lastIndex % step !== 0) {
                const lastPoint = routeCoordinates[lastIndex];
                const lastPointDist = this.haversineMeters(
                    d.lat,
                    d.lon,
                    lastPoint[1],
                    lastPoint[0]
                );
                if (lastPointDist < minDist) bestIdx = lastIndex;
            }
            d.progressioneKm = cumDist[bestIdx] / 1000;
        });

        stations.sort((a, b) => a.progressioneKm - b.progressioneKm);
        return { cumDist, totalDistKm: cumDist[cumDist.length - 1] / 1000 };
    },

    haversineMeters(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    // --- Geolocalizzazione ---
    locateUser() {
        this.updatePill('Localizzazione in corso...', true);
        if (!navigator.geolocation) {
            this.updatePill('Geolocalizzazione non supportata');
            this.loadDefault();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                this.currentLat = latitude;
                this.currentLon = longitude;
                
                FuelMap.setUserPosition(latitude, longitude);
                FuelMap.flyTo(latitude, longitude, 14);
                this.loadDistributori(latitude, longitude);
            },
            (err) => {
                console.warn('Errore GPS:', err.message);
                this.updatePill('GPS non disponibile – mostro Roma');
                this.loadDefault();
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
    },

    loadDefault() {
        this.currentLat = 41.9028;
        this.currentLon = 12.4964;
        this.loadDistributori(this.currentLat, this.currentLon);
    },

    // Chiamato automaticamente da Leaflet quando sposti la mappa
    onMapMoved() {
        // Se stiamo visualizzando le pompe di un percorso stradale, non sovrascriverle!
        if (this.isRouteModeActive) return;

        const { lat, lon, radius, zoom } = FuelMap.getCenterAndRadius();
        this.currentLat = lat;
        this.currentLon = lon;

        // Mostra il pulsante "Cerca in quest'area"
        const searchAreaBtn = document.getElementById('btnSearchArea');
        if (searchAreaBtn) searchAreaBtn.classList.remove('hidden');

        // Se lo zoom è troppo distante (vista tutta Italia), non auto-caricare
        if (zoom < 9) {
            this.updatePill('🔍 Ingrandisci la mappa per vedere i distributori', false);
            return;
        }

        clearTimeout(this.moveDebounceTimer);
        this.moveDebounceTimer = setTimeout(() => {
            this.loadDistributori(lat, lon, Math.max(radius, 8000));
            if (searchAreaBtn) searchAreaBtn.classList.add('hidden');
        }, 500);
    },

    // --- Carica distributori ---
    async loadDistributori(lat, lon, raggio = 10000) {
        try {
            const data = await API.getDistributoriVicini(lat, lon, raggio, this.activeFilters);
            const stations = Array.isArray(data?.distributori) ? data.distributori : [];

            // Calcolo distributore più conveniente (minimo prezzo benzina/diesel)
            let minPrice = Infinity;
            let cheapestId = null;
            let totalPrice = 0;
            let countPrice = 0;

            stations.forEach(d => {
                const p = parseFloat(d.prezzo_benzina || d.prezzo_diesel);
                if (!isNaN(p) && p > 1) {
                    totalPrice += p;
                    countPrice++;
                    if (p < minPrice) {
                        minPrice = p;
                        cheapestId = d.id;
                    }
                }
            });

            this.cheapestStationId = cheapestId;
            this.currentAveragePrice = countPrice > 0 ? (totalPrice / countPrice) : null;

            // Se è attivo il filtro "👑 Economico", isola solo le stazioni top per convenienza
            let displayStations = stations;
            if (this.activeFilters.soloEconomico && this.currentAveragePrice) {
                displayStations = stations
                    .filter(d => {
                        const p = parseFloat(d.prezzo_benzina || d.prezzo_diesel);
                        return !isNaN(p) && p <= this.currentAveragePrice;
                    })
                    .sort((a, b) => {
                        const pa = parseFloat(a.prezzo_benzina || a.prezzo_diesel) || 999;
                        const pb = parseFloat(b.prezzo_benzina || b.prezzo_diesel) || 999;
                        return pa - pb;
                    });
            }

            // Renderizza con la corona d'oro al più economico e il prezzo corrispondente al filtro
            FuelMap.renderDistributori(displayStations, cheapestId, this.activeFilters.carburante);

            // Controllo Radar: notifica di sistema se c'è una pompa vicina a ottimo prezzo
            this.checkProximityPriceDeals(stations);

            const n = stations.length;
            if (data?.offline) {
                this.updatePill(`📡 Offline — ${n} distribut${n === 1 ? 'ore' : 'ori'} in cache`, false);
            } else {
                this.updatePill(`${n} distribut${n === 1 ? 'ore' : 'ori'} nell'area visibile`, false);
            }
            
            setTimeout(() => {
                const statusPill = document.getElementById('statusPill');
                if (statusPill) statusPill.classList.add('hidden');
            }, 3000);

        } catch (err) {
            console.error('Errore caricamento:', err);
            this.updatePill(
                err?.name === 'AbortError'
                    ? 'Il server impiega più tempo del previsto. Riprova tra poco.'
                    : 'Errore nel caricamento'
            );
        }
    },

    // --- Bottom Sheet ---
    openSheet(d, isCheapest = false) {
        this.currentDistributore = d;
        const sheet = document.getElementById('bottomSheet');
        const overlay = document.getElementById('sheetOverlay');

        // Brand e Nome
        const bandiera = d.bandiera || 'Indipendente';
        const autostradaBadge = d.autostradale ? ' • 🛣️ In Autostrada' : '';
        document.getElementById('sheetBrandTag').textContent = `⛽ ${bandiera}${autostradaBadge}`;
        document.getElementById('sheetNome').textContent = d.nome || bandiera;
        document.getElementById('sheetIndirizzo').textContent = d.indirizzo ? `${d.indirizzo}, ${d.comune || ''}` : (d.comune || '');

        // Badge Miglior Prezzo (Corona)
        const cheapestBadge = document.getElementById('sheetCheapestBadge');
        if (isCheapest || d.id === this.cheapestStationId) {
            cheapestBadge.textContent = this.isRouteModeActive ? '👑 Più Economica del Viaggio' : '👑 Miglior Prezzo';
            cheapestBadge.classList.remove('hidden');
        } else {
            cheapestBadge.classList.add('hidden');
        }

        // Badge Sosta Consigliata per Autonomia (Pit-Stop Planner)
        const pitstopBadge = document.getElementById('sheetPitstopBadge');
        if (pitstopBadge) {
            if (d.isRecommendedPitStop) {
                const totalStops = this.currentPitStops.length || 1;
                pitstopBadge.textContent = d.pitStopNumber
                    ? `🎯 Sosta ${d.pitStopNumber} di ${totalStops} consigliata`
                    : '🎯 Sosta Consigliata per Autonomia';
                pitstopBadge.classList.remove('hidden');
            } else if (d.inSafeZone) {
                pitstopBadge.textContent = '✅ Nella Finestra di Sosta';
                pitstopBadge.classList.remove('hidden');
            } else {
                pitstopBadge.classList.add('hidden');
            }
        }

        // Calcolo distanza reale dalla posizione GPS dell'utente
        let distanzaText = '📍 Attiva il GPS per calcolare la distanza';
        if (FuelMap.userLat && FuelMap.userLon) {
            const userPos = L.latLng(FuelMap.userLat, FuelMap.userLon);
            const stationPos = L.latLng(d.lat, d.lon);
            const distMeters = userPos.distanceTo(stationPos);
            
            if (distMeters < 1000) {
                distanzaText = `📍 ${Math.round(distMeters)} m da te`;
            } else {
                distanzaText = `📍 ${(distMeters / 1000).toFixed(1)} km da te`;
            }
        }
        if (d.progressioneKm !== undefined && this.isRouteModeActive) {
            distanzaText = `📍 Al km ${Math.round(d.progressioneKm)} del viaggio`;
            if (d.dist_tracciato_m !== undefined) {
                distanzaText += ` • 🛣️ A ${d.dist_tracciato_m}m dalla rotta`;
            }
        } else if (d.dist_tracciato_m !== undefined && this.isRouteModeActive) {
            distanzaText += ` • 🛣️ A ${d.dist_tracciato_m}m dalla rotta`;
        }
        document.getElementById('sheetDistanza').textContent = distanzaText;

        const conferme = d.conferme || 0;
        document.getElementById('sheetConferme').textContent = `${conferme} feedback`;

        // Link navigatore turn-by-turn con gestione Tappa Waypoint
        const navBtn = document.getElementById('btnNavigate');
        const navText = navBtn.querySelector('span');
        if (this.isRouteModeActive && this.currentRouteStart && this.currentRouteDest) {
            navBtn.href = `https://www.google.com/maps/dir/?api=1&origin=${this.currentRouteStart.lat},${this.currentRouteStart.lon}&destination=${this.currentRouteDest.lat},${this.currentRouteDest.lon}&waypoints=${d.lat},${d.lon}`;
            if (navText) navText.textContent = 'Naviga con Tappa';
        } else {
            navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}`;
            if (navText) navText.textContent = 'Naviga';
        }

        // Stato Tasto Preferiti Salva
        const btnFav = document.getElementById('btnFavoriteStation');
        if (btnFav) {
            const isFav = this.isFavorite(d.id);
            btnFav.classList.toggle('active', isFav);
            const spanText = btnFav.querySelector('span');
            if (spanText) spanText.textContent = isFav ? 'Salvato' : 'Salva';
        }

        // Badge stato
        const badge = document.getElementById('sheetBadge');
        const stato = d.stato || 'sconosciuto';
        badge.textContent = stato;
        badge.className = `sheet-badge ${stato}`;

        // Griglia carburanti fintech con Trend
        this.renderFuelGrid(d);

        // Rendering Grafico Andamento Settimanale
        this.renderWeeklyChart(d);

        // Calcola e aggiorna il risparmio sul pieno
        this.updateSavingsBadge();

        // Indicatore coda a barre
        this.renderQueue(d.livello_coda || 0);

        // Visualizzazione Foto (Utente se c'è, altrimenti Brand)
        const photoSection = document.getElementById('photoSection');
        const imgPhoto = document.getElementById('imgStationPhoto');
        const badgePhoto = document.querySelector('.photo-badge');

        if (d.ultima_foto) {
            imgPhoto.src = d.ultima_foto;
            badgePhoto.textContent = '📸 Foto verificata community';
            badgePhoto.style.background = 'rgba(5, 150, 105, 0.85)';
        } else {
            imgPhoto.src = getBrandPhoto(d.bandiera);
            badgePhoto.textContent = `🏢 Stazione ${bandiera}`;
            badgePhoto.style.background = 'rgba(0, 0, 0, 0.7)';
        }
        photoSection.classList.remove('hidden');

        // Link Google Street View 360
        const streetViewBtn = document.getElementById('btnStreetView');
        if (streetViewBtn) {
            streetViewBtn.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${d.lat},${d.lon}`;
        }

        // Reset modulo segnalazione
        this.resetReportForm();

        // Ultimo aggiornamento
        const agg = d.ultimo_aggiornamento 
            ? this.timeAgo(new Date(d.ultimo_aggiornamento)) 
            : 'Mai aggiornato';
        document.getElementById('sheetAggiornamento').textContent = `Ultimo aggiornamento: ${agg}`;

        sheet.classList.add('open');
        overlay.classList.add('active');
    },

    closeSheet() {
        document.getElementById('bottomSheet').classList.remove('open');
        document.getElementById('sheetOverlay').classList.remove('active');
        this.currentDistributore = null;
    },

    renderFuelGrid(d) {
        const grid = document.getElementById('fuelGrid');
        const fuels = [
            { id: 'benzina', nome: 'Benzina', dot: 'dot-benzina', dispo: d.benzina_disponibile, prezzo: d.prezzo_benzina },
            { id: 'diesel',  nome: 'Diesel',  dot: 'dot-diesel',  dispo: d.diesel_disponibile,  prezzo: d.prezzo_diesel },
            { id: 'gpl',     nome: 'GPL',     dot: 'dot-gpl',     dispo: d.gpl_disponibile,     prezzo: d.prezzo_gpl },
            { id: 'metano',  nome: 'Metano',  dot: 'dot-metano',  dispo: d.metano_disponibile,  prezzo: d.prezzo_metano },
        ];

        grid.innerHTML = fuels.map(f => {
            if (f.dispo === null || f.dispo === undefined) return '';

            const dispoClass = f.dispo ? 'avail-ok' : 'avail-no';
            const dispoText = f.dispo ? (f.prezzo ? 'Disponibile' : 'Non comunicato') : 'Esaurito';
            
            let trendBadge = '';
            if (f.prezzo && this.currentAveragePrice) {
                const diff = parseFloat(f.prezzo) - this.currentAveragePrice;
                if (diff <= -0.015) {
                    trendBadge = `<span class="trend-pill trend-down">📉 Ottimo</span>`;
                } else if (diff >= 0.02) {
                    trendBadge = `<span class="trend-pill trend-up">📈 Caro</span>`;
                }
            }

            const prezzoFormatted = f.prezzo 
                ? `€ ${parseFloat(f.prezzo).toFixed(3)}<small>/L</small>${trendBadge}` 
                : (f.dispo ? '<span class="price-unreported">Non comunicato</span>' : '<span class="price-out">A secco</span>');

            return `
                <div class="fuel-card-modern ${!f.prezzo ? 'fuel-no-price' : ''}">
                    <div class="fuel-card-top">
                        <div class="fuel-name-row">
                            <span class="fuel-indicator-dot ${f.dot}"></span>
                            <span>${f.nome}</span>
                        </div>
                        <span class="fuel-avail-badge ${dispoClass}">${dispoText}</span>
                    </div>
                    <div class="fuel-price-large">${prezzoFormatted}</div>
                </div>
            `;
        }).join('');
    },

    // Auto-adattamento Light/Dark Mode (Sensore di sistema o Orario 19:30-07:00)
    initAutoTheme() {
        const saved = localStorage.getItem('fuelmap_theme');
        let shouldBeDark = false;

        if (saved) {
            shouldBeDark = saved === 'dark';
        } else {
            // Rileva sensore tema scuro telefono/sistema
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            // Rileva orario notturno (tra le 19:30 e le 07:00)
            const now = new Date();
            const hour = now.getHours() + (now.getMinutes() / 60);
            const isNightTime = hour >= 19.5 || hour < 7.0;

            shouldBeDark = prefersDark || isNightTime;
        }

        if (shouldBeDark) {
            document.body.classList.add('dark-theme');
            const chkTheme = document.getElementById('chkToolTheme');
            if (chkTheme) chkTheme.checked = true;
            FuelMap.isDarkMode = true;
            FuelMap.updateBaseLayer();
        }

        // Ascolta variazioni del tema del telefono in tempo reale
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('fuelmap_theme')) {
                    const isDark = e.matches;
                    document.body.classList.toggle('dark-theme', isDark);
                    const chkTheme = document.getElementById('chkToolTheme');
                    if (chkTheme) chkTheme.checked = isDark;
                    if (FuelMap.isDarkMode !== isDark) {
                        FuelMap.isDarkMode = isDark;
                        FuelMap.updateBaseLayer();
                    }
                }
            });
        }
    },

    // Generatore Grafico SVG Andamento Prezzi Reali dal Database (storico_prezzi)
    async renderWeeklyChart(d) {
        const container = document.getElementById('chartSvgWrap');
        const summary = document.getElementById('chartTrendSummary');
        const daysRow = document.querySelector('.weekly-days-row');
        const currentPrice = parseFloat(d.prezzo_benzina || d.prezzo_diesel);

        if (isNaN(currentPrice) || currentPrice <= 0) {
            document.getElementById('chartSection').classList.add('hidden');
            return;
        }
        document.getElementById('chartSection').classList.remove('hidden');

        try {
            const data = await API.getStoricoDistributore(d.id);
            let prices = [];
            let days = [];

            if (data.storico && data.storico.length >= 2) {
                // Estrai i prezzi storici reali
                prices = data.storico.map(r => parseFloat(r.prezzo_benzina || r.prezzo_diesel || currentPrice));
                days = data.storico.map(r => {
                    const dt = new Date(r.data && !r.data.includes('T') ? r.data + 'T12:00:00' : r.data);
                    const name = dt.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
                    return name.charAt(0).toUpperCase() + name.slice(1);
                });
            } else {
                prices = [currentPrice, currentPrice];
                days = ['Ieri', 'Oggi'];
            }

            // Aggiorna le etichette dei giorni
            if (daysRow && days.length > 0) {
                daysRow.innerHTML = days.map(day => `<span>${day}</span>`).join('');
            }

            const min = Math.min(...prices) - 0.003;
            const max = Math.max(...prices) + 0.003;
            const range = max - min || 1;
            
            const w = 320;
            const h = 60;
            
            const points = prices.map((p, i) => {
                const x = (i / (prices.length - 1)) * (w - 20) + 10;
                const y = h - ((p - min) / range) * (h - 20) - 10;
                return `${x},${y}`;
            });

            const polylinePoints = points.join(' ');
            const diff = prices[prices.length - 1] - prices[0];
            const isDecreasing = diff <= 0;
            const strokeColor = isDecreasing ? '#10B981' : '#EF4444';
            const fillColor = isDecreasing ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';

            if (Math.abs(diff) < 0.002) {
                summary.textContent = '➡️ Stabile questa settimana';
                summary.style.color = '#6B7280';
            } else {
                summary.textContent = isDecreasing 
                    ? `📉 In discesa (${(diff * 100).toFixed(1)} cent)` 
                    : `📈 In rialzo (+${(diff * 100).toFixed(1)} cent)`;
                summary.style.color = strokeColor;
            }

            const svgHtml = `
                <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%; height:100%;">
                    <polygon points="10,${h} ${polylinePoints} ${w - 10},${h}" fill="${fillColor}" />
                    <polyline points="${polylinePoints}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                    ${points.map((pt, idx) => {
                        const [cx, cy] = pt.split(',');
                        const val = prices[idx].toFixed(3);
                        return `
                            <g class="chart-point-group">
                                <circle cx="${cx}" cy="${cy}" r="3.5" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="2" />
                            </g>
                        `;
                    }).join('')}
                </svg>
            `;
            container.innerHTML = svgHtml;

        } catch (err) {
            console.warn('Errore recupero storico prezzi:', err);
        }
    },

    updateSavingsBadge() {
        if (!this.currentDistributore || !this.currentAveragePrice) {
            document.getElementById('savingsSection').classList.add('hidden');
            return;
        }

        const d = this.currentDistributore;
        const price = parseFloat(d.prezzo_benzina || d.prezzo_diesel);
        
        if (isNaN(price) || price <= 0) {
            document.getElementById('savingsSection').classList.add('hidden');
            return;
        }
        document.getElementById('savingsSection').classList.remove('hidden');

        const diffPerLiter = this.currentAveragePrice - price;
        const totalSaved = diffPerLiter * this.selectedTankLiters;

        const badgeEl = document.getElementById('savingsAmountBadge');
        if (totalSaved > 0.3) {
            badgeEl.textContent = `Risparmi ~ €${totalSaved.toFixed(2)}`;
            badgeEl.style.color = '#047857';
            badgeEl.style.background = '#ECFDF5';
        } else if (totalSaved < -0.3) {
            badgeEl.textContent = `+ €${Math.abs(totalSaved).toFixed(2)} vs media`;
            badgeEl.style.color = '#B91C1C';
            badgeEl.style.background = '#FEF2F2';
        } else {
            badgeEl.textContent = 'In linea con la media';
            badgeEl.style.color = '#4B5563';
            badgeEl.style.background = '#F3F4F6';
        }
    },

    // Condivisione Rapida (Web Share API / WhatsApp / Appunti)
    async shareCurrentStation() {
        if (!this.currentDistributore) return;
        
        const d = this.currentDistributore;
        const bandiera = d.bandiera || 'Distributore';
        const prezzoBenzina = d.prezzo_benzina ? `Benzina: € ${parseFloat(d.prezzo_benzina).toFixed(3)}` : '';
        const prezzoDiesel = d.prezzo_diesel ? `Diesel: € ${parseFloat(d.prezzo_diesel).toFixed(3)}` : '';
        const infoPrezzi = [prezzoBenzina, prezzoDiesel].filter(Boolean).join(' | ');

        const shareData = {
            title: `Prezzi Carburante ${bandiera}`,
            text: `⛽ ${bandiera} (${d.nome})\n📍 ${d.indirizzo || d.comune}\n💰 ${infoPrezzi || 'Prezzi aggiornati'}\nGuarda la mappa e naviga qui:`,
            url: `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}`
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // Utente ha annullato condivisione
            }
        } else {
            // Fallback: copia negli appunti
            const textToCopy = `${shareData.text}\n${shareData.url}`;
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.showToast('✅ Dettagli e link copiati negli appunti!');
            }).catch(() => {
                this.showToast('❌ Impossibile copiare il link');
            });
        }
    },

    renderQueue(livello) {
        const labelEl = document.getElementById('queueStatusText');
        const bars = document.querySelectorAll('.step-bar');
        
        const labels = ['Zero attesa', 'Scorrevole (~5 min)', 'Moderata (~10 min)', 'Lunga (>15 min)'];
        const colors = ['active-green', 'active-amber', 'active-red'];

        labelEl.textContent = labels[livello] || 'Normale';
        labelEl.style.color = livello === 0 ? '#059669' : (livello === 1 ? '#D97706' : '#DC2626');

        bars.forEach((bar, idx) => {
            bar.className = 'step-bar'; 
            if (idx < livello) {
                bar.classList.add(colors[Math.min(livello - 1, 2)]);
            }
        });
    },

    updateSubmitButtonState() {
        const hasSelection = this.currentReportState.stato !== null || 
            this.currentReportState.benzina_esaurita || 
            this.currentReportState.diesel_esaurito || 
            this.currentReportState.coda !== null ||
            this.selectedPhotoFile !== null;

        const btn = document.getElementById('btnSubmitReport');
        btn.disabled = !hasSelection;
        btn.classList.toggle('disabled', !hasSelection);
    },

    resetReportForm() {
        this.currentReportState = {
            stato: null,
            benzina_esaurita: false,
            diesel_esaurito: false,
            coda: null
        };
        this.selectedPhotoFile = null;

        document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('selected'));
        document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('selected'));
        document.getElementById('inputPhoto').value = '';
        document.getElementById('photoPreviewWrap').classList.add('hidden');
        document.getElementById('btnTriggerPhoto').classList.remove('hidden');
        
        this.updateSubmitButtonState();
    },

    async submitFullReport() {
        if (!this.currentDistributore) return;

        const btn = document.getElementById('btnSubmitReport');
        btn.disabled = true;
        btn.textContent = 'Invio in corso...';

        try {
            // Invio stato principale (aperto/chiuso o altro)
            let tipoSegnalazione = 'stato';
            let dettagli = {};

            if (this.currentReportState.stato) {
                tipoSegnalazione = 'stato';
                dettagli.stato = this.currentReportState.stato;
            } else if (this.currentReportState.benzina_esaurita) {
                tipoSegnalazione = 'carburante_esaurito';
                dettagli.carburante = 'benzina';
            } else if (this.currentReportState.diesel_esaurito) {
                tipoSegnalazione = 'carburante_esaurito';
                dettagli.carburante = 'diesel';
            } else if (this.currentReportState.coda !== null) {
                tipoSegnalazione = 'coda';
                dettagli.livello = this.currentReportState.coda;
            }

            // Includiamo tutti i dettagli opzionali nel payload
            if (this.currentReportState.coda !== null) dettagli.livello = this.currentReportState.coda;
            if (this.currentReportState.benzina_esaurita) dettagli.benzina_esaurita = true;
            if (this.currentReportState.diesel_esaurito) dettagli.diesel_esaurito = true;

            const res = await API.inviaSegnalazione({
                distributore_id: this.currentDistributore.id,
                tipo_segnalazione: tipoSegnalazione,
                dettagli,
                lat_utente: FuelMap.userLat,
                lon_utente: FuelMap.userLon
            }, this.selectedPhotoFile);

            // Vibrazione aptica su cellulare se supportata
            if (navigator.vibrate) navigator.vibrate([40, 60, 40]);

            this.showToast('✅ Segnalazione registrata con successo!');
            this.resetReportForm();
            
            // Ricarica la scheda e la mappa
            setTimeout(() => {
                const { lat, lon, radius } = FuelMap.getCenterAndRadius();
                this.loadDistributori(lat, lon, radius);
            }, 800);

        } catch (err) {
            this.showToast(`❌ ${err.message}`);
        } finally {
            btn.textContent = 'Conferma Segnalazione';
            this.updateSubmitButtonState();
        }
    },

    // ============================================
    // Radar Notifiche di Prossimità & Prezzi Top
    // ============================================
    initNotifications() {
        const savedRadar = localStorage.getItem('fuelmap_radar_notif');
        if (savedRadar === 'true' && 'Notification' in window && Notification.permission === 'granted') {
            this.setRadarState(true, false);
        }

        // Ascolto apertura stazione da tap su notifica Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'OPEN_STATION_FROM_NOTIFICATION') {
                    this.openStationById(event.data.stationId);
                }
            });
        }

        // Se l'app è stata aperta da un link con parametro notifica (?station=ID)
        const urlParams = new URLSearchParams(window.location.search);
        const stationParam = urlParams.get('station');
        if (stationParam) {
            setTimeout(() => this.openStationById(stationParam), 900);
        }
    },

    async toggleRadarNotifications() {
        if (!('Notification' in window)) {
            this.showToast('⚠️ Il tuo browser non supporta le notifiche di sistema');
            return;
        }

        if (Notification.permission === 'denied') {
            this.showToast('⚠️ Notifiche bloccate nel browser. Abilitale nei permessi del sito.');
            return;
        }

        if (Notification.permission === 'default') {
            try {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                    this.setRadarState(true, true);
                    this.showToast('🔔 Radar Prezzi attivo! Ti avviseremo quando passi vicino a offerte top.');
                    this.sendTestNotification();
                } else {
                    this.showToast('Notifiche non abilitate');
                }
            } catch (err) {
                console.warn('Errore richiesta permessi notifiche:', err);
            }
            return;
        }

        // Se già granted, fai toggle ON / OFF
        const newState = !this.isRadarActive;
        this.setRadarState(newState, true);
        this.showToast(newState 
            ? '🔔 Radar attivo! Ti avviseremo se passi vicino a prezzi top.' 
            : '🔕 Radar Notifiche disattivato');
    },

    setRadarState(active, persist = true) {
        this.isRadarActive = active;
        if (persist) {
            localStorage.setItem('fuelmap_radar_notif', active ? 'true' : 'false');
        }

        const dot = document.getElementById('toolsActiveDot');
        const chk = document.getElementById('chkToolRadar');
        if (dot) dot.classList.toggle('hidden', !active);
        if (chk) chk.checked = active;

        if (active) {
            this.startLocationWatch();
        } else {
            this.stopLocationWatch();
        }
    },

    startLocationWatch() {
        if (!navigator.geolocation || this.radarWatchId !== null) return;
        this.radarWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                FuelMap.setUserPosition(latitude, longitude);
                // Se abbiamo distributori caricati, verifica la prossimità in movimento
                if (this.currentDistributoriCache && this.currentDistributoriCache.length > 0) {
                    this.checkProximityPriceDeals(this.currentDistributoriCache);
                }
            },
            (err) => console.warn('Errore watchPosition:', err.message),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
    },

    stopLocationWatch() {
        if (this.radarWatchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.radarWatchId);
            this.radarWatchId = null;
        }
    },

    sendTestNotification() {
        const title = '⛽ Fuel Map — Radar Prezzi Attivo';
        const options = {
            body: 'Riceverai un avviso quando sarai vicino a un distributore con i prezzi più bassi della zona!',
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: 'radar-welcome'
        };
        DynamicIsland.showStatus('Radar Prezzi Attivo 🔔', '⛽', 4000);

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options));
        } else {
            try { new Notification(title, options); } catch (e) {}
        }
    },

    checkProximityPriceDeals(stations) {
        if (!this.isRadarActive || !('Notification' in window) || Notification.permission !== 'granted') return;
        if (!FuelMap.userLat || !FuelMap.userLon || !stations || stations.length === 0) return;

        // Salva in cache per watchPosition in mobilità
        this.currentDistributoriCache = stations;

        // Cooldown globale: almeno 15 minuti tra due notifiche qualsiasi
        const now = Date.now();
        if (now - this.lastGlobalNotificationTime < 15 * 60 * 1000) return;

        // Carica cache storico notifiche da localStorage
        let notifCache = {};
        try {
            notifCache = JSON.parse(localStorage.getItem('fuelmap_notif_history') || '{}');
        } catch (e) {
            notifCache = {};
        }

        const userLatLng = L.latLng(FuelMap.userLat, FuelMap.userLon);

        for (const s of stations) {
            if (s.stato === 'chiuso') continue;

            const stLatLng = L.latLng(s.lat, s.lon);
            const distM = userLatLng.distanceTo(stLatLng);

            // Considera impianti entro 1.5 km (1500 metri)
            if (distM <= 1500) {
                const lastNotif = notifCache[s.id];
                // Non ripetere la notifica per la stessa stazione per 6 ore
                if (lastNotif && (now - lastNotif < 6 * 60 * 60 * 1000)) {
                    continue;
                }

                // Criterio "Ottimo Prezzo":
                // 1. È il distributore con la corona (il più economico assoluto della zona)
                // 2. Oppure ha un prezzo almeno 0.020 €/L inferiore alla media di zona
                const isCheapest = (s.id === this.cheapestStationId);
                const pBenz = parseFloat(s.prezzo_benzina);
                const pDies = parseFloat(s.prezzo_diesel);
                let isDeal = isCheapest;

                if (!isDeal && this.currentAveragePrice) {
                    if (!isNaN(pBenz) && (pBenz - this.currentAveragePrice <= -0.020)) isDeal = true;
                    if (!isNaN(pDies) && (pDies - this.currentAveragePrice <= -0.020)) isDeal = true;
                }

                if (isDeal) {
                    notifCache[s.id] = now;
                    localStorage.setItem('fuelmap_notif_history', JSON.stringify(notifCache));
                    this.lastGlobalNotificationTime = now;
                    this.sendProximityNotification(s, distM, isCheapest);
                    break; // Invia solo 1 notifica per volta
                }
            }
        }
    },

    sendProximityNotification(stazione, distM, isCheapest = false) {
        const distKmText = distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`;
        const carbPref = this.activeFilters.carburante || 'benzina';
        let prezzo = stazione[`prezzo_${carbPref}`] || stazione.prezzo_benzina || stazione.prezzo_diesel;
        let carbLabel = carbPref.toUpperCase();
        if (!prezzo) {
            prezzo = stazione.prezzo_diesel || stazione.prezzo_benzina;
            carbLabel = stazione.prezzo_diesel ? 'DIESEL' : 'BENZINA';
        }

        const formattedPrice = prezzo ? `a € ${parseFloat(prezzo).toFixed(3)}/L` : 'con prezzi convenienti';
        const brand = stazione.bandiera || stazione.nome || 'Distributore';

        const title = `⛽ Pompa super economica a ${distKmText}!`;
        const body = `${brand}: ${carbLabel} ${formattedPrice}. ${isCheapest ? '👑 Il miglior prezzo dell\'area!' : '📉 Notevolmente sotto la media di zona!'}`;

        const options = {
            body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: `deal-${stazione.id}`,
            vibrate: [200, 100, 200],
            data: {
                stationId: stazione.id,
                lat: stazione.lat,
                lon: stazione.lon,
                url: `/?station=${stazione.id}`
            }
        };

        // Espandi la Dynamic Island in tempo reale sullo schermo
        DynamicIsland.showDeal(stazione, distKmText, isCheapest);

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, options);
            });
        } else {
            try {
                new Notification(title, options);
            } catch (e) {
                console.warn('Errore notifica diretta:', e);
            }
        }
    },

    async openStationById(stationId) {
        try {
            const d = await API.getDistributore(stationId);
            if (d) {
                FuelMap.flyTo(d.lat, d.lon, 16);
                this.openSheet(d, d.id === this.cheapestStationId);
            }
        } catch (err) {
            console.warn('Impossibile aprire stazione da notifica:', err);
        }
    },

    // ============================================
    // Gestione Distributori Preferiti ⭐
    // ============================================
    loadFavorites() {
        try {
            const raw = localStorage.getItem('fuelmap_favorites');
            this.favorites = raw ? JSON.parse(raw) : [];
        } catch (e) {
            this.favorites = [];
        }
    },

    saveFavorites() {
        try {
            localStorage.setItem('fuelmap_favorites', JSON.stringify(this.favorites));
        } catch (e) {
            console.warn('Errore salvataggio preferiti:', e);
        }
        this.updateFavoritesBadge();
    },

    updateFavoritesBadge() {
        const count = this.favorites.length;
        const lbl = document.getElementById('lblToolsFavCount');
        if (lbl) {
            lbl.textContent = `${count} stazion${count === 1 ? 'e salvata' : 'i salvate'}`;
        }
    },

    isFavorite(id) {
        if (!id) return false;
        return this.favorites.some(f => String(f.id) === String(id));
    },

    toggleFavoriteCurrentStation() {
        if (!this.currentDistributore) return;
        const d = this.currentDistributore;
        const exists = this.isFavorite(d.id);

        if (exists) {
            this.favorites = this.favorites.filter(f => String(f.id) !== String(d.id));
            this.showToast('Distributore rimosso dai preferiti');
        } else {
            this.favorites.unshift({
                id: d.id,
                nome: d.nome || d.bandiera || 'Distributore',
                bandiera: d.bandiera,
                indirizzo: d.indirizzo ? `${d.indirizzo}, ${d.comune || ''}` : (d.comune || ''),
                lat: d.lat,
                lon: d.lon,
                prezzo_benzina: d.prezzo_benzina,
                prezzo_diesel: d.prezzo_diesel,
                autostradale: d.autostradale
            });
            this.showToast('⭐ Aggiunto ai tuoi Preferiti!');
            if (navigator.vibrate) navigator.vibrate(50);
        }

        this.saveFavorites();

        // Aggiorna stato bottone
        const btnFav = document.getElementById('btnFavoriteStation');
        if (btnFav) {
            const nowFav = !exists;
            btnFav.classList.toggle('active', nowFav);
            const spanText = btnFav.querySelector('span');
            if (spanText) spanText.textContent = nowFav ? 'Salvato' : 'Salva';
        }
    },

    openFavoritesModal() {
        const modal = document.getElementById('favoritesModalCard');
        if (!modal) return;
        this.renderFavoritesList();
        modal.classList.remove('hidden');
    },

    renderFavoritesList() {
        const container = document.getElementById('favoritesListBody');
        if (!container) return;

        if (this.favorites.length === 0) {
            container.innerHTML = `
                <div class="fav-empty-state">
                    <span class="fav-empty-icon">⭐</span>
                    <span class="fav-empty-text">Non hai ancora salvato distributori.<br>Tocca <b>Salva</b> nella scheda di una pompa per ritrovarla subito qui!</span>
                </div>
            `;
            return;
        }

        container.innerHTML = this.favorites.map(f => {
            let distText = '';
            if (FuelMap.userLat && FuelMap.userLon) {
                const uPos = L.latLng(FuelMap.userLat, FuelMap.userLon);
                const stPos = L.latLng(f.lat, f.lon);
                const dM = uPos.distanceTo(stPos);
                distText = dM < 1000 ? ` • 📍 ${Math.round(dM)}m` : ` • 📍 ${(dM / 1000).toFixed(1)}km`;
            }

            const pBenz = f.prezzo_benzina ? `B: €${parseFloat(f.prezzo_benzina).toFixed(3)}` : '';
            const pDies = f.prezzo_diesel ? `D: €${parseFloat(f.prezzo_diesel).toFixed(3)}` : '';
            const prices = [pBenz, pDies].filter(Boolean).join(' | ') || 'Prezzi al distributore';

            return `
                <div class="fav-card" data-id="${f.id}">
                    <div class="fav-info-col" data-id="${f.id}">
                        <span class="fav-title">⛽ ${f.nome}${f.autostradale ? ' • 🛣️' : ''}</span>
                        <span class="fav-sub">${f.indirizzo || 'Italia'}${distText}</span>
                    </div>
                    <div class="fav-actions-col">
                        <span class="fav-price-badge" data-id="${f.id}">${prices}</span>
                        <button type="button" class="btn-remove-fav" data-id="${f.id}" title="Rimuovi dai preferiti">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        // Event listener click sulle card per aprire il distributore
        container.querySelectorAll('.fav-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-remove-fav')) return;
                const id = card.dataset.id;
                document.getElementById('favoritesModalCard').classList.add('hidden');
                this.openStationById(id);
            });
        });

        // Event listener rimuovi
        container.querySelectorAll('.btn-remove-fav').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.favorites = this.favorites.filter(f => String(f.id) !== String(id));
                this.saveFavorites();
                this.renderFavoritesList();
                // Se la stazione rimossa è quella aperta nel sheet, aggiorna il tasto
                if (this.currentDistributore && String(this.currentDistributore.id) === String(id)) {
                    const btnFav = document.getElementById('btnFavoriteStation');
                    if (btnFav) {
                        btnFav.classList.remove('active');
                        const span = btnFav.querySelector('span');
                        if (span) span.textContent = 'Salva';
                    }
                }
            });
        });
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // --- Onboarding Tutorial Primo Avvio ---
    onboardingSlides: [
        {
            icon: '⛽',
            title: 'Prezzi Ufficiali in Tempo Reale',
            desc: 'Esplora oltre 23.800 distributori in tutta Italia con prezzi certificati MIMIT aggiornati ogni mattina alle 08:35.'
        },
        {
            icon: '🚗',
            title: 'Pit-Stop Planner & Radar Prezzi',
            desc: 'Pianifica le soste più economiche lungo i tuoi viaggi (A ➔ B) e attiva il Radar per ricevere un avviso vicino alle pompe top.'
        },
        {
            icon: '📈',
            title: 'Storico 7 Giorni & Risparmio',
            desc: 'Controlla il grafico settimanale di ogni stazione, calcola quanto risparmi sul pieno e salva i tuoi distributori preferiti.'
        },
        {
            icon: '👥',
            title: 'Segnalazioni della Community',
            desc: 'Aiuta gli altri automobilisti segnalando code, chiusure o allegando foto dal vivo — zero registrazioni richieste!'
        }
    ],
    onboardingStep: 0,

    initOnboarding() {
        const overlay = document.getElementById('onboardingOverlay');
        const btnNext = document.getElementById('btnNextOnboarding');
        const btnPrev = document.getElementById('btnPrevOnboarding');
        const btnSkip = document.getElementById('btnSkipOnboarding');
        if (!overlay || !btnNext || !btnPrev || !btnSkip) return;

        btnNext.addEventListener('click', () => {
            if (this.onboardingStep < this.onboardingSlides.length - 1) {
                this.onboardingStep++;
                this.renderOnboardingSlide();
            } else {
                this.closeOnboarding();
            }
        });

        btnPrev.addEventListener('click', () => {
            if (this.onboardingStep > 0) {
                this.onboardingStep--;
                this.renderOnboardingSlide();
            }
        });

        btnSkip.addEventListener('click', () => this.closeOnboarding());

        if (localStorage.getItem('fuelmap_onboarding_done') !== 'true') {
            this.openOnboarding(false);
        }
    },

    openOnboarding(forceReplay = false) {
        const overlay = document.getElementById('onboardingOverlay');
        if (!overlay) return;
        this.onboardingStep = 0;
        this.renderOnboardingSlide();
        overlay.classList.remove('hidden');
        if (forceReplay) {
            localStorage.setItem('fuelmap_onboarding_done', 'true');
        }
    },

    renderOnboardingSlide() {
        const slide = this.onboardingSlides[this.onboardingStep];
        const iconEl = document.getElementById('onboardingIcon');
        const titleEl = document.getElementById('onboardingTitle');
        const descEl = document.getElementById('onboardingDesc');
        const dotsEl = document.getElementById('onboardingDots');
        const btnPrev = document.getElementById('btnPrevOnboarding');
        const btnNext = document.getElementById('btnNextOnboarding');

        if (iconEl) iconEl.textContent = slide.icon;
        if (titleEl) titleEl.textContent = slide.title;
        if (descEl) descEl.textContent = slide.desc;

        if (dotsEl) {
            dotsEl.innerHTML = this.onboardingSlides
                .map((_, idx) => `<span class="onboarding-dot ${idx === this.onboardingStep ? 'active' : ''}"></span>`)
                .join('');
        }

        if (btnPrev) btnPrev.classList.toggle('hidden', this.onboardingStep === 0);
        if (btnNext) {
            btnNext.textContent = this.onboardingStep === this.onboardingSlides.length - 1 ? 'Inizia! 🚀' : 'Avanti ➔';
        }
    },

    closeOnboarding() {
        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) overlay.classList.add('hidden');
        localStorage.setItem('fuelmap_onboarding_done', 'true');
    },

    // --- Utilità ---
    updatePill(text, showDot = true) {
        DynamicIsland.showStatus(text, showDot ? '🔍' : '📍', 3200);
        const pill = document.getElementById('statusPill');
        if (pill) {
            pill.classList.remove('hidden');
            pill.querySelector('.pill-text').textContent = text;
            pill.querySelector('.pill-dot').style.display = showDot ? '' : 'none';
        }
    },

    showToast(text) {
        const toast = document.getElementById('toast');
        toast.textContent = text;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    },

    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Ora';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min fa`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} ore fa`;
        return `${Math.floor(seconds / 86400)} giorni fa`;
    }
};

// --- Avvio ed esposizione globale ---
window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
