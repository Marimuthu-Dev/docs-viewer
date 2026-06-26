import { assetUrl } from './api.js';

let currentProject = '';
let currentFilePath = '';
let currentFileDir = '';

export function setFileContext(project, filePath) {
  currentProject = project;
  currentFilePath = filePath;
  const parts = filePath.split('/');
  parts.pop();
  currentFileDir = parts.join('/');
}

export function slugify(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveRelative(baseDir, href) {
  if (!href || /^https?:\/\//i.test(href) || href.startsWith('data:') || href.startsWith('#')) {
    return href;
  }
  const stack = baseDir ? baseDir.split('/') : [];
  for (const part of href.split('/')) {
    if (part === '..') stack.pop();
    else if (part && part !== '.') stack.push(part);
  }
  return stack.join('/');
}

function highlightCode(text, language) {
  const hljs = globalThis.hljs;
  if (!hljs) return escapeHtml(text);

  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(text, { language }).value;
    }
    return hljs.highlightAuto(text).value;
  } catch {
    return escapeHtml(text);
  }
}

function configureMarked(onInternalLink) {
  const markedLib = globalThis.marked;
  if (!markedLib) {
    throw new Error('Markdown library failed to load');
  }

  const renderer = new markedLib.Renderer();

  renderer.heading = ({ text, depth }) => {
    const plain = text.replace(/<[^>]+>/g, '');
    const id = slugify(plain);
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };

  renderer.code = ({ text, lang }) => {
    const language = (lang || '').trim();
    if (language === 'mermaid') {
      return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
    }
    let highlighted = highlightCode(text, language);
    const langClass = language ? ` language-${language}` : '';
    return `<div class="code-block-wrapper">
      <button type="button" class="copy-code-btn" aria-label="Copy code">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      </button>
      <pre><code class="hljs${langClass}">${highlighted}</code></pre>
    </div>`;
  };

  renderer.image = ({ href, title, text }) => {
    const resolved = resolveRelative(currentFileDir, href);
    const src = assetUrl(currentProject, resolved);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${src}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" />`;
  };

  renderer.link = ({ href, title, text }) => {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    if (!href) return `<a${titleAttr}>${text}</a>`;

    if (/^https?:\/\//i.test(href)) {
      return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    if (href.startsWith('#')) {
      return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
    }

    const resolved = resolveRelative(currentFileDir, href);
    if (resolved.endsWith('.md')) {
      return `<a href="#" data-md-link="${escapeHtml(resolved)}"${titleAttr}>${text}</a>`;
    }

    const src = assetUrl(currentProject, resolved);
    return `<a href="${src}"${titleAttr} target="_blank" rel="noopener">${text}</a>`;
  };

  renderer.table = ({ header, rows }) => {
    const head = header.map((cell) => `<th>${cell.text}</th>`).join('');
    const body = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`)
      .join('');
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  markedLib.setOptions({
    gfm: true,
    breaks: false,
    renderer,
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-md-link]');
    if (!link) return;
    e.preventDefault();
    onInternalLink(link.dataset.mdLink);
  });
}

export function initMarkdown(onInternalLink) {
  configureMarked(onInternalLink);
}

export async function renderMarkdown(content) {
  const markedLib = globalThis.marked;
  if (!markedLib) throw new Error('Markdown library failed to load');
  return markedLib.parse(content);
}

export function extractToc(content) {
  const headings = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (match) {
      const depth = match[1].length;
      const text = match[2].replace(/\[(.+?)\]\(.+?\)/g, '$1').trim();
      headings.push({ depth, text, id: slugify(text) });
    }
  }
  return headings;
}

export async function renderMermaid(container) {
  const blocks = container.querySelectorAll('pre.mermaid');
  if (blocks.length === 0) return;

  const mermaidLib = globalThis.mermaid;
  if (!mermaidLib) return;

  mermaidLib.initialize({
    startOnLoad: false,
    theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark',
    securityLevel: 'loose',
  });

  for (const block of blocks) {
    try {
      const { svg } = await mermaidLib.render(
        `mermaid-${Math.random().toString(36).slice(2)}`,
        block.textContent
      );
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-diagram';
      wrapper.innerHTML = svg;
      block.replaceWith(wrapper);
    } catch (err) {
      block.outerHTML = `<pre class="mermaid-error">Mermaid render error: ${escapeHtml(err.message || String(err))}</pre>`;
    }
  }
}

export function attachCopyButtons(container) {
  container.querySelectorAll('.copy-code-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('code');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        }, 1500);
      } catch {
        btn.textContent = 'Failed';
      }
    });
  });
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
