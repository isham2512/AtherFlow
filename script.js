window._ytReady = false;
window.onYouTubeIframeAPIReady = function () {
  window._ytReady = true;
  window.dispatchEvent(new Event('yt-api-ready'));
};

class AetherFlow {
  constructor() {
    this.defaultPlaylist = [{
      id: 1, source: 'youtube', youtubeId: 'TW9d8vYrVFQ',
      title: 'Sky High', artist: 'Elektronomia · NCS',
      audio: 'https://www.youtube.com/watch?v=TW9d8vYrVFQ',
      image: 'https://img.youtube.com/vi/TW9d8vYrVFQ/hqdefault.jpg',
      embedHtml: null
    }];

    this.playlist = [...this.defaultPlaylist];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 75;
    this.showHistory = false;
    this.theme = 'dark';
    this.history = [];

    this.ytPlayer = null;
    this.ytReady = false;
    this.pendingYtId = null;
    this.ytPollTimer = null;
    this.audioPoll = null;

    this.loadState();
    this.d = this.buildDom();
    this.checkDom();
    this.bindEvents();
    this.initAudio();
    this.spawnNotes();
    this.applyTheme();
    this.updateMeta();
    this.renderQueue();

    this.fillSlider(this.d.volSlider, this.volume);
    this.fillSlider(this.d.progSlider, 0);
    this.d.volLabel.textContent = `${this.volume}%`;

    if (window._ytReady) {
      this.initYtPlayer();
    } else {
      window.addEventListener('yt-api-ready', () => this.initYtPlayer(), { once: true });
    }

    const first = this.playlist[this.currentIndex];
    if (first && first.source === 'youtube') {
      this.pendingYtId = first.youtubeId;
    }
  }

  buildDom() {
    const g = id => document.getElementById(id);
    return {
      audio: g('audio-player'),
      urlInput: g('url-input'),
      btnLoad: g('btn-load'),
      urlError: g('url-error'),
      mediaBox: g('media-box'),
      coverState: g('cover-state'),
      albumArt: g('album-art'),
      videoState: g('video-state'),
      ytPlayerDiv: g('yt-player'),
      plainIframe: g('plain-iframe'),
      btnFs: g('btn-fullscreen'),
      trackTitle: g('track-title'),
      trackSub: g('track-sub'),
      progRow: g('prog-row'),
      progSlider: g('prog-slider'),
      tCur: g('t-cur'),
      tTot: g('t-tot'),
      btnPlay: g('btn-play'),
      btnPrev: g('btn-prev'),
      btnNext: g('btn-next'),
      btnMute: g('btn-mute'),
      volSlider: g('vol-slider'),
      volLabel: g('vol-label'),
      btnHistory: g('btn-history'),
      btnTheme: g('btn-theme'),
      queueLabel: g('queue-label'),
      queueCount: g('queue-count'),
      queueList: g('queue-list'),
      card: g('player-card'),
      notesWrap: g('notes-wrap'),
      toasts: g('toasts')
    };
  }

  checkDom() {
    const missing = Object.entries(this.d).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) console.warn('[AetherFlow] missing DOM refs:', missing);
  }

  bindEvents() {
    this.d.btnTheme.addEventListener('click', () => this.toggleTheme());
    this.d.btnHistory.addEventListener('click', () => this.toggleHistory());
    this.d.btnPlay.addEventListener('click', () => this.handlePlay());
    this.d.btnPrev.addEventListener('click', () => this.prev());
    this.d.btnNext.addEventListener('click', () => this.next());
    this.d.btnFs.addEventListener('click', () => this.fullscreen());
    this.d.btnLoad.addEventListener('click', () => this.handleImport());
    this.d.btnMute.addEventListener('click', () => this.toggleMute());
    this.d.urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.handleImport(); });

    this.d.progSlider.addEventListener('input', e => {
      this.fillSlider(e.target, e.target.value);
    });
    this.d.progSlider.addEventListener('change', e => {
      this.seek(parseFloat(e.target.value));
    });

    this.d.volSlider.addEventListener('input', e => {
      this.setVolume(parseInt(e.target.value));
    });
  }

  initAudio() {
    const a = this.d.audio;
    a.volume = this.volume / 100;
    a.addEventListener('play', () => {
      this.isPlaying = true;
      this.syncPlayBtn();
      this.setCardPlaying(true);
      this.startAudioPoll();
    });
    a.addEventListener('pause', () => {
      this.isPlaying = false;
      this.syncPlayBtn();
      this.setCardPlaying(false);
      this.stopAudioPoll();
    });
    a.addEventListener('ended', () => this.next());
    a.addEventListener('error', () => this.toast('Audio load failed.', 'error'));
  }

  initYtPlayer() {
    try {
      this.ytPlayer = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
          controls: 0,
          playsinline: 1,
          rel: 0,
          fs: 0,
          disablekb: 0,
          autoplay: 0,
          origin: window.location.origin || 'http://localhost'
        },
        events: {
          onReady: ev => this.onYtReady(ev),
          onStateChange: ev => this.onYtState(ev.data),
          onError: ev => this.onYtError(ev.data)
        }
      });
    } catch (e) {
      console.error('[AetherFlow] YT.Player init error:', e);
    }
  }

  onYtReady(event) {
    this.ytReady = true;
    event.target.setVolume(this.volume);

    if (this.pendingYtId) {
      const id = this.pendingYtId;
      this.pendingYtId = null;
      this.showVideoBox('youtube');
      event.target.loadVideoById(id);
      this.startYtPoll();
      this.isPlaying = true;
      this.syncPlayBtn();
      this.setCardPlaying(true);
    }
  }

  onYtState(state) {
    switch (state) {
      case YT.PlayerState.PLAYING:
        this.isPlaying = true;
        this.syncPlayBtn();
        this.setCardPlaying(true);
        this.startYtPoll();
        break;
      case YT.PlayerState.PAUSED:
        this.isPlaying = false;
        this.syncPlayBtn();
        this.setCardPlaying(false);
        break;
      case YT.PlayerState.ENDED:
        this.setCardPlaying(false);
        this.next();
        break;
    }
  }

  onYtError(code) {
    const msgs = {
      100: 'Video not found or private.',
      101: 'Uploader has disabled embedding for this video.',
      150: 'Uploader has disabled embedding for this video.'
    };
    this.toast(msgs[code] || `YouTube error (code ${code}).`, 'error');
    this.isPlaying = false;
    this.syncPlayBtn();
    this.setCardPlaying(false);
  }

  playTrack(index, fromHistory = false) {
    let track;
    if (fromHistory) {
      if (index < 0 || index >= this.history.length) return;
      track = this.history[index];
      const pi = this.playlist.findIndex(t => t.audio === track.audio);
      if (pi !== -1) this.currentIndex = pi;
      else { this.playlist.push(track); this.currentIndex = this.playlist.length - 1; }
    } else {
      if (index < 0 || index >= this.playlist.length) return;
      this.currentIndex = index;
      track = this.playlist[index];
    }

    this.stopYtPoll();
    this.stopAudioPoll();
    this.d.audio.pause();
    this.d.audio.src = '';

    if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
      try { this.ytPlayer.stopVideo(); } catch (_) { }
    }
    this.d.plainIframe.src = 'about:blank';

    const src = track.source;

    if (src === 'youtube') {
      this.showVideoBox('youtube');
      this.enableProgressRow(true);

      if (this.ytReady && this.ytPlayer) {
        try {
          this.ytPlayer.loadVideoById(track.youtubeId);
          this.ytPlayer.setVolume(this.isMuted ? 0 : this.volume);
          this.startYtPoll();
          this.isPlaying = true;
          this.syncPlayBtn();
          this.setCardPlaying(true);
        } catch (e) { console.warn('[AetherFlow] loadVideoById error:', e); }
      } else {
        this.pendingYtId = track.youtubeId;
        this.toast('YouTube player initialising…', 'info');
      }

    } else if (src === 'terabox' || src === 'embed') {
      this.showVideoBox('plain');
      this.enableProgressRow(false);
      this.d.plainIframe.src = track.iframeSrc || track.audio;
      this.isPlaying = true;
      this.syncPlayBtn();
      this.setCardPlaying(true);
      this.syncProg(0, 0);
      if (src === 'terabox') this.toast('TeraBox loaded — use its controls inside the player.', 'info');

    } else {
      this.showVideoBox(null);
      this.enableProgressRow(true);
      this.d.audio.src = track.audio;
      this.d.audio.load();
      this.d.audio.volume = (this.isMuted ? 0 : this.volume) / 100;
      this.d.audio.play().catch(() => this.toast('Tap Play to start audio.', 'info'));
    }

    this.addToHistory(track);
    this.updateMeta();
    this.renderQueue();
    this.saveState();
  }

  handlePlay() {
    const t = this.playlist[this.currentIndex];
    if (!t) return;

    if (t.source === 'youtube') {
      if (!this.ytReady || !this.ytPlayer) {
        this.toast('YouTube player still loading…', 'info'); return;
      }
      if (this.isPlaying) {
        this.ytPlayer.pauseVideo();
      } else {
        this.ytPlayer.playVideo();
      }
      return;
    }

    if (t.source === 'terabox' || t.source === 'embed') {
      this.toast('Use the controls inside the embedded player.', 'info'); return;
    }

    if (this.isPlaying) {
      this.d.audio.pause();
    } else {
      this.d.audio.play().catch(() => this.toast('Tap again to play.', 'info'));
    }
  }

  prev() { this.playTrack((this.currentIndex - 1 + this.playlist.length) % this.playlist.length); }
  next() { this.playTrack((this.currentIndex + 1) % this.playlist.length); }

  seek(pct) {
    const t = this.playlist[this.currentIndex];
    if (!t) return;

    if (t.source === 'youtube') {
      if (this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
        const dur = this.ytPlayer.getDuration();
        if (dur > 0) this.ytPlayer.seekTo((pct / 100) * dur, true);
      }
    } else if (t.source === 'local') {
      const dur = this.d.audio.duration;
      if (dur) this.d.audio.currentTime = (pct / 100) * dur;
    }
  }

  setVolume(v) {
    this.volume = v;
    this.isMuted = (v === 0);

    this.d.audio.volume = v / 100;
    this.d.audio.muted = this.isMuted;

    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(v);
        if (this.isMuted) this.ytPlayer.mute(); else this.ytPlayer.unMute();
      } catch (_) { }
    }

    this.fillSlider(this.d.volSlider, v);
    this.d.volLabel.textContent = `${v}%`;
    const ico = v === 0 ? 'fa-volume-xmark' : v < 40 ? 'fa-volume-low' : 'fa-volume-high';
    this.d.btnMute.innerHTML = `<i class="fa-solid ${ico}"></i>`;
    this.saveState();
  }

  toggleMute() {
    if (this.isMuted) {
      const restore = this.volume || 75;
      this.setVolume(restore);
    } else {
      this.isMuted = true;
      this.d.audio.muted = true;
      if (this.ytPlayer && typeof this.ytPlayer.mute === 'function') {
        try { this.ytPlayer.mute(); } catch (_) { }
      }
      this.fillSlider(this.d.volSlider, 0);
      this.d.volLabel.textContent = '0%';
      this.d.btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
  }

  fullscreen() {
    const el = this.d.videoState;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const enter = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (enter) {
        enter.call(el);
      } else {
        const iframe = this.d.plainIframe.classList.contains('hidden') ? this.d.ytPlayerDiv : this.d.plainIframe;
        if (iframe) {
          const enterIframe = iframe.requestFullscreen || iframe.webkitRequestFullscreen || iframe.webkitEnterFullscreen;
          if (enterIframe) {
            try { enterIframe.call(iframe); } catch (_) { this.toast('Fullscreen not supported on this device.', 'info'); }
          } else {
            this.toast('Fullscreen not supported on this device.', 'info');
          }
        }
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) exit.call(document);
    }
  }

  showVideoBox(type) {
    const isVideo = type !== null;
    this.d.coverState.classList.toggle('hidden', isVideo);
    this.d.videoState.classList.toggle('hidden', !isVideo);

    if (type === 'youtube') {
      this.d.ytPlayerDiv.classList.remove('hidden');
      this.d.plainIframe.classList.add('hidden');
    } else if (type === 'plain') {
      this.d.ytPlayerDiv.classList.add('hidden');
      this.d.plainIframe.classList.remove('hidden');
    }
  }

  enableProgressRow(enabled) {
    if (enabled) {
      this.d.progRow.classList.remove('disabled');
      this.d.progSlider.disabled = false;
    } else {
      this.d.progRow.classList.add('disabled');
      this.d.progSlider.disabled = true;
      this.d.tCur.textContent = '--:--';
      this.d.tTot.textContent = '—';
    }
  }

  setCardPlaying(on) {
    this.d.card.classList.toggle('playing', on);
  }

  syncPlayBtn() {
    this.d.btnPlay.innerHTML = this.isPlaying
      ? '<i class="fa-solid fa-pause"></i>'
      : '<i class="fa-solid fa-play"></i>';
  }

  updateMeta() {
    const t = this.playlist[this.currentIndex];
    if (!t) return;
    this.d.trackTitle.textContent = t.title;
    this.d.trackSub.textContent = t.artist;
    this.d.albumArt.src = t.image;
    document.title = `${t.title} · AetherFlow`;
    this.syncPlayBtn();
  }

  startYtPoll() {
    this.stopYtPoll();
    this.ytPollTimer = setInterval(() => {
      if (!this.ytPlayer || !this.ytReady) return;
      try {
        const cur = this.ytPlayer.getCurrentTime();
        const dur = this.ytPlayer.getDuration();
        this.syncProg(cur, dur);
      } catch (_) { }
    }, 350);
  }

  stopYtPoll() {
    if (this.ytPollTimer) { clearInterval(this.ytPollTimer); this.ytPollTimer = null; }
  }

  startAudioPoll() {
    this.stopAudioPoll();
    this.audioPoll = setInterval(() => {
      this.syncProg(this.d.audio.currentTime, this.d.audio.duration);
    }, 350);
  }

  stopAudioPoll() {
    if (this.audioPoll) { clearInterval(this.audioPoll); this.audioPoll = null; }
  }

  syncProg(cur, dur) {
    const pct = (dur && !isNaN(dur) && dur > 0) ? (cur / dur) * 100 : 0;
    this.d.progSlider.value = pct;
    this.fillSlider(this.d.progSlider, pct);
    this.d.tCur.textContent = this.fmt(cur);
    this.d.tTot.textContent = (dur && !isNaN(dur)) ? this.fmt(dur) : '0:00';
  }

  fillSlider(el, pct) {
    if (!el) return;
    el.style.background =
      `linear-gradient(to right,var(--green) 0%,var(--green) ${pct}%,var(--track) ${pct}%,var(--track) 100%)`;
  }

  async handleImport() {
    this.d.urlError.textContent = '';
    const raw = this.d.urlInput.value.trim();
    if (!raw) return;

    const dup = this.playlist.findIndex(t => t.audio === raw);
    if (dup !== -1) {
      this.toast('Already in playlist.', 'info');
      this.playTrack(dup);
      this.d.urlInput.value = '';
      return;
    }

    this.toast('Loading…', 'info');

    const ytId = this.parseYtId(raw);
    const isTera = this.isTeraBox(raw);
    let track;

    if (ytId) {
      const meta = await this.fetchMeta(raw);
      track = {
        id: Date.now(), source: 'youtube', youtubeId: ytId,
        title: meta.title || 'YouTube Video',
        artist: meta.artist || 'YouTube',
        audio: raw,
        image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        embedHtml: null, iframeSrc: null
      };

    } else if (isTera) {
      track = {
        id: Date.now(), source: 'terabox',
        title: 'TeraBox Video', artist: 'TeraBox',
        audio: raw, image: 'https://img.youtube.com/vi/TW9d8vYrVFQ/hqdefault.jpg',
        iframeSrc: raw,
        youtubeId: null, embedHtml: null
      };

    } else {
      const meta = await this.fetchMeta(raw);
      let source = 'local', embedHtml = null, iframeSrc = null;
      let title = meta.title || 'Stream', artist = meta.artist || 'Web';

      if (meta.embedHtml) {
        source = 'embed'; embedHtml = meta.embedHtml;
        const tmp = document.createElement('div');
        tmp.innerHTML = embedHtml;
        iframeSrc = tmp.querySelector('iframe')?.src || raw;
      } else {
        try { artist = new URL(raw).hostname.replace('www.', ''); } catch (_) { }
        const fn = raw.split('/').pop().split('?')[0];
        if (fn && fn.includes('.')) title = decodeURIComponent(fn);
      }

      track = {
        id: Date.now(), source, title, artist, audio: raw,
        image: meta.thumbnail || 'https://img.youtube.com/vi/TW9d8vYrVFQ/hqdefault.jpg',
        youtubeId: null, iframeSrc, embedHtml
      };
    }

    this.playlist.push(track);
    this.d.urlInput.value = '';
    this.toast(`Loaded: ${track.title}`, 'success');
    this.renderQueue();
    this.saveState();
    this.playTrack(this.playlist.length - 1);
  }

  parseYtId(url) {
    const m = url.match(/(?:youtu\.be\/|[?&]v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  isTeraBox(url) {
    return /terabox\.com|teraboxapp\.com|1024tera\.com|1024terabox\.com|freeterabox\.com/i.test(url);
  }

  async fetchMeta(url) {
    try {
      const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      const d = await r.json();
      if (d.error) return {};
      return { title: d.title, artist: d.author_name, thumbnail: d.thumbnail_url, embedHtml: d.html || null };
    } catch (_) { return {}; }
  }

  addToHistory(t) {
    this.history = [t, ...this.history.filter(h => h.audio !== t.audio)].slice(0, 10);
    this.saveState();
  }

  toggleHistory() {
    this.showHistory = !this.showHistory;
    this.d.btnHistory.classList.toggle('active', this.showHistory);
    this.d.queueLabel.textContent = this.showHistory ? 'Recently Played' : 'Up Next';
    this.d.btnClrHistory.classList.toggle('hidden', !this.showHistory);
    this.renderQueue();
  }

  clearHistory() {
    this.history = [];
    this.saveState();
    this.renderQueue();
    this.toast('Recently Played history cleared.', 'success');
  }

  renderQueue() {
    const list = this.showHistory ? this.history : this.playlist;
    this.d.queueCount.textContent = `${list.length} track${list.length === 1 ? '' : 's'}`;
    this.d.queueList.innerHTML = '';

    if (!list.length) {
      this.d.queueList.innerHTML = '<div style="text-align:center;color:var(--t2);font-size:11px;padding:14px 0">No tracks yet.</div>';
      return;
    }

    list.forEach((t, i) => {
      const active = !this.showHistory && i === this.currentIndex;
      const row = document.createElement('div');
      row.className = `q-row${active ? ' active' : ''}`;
      const bc = t.source === 'youtube' ? 'b-yt' : t.source === 'terabox' ? 'b-tera' : 'b-audio';
      const bi = t.source === 'youtube' ? 'fab fa-youtube' : t.source === 'terabox' ? 'fa-solid fa-box' : 'fa-solid fa-music';
      row.innerHTML = `
        <img class="q-thumb" src="${t.image}" alt=""
          onerror="this.src='https://img.youtube.com/vi/TW9d8vYrVFQ/hqdefault.jpg'">
        <div class="q-meta">
          <span class="q-title">${t.title}</span>
          <span class="q-artist">${t.artist}</span>
        </div>
        <span class="q-badge ${bc}"><i class="${bi}"></i> ${t.source}</span>
        <button class="q-delete-btn" title="Delete Track"><i class="fa-solid fa-xmark"></i></button>
      `;
      row.addEventListener('click', () => this.playTrack(i, this.showHistory));

      const delBtn = row.querySelector('.q-delete-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTrack(i, this.showHistory);
      });

      this.d.queueList.appendChild(row);
    });
  }

  deleteTrack(index, fromHistory) {
    if (fromHistory) {
      if (index < 0 || index >= this.history.length) return;
      const removed = this.history.splice(index, 1)[0];
      this.toast(`Removed from history: ${removed.title}`, 'info');
    } else {
      if (index < 0 || index >= this.playlist.length) return;

      const removed = this.playlist.splice(index, 1)[0];
      this.toast(`Removed: ${removed.title}`, 'info');

      if (index === this.currentIndex) {
        this.currentIndex = Math.min(index, this.playlist.length - 1);
        if (this.playlist.length > 0) {
          this.playTrack(this.currentIndex);
        } else {
          this.playlist = [...this.defaultPlaylist];
          this.currentIndex = 0;
          this.playTrack(this.currentIndex);
        }
      } else if (index < this.currentIndex) {
        this.currentIndex--;
      }
    }
    this.saveState();
    this.renderQueue();
  }

  toggleTheme() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; this.applyTheme(); this.saveState(); }
  applyTheme() {
    const light = this.theme === 'light';
    document.body.classList.toggle('light', light);
    this.d.btnTheme.innerHTML = light ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }

  spawnNotes() {
    const pool = ['♪', '♫', '♬', '♩'];
    const add = () => {
      const n = document.createElement('span');
      n.className = 'note';
      n.textContent = pool[Math.floor(Math.random() * pool.length)];
      n.style.left = `${Math.random() * 95}%`;
      n.style.bottom = '-20px';
      const dur = 9 + Math.random() * 9;
      n.style.fontSize = `${13 + Math.random() * 13}px`;
      n.style.animationDuration = `${dur}s`;
      n.style.animationDelay = `${Math.random() * 2}s`;
      this.d.notesWrap.appendChild(n);
      setTimeout(() => n.remove(), (dur + 3) * 1000);
    };
    add(); setInterval(add, 2500);
  }

  toast(msg, type = 'info') {
    this.d.toasts.innerHTML = '';
    const ico = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-xmark' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid ${ico[type]}"></i><span>${msg}</span>`;
    this.d.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  saveState() {
    try {
      localStorage.setItem('af4', JSON.stringify({
        volume: this.volume, currentIndex: this.currentIndex,
        playlist: this.playlist, history: this.history, theme: this.theme
      }));
    } catch (_) { }
  }

  loadState() {
    try {
      const s = JSON.parse(localStorage.getItem('af4') || 'null');
      if (!s) return;
      this.volume = s.volume ?? 75;
      this.currentIndex = s.currentIndex ?? 0;
      this.playlist = s.playlist?.length ? s.playlist : [...this.defaultPlaylist];
      this.history = s.history ?? [];
      this.theme = s.theme ?? 'dark';
    } catch (_) { }
  }

  fmt(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }
}

window.addEventListener('DOMContentLoaded', () => new AetherFlow());
