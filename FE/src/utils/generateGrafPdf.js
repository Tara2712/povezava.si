import html2pdf from 'html2pdf.js'
import html2canvas from 'html2canvas'

function prettifyFilter(filter) {
  if (filter === 'vse') return 'Vse'
  if (filter === 'oseba') return 'Osebe'
  if (filter === 'podjetje') return 'Podjetja'
  return filter
}

function prettifyColorMode(mode) {
  if (mode === 'tip') return 'Po tipu'
  return 'Po stopnji'
}

export async function exportNetworkPdf({
  container,
  title,
  depth,
  filter,
  colorMode,
  stats,
}) {
  if (!container) return

  // zajem grafa
  const canvas = await html2canvas(container, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
  })

  const graphImage = canvas.toDataURL('image/png')

  const now = new Date().toLocaleString('sl-SI')

  const pdfContainer = document.createElement('div')

  pdfContainer.innerHTML = `
    <div style="
      font-family: Inter, Arial, sans-serif;
      padding: 28px;
      color: #0f172a;
      width: 1100px;
      background: #ffffff;
    ">

      <!-- HEADER -->
      <div style="
        background:#0f172a;
        color:white;
        padding:24px;
        border-radius:20px;
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <div>
          <div style="
            font-size:13px;
            opacity:0.7;
            margin-bottom:6px;
            letter-spacing:0.5px;
          ">
            ANALIZA OMREŽJA
          </div>

          <h1 style="
            margin:0;
            font-size:28px;
            font-weight:700;
          ">
            ${title}
          </h1>
        </div>

        <div style="
          text-align:right;
          font-size:13px;
          opacity:0.8;
        ">
          ${now}
        </div>
      </div>

      <!-- STATS -->
      <div style="
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:14px;
        margin-top:22px;
      ">

        ${card('Stopnja', depth)}
        ${card('Filter', prettifyFilter(filter))}
        ${card('Barvanje', prettifyColorMode(colorMode))}
        ${card('Vozlišča', stats?.nodes || 0)}
        ${card('Povezave', stats?.edges || 0)}

      </div>

      <!-- GRAPH -->
      <div style="
        margin-top:24px;
        background:#0f172a;
        border-radius:22px;
        padding:20px;
        overflow:hidden;
      ">

        <img
          src="${graphImage}"
          style="
            width:100%;
            border-radius:16px;
            display:block;
          "
        />
      </div>

      <!-- FOOTER -->
      <div style="
        margin-top:18px;
        text-align:center;
        color:#64748b;
        font-size:12px;
      ">
        Povezava.si
      </div>

    </div>
  `

  document.body.appendChild(pdfContainer)

  await html2pdf()
    .from(pdfContainer)
    .set({
      margin: 0,
      filename: `${title.replaceAll(' ', '_')}_omrezje.pdf`,
      image: {
        type: 'jpeg',
        quality: 1,
      },
      html2canvas: {
        scale: 2,
        useCORS: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'landscape',
      },
    })
    .save()

  document.body.removeChild(pdfContainer)
}

function card(label, value) {
  return `
    <div style="
      background:#f1f5f9;
      border-radius:18px;
      padding:16px;
    ">
      <div style="
        color:#64748b;
        font-size:12px;
        margin-bottom:8px;
      ">
        ${label}
      </div>

      <div style="
        font-size:22px;
        font-weight:700;
        color:#0f172a;
      ">
        ${value}
      </div>
    </div>
  `
}