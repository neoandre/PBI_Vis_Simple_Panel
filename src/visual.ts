
/* eslint-disable */
import powerbi from "powerbi-visuals-api";

// Visual interfaces
import IVisual = powerbi.extensibility.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

// Data types
import DataView = powerbi.DataView;
import DataViewTable = powerbi.DataViewTable;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

export class Visual implements IVisual {
  private host: powerbi.extensibility.IVisualHost | any;
  private selectionManager: powerbi.extensibility.ISelectionManager | any;

  private container: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private valueEl: HTMLDivElement;
  private iconEl: HTMLDivElement;

  private lastObjects: powerbi.DataViewObjects | undefined;

  private _actionMode: string = 'none';
  private _actionUrl: string = '';

  constructor(options?: VisualConstructorOptions) {
    this.host = (options && options.host) || ({} as any);
    this.selectionManager = (this.host && this.host.createSelectionManager)
      ? this.host.createSelectionManager()
      : ({ select: ()=>Promise.resolve([]), clear: ()=>Promise.resolve([]), hasSelection: ()=>false } as any);

    this.container = document.createElement('div');
    this.container.className = 'card-root';
    this.container.style.display = 'grid'; // enforce grid even if style fails to load

    const root = (options && options.element) ? options.element : document.body;
    root.appendChild(this.container);

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'name';
    this.container.appendChild(this.nameEl);

    this.valueEl = document.createElement('div');
    this.valueEl.className = 'value';
    this.container.appendChild(this.valueEl);

    this.iconEl = document.createElement('div');
    this.iconEl.className = 'icon';
    this.container.appendChild(this.iconEl);

    this.container.onclick = () => this.onClick();
  }

  public update(options: VisualUpdateOptions): void {
    const dv: DataView | undefined = options.dataViews && options.dataViews[0];
    this.lastObjects = (dv && dv.metadata && dv.metadata.objects) || ({} as powerbi.DataViewObjects);
    const table: DataViewTable | undefined = dv && dv.table;

    // Size
    const width = Math.max(24, options.viewport.width);
    const height = Math.max(24, options.viewport.height);
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;

    const objects = this.lastObjects;

    // Layout, background, border
    const gap = this.num(objects, 'layout', 'gap', 6);
    const padding = this.num(objects, 'layout', 'padding', 8);
    (this.container.style as any).gap = `${gap}px`;
    this.container.style.padding = `${padding}px`;

    const bgColor = this.col(objects, 'background', 'color', '#FFFFFF');
    const bgAlpha = this.num(objects, 'background', 'transparency', 0);
    this.container.style.backgroundColor = this.rgba(bgColor, 1 - Math.max(0, Math.min(100, bgAlpha)) / 100);

    const borderColor = this.col(objects, 'card', 'borderColor', '#E5E7EB');
    const borderWidth = this.num(objects, 'card', 'borderWidth', 0);
    const cornerRadius = this.num(objects, 'card', 'cornerRadius', 6);
    this.container.style.border = borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none';
    (this.container.style as any).borderRadius = `${cornerRadius}px`;

    // Fonts & placements
    const nameFont = this.txt(objects, 'nameText', 'fontFamily', 'Segoe UI, Arial');
    const nameSize = this.num(objects, 'nameText', 'fontSize', 12);
    const nameColor = this.col(objects, 'nameText', 'color', '#6B7280');
    const namePlacement = (this.txt(objects, 'nameText', 'placement', 'top') || 'top').toLowerCase();

    const valFont = this.txt(objects, 'valueText', 'fontFamily', 'Segoe UI, Arial');
    const valSize = this.num(objects, 'valueText', 'fontSize', 28);
    const valColorDefault = this.col(objects, 'valueText', 'color', '#0F172A');

    const iconSize = this.num(objects, 'icon', 'size', 18);
    const iconPlacement = (this.txt(objects, 'icon', 'placement', 'left') || 'left').toLowerCase();
    const builtIn = (this.txt(objects, 'icon', 'builtIn', 'status-circles') || 'status-circles').toLowerCase();

    // Data roles → first row
    let value: any = '';
    let condition: any = undefined;
    let iconSvg: string | undefined = undefined;
    let measureName = 'Measure';
    let measureFormat: string | undefined = undefined;

    if (table && table.rows && table.rows.length > 0) {
      const row = table.rows[0];
      const cols = (table.columns || []) as DataViewMetadataColumn[];

      const idxMeasure = cols.findIndex((c) => c.roles && (c.roles as any)['measure']);
      const idxCond = cols.findIndex((c) => c.roles && (c.roles as any)['condition']);
      const idxIcon = cols.findIndex((c) => c.roles && (c.roles as any)['iconSvg']);

      if (idxMeasure >= 0) {
        value = row[idxMeasure];
        const mc = cols[idxMeasure];
        measureName = mc.displayName || measureName;
        measureFormat = (mc as any).format;
      }
      if (idxCond >= 0) condition = row[idxCond];
      if (idxIcon >= 0) iconSvg = row[idxIcon] != null ? String(row[idxIcon]) : undefined;
    }

    // Value formatting controls
    const useModel = this.bool(objects, 'valueFormat', 'useModelFormat', true);
    const usePercent = this.bool(objects, 'valueFormat', 'usePercent', false);
    const decimals = this.num(objects, 'valueFormat', 'decimals', 2);
    const thousands = this.bool(objects, 'valueFormat', 'thousands', true);
    const prefix = this.txt(objects, 'valueFormat', 'prefix', '');
    const suffix = this.txt(objects, 'valueFormat', 'suffix', '');
    const customFmt = this.txt(objects, 'valueFormat', 'customFormat', '').trim();

    const formatted = this.format(value, {
      useModel,
      customFmt,
      decimals,
      thousands,
      usePercent,
      prefix,
      suffix,
      modelFmt: measureFormat,
    });

    // Coloring rules
    const mode = (this.txt(objects, 'rules', 'mode', 'none') || 'none').toLowerCase();
    const rulesColor = this.pickRuleColor(mode, condition, {
      pos: this.col(objects, 'rules', 'posColor', '#28FF18'),
      zero: this.col(objects, 'rules', 'zeroColor', '#FFEA04'),
      neg: this.col(objects, 'rules', 'negColor', '#FF2C2C'),
      good: this.col(objects, 'rules', 'goodColor', '#28FF18'),
      warn: this.col(objects, 'rules', 'warnColor', '#FFEA04'),
      bad: this.col(objects, 'rules', 'badColor', '#FF2C2C'),
      defaultCol: this.col(objects, 'rules', 'defaultColor', valColorDefault),
    });

    // Apply Name
    this.nameEl.textContent = measureName || '';
    this.nameEl.style.fontFamily = nameFont;
    this.nameEl.style.fontSize = `${nameSize}px`;
    this.nameEl.style.color = nameColor;

    // Apply Value
    this.valueEl.textContent = formatted || '';
    this.valueEl.style.fontFamily = valFont;
    this.valueEl.style.fontSize = `${valSize}px`;
    this.valueEl.style.color = rulesColor || valColorDefault;

    // Icon (built-in fallback)
    this.iconEl.innerHTML = '';
    let svgToRender: string | undefined = iconSvg;
    if ((!svgToRender || !svgToRender.trim()) && builtIn === 'status-circles') {
      const fill = rulesColor || '#28FF18';
      svgToRender = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${fill}"/></svg>`;
    }
    if (svgToRender && svgToRender.trim().length > 0) {
      const svg = this.ensureSvg(svgToRender);
      if (svg) { svg.setAttribute('width', String(iconSize)); svg.setAttribute('height', String(iconSize)); this.iconEl.appendChild(svg); }
    }

    // Placements (work because container is a CSS grid)
    this.place(this.iconEl, iconPlacement);
    this.place(this.nameEl, namePlacement);
    this.valueEl.style.gridRow = '2';
    this.valueEl.style.gridColumn = '2';

    // Store action config
    this._actionMode = (this.txt(objects, 'action', 'mode', 'none') || 'none').toLowerCase();
    this._actionUrl = this.txt(objects, 'action', 'url', '');
  }

  // ==== Formatting pane model (modern) omitted for brevity in this scaffold ====
  public getFormattingModel(): powerbi.visuals.FormattingModel {
    // Provide minimal empty model to satisfy hosts that call it
    return { cards: [] } as any;
  }

  private place(el: HTMLElement, p: string) {
    el.classList.remove('center','right');
    switch ((p || 'left').toLowerCase()) {
      case 'left':   el.style.gridRow = '2'; el.style.gridColumn = '1'; break;
      case 'right':  el.style.gridRow = '2'; el.style.gridColumn = '3'; el.classList.add('right'); break;
      case 'top':    el.style.gridRow = '1'; el.style.gridColumn = '2'; el.classList.add('center'); break;
      case 'bottom': el.style.gridRow = '3'; el.style.gridColumn = '2'; el.classList.add('center'); break;
      default:       el.style.gridRow = '2'; el.style.gridColumn = '1';
    }
  }

  private format(
    v: any,
    opt: { useModel: boolean; customFmt: string; decimals: number; thousands: boolean; usePercent: boolean; prefix: string; suffix: string; modelFmt?: string }
  ): string {
    if (v == null || v === '') return '';
    const n = typeof v === 'number' ? v : Number(v);

    let model = opt.useModel && opt.modelFmt ? String(opt.modelFmt) : '';
    let usePct = opt.usePercent;
    let decimals = opt.decimals;
    let useThousands = opt.thousands;

    if (model) {
      if (model.indexOf('%') >= 0) usePct = True;
      const m = model.match(/0\.0+/); if (m) decimals = Math.max(decimals, m[0].length - 2);
      if (model.indexOf(',') >= 0) useThousands = True;
    }

    let valueToFormat = n;
    let suffix = opt.suffix || '';
    if (usePct) { valueToFormat = n * 100; if (!suffix) suffix = '%'; }

    if (isFinite(valueToFormat)) {
      const str = useThousands
        ? valueToFormat.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : valueToFormat.toFixed(decimals);
      return (opt.prefix||'') + str + (suffix||'');
    }
    return String(v);
  }

  private pickRuleColor(mode: string, cond: any, cols: any): string {
    if (!mode || mode === 'none') return cols.defaultCol;
    if (mode === 'hex') {
      const s = String(cond||'').trim();
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s; else return cols.defaultCol;
    }
    if (mode === 'text') {
      const k = String(cond||'').toLowerCase();
      if (["good","ok","green","pass","true"].includes(k)) return cols.good;
      if (["warn","warning","yellow","amber"].includes(k)) return cols.warn;
      if (["bad","red","fail","false"].includes(k)) return cols.bad;
      return cols.defaultCol;
    }
    if (mode === 'numeric') {
      const n = Number(cond);
      if (!isNaN(n)) { if (n>0) return cols.pos; if (n===0) return cols.zero; return cols.neg; }
      return cols.defaultCol;
    }
    return cols.defaultCol;
  }

  private rgba(hex: string, alpha: number): string {
    try {
      const h = hex.replace('#','');
      let r: number, g: number, b: number;
      if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
      } else {
        r = parseInt(h.slice(0, 2), 16);
        g = parseInt(h.slice(2, 4), 16);
        b = parseInt(h.slice(4, 6), 16);
      }
      return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
    } catch { return hex; }
  }

  private ensureSvg(input: string): SVGSVGElement | null {
    try {
      const trimmed = input.trim();
      if (trimmed.startsWith('data:image/svg+xml')) {
        const comma = trimmed.indexOf(',');
        const svgText = decodeURIComponent(trimmed.slice(comma + 1));
        return this.ensureSvg(svgText);
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');
      const svg = doc.documentElement as unknown as SVGSVGElement;
      if (svg && svg.tagName.toLowerCase() === 'svg') return svg;
    } catch {}
    return null;
  }

  // Object readers
  private num(objects: powerbi.DataViewObjects, obj: string, prop: string, def: number): number {
    try { const v = (objects as any)[obj]?.[prop]; const n = typeof v==='number'? v: Number(v); return isFinite(n)? n: def; } catch { return def; }
  }
  private txt(objects: powerbi.DataViewObjects, obj: string, prop: string, def: string): string {
    try { const v = (objects as any)[obj]?.[prop]; return v!=null? String(v): def; } catch { return def; }
  }
  private col(objects: powerbi.DataViewObjects, obj: string, prop: string, def: string): string {
    try { const c: any = (objects as any)[obj]?.[prop]; if (typeof c==='string') return c; if (c?.solid?.color) return String(c.solid.color); return def; } catch { return def; }
  }
  private bool(objects: powerbi.DataViewObjects, obj: string, prop: string, def: boolean): boolean {
    try { const v: any = (objects as any)[obj]?.[prop]; if (typeof v === 'boolean') return v; if (v==='true') return True; if (v==='false') return False; return def; } catch { return def; }
  }

  private onClick() {
    if (this._actionMode === 'drillthrough') {
      try {
        const rect = this.container.getBoundingClientRect();
        if (this.selectionManager?.showContextMenu) {
          this.selectionManager.showContextMenu({}, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
      } catch {}
      return;
    }

    if (this._actionMode === 'url' || this._actionMode === 'navigate' || this._actionMode === 'bookmark') {
      const url = this._actionUrl?.trim();
      if (!url) return;
      try {
        const anyHost = this.host as any;
        if (anyHost && typeof anyHost.launchUrl === 'function') anyHost.launchUrl(url);
        else window.open(url, '_blank');
      } catch {}
    }
  }
}
