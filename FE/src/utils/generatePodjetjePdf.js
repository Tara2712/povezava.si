import html2pdf from "html2pdf.js"

export function generatePodjetjePdf(data) {
  const naziv = data.popolno_ime || "Podjetje"

  const container = document.createElement("div")

  // simple text (hitro za render)
  const osebeText = (data.osebe || [])
    .map(o => {
      const ime = [o.ime, o.priimek].filter(Boolean).join(" ")
      return `• ${ime} ${o.vloga ? `— ${o.vloga}` : ""}`
    })
    .join("\n")

  container.innerHTML = `
    <div style="
      font-family: Arial, sans-serif;
      padding: 28px;
      color: #1f2937;
      width: 760px;
      font-size: 12px;
      line-height: 1.5;
      background: #ffffff;
    ">

      <!-- HEADER -->
      <div style="
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 14px;
        margin-bottom: 22px;
      ">
        <h1 style="
          margin: 0;
          font-size: 24px;
          color: #111827;
        ">
          ${naziv}
        </h1>

        <div style="
          margin-top: 6px;
          color: #6b7280;
          font-size: 12px;
        ">
          Izpis podjetja
        </div>
      </div>

      <!-- INFO -->
      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 14px 16px;
        margin-bottom: 24px;
      ">

        <div style="margin-bottom: 8px;">
          <b>Pravna oblika:</b>
          ${data.pravna_oblika || "-"}
        </div>

        <div style="margin-bottom: 8px;">
          <b>Pošta:</b>
          ${data.posta || "-"}
        </div>

        <div>
          <b>Matična:</b>
          ${
            data.maticna && !data.maticna.startsWith("AI-")
              ? data.maticna
              : "-"
          }
        </div>
      </div>

      <!-- OSEBE -->
      <div style="
        margin-bottom: 18px;
      ">
        <h2 style="
          font-size: 16px;
          margin: 0 0 12px 0;
          color: #111827;
          page-break-inside: avoid;
          break-inside: avoid;
        ">
          Povezane osebe (${data.osebe?.length || 0})
        </h2>

        <div style="
          background: #fafafa;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 11px;
          line-height: 1.6;
        ">
${osebeText || "Ni podatkov"}
        </div>
      </div>

      <!-- FOOTER -->
      <div style="
        margin-top: 30px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        font-size: 10px;
        color: #9ca3af;
        text-align: center;
      ">
        Generirano: ${new Date().toLocaleDateString("sl-SI")}
      </div>

    </div>
  `

  document.body.appendChild(container)

  const opt = {
    margin: 8,
    filename: `${naziv.replaceAll(" ", "_")}.pdf`,

    image: {
      type: "jpeg",
      quality: 0.95
    },

    html2canvas: {
      scale: 1.2, 
      useCORS: true,
      scrollY: 0,
      windowWidth: 900,
      logging: false
    },

    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    },

    pagebreak: {
      mode: ["css", "legacy"]
    }
  }

  html2pdf()
    .from(container)
    .set(opt)
    .save()
    .then(() => {
      document.body.removeChild(container)
    })
}