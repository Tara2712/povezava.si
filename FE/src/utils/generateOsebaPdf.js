import html2pdf from "html2pdf.js"

export function generateOsebaPdf(data, clanki = []) {
  const fullName = `${data.ime} ${data.priimek}`

  const container = document.createElement("div")

  container.innerHTML = `
    <div style="
      font-family: Inter, Arial, sans-serif;
      padding: 24px;
      color: #0f172a;
      width: 800px;
    ">

      <!-- HEADER -->
      <div style="
        display:flex;
        align-items:center;
        gap:16px;
        padding:16px;
        border-radius:16px;
        background:#0f172a;
        color:white;
      ">
        <div>
          <h1 style="margin:0;font-size:20px;">${fullName}</h1>
          <div style="opacity:0.8;font-size:13px;">
            ${data.tip || "ni podatka"}
          </div>
        </div>
      </div>

      <!-- INFO -->
      <div style="margin-top:20px;display:flex;flex-direction:column;gap:10px;">

        <div style="padding:12px;background:#f1f5f9;border-radius:12px;">
          <b>Zadnja posodobitev:</b> ${data.zadnja_posodobitev || "ni podatka"}
        </div>

        ${
          data.opis
            ? `<div style="padding:12px;background:#f1f5f9;border-radius:12px;">
                <b>Opis:</b><br/>${data.opis}
              </div>`
            : ""
        }

        ${
          data.profil_url
            ? `<div style="padding:12px;background:#f1f5f9;border-radius:12px;">
                <b>Akademski profil:</b><br/>
                ${data.profil_url}
              </div>`
            : ""
        }
      </div>

      <!-- POVEZAVE -->
      ${
        data.povezave?.length
          ? `
        <div style="margin-top:20px;">
          <h3>Povezave</h3>
          <ul>
            ${data.povezave
              .slice(0, 10)
              .map(p => `<li>${p.popolno_ime} - ${p.vloga || ""}</li>`)
              .join("")}
          </ul>
        </div>`
          : ""
      }

      <!-- ČLANKI -->
      ${
        clanki?.length
          ? `
        <div style="margin-top:20px;">
          <h3>Mediji</h3>
          <ul>
            ${clanki
              .slice(0, 10)
              .map(c => `<li>${c.naslov}</li>`)
              .join("")}
          </ul>
        </div>`
          : ""
      }

    </div>
  `

  document.body.appendChild(container)

  html2pdf()
    .from(container)
    .set({
      margin: 0,
      filename: `${fullName.replaceAll(" ", "_")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      }
    })
    .save()
    .then(() => {
      document.body.removeChild(container)
    })
}