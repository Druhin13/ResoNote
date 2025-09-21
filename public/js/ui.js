/**
 * UI manipulation functions for ResoNote
 *
 * Initializes and manages the interactive client UI:
 * - Search and selection of seed tracks
 * - Weight sliders and similarity options
 * - Playlist generation, rendering, export
 * - Track details modal, thumbnails, and session persistence
 */

/**
 * @typedef {Object} UIElements
 * @property {HTMLInputElement} trackSearchInput
 * @property {HTMLElement} searchResults
 * @property {HTMLElement} selectedTracks
 * @property {HTMLButtonElement} randomTrackBtn
 * @property {NodeListOf<HTMLInputElement>} similarityTypeRadios
 * @property {HTMLInputElement} semanticWeightSlider
 * @property {HTMLElement} semanticWeightValue
 * @property {HTMLInputElement} audioWeightSlider
 * @property {HTMLElement} audioWeightValue
 * @property {HTMLInputElement} minTracksInput
 * @property {HTMLInputElement} maxTracksInput
 * @property {HTMLInputElement} diversityFactorSlider
 * @property {HTMLElement} diversityFactorValue
 * @property {HTMLInputElement} includeSeedTracksCheckbox
 * @property {HTMLInputElement} allowTrackVariationsCheckbox
 * @property {HTMLButtonElement} generatePlaylistBtn
 * @property {HTMLElement} weightsContainer
 * @property {HTMLElement} loadingIndicator
 * @property {HTMLElement} errorMessage
 * @property {HTMLElement} playlistResults
 * @property {HTMLElement} playlistName
 * @property {HTMLElement} trackCount
 * @property {HTMLElement} avgSimilarity
 * @property {HTMLElement} trackList
 * @property {HTMLButtonElement} clearResultsBtn
 * @property {HTMLButtonElement} exportPlaylistBtn
 * @property {HTMLElement|null} emptyState
 * @property {HTMLElement} trackDetailsModal
 * @property {HTMLElement} modalTrackTitle
 * @property {HTMLElement} modalLoading
 * @property {HTMLElement} modalTrackDetails
 * @property {HTMLButtonElement} modalCloseBtn
 */

/**
 * @typedef {Object} UIState
 * @property {Array<any>} selectedTracks
 * @property {number|null} searchTimeout
 * @property {Array<any>} searchResults
 * @property {any} searchIndex
 * @property {any} currentPlaylist
 * @property {string[]} currentSeedTrackIds
 * @property {"semantic"|"audio"|"combined"} similarityType
 * @property {number} semanticWeight
 * @property {number} audioWeight
 * @property {Record<string, string|null>} imageCache
 * @property {boolean} randomInProgress
 */

const UI = {
  /**
   * Cached DOM elements used across the UI layer.
   * @type {UIElements}
   */
  elements: {
    trackSearchInput: document.getElementById("track-search"),
    searchResults: document.getElementById("search-results"),
    selectedTracks: document.getElementById("selected-tracks"),
    randomTrackBtn: document.getElementById("random-track"),
    similarityTypeRadios: document.querySelectorAll(
      'input[name="similarity-type"]'
    ),
    semanticWeightSlider: document.getElementById("semantic-weight"),
    semanticWeightValue: document.getElementById("semantic-weight-value"),
    audioWeightSlider: document.getElementById("audio-weight"),
    audioWeightValue: document.getElementById("audio-weight-value"),
    minTracksInput: document.getElementById("min-tracks"),
    maxTracksInput: document.getElementById("max-tracks"),
    diversityFactorSlider: document.getElementById("diversity-factor"),
    diversityFactorValue: document.getElementById("diversity-factor-value"),
    includeSeedTracksCheckbox: document.getElementById("include-seed-tracks"),
    allowTrackVariationsCheckbox: document.getElementById(
      "allow-track-variations"
    ),
    generatePlaylistBtn: document.getElementById("generate-playlist"),
    weightsContainer: document.getElementById("weights-container"),

    loadingIndicator: document.getElementById("loading"),
    errorMessage: document.getElementById("error-message"),
    playlistResults: document.getElementById("playlist-results"),
    playlistName: document.getElementById("playlist-name"),
    trackCount: document.getElementById("track-count"),
    avgSimilarity: document.getElementById("avg-similarity"),
    trackList: document.getElementById("track-list"),
    clearResultsBtn: document.getElementById("clear-results"),
    exportPlaylistBtn: document.getElementById("export-playlist"),
    emptyState: document.querySelector(".empty-state"),

    trackDetailsModal: document.getElementById("track-details-modal"),
    modalTrackTitle: document.getElementById("modal-track-title"),
    modalLoading: document.getElementById("modal-loading"),
    modalTrackDetails: document.getElementById("modal-track-details"),
    modalCloseBtn: document.querySelector(".modal-close"),
  },

  /**
   * Mutable UI state backing view rendering and behaviors.
   * @type {UIState}
   */
  state: {
    selectedTracks: [],
    searchTimeout: null,
    searchResults: [],
    searchIndex: null,
    currentPlaylist: null,
    currentSeedTrackIds: [],
    similarityType: "combined",
    semanticWeight: 0.5,
    audioWeight: 0.5,
    imageCache: {}, // client-side cache for image URLs keyed by track_id
    randomInProgress: false, // prevent concurrent random requests
  },

  /** Default innerHTML for the Random button (restored after errors/reset). */
  randomButtonDefaultHtml: '<i data-lucide="shuffle"></i> Random',

  /**
   * Entrypoint to initialize the UI layer.
   * Sets default visibility, restores session state, binds events,
   * initializes sliders/tooltips/icons, and renders initial selection.
   */
  init() {
    // Ensure Clear button hidden initially - only show after a successful playlist generate
    if (this.elements.clearResultsBtn) {
      this.elements.clearResultsBtn.style.display = "none";
    }

    // Load state from sessionStorage if available
    this.loadStateFromSession();

    this.setupEventListeners();
    this._initSliderDisplays();
    this._initTooltips();
    this.updateSelectedTracks();
    this.initializeIcons();
  },

  /**
   * Initialize Lucide icons if available; safely ignores runtime errors.
   */
  initializeIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      try {
        window.lucide.createIcons();
      } catch (err) {
        // ignore icon creation errors
      }
    }
  },

  /**
   * Create native title tooltips from elements marked with data-tooltip.
   * Ensures UX affordance without introducing a tooltip library dependency.
   * @private
   */
  _initTooltips() {
    // Ensure elements with data-tooltip have a title for native tooltip behavior
    const tooltipElements = document.querySelectorAll("[data-tooltip]");
    tooltipElements.forEach((el) => {
      const text = el.getAttribute("data-tooltip");
      if (text && !el.getAttribute("title")) el.setAttribute("title", text);
    });
  },

  /**
   * Initialize slider display values and internal weights from DOM,
   * maintaining the invariant semanticWeight + audioWeight = 1.
   * @private
   */
  _initSliderDisplays() {
    const semantic = parseFloat(
      this.elements.semanticWeightSlider.value || 0.5
    );
    const audio = parseFloat(
      this.elements.audioWeightSlider.value || 1 - semantic
    );
    const diversity = parseFloat(
      this.elements.diversityFactorSlider.value || 0.3
    );

    this.state.semanticWeight = semantic;
    this.state.audioWeight = audio;

    this.elements.semanticWeightValue.textContent = `${Math.round(
      semantic * 100
    )}%`;
    this.elements.audioWeightValue.textContent = `${Math.round(audio * 100)}%`;
    this.elements.diversityFactorValue.textContent = `${Math.round(
      diversity * 100
    )}%`;
  },

  /**
   * Wire up UI event handlers for search, sliders, options, actions, and modals.
   * Persists relevant user choices to sessionStorage.
   */
  setupEventListeners() {
    this.elements.trackSearchInput.addEventListener("input", () => {
      clearTimeout(this.state.searchTimeout);
      const query = this.elements.trackSearchInput.value.trim();
      if (query.length < 2) {
        this.elements.searchResults.classList.add("hidden");
        return;
      }
      this.state.searchTimeout = setTimeout(() => {
        this.searchTracks(query);
      }, 300);
    });

    document.addEventListener("click", (event) => {
      if (
        !this.elements.trackSearchInput.contains(event.target) &&
        !this.elements.searchResults.contains(event.target)
      ) {
        this.elements.searchResults.classList.add("hidden");
      }
    });

    // Random track button behavior
    this.elements.randomTrackBtn.addEventListener("click", async () => {
      if (this.state.selectedTracks.length > 0 || this.state.randomInProgress)
        return;
      this.state.randomInProgress = true;
      this.elements.randomTrackBtn.disabled = true;
      this.elements.randomTrackBtn.innerHTML =
        '<i data-lucide="loader-2" class="animate-spin"></i> Loading...';
      this.initializeIcons();

      try {
        const randomTrack = await API.getRandomTrack();
        if (!randomTrack) throw new Error("No random track returned");
        if (
          !this.state.selectedTracks.some(
            (t) => t.track_id === randomTrack.track_id
          )
        ) {
          this.addSelectedTrack(randomTrack);
        }
      } catch (err) {
        const message =
          (err && err.message) || "Failed to fetch a random track";
        this.showError(message);
        // revert to default state if no selection exists
        if (this.state.selectedTracks.length === 0) {
          this.elements.randomTrackBtn.innerHTML = this.randomButtonDefaultHtml;
          this.elements.randomTrackBtn.disabled = false;
          this.initializeIcons();
        }
      } finally {
        this.state.randomInProgress = false;
      }
    });

    // Similarity radios
    this.elements.similarityTypeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        this.state.similarityType = radio.value;
        if (radio.value === "combined") {
          this.elements.weightsContainer.style.display = "flex";
        } else {
          this.elements.weightsContainer.style.display = "none";
        }
        this.saveStateToSession();
      });
    });

    // Sliders showing percentage
    this.elements.semanticWeightSlider.addEventListener("input", () => {
      const value = parseFloat(this.elements.semanticWeightSlider.value);
      this.elements.semanticWeightValue.textContent = `${Math.round(
        value * 100
      )}%`;
      this.state.semanticWeight = value;
      const audioWeight = 1 - value;
      this.elements.audioWeightSlider.value = audioWeight;
      this.elements.audioWeightValue.textContent = `${Math.round(
        audioWeight * 100
      )}%`;
      this.state.audioWeight = audioWeight;
      this.saveStateToSession();
    });

    this.elements.audioWeightSlider.addEventListener("input", () => {
      const value = parseFloat(this.elements.audioWeightSlider.value);
      this.elements.audioWeightValue.textContent = `${Math.round(
        value * 100
      )}%`;
      this.state.audioWeight = value;
      const semanticWeight = 1 - value;
      this.elements.semanticWeightSlider.value = semanticWeight;
      this.elements.semanticWeightValue.textContent = `${Math.round(
        semanticWeight * 100
      )}%`;
      this.state.semanticWeight = semanticWeight;
      this.saveStateToSession();
    });

    this.elements.diversityFactorSlider.addEventListener("input", () => {
      const value = parseFloat(this.elements.diversityFactorSlider.value);
      this.elements.diversityFactorValue.textContent = `${Math.round(
        value * 100
      )}%`;
      this.saveStateToSession();
    });

    this.elements.minTracksInput.addEventListener("change", () => {
      const minTracks = parseInt(this.elements.minTracksInput.value);
      const maxTracks = parseInt(this.elements.maxTracksInput.value);
      if (minTracks > maxTracks) this.elements.maxTracksInput.value = minTracks;
      this.saveStateToSession();
    });

    this.elements.maxTracksInput.addEventListener("change", () => {
      const minTracks = parseInt(this.elements.minTracksInput.value);
      const maxTracks = parseInt(this.elements.maxTracksInput.value);
      if (maxTracks < minTracks) this.elements.minTracksInput.value = maxTracks;
      this.saveStateToSession();
    });

    this.elements.includeSeedTracksCheckbox.addEventListener("change", () => {
      this.saveStateToSession();
    });

    this.elements.allowTrackVariationsCheckbox.addEventListener(
      "change",
      () => {
        this.saveStateToSession();
      }
    );

    this.elements.generatePlaylistBtn.addEventListener("click", () =>
      this.generatePlaylist()
    );

    // Clear (only shown when playlist visible)
    if (this.elements.clearResultsBtn) {
      this.elements.clearResultsBtn.addEventListener("click", () => {
        this.clearResults();
        // Also clear session state when user clears results
        sessionStorage.removeItem("ResoNoteState");
      });
    }

    // Export CSV
    if (this.elements.exportPlaylistBtn) {
      this.elements.exportPlaylistBtn.addEventListener("click", () =>
        this.exportPlaylistCsv()
      );
    }

    // Modal events
    this.elements.modalCloseBtn.addEventListener("click", () =>
      this.closeTrackDetailsModal()
    );
    this.elements.trackDetailsModal.addEventListener("click", (event) => {
      if (event.target.classList.contains("modal-overlay"))
        this.closeTrackDetailsModal();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !this.elements.trackDetailsModal.classList.contains("hidden")
      ) {
        this.closeTrackDetailsModal();
      }
    });

    // Ensure lucide icons show ticks correctly for checkboxes
    this.initializeIcons();
  },

  /**
   * Execute a debounced search and render results.
   * Applies client-side filtering, deduplication, and a fallback union search.
   * @param {string} query Free-text search query.
   * @returns {Promise<void>}
   */
  async searchTracks(query) {
    if (!query || query.length < 2) return;
    try {
      // Call the API search function normally
      let results = await API.searchTracks(query);

      // Break the query into terms
      const terms = query.split(/\s+/).filter((t) => t);

      // Exclude tracks that are already selected
      results = results.filter(
        (track) =>
          !this.state.selectedTracks.some(
            (selected) => selected.track_id === track.track_id
          )
      );

      // Use fuzzy filtering on the API results if more than one term exists
      if (terms.length > 1 && results && results.length > 0) {
        results = results.filter((track) => {
          const combined = (
            track.track_name +
            " " +
            track.artist_name
          ).toLowerCase();
          return terms.every((term) => combined.includes(term.toLowerCase()));
        });
      }

      // If no results found, perform a fallback union search by each individual term
      if (!results || results.length === 0) {
        let unionResults = [];
        for (const term of terms) {
          const partialResults = await API.searchTracks(term);
          // Exclude already selected tracks
          unionResults = unionResults.concat(
            partialResults.filter(
              (track) =>
                !this.state.selectedTracks.some(
                  (selected) => selected.track_id === track.track_id
                )
            )
          );
        }
        // Deduplicate union results by track_id
        const dedup = {};
        unionResults.forEach((track) => {
          dedup[track.track_id] = track;
        });
        results = Object.values(dedup).filter((track) => {
          const combined = (
            track.track_name +
            " " +
            track.artist_name
          ).toLowerCase();
          // Count how many terms appear in the combined string
          let matchCount = terms.filter((term) =>
            combined.includes(term.toLowerCase())
          ).length;
          // Require at least 70% of terms to match (rounded down)
          return matchCount >= Math.floor(terms.length * 0.7);
        });
      }

      this.renderSearchResults(results);
    } catch (err) {
      console.error("searchTracks error", err);
      this.showError("Error searching tracks");
    }
  },

  /**
   * Render the autocomplete dropdown list for search results.
   * @param {Array<any>} results Track result objects.
   */
  renderSearchResults(results) {
    this.elements.searchResults.innerHTML = "";
    if (!results || results.length === 0) {
      const noResultsItem = document.createElement("div");
      noResultsItem.classList.add("search-result-item");
      noResultsItem.innerHTML = `
        <div class="search-result-name">No tracks found</div>
        <div class="search-result-artist">Try a different search term</div>
      `;
      this.elements.searchResults.appendChild(noResultsItem);
    } else {
      results.forEach((track) => {
        const resultItem = document.createElement("div");
        resultItem.classList.add("search-result-item");
        if (track.exactMatch) resultItem.classList.add("exact-match");

        resultItem.innerHTML = `
          <div class="search-result-name">${this.escapeHtml(
            track.track_name
          )}</div>
          <div class="search-result-artist">${this.escapeHtml(
            track.artist_name
          )} <small style="display:block;color:var(--muted-foreground)">${this.escapeHtml(
          track.track_id
        )}</small></div>
        `;

        resultItem.addEventListener("click", () => {
          this.addSelectedTrack(track);
          this.elements.searchResults.classList.add("hidden");
          this.elements.trackSearchInput.value = "";
          this.saveStateToSession();
        });

        this.elements.searchResults.appendChild(resultItem);
      });
    }
    this.elements.searchResults.classList.remove("hidden");
    this.initializeIcons();
  },

  /**
   * Add a track to the current selection, prefetch its image, and refresh UI.
   * No-ops if the track is invalid or already selected.
   * @param {any} track Track object with at least a track_id.
   * @returns {Promise<void>|void}
   */
  async addSelectedTrack(track) {
    if (!track || !track.track_id) return;
    if (this.state.selectedTracks.some((t) => t.track_id === track.track_id))
      return;
    this.state.selectedTracks.push(track);
    this._setTrackImagePlaceholder(track.track_id);

    // Prefetch image (non-blocking)
    API.getTrackImage(track.track_id)
      .then((url) => {
        if (url) {
          this.state.imageCache[track.track_id] = url;
          this._refreshThumbForTrackInUI(track.track_id, url);
        }
      })
      .catch(() => {});

    this.updateSelectedTracks();
    this.saveStateToSession();
  },

  /**
   * Remove a selected track by ID and update UI and session state.
   * Restores Random button affordance when selection becomes empty.
   * @param {string} trackId
   */
  removeSelectedTrack(trackId) {
    this.state.selectedTracks = this.state.selectedTracks.filter(
      (t) => t.track_id !== trackId
    );
    this.updateSelectedTracks();
    this.saveStateToSession();
    // If selection empty, restore random button to default
    if (this.state.selectedTracks.length === 0) {
      if (this.elements.randomTrackBtn) {
        this.elements.randomTrackBtn.innerHTML = this.randomButtonDefaultHtml;
        this.elements.randomTrackBtn.disabled = false;
        this.initializeIcons();
      }
    }
  },

  /**
   * Ensure a track has a placeholder image entry in the cache.
   * @private
   * @param {string} trackId
   */
  _setTrackImagePlaceholder(trackId) {
    if (!this.state.imageCache.hasOwnProperty(trackId)) {
      this.state.imageCache[trackId] = null;
    }
  },

  /**
   * Render the selected track chips/cards and manage Random button state.
   */
  updateSelectedTracks() {
    this.elements.selectedTracks.innerHTML = "";

    // Show/hide random button based on selection count
    if (this.state.selectedTracks.length === 0) {
      if (this.elements.randomTrackBtn) {
        this.elements.randomTrackBtn.style.display = "inline-flex";
        this.elements.randomTrackBtn.disabled = false;
        if (
          !this.elements.randomTrackBtn.innerHTML ||
          this.elements.randomTrackBtn.innerHTML.indexOf("Loading") !== -1
        ) {
          this.elements.randomTrackBtn.innerHTML = this.randomButtonDefaultHtml;
          this.initializeIcons();
        }
      }
    } else {
      if (this.elements.randomTrackBtn) {
        this.elements.randomTrackBtn.style.display = "none";
        this.elements.randomTrackBtn.disabled = true;
      }
    }

    if (this.state.selectedTracks.length === 0) {
      const emptySelection = document.createElement("div");
      emptySelection.classList.add("empty-selection");
      emptySelection.innerHTML = `
        <i data-lucide="music" class="empty-icon"></i>
        <p>No tracks selected yet</p>
        <span class="empty-subtext">Search for a track above or select a random track</span>
      `;
      this.elements.selectedTracks.appendChild(emptySelection);
      this.initializeIcons();
      return;
    }

    this.state.selectedTracks.forEach((track) => {
      const trackElement = document.createElement("div");
      trackElement.classList.add("selected-track");

      const thumb = document.createElement("img");
      thumb.classList.add("track-thumb");
      thumb.alt = `${track.track_id} - ${track.track_name}`;
      const cached = this.state.imageCache[track.track_id];
      thumb.src = cached || this._placeholderDataUrl();

      const infoElement = document.createElement("div");
      infoElement.classList.add("selected-track-info");
      infoElement.innerHTML = `
        <div class="selected-track-name">${this.escapeHtml(
          track.track_name
        )}</div>
        <div class="selected-track-artist">${this.escapeHtml(
          track.artist_name
        )}</div>
        <div class="selected-track-id" style="font-size:0.75rem;color:var(--muted-foreground);margin-top:4px">
          ${this.escapeHtml(track.track_id)}
        </div>
      `;

      const removeButton = document.createElement("button");
      removeButton.classList.add("remove-track");
      removeButton.innerHTML = '<i data-lucide="x"></i>';
      removeButton.setAttribute("aria-label", `Remove ${track.track_name}`);
      removeButton.addEventListener("click", () =>
        this.removeSelectedTrack(track.track_id)
      );

      trackElement.appendChild(thumb);
      trackElement.appendChild(infoElement);
      trackElement.appendChild(removeButton);

      this.elements.selectedTracks.appendChild(trackElement);
    });

    this.initializeIcons();
  },

  /**
   * Invoke the backend to generate a playlist from the selected seeds and options.
   * Validates input, shows loading, handles errors, and renders the result.
   * @returns {Promise<void>}
   */
  async generatePlaylist() {
    if (this.state.selectedTracks.length === 0) {
      this.showError("Please select at least one track");
      return;
    }

    const trackIds = this.state.selectedTracks.map((t) => t.track_id);
    this.state.currentSeedTrackIds = trackIds;

    const options = {
      minTracks: Number(this.elements.minTracksInput.value) || 5,
      maxTracks: Number(this.elements.maxTracksInput.value) || 10,
      similarityType: this.state.similarityType,
      semanticWeight: this.state.semanticWeight,
      audioWeight: this.state.audioWeight,
      diversityFactor: Number(this.elements.diversityFactorSlider.value) || 0.3,
      includeSeedTracks: !!this.elements.includeSeedTracksCheckbox.checked,
      allowTrackVariations:
        !!this.elements.allowTrackVariationsCheckbox.checked,
    };

    this.showLoading();
    try {
      const playlist = await API.generatePlaylist(trackIds, options);
      if (
        !playlist ||
        !Array.isArray(playlist.tracks) ||
        playlist.tracks.length === 0
      ) {
        this.showError(
          "Unable to generate a playlist with the given options. Try relaxing filters or enabling variations."
        );
        return;
      }
      this.state.currentPlaylist = playlist;

      // Preload images (non-blocking) for playlist tracks
      playlist.tracks.forEach((t) => {
        if (!this.state.imageCache[t.track_id]) {
          API.getTrackImage(t.track_id)
            .then((url) => {
              if (url) {
                this.state.imageCache[t.track_id] = url;
                this._refreshThumbForTrackInUI(t.track_id, url);
              }
            })
            .catch(() => {});
        }
      });

      this.displayPlaylist(playlist);
      this.saveStateToSession();
    } catch (err) {
      const message = (err && err.message) || "Failed to generate playlist";
      this.showError(message);
    }
  },

  /**
   * Render playlist view, KPIs, and interactive actions for each track.
   * @param {any} playlist Playlist object with tracks, name, and optional stats.
   */
  displayPlaylist(playlist) {
    this.elements.loadingIndicator.classList.add("hidden");
    this.elements.errorMessage.classList.add("hidden");
    if (this.elements.emptyState)
      this.elements.emptyState.style.display = "none";
    this.elements.playlistResults.classList.remove("hidden");

    // Show Clear button when playlist is visible
    if (this.elements.clearResultsBtn) {
      this.elements.clearResultsBtn.display = "inline-flex";
      this.elements.clearResultsBtn.style.display = "inline-flex";
    }

    this.elements.playlistName.textContent =
      playlist.name || "Generated Playlist";

    // Stats
    this.elements.trackCount.innerHTML = `<i data-lucide="music"></i> ${playlist.tracks.length} tracks`;
    const avgSimPct =
      playlist.stats && typeof playlist.stats.averageSimilarity !== "undefined"
        ? Math.round(playlist.stats.averageSimilarity * 100)
        : 0;
    this.elements.avgSimilarity.innerHTML = `<i data-lucide="target"></i> Avg Similarity: ${avgSimPct}%`;

    // Build track list
    this.elements.trackList.innerHTML = "";

    playlist.tracks.forEach((track, index) => {
      const trackItem = document.createElement("div");
      trackItem.classList.add("track-item");
      if (track.isSeed) trackItem.classList.add("seed-track");
      if (track.isVariation) trackItem.classList.add("track-variation");

      const thumb = document.createElement("img");
      thumb.classList.add("track-thumb");
      thumb.alt = `${track.track_id} - ${track.track_name}`;
      thumb.src =
        this.state.imageCache[track.track_id] || this._placeholderDataUrl();

      trackItem.innerHTML = `
        <div class="track-number">${index + 1}</div>
        <div class="track-title-cell">
          <div class="track-info">
            <div class="track-name">${this.escapeHtml(track.track_name)}${
        track.isVariation
          ? ' <span class="variation-badge">Variation</span>'
          : ""
      }</div>
            <div class="track-id" style="font-size:0.75rem;color:var(--muted-foreground);margin-top:4px;opacity:0.6">${this.escapeHtml(
              track.track_id
            )}</div>
          </div>
        </div>
        <div class="track-artist-cell">${this.escapeHtml(
          track.artist_name
        )}</div>
        <div class="track-similarity">${
          track.similarity
            ? Math.round((track.similarity || 0) * 100) + "%"
            : "0%"
        }</div>
        <div class="track-actions">
          <button class="btn-icon play-btn spotify" aria-label="Play ${this.escapeHtml(
            track.track_name
          )} on Spotify">
          </button>
          <button class="btn-icon info-btn" aria-label="Details for ${this.escapeHtml(
            track.track_name
          )}">
            <i data-lucide="info"></i>
          </button>
        </div>
      `;

      const titleCell = trackItem.querySelector(".track-title-cell");
      titleCell.insertBefore(thumb, titleCell.firstChild);

      const playButton = trackItem.querySelector(".play-btn");
      const infoButton = trackItem.querySelector(".info-btn");

      playButton.addEventListener("click", () => {
        window.open(
          `https://open.spotify.com/track/${encodeURIComponent(
            track.track_id
          )}`,
          "_blank"
        );
      });

      infoButton.addEventListener("click", () =>
        this.showTrackDetails(track, this.state.currentSeedTrackIds)
      );

      this.elements.trackList.appendChild(trackItem);
    });

    this.initializeIcons();
  },

  /**
   * Open the details modal for a track and optionally fetch similarity to the first seed.
   * @param {any} track
   * @param {string[]} seedTrackIds
   * @returns {Promise<void>}
   */
  async showTrackDetails(track, seedTrackIds) {
    this.elements.modalTrackTitle.textContent = `${track.track_name} by ${track.artist_name}`;
    this.elements.modalTrackDetails.innerHTML = "";
    this.elements.modalLoading.classList.remove("hidden");
    this.elements.trackDetailsModal.classList.remove("hidden");

    try {
      const trackDetails = await API.getTrackDetails(track.track_id);
      let similarityDetails = null;
      if (!track.isSeed && seedTrackIds && seedTrackIds.length > 0) {
        similarityDetails = await API.getSimilarityDetails(
          seedTrackIds[0],
          track.track_id,
          {
            similarityType: this.state.similarityType,
            semanticWeight: this.state.semanticWeight,
            audioWeight: this.state.audioWeight,
          }
        );
      }
      this.renderTrackDetails(
        trackDetails,
        similarityDetails,
        track.isSeed,
        track.isVariation,
        track.variationOf
      );
      this.elements.modalLoading.classList.add("hidden");
      this.initializeIcons();
    } catch (err) {
      this.elements.modalTrackDetails.innerHTML = `
        <div class="error-state">
          <i data-lucide="alert-circle"></i>
          <p>Failed to load track details: ${this.escapeHtml(
            err && err.message ? err.message : "Unknown error"
          )}</p>
        </div>
      `;
      this.elements.modalLoading.classList.add("hidden");
      this.initializeIcons();
    }
  },

  /**
   * Render the track details modal content: metadata, tags, features, similarity, and lyrics.
   * @param {any} track
   * @param {any|null} similarityDetails
   * @param {boolean} isSeed
   * @param {boolean} isVariation
   * @param {string|undefined} variationOf
   */
  renderTrackDetails(
    track,
    similarityDetails,
    isSeed,
    isVariation,
    variationOf
  ) {
    // Build modal content for detailed track view with enhanced spacing and styling for tags, features, lyrics, and similarity reason.
    let html = `
      <div class="track-details-section">
        <h3><i data-lucide="music"></i> Track Information</h3>
        <div class="track-info modal-section">
          <div class="track-info-item">
            <div class="track-info-label">Track Name</div>
            <div class="track-info-value">${this.escapeHtml(
              track.track_name
            )}</div>
          </div>
          <div class="track-info-item">
            <div class="track-info-label">Artist</div>
            <div class="track-info-value">${this.escapeHtml(
              track.artist_name
            )}</div>
          </div>
          ${
            isVariation
              ? `<div class="track-info-item">
                  <div class="track-info-label">Variation</div>
                  <div class="track-info-value variation-info">This is a variation of track ID: ${this.escapeHtml(
                    variationOf
                  )}</div>
                </div>`
              : ""
          }
          <div class="track-info-item">
            <div class="track-info-value">
              <a href="https://open.spotify.com/track/${encodeURIComponent(
                track.track_id
              )}" target="_blank" class="btn btn-outline btn-sm">
                <i data-lucide="external-link"></i> Open in Spotify
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    if (track.tags && Object.keys(track.tags).length > 0) {
      html += `<div class="track-details-section">
            <h3><i data-lucide="tag"></i> Semantic Tags</h3>
            <div class="track-info modal-section">`;
      for (const [facet, tags] of Object.entries(track.tags)) {
        if (!tags || tags.length === 0) continue;
        html += `<div class="track-info-item modal-section">
               <div class="track-info-label">${this.escapeHtml(
                 facet.replace("_", " ")
               )}</div>
               <div class="tags-list">`;
        tags.forEach((tag) => {
          let statusClass = "default";
          if (
            track.scores &&
            track.scores[facet] &&
            track.scores[facet][tag] != null
          ) {
            const score = track.scores[facet][tag];
            statusClass = score >= 0.7 ? "match" : "nomatch";
          }
          const scoreHtml =
            track.scores && track.scores[facet] && track.scores[facet][tag]
              ? `<span class="tag-score">${Math.round(
                  track.scores[facet][tag] * 100
                )}%</span>`
              : "";
          html += `<span class="tag-item ${statusClass}">${this.escapeHtml(
            tag
          )}${scoreHtml}</span>`;
        });
        html += `   </div>
             </div>`;
      }
      html += `   </div>
           </div>`;
    }

    if (track.features && Object.keys(track.features).length > 0) {
      html += `<div class="track-details-section">
                <h3><i data-lucide="waves"></i> Audio Features</h3>
                <div class="features-grid">`;
      const featureLabels = {
        danceability: "Danceability",
        energy: "Energy",
        acousticness: "Acousticness",
        instrumentalness: "Instrumentalness",
        valence: "Valence (Positivity)",
        tempo: "Tempo (BPM)",
        loudness: "Loudness (dB)",
        speechiness: "Speechiness",
        liveness: "Liveness",
        mode: "Mode",
      };
      for (const [feature, value] of Object.entries(track.features)) {
        if (value === null || typeof value === "undefined") continue;
        const label = featureLabels[feature] || feature;
        let displayValue = value;
        if (feature === "tempo") displayValue = `${Math.round(value)} BPM`;
        else if (feature === "loudness")
          displayValue = `${value.toFixed(1)} dB`;
        else if (feature === "mode")
          displayValue = value === 1 ? "Major" : "Minor";
        else if (typeof value === "number") displayValue = value.toFixed(2);
        html += `<div class="feature-item">
                   <div class="feature-name">${this.escapeHtml(label)}</div>
                   <div class="feature-value">${this.escapeHtml(
                     String(displayValue)
                   )}</div>
                 </div>`;
      }
      html += `  </div>
              </div>`;
    }

    if (similarityDetails && similarityDetails.similarity) {
      const s = similarityDetails.similarity;
      const overallPct = Math.round((s.overall || 0) * 100);
      html += `<div class="track-details-section">
                 <h3><i data-lucide="target"></i> Similarity Analysis</h3>
                 <div class="similarity-breakdown">
                   <h4>Overall Similarity: ${overallPct}%</h4>
                   <div class="similarity-reason">${this.getSimilarityReason(
                     s
                   )}</div>
                 </div>
               </div>`;
    }

    if (track.lyrics) {
      html += `<div class="track-details-section">
                 <h3><i data-lucide="file-text"></i> Lyrics</h3>
                 <div class="lyrics-section">
                   ${this.escapeHtml(track.lyrics)}
                 </div>
               </div>`;
    }

    this.elements.modalTrackDetails.innerHTML = html;
  },

  /**
   * Produce a concise human-readable explanation for a similarity payload.
   * @param {any} similarity
   * @returns {string}
   */
  getSimilarityReason(similarity) {
    if (!similarity) return "relevant characteristics";
    try {
      if (
        similarity.breakdown &&
        similarity.breakdown.semantic &&
        similarity.breakdown.semantic.coOccurrence &&
        similarity.breakdown.semantic.coOccurrence.score > 0.5
      ) {
        const patterns =
          similarity.breakdown.semantic.coOccurrence.matchingPatterns;
        if (patterns && patterns.length > 0) {
          return `Matched tag combinations around "${patterns[0].pattern}"`;
        }
        return "semantic tag combinations";
      }
      if (similarity.semantic > similarity.audio) {
        return "semantic themes and emotional characteristics";
      } else {
        return "audio features and rhythm characteristics";
      }
    } catch (err) {
      return "relevant characteristics";
    }
  },

  /**
   * Hide and clear the details modal content.
   */
  closeTrackDetailsModal() {
    this.elements.trackDetailsModal.classList.add("hidden");
    this.elements.modalTrackDetails.innerHTML = "";
  },

  /**
   * Show the loading state and hide other panels.
   */
  showLoading() {
    this.elements.errorMessage.classList.add("hidden");
    this.elements.playlistResults.classList.add("hidden");
    if (this.elements.emptyState)
      this.elements.emptyState.style.display = "none";
    this.elements.loadingIndicator.classList.remove("hidden");
  },

  /**
   * Render a visible error banner with the provided message.
   * @param {string} message
   */
  showError(message) {
    this.elements.loadingIndicator.classList.add("hidden");
    this.elements.playlistResults.classList.add("hidden");
    if (this.elements.emptyState)
      this.elements.emptyState.style.display = "none";
    this.elements.errorMessage.innerHTML = `
      <i data-lucide="alert-circle"></i>
      <p>${this.escapeHtml(message)}</p>
    `;
    this.elements.errorMessage.classList.remove("hidden");
    this.initializeIcons();
  },

  /**
   * Reset the visible UI sections and clear current playlist UI.
   * Keeps selections intact; use Clear button UX to reset view.
   */
  clearResults() {
    this.elements.loadingIndicator.classList.add("hidden");
    this.elements.errorMessage.classList.add("hidden");
    this.elements.playlistResults.classList.add("hidden");
    if (this.elements.emptyState)
      this.elements.emptyState.style.display = "flex";
    if (this.elements.trackList) this.elements.trackList.innerHTML = "";
    this.state.currentPlaylist = null;
  },

  /**
   * Update any thumbnails in the selection and playlist that match trackId.
   * @private
   * @param {string} trackId
   * @param {string} imageUrl
   */
  _refreshThumbForTrackInUI(trackId, imageUrl) {
    // Update selected tracks thumbnails by matching exact track_id
    const selectedItems =
      this.elements.selectedTracks.querySelectorAll(".selected-track");
    selectedItems.forEach((item) => {
      const idEl = item.querySelector(".selected-track-id");
      const img = item.querySelector("img.track-thumb");
      if (!img || !idEl) return;
      // Compare trimmed text exactly to trackId
      if (idEl.textContent.trim() === String(trackId)) {
        img.src = imageUrl;
      }
    });

    // Update playlist thumbnails using similar exact matching
    const playlistThumbs =
      this.elements.trackList.querySelectorAll("img.track-thumb");
    playlistThumbs.forEach((img) => {
      if (!img || !img.alt) return;
      // Assuming alt is in format "track_id - track_name"
      const [imgTrackId] = img.alt.split(" - ");
      if (imgTrackId.trim() === String(trackId)) {
        img.src = imageUrl;
      }
    });
  },

  /**
   * Return a small inline SVG data URL to act as a neutral image placeholder.
   * @private
   * @returns {string}
   */
  _placeholderDataUrl() {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="%2312181a"/><text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle" font-size="10" fill="%238a8f98" font-family="Inter, sans-serif">No Image</text></svg>';
  },

  /**
   * Safely escape untrusted text for HTML insertion.
   * @param {any} text
   * @returns {string}
   */
  escapeHtml(text) {
    if (typeof text === "undefined" || text === null) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  },

  /**
   * Export the current playlist to CSV and trigger a download.
   * @returns {void}
   */
  exportPlaylistCsv() {
    const playlist = this.state.currentPlaylist;
    if (
      !playlist ||
      !Array.isArray(playlist.tracks) ||
      playlist.tracks.length === 0
    ) {
      this.showError("No playlist to export");
      return;
    }

    const rows = [
      ["Track no.", "Title", "Artist", "Similarity", "Spotify URL"],
    ];

    playlist.tracks.forEach((t, idx) => {
      const similarity = t.similarity
        ? `${Math.round((t.similarity || 0) * 100)}%`
        : "0%";
      const url = `https://open.spotify.com/track/${encodeURIComponent(
        t.track_id
      )}`;
      rows.push([
        String(idx + 1),
        t.track_name || "",
        t.artist_name || "",
        similarity,
        url,
      ]);
    });

    const csvContent = rows
      .map((r) =>
        r
          .map((cell) => {
            if (cell == null) return "";
            const escaped = String(cell).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (playlist.name || "playlist").replace(/[^\w\d-_ ]+/g, "");
    a.download = `${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 5000);
  },

  /**
   * Persist relevant UI state into sessionStorage.
   * Saves selection, playlist, similarity choices, and control values.
   */
  saveStateToSession() {
    const stateToSave = {
      selectedTracks: this.state.selectedTracks,
      currentPlaylist: this.state.currentPlaylist,
      similarityType: this.state.similarityType,
      semanticWeight: this.state.semanticWeight,
      audioWeight: this.state.audioWeight,
      minTracks: this.elements.minTracksInput.value,
      maxTracks: this.elements.maxTracksInput.value,
      diversityFactor: this.elements.diversityFactorSlider.value,
      includeSeedTracks: this.elements.includeSeedTracksCheckbox.checked,
      allowTrackVariations: this.elements.allowTrackVariationsCheckbox.checked,
    };
    sessionStorage.setItem("ResoNoteState", JSON.stringify(stateToSave));
  },

  /**
   * Restore UI state from sessionStorage, re-rendering views and rehydrating controls.
   * Also attempts to restore thumbnails by refetching image URLs.
   */
  loadStateFromSession() {
    const savedState = sessionStorage.getItem("ResoNoteState");
    if (savedState) {
      try {
        const stateObj = JSON.parse(savedState);
        if (stateObj.selectedTracks) {
          this.state.selectedTracks = stateObj.selectedTracks;
        }
        if (stateObj.currentPlaylist) {
          this.state.currentPlaylist = stateObj.currentPlaylist;
          // Display the saved playlist
          this.displayPlaylist(this.state.currentPlaylist);
        }
        if (stateObj.similarityType) {
          this.state.similarityType = stateObj.similarityType;
          // Update radio buttons to reflect the saved similarity type
          this.elements.similarityTypeRadios.forEach((radio) => {
            radio.checked = radio.value === stateObj.similarityType;
          });
          if (stateObj.similarityType === "combined") {
            this.elements.weightsContainer.style.display = "flex";
          } else {
            this.elements.weightsContainer.style.display = "none";
          }
        }
        if (stateObj.semanticWeight) {
          this.state.semanticWeight = stateObj.semanticWeight;
          this.elements.semanticWeightSlider.value = stateObj.semanticWeight;
          this.elements.semanticWeightValue.textContent = `${Math.round(
            stateObj.semanticWeight * 100
          )}%`;
        }
        if (stateObj.audioWeight) {
          this.state.audioWeight = stateObj.audioWeight;
          this.elements.audioWeightSlider.value = stateObj.audioWeight;
          this.elements.audioWeightValue.textContent = `${Math.round(
            stateObj.audioWeight * 100
          )}%`;
        }
        if (stateObj.minTracks) {
          this.elements.minTracksInput.value = stateObj.minTracks;
        }
        if (stateObj.maxTracks) {
          this.elements.maxTracksInput.value = stateObj.maxTracks;
        }
        if (stateObj.diversityFactor) {
          this.elements.diversityFactorSlider.value = stateObj.diversityFactor;
          this.elements.diversityFactorValue.textContent = `${Math.round(
            stateObj.diversityFactor * 100
          )}%`;
        }
        if (typeof stateObj.includeSeedTracks !== "undefined") {
          this.elements.includeSeedTracksCheckbox.checked =
            stateObj.includeSeedTracks;
        }
        if (typeof stateObj.allowTrackVariations !== "undefined") {
          this.elements.allowTrackVariationsCheckbox.checked =
            stateObj.allowTrackVariations;
        }
      } catch (e) {
        console.error("Error parsing session state", e);
      }

      // For each saved selected track, re-fetch its album image if not already in cache
      if (this.state.selectedTracks && this.state.selectedTracks.length > 0) {
        this.state.selectedTracks.forEach((track) => {
          API.getTrackImage(track.track_id)
            .then((url) => {
              if (url) {
                this.state.imageCache[track.track_id] = url;
                this._refreshThumbForTrackInUI(track.track_id, url);
              }
            })
            .catch(() => {});
        });
      }
      // If a playlist exists in state, for each track in it re-fetch its album image
      if (
        this.state.currentPlaylist &&
        this.state.currentPlaylist.tracks &&
        this.state.currentPlaylist.tracks.length > 0
      ) {
        this.state.currentPlaylist.tracks.forEach((track) => {
          API.getTrackImage(track.track_id)
            .then((url) => {
              if (url) {
                this.state.imageCache[track.track_id] = url;
                this._refreshThumbForTrackInUI(track.track_id, url);
              }
            })
            .catch(() => {});
        });
      }
    }
  },
};

// Initialize UI when DOM is loaded
document.addEventListener("DOMContentLoaded", () => UI.init());
