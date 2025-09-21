// public/js/ui.js
/**
 * UI manipulation functions for ResoNote
 *
 * Adjustments in this version:
 * - Show 'Clear' (clear-results) button only when a playlist is visible.
 * - Ensure random button reverts to default when selection cleared.
 * - Fix selected track thumbnail bug by updating _refreshThumbForTrackInUI to use exact matching for track IDs.
 * - Keep slider displays as percentages (already implemented).
 * - Responsive interactions are controlled via CSS; JS shows/hides elements when appropriate.
 */

const UI = {
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

  randomButtonDefaultHtml: '<i data-lucide="shuffle"></i> Random',

  init() {
    // Ensure Clear button hidden initially - only show after a successful playlist generate
    if (this.elements.clearResultsBtn) {
      this.elements.clearResultsBtn.style.display = "none";
    }

    this.setupEventListeners();
    this._initSliderDisplays();
    this._initTooltips();
    this.updateSelectedTracks();
    this.initializeIcons();
  },

  initializeIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      try {
        window.lucide.createIcons();
      } catch (err) {
        // ignore icon creation errors
      }
    }
  },

  _initTooltips() {
    // Ensure elements with data-tooltip have a title for native tooltip behavior
    const tooltipElements = document.querySelectorAll("[data-tooltip]");
    tooltipElements.forEach((el) => {
      const text = el.getAttribute("data-tooltip");
      if (text && !el.getAttribute("title")) el.setAttribute("title", text);
    });
  },

  _initSliderDisplays() {
    const semantic = parseFloat(this.elements.semanticWeightSlider.value || 0.5);
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
    });

    this.elements.diversityFactorSlider.addEventListener("input", () => {
      const value = parseFloat(this.elements.diversityFactorSlider.value);
      this.elements.diversityFactorValue.textContent = `${Math.round(
        value * 100
      )}%`;
    });

    this.elements.minTracksInput.addEventListener("change", () => {
      const minTracks = parseInt(this.elements.minTracksInput.value);
      const maxTracks = parseInt(this.elements.maxTracksInput.value);
      if (minTracks > maxTracks) this.elements.maxTracksInput.value = minTracks;
    });

    this.elements.maxTracksInput.addEventListener("change", () => {
      const minTracks = parseInt(this.elements.minTracksInput.value);
      const maxTracks = parseInt(this.elements.maxTracksInput.value);
      if (maxTracks < minTracks) this.elements.minTracksInput.value = maxTracks;
    });

    this.elements.generatePlaylistBtn.addEventListener("click", () =>
      this.generatePlaylist()
    );

    // Clear (only shown when playlist visible)
    if (this.elements.clearResultsBtn) {
      this.elements.clearResultsBtn.addEventListener("click", () =>
        this.clearResults()
      );
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

  async searchTracks(query) {
    if (!query || query.length < 2) return;
    try {
      const results = await API.searchTracks(query);
      this.renderSearchResults(results);
    } catch (err) {
      console.error("searchTracks error", err);
      this.showError("Error searching tracks");
    }
  },

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
        });

        this.elements.searchResults.appendChild(resultItem);
      });
    }
    this.elements.searchResults.classList.remove("hidden");
    this.initializeIcons();
  },

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
  },

  removeSelectedTrack(trackId) {
    this.state.selectedTracks = this.state.selectedTracks.filter(
      (t) => t.track_id !== trackId
    );
    this.updateSelectedTracks();
    // If selection empty, restore random button to default
    if (this.state.selectedTracks.length === 0) {
      if (this.elements.randomTrackBtn) {
        this.elements.randomTrackBtn.innerHTML = this.randomButtonDefaultHtml;
        this.elements.randomTrackBtn.disabled = false;
        this.initializeIcons();
      }
    }
  },

  _setTrackImagePlaceholder(trackId) {
    if (!this.state.imageCache.hasOwnProperty(trackId)) {
      this.state.imageCache[trackId] = null;
    }
  },

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

      // Preload images (non-blocking)
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
    } catch (err) {
      const message =
        (err && err.message) || "Failed to generate playlist";
      this.showError(message);
    }
  },

  displayPlaylist(playlist) {
    this.elements.loadingIndicator.classList.add("hidden");
    this.elements.errorMessage.classList.add("hidden");
    if (this.elements.emptyState)
      this.elements.emptyState.style.display = "none";
    this.elements.playlistResults.classList.remove("hidden");

    // Show Clear button when playlist is visible
    if (this.elements.clearResultsBtn) {
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
          <button class="btn-icon play-btn" aria-label="Play ${this.escapeHtml(
            track.track_name
          )}">
            <i data-lucide="play"></i>
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
            (err && err.message) ? err.message : "Unknown error"
          )}</p>
        </div>
      `;
      this.elements.modalLoading.classList.add("hidden");
      this.initializeIcons();
    }
  },

  renderTrackDetails(
    track,
    similarityDetails,
    isSeed,
    isVariation,
    variationOf
  ) {
    let html = `
      <div class="track-details-section">
        <h3><i data-lucide="music"></i> Track Information</h3>
        <div class="track-info">
          <div class="track-info-column">
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
              <div class="track-info-label">Spotify Link</div>
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
      </div>
    `;

    if (track.tags && Object.keys(track.tags).length > 0) {
      html += `<div class="track-details-section"><h3><i data-lucide="tag"></i> Semantic Tags</h3>`;
      for (const [facet, tags] of Object.entries(track.tags)) {
        if (!tags || tags.length === 0) continue;
        html += `<div class="track-info-item"><div class="track-info-label">${this.escapeHtml(
          facet.replace("_", " ")
        )}</div><div class="tags-list">`;
        tags.forEach((tag) => {
          const confidence =
            track.scores && track.scores[facet] && track.scores[facet][tag];
          const scoreHtml = confidence
            ? `<span class="tag-score">${Math.round(confidence * 100)}%</span>`
            : "";
          html += `<span class="tag-item">${this.escapeHtml(
            tag
          )}${scoreHtml}</span>`;
        });
        html += `</div></div>`;
      }
      html += `</div>`;
    }

    if (track.features && Object.keys(track.features).length > 0) {
      html += `<div class="track-details-section"><h3><i data-lucide="waves"></i> Audio Features</h3><div class="features-grid">`;
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
        html += `<div class="feature-item"><div class="feature-name">${this.escapeHtml(
          label
        )}</div><div class="feature-value">${this.escapeHtml(
          String(displayValue)
        )}</div></div>`;
      }
      html += `</div></div>`;
    }

    if (similarityDetails && similarityDetails.similarity) {
      const s = similarityDetails.similarity;
      const overallPct = Math.round((s.overall || 0) * 100);
      html += `<div class="track-details-section"><h3><i data-lucide="target"></i> Similarity Analysis</h3><div class="similarity-breakdown"><h4>Overall Similarity: ${overallPct}%</h4></div></div>`;
    }

    if (track.lyrics) {
      html += `<div class="track-details-section"><h3><i data-lucide="file-text"></i> Lyrics</h3><div class="track-info-value" style="white-space: pre-line;">${this.escapeHtml(
        track.lyrics
      )}</div></div>`;
    }

    this.elements.modalTrackDetails.innerHTML = html;
  },

  closeTrackDetailsModal() {
    this.elements.trackDetailsModal.classList.add("hidden");
    this.elements.modalTrackDetails.innerHTML = "";
  },

  showLoading() {
    this.elements.errorMessage.classList.add("hidden");
    this.elements.playlistResults.classList.add("hidden");
    if (this.elements.emptyState)
      this.elements.emptyState.style.display = "none";
    this.elements.loadingIndicator.classList.remove("hidden");
  },

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

  clearResults() {
    this.elements.loadingIndicator.classList.add("hidden");
    this.elements.errorMessage.classList.add("hidden");
    this.elements.playlistResults.classList.add("hidden");
    if (this.elements.emptyState)
      this.elements.emptyState.style.display = "flex";
    if (this.elements.trackList) this.elements.trackList.innerHTML = "";
    this.state.currentPlaylist = null;

    // Hide Clear button now that there's no playlist
    if (this.elements.clearResultsBtn)
      this.elements.clearResultsBtn.style.display = "none";
  },

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

  _placeholderDataUrl() {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="%2312181a"/><text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle" font-size="10" fill="%238a8f98" font-family="Inter, sans-serif">No Image</text></svg>';
  },

  escapeHtml(text) {
    if (typeof text === "undefined" || text === null) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  },

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
};

// Initialize UI when DOM is loaded
document.addEventListener("DOMContentLoaded", () => UI.init());