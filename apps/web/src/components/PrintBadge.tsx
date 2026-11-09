import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDateTime } from '@/lib/format';
import type { Visit } from '@/lib/types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Opens a clean, print-ready sticker badge in a small window and prints it. */
export function printBadge(v: Visit) {
  const qr = renderToStaticMarkup(<QRCodeSVG value={`foyer-badge:${v.id}`} size={96} level="M" marginSize={0} />);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Badge ${esc(v.badgeNumber ?? '')}</title>
<style>
  @page { size: 90mm 60mm; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #2D211B }
  .badge { width: 90mm; height: 60mm; padding: 5mm; display: flex; flex-direction: column; border: 0.4mm solid #2D211B }
  .top { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 11pt }
  .tag { background: #2D211B; color: #F8F1E8; padding: 1mm 3mm; border-radius: 99px; font-size: 9pt }
  .main { display: flex; gap: 4mm; align-items: center; flex: 1; margin-top: 3mm }
  .name { font-size: 19pt; font-weight: 800; line-height: 1.05 }
  .meta { font-size: 9pt; margin-top: 1.5mm; color: #5a463a }
  .foot { display: flex; justify-content: space-between; font-size: 8.5pt; border-top: 0.3mm solid #E7D7C2; padding-top: 2mm }
  .num { font-weight: 800 }
</style></head><body>
<div class="badge">
  <div class="top"><span>Foyer</span><span class="tag">VISITOR</span></div>
  <div class="main">
    <div style="flex:1;min-width:0">
      <div class="name">${esc(v.visitor.fullName)}</div>
      <div class="meta">${esc(v.visitor.company ?? '')}</div>
      <div class="meta">Visiting ${esc(v.host.name)}</div>
    </div>
    ${qr}
  </div>
  <div class="foot"><span>In: ${esc(fmtDateTime(v.checkInAt))}</span><span class="num">${esc(v.badgeNumber ?? '')}</span></div>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); window.close(); }, 150); };</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=420,height=320');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
