# Docs Hub

A modern Documentation Hub built with **Node.js + Express**. Scan one or more project folders, browse markdown files in a rich viewer, and search across all docs — with live filesystem watching.

## Features

- **Multi-project support** — configure multiple doc roots in `config.json`
- **Recursive markdown scan** — builds a nested folder tree automatically
- **Live reload** — `chokidar` watches for `.md` changes and rescans
- **Full-text search** — search across all markdown files
- **Rich markdown viewer** — tables, task lists, code highlighting, Mermaid diagrams, TOC
- **Dark / light theme** with responsive layout
- **Keyboard shortcuts** — `Ctrl+K` search, `Ctrl+B` toggle sidebar
- **Recent files & favorites** — persisted in `localStorage`
- **Toolbar actions** — copy markdown, open in Cursor, reveal in folder

## Quick Start

### 1. Configure projects

Edit `config.json`:

```json
{
  "projects": [
    {
      "name": "Legacy",
      "path": "/mnt/d/Code/GitHub_Projects"
    }
  ]
}
```

### 2. Install & run

```bash
npm install
npm start
```

Open [http://localhost:3456](http://localhost:3456)

### Development (auto-restart)

```bash
npm run dev
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List configured projects |
| GET | `/api/tree?project=Legacy` | Nested folder/file tree |
| GET | `/api/file?project=Legacy&path=docs/readme.md` | Markdown file content + metadata |
| GET | `/api/search?q=postgres` | Full-text search |
| GET | `/api/raw?project=Legacy&path=images/logo.png` | Static assets (images) |
| POST | `/api/refresh` | Rescan project(s) |
| POST | `/api/reveal` | Open containing folder |
| POST | `/api/cursor` | Open file in Cursor/VS Code |

## Project Structure

```
docs-viewer/
├── server.js           # Express entry point
├── config.json         # Project configuration
├── package.json
├── lib/
│   ├── config.js       # Config loader
│   ├── scanner.js      # Glob-based tree builder
│   ├── search.js       # Full-text search
│   ├── watcher.js      # Chokidar filesystem watcher
│   └── paths.js        # Safe path resolution
├── public/
│   ├── index.html
│   ├── app.js          # Main frontend entry
│   ├── style.css
│   └── js/
│       ├── api.js
│       ├── storage.js
│       ├── markdown.js
│       └── tree.js
└── README.md
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open search |
| `Ctrl+B` | Toggle sidebar |
| `Esc` | Close search modal |

## License

ISC
