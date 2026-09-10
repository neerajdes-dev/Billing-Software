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
export function runInvoicePrint(printSettings = {}) {
  const invoiceElement = document.querySelector(".invoice-print-area");

  if (!invoiceElement) {
    return {
      ok: false,
      error: "Invoice print layout is not ready yet.",
    };
  }

  const layout = printSettings.layout || "a4";
  const dynamicStyleId = "resolvent-dynamic-print-page";

  document.getElementById(dynamicStyleId)?.remove();

  const style = document.createElement("style");
  style.id = dynamicStyleId;

  if (layout === "thermal") {
    const thermalSize = printSettings.thermal_size || "80mm";
    const widthMm =
      Number(String(thermalSize).replace(/[^0-9.]/g, "")) || 80;

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

    /*
     * Small safety allowance prevents the last line from spilling onto a
     * second receipt page. Receipt length therefore grows automatically
     * with item count, QR, totals and footer content -- this is what
     * keeps a thermal reprint from producing a trailing blank page.
     */
    const receiptHeightMm = Math.max(55, measuredMm + 5);

    style.textContent = `
      @page resolventThermal {
        size: ${widthMm}mm ${receiptHeightMm}mm;
        margin: 0;
      }

      @media print {
        html,
        body,
        #root {
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

  /*
   * Browser security requires the system print dialog. The application can
   * prepare the exact page size, but cannot silently choose a printer or
   * bypass it.
   */
  setTimeout(() => {
    window.print();
  }, 120);

  return { ok: true };
}
