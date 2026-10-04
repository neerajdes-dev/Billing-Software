// Shared print trigger for every place that prints an invoice through the
// real <InvoicePrint> component (Create Bill printing a fresh invoice, Sales
// Report reprinting a historical one, and any future call site) -- rather
// than each page hand-rolling its own print CSS. A page renders
// <InvoicePrint> into a hidden ".invoice-print-area" node using the
// merchant's actual Print Designer settings (layout, thermal size, theme),
// then calls runInvoicePrint() to size the browser's print page to match
// before opening the system print dialog. Sharing this one implementation
// is what keeps every invoice reprint pixel-identical to the one printed at
// time of sale -- a second, independently-styled template is exactly how
// "Print Invoice" from Sales Report used to look nothing like the real
// invoice (plain Arial text, no logo, no A4/thermal sizing, ignored the
// Print Designer entirely).
function buildDesktopPrintDocument(invoiceElement, printSettings = {}) {
  const layout = printSettings.layout || "a4";
  const thermalSize = printSettings.thermal_size || "80mm";
  const widthMm = Number(String(thermalSize).replace(/[^0-9.]/g, "")) || 80;

  const cloned = invoiceElement.cloneNode(true);
  cloned.style.display = "block";
  cloned.style.visibility = "visible";
  cloned.style.position = "static";
  cloned.style.left = "auto";
  cloned.style.top = "auto";
  cloned.style.margin = "0";
  cloned.style.opacity = "1";

  const styles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]')
  )
    .map((node) => node.outerHTML)
    .join("\n");

  const pageCss =
    layout === "thermal"
      ? `
        @page { size: ${widthMm}mm auto; margin: 0; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${widthMm}mm !important;
          min-width: ${widthMm}mm !important;
          background: #fff !important;
        }
        .invoice-print-area {
          display: block !important;
          visibility: visible !important;
          position: static !important;
          width: ${widthMm}mm !important;
          max-width: ${widthMm}mm !important;
          min-height: 0 !important;
          height: auto !important;
          overflow: visible !important;
          margin: 0 !important;
        }
      `
      : `
        @page { size: A4 portrait; margin: 0; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
          background: #fff !important;
        }
        .invoice-print-area {
          display: block !important;
          visibility: visible !important;
          position: static !important;
          width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
        }
      `;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <title>Invoice</title>
  ${styles}
  <style>
    ${pageCss}
    * { box-sizing: border-box; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>${cloned.outerHTML}</body>
</html>`;
}

export function runInvoicePrint(printSettings = {}) {
  const invoiceElement = document.querySelector(".invoice-print-area");

  if (!invoiceElement) {
    return {
      ok: false,
      error: "Invoice print layout is not ready yet.",
    };
  }

  // Desktop: print a dedicated invoice-only document in a hidden Electron
  // window. This avoids the blank-bill issue caused by silent-printing the
  // main application window while the invoice itself is hidden by screen CSS.
  if (window.electronAPI?.print) {
    const html = buildDesktopPrintDocument(invoiceElement, printSettings);

    window.electronAPI
      .print({
        silent: true,
        printerName: printSettings.desktop_printer_name,
        html,
      })
      .then((result) => {
        if (!result?.ok) {
          console.error("Desktop invoice print failed:", result?.reason);
        }
      })
      .catch((error) => {
        console.error("Desktop invoice print IPC failed:", error);
      });

    return { ok: true };
  }

  // Web: retain the existing browser print path and dynamically size thermal
  // paper from the rendered invoice height.
  const layout = printSettings.layout || "a4";
  const dynamicStyleId = "resolvent-dynamic-print-page";
  document.getElementById(dynamicStyleId)?.remove();

  const style = document.createElement("style");
  style.id = dynamicStyleId;

  if (layout === "thermal") {
    const thermalSize = printSettings.thermal_size || "80mm";
    const widthMm = Number(String(thermalSize).replace(/[^0-9.]/g, "")) || 80;

    const previous = {
      display: invoiceElement.style.display,
      position: invoiceElement.style.position,
      visibility: invoiceElement.style.visibility,
      left: invoiceElement.style.left,
      top: invoiceElement.style.top,
      width: invoiceElement.style.width,
      height: invoiceElement.style.height,
    };

    Object.assign(invoiceElement.style, {
      display: "block",
      position: "fixed",
      visibility: "hidden",
      left: "-10000px",
      top: "0",
      width: `${widthMm}mm`,
      height: "auto",
    });

    const measuredPx = invoiceElement.scrollHeight;
    Object.assign(invoiceElement.style, previous);

    const measuredMm = Math.ceil((measuredPx * 25.4) / 96);
    const receiptHeightMm = Math.max(55, measuredMm + 5);

    style.textContent = `
      @page resolventThermal {
        size: ${widthMm}mm ${receiptHeightMm}mm;
        margin: 0;
      }
      @media print {
        html, body, #root {
          width: ${widthMm}mm !important;
          min-width: ${widthMm}mm !important;
          max-width: ${widthMm}mm !important;
          height: ${receiptHeightMm}mm !important;
          min-height: 0 !important;
          max-height: ${receiptHeightMm}mm !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .invoice-print-area.invoice-thermal {
          page: resolventThermal !important;
          width: ${widthMm}mm !important;
          min-height: 0 !important;
          height: auto !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          overflow: visible !important;
        }
      }
    `;
  } else {
    style.textContent = `
      @page resolventA4 {
        size: A4 portrait;
        margin: 0;
      }
      @media print {
        .invoice-print-area.invoice-a4 {
          page: resolventA4 !important;
        }
      }
    `;
  }

  document.head.appendChild(style);
  setTimeout(() => window.print(), 120);
  return { ok: true };
}
