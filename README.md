# AetherFlow

AetherFlow is a web-based media player designed to stream audio and video content from multiple sources in a single interface. It aggregates YouTube links, TeraBox links, direct audio streams, and embeds into one unified dashboard.

The application features a responsive dark/light theme, local storage persistence, queue management, and a clean user interface.

---

## Key Features

- **Multi-Source Playback**:
  - **YouTube**: Plays videos using the YouTube IFrame API without requiring API keys.
  - **TeraBox & Embeds**: Loads TeraBox and generic embedded player URLs inside an iframe.
  - **Direct Audio / MP3**: Supports native HTML5 audio streams for direct media URLs.
- **Local Persistence**: Saves playlist queue, playback history, volume levels, selected theme, and current track index to localStorage.
- **Dynamic Themes**: Toggles between Dark Mode and Light Mode.
- **Queue and History**:
  - **Up Next**: Add new links or remove tracks from the active queue.
  - **Recently Played**: Stores the last 10 tracks with options to clear or re-enqueue.
- **Visuals and Controls**:
  - Background music note animation.
  - Equalizer bar visualization when playing audio.
  - Custom progress and volume sliders.
- **Custom Notifications**: Non-blocking toast messages for loading statuses and errors.
- **Metadata Detection**: Queries the noembed oEmbed API to automatically fetch titles, authors, and thumbnails.

---

## Technology Stack

The project is built using vanilla web technologies:

- **HTML5**: Structured semantic markup and responsive viewport controls.
- **CSS3**: Layout, typography, transitions, animations, and variable-based theme management.
- **JavaScript (ES6+)**: Handles player logic, oEmbed requests, events, and state persistence.
- **Font Awesome 6.4.0**: Icons for controls and indicators.
- **Google Fonts**: Montserrat and Inter typography.

---

## File Structure

```text
player/
├── index.html   # Main layout and media targets
├── style.css    # Typography, styling, animations, and theme variables
└── script.js    # Player logic and state management
```

---

## Getting Started

AetherFlow runs directly in the browser.

## Technical Overview

### YouTube Playback
When a YouTube URL is loaded, the application extracts the 11-character video ID and initializes the YouTube Player via the IFrame Player API. A dynamic polling interval tracks current time and duration to update the seek bar.

### TeraBox and Embeds
For TeraBox and generic embedded frames, the UI displays an iframe with the media source. Controls like seeking are handled within the embedded window itself.

### HTML5 Audio
Standard audio file URLs (MP3, WAV, etc.) are played using the browser's native `<audio>` element. Event listeners update global play states, trigger visualizer animations, and handle track transitions.

### oEmbed Integration
The player uses `noembed.com` to resolve track titles and thumbnails. If a URL is not supported by the provider, the application parses the domain name or filename to create fallback labels.

---

## Theme Configuration

The CSS custom properties in `style.css` control UI colors:
- `--bg`: Document background color.
- `--card`: Main player container card background.
- `--green`: Primary accent color for active indicators and volumes.
- `--border`: Standard container border lines.
- `--shadow`: Container depth shadows.

---

## License

This project is licensed under the MIT License.
