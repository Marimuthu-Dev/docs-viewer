/** Export rendered markdown to PDF (full document). */

function buildPdfFilename(name) {
  const base = (name || 'document').replace(/\.md$/i, '');
  return `${base}.pdf`;
}

function createPdfWrapper(markdownEl, title) {
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-export-root';
  wrapper.setAttribute('aria-hidden', 'true');

  if (title) {
    const heading = document.createElement('h1');
    heading.className = 'pdf-export-title';
    heading.textContent = title.replace(/\.md$/i, '');
    wrapper.appendChild(heading);
  }

  const clone = markdownEl.cloneNode(true);
  clone.classList.add('pdf-export-body');
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return wrapper;
}

export async function downloadMarkdownPdf(markdownEl, filename) {
  const html2pdf = globalThis.html2pdf;
  if (!html2pdf) {
    throw new Error('PDF library failed to load');
  }
  if (!markdownEl?.innerHTML?.trim()) {
    throw new Error('No document content to export');
  }

  const wrapper = createPdfWrapper(markdownEl, filename);

  try {
    await html2pdf()
      .set({
        margin: [12, 14, 12, 14],
        filename: buildPdfFilename(filename),
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          windowWidth: 980,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['pre', 'tr', 'img', 'table', '.mermaid-diagram', '.code-block-wrapper'],
        },
      })
      .from(wrapper)
      .save();
  } finally {
    wrapper.remove();
  }
}

export function printMarkdownDocument() {
  window.print();
}
