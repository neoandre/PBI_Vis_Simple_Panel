/* eslint-disable */
import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;
import DataViewTable = powerbi.DataViewTable;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

export class Visual implements IVisual {
  private host?: powerbi.extensibility.IVisualHost;
  private container: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private valueEl: HTMLDivElement;
  private iconEl: HTMLDivElement;
  private lastObjects: powerbi.DataViewObjects | undefined;

  constructor(options?: VisualConstructorOptions) {
    this.host = options?.host;
    const hostEl = options?.element ?? document.createElement('div');

    this.container = document.createElement('div');
    this.container.className = 'card-root';
    hostEl.appendChild(this.container);

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

    const width = Math.max(24, options.viewport.width);
    const height = Math.max(24, options.viewport.height);
    this.container.style.width = `${width}px`; this.container.style.height = `${height}px`;

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
    const namePlacement = this.txt(objects, 'nameText', 'placement', 'top');

    const valFont = this.txt(objects, 'valueText', 'fontFamily', 'Segoe UI, Arial');
    const valSize = this.num(objects, 'valueText', 'fontSize', 28);
    const valColorDefault = this.col(objects, 'valueText', 'color', '#0F172A');

    const iconSize = this.num(objects, 'icon', 'size', 18);
    const iconPlacement = this.txt(objects, 'icon', 'placement', 'left');
    const builtIn = (this.txt(objects, 'icon', 'builtIn', 'none')||'none').toLowerCase();

    // Data roles
    let value: any = '';
    let condition: any = undefined;
    let iconSvg: string | undefined = undefined;
    let measureName = 'Measure';
    let measureFormat: string | undefined = undefined;

    const tableDv = table;
    if (tableDv && tableDv.rows && tableDv.rows.length > 0) {
      const row = tableDv.rows[0];
      const cols = (tableDv.columns || []) as DataViewMetadataColumn[];
      const idxMeasure = cols.findIndex(c => c.roles && (c.roles as any)['measure']);
      const idxCond = cols.findIndex(c => c.roles && (c.roles as any)['condition']);
      const idxIcon = cols.findIndex(c => c.roles && (c.roles as any)['iconSvg']);
      if (idxMeasure >= 0) {
        value = row[idxMeasure];
        const mc = cols[idxMeasure];
        measureName = mc.displayName || measureName;
        measureFormat = (mc as any).format;
      }
      if (idxCond >= 0) condition = row[idxCond];
      if (idxIcon >= 0) iconSvg = (row[idxIcon] != null) ? String(row[idxIcon]) : undefined;
    }

    // Value formatting controls
    const useModel = this.bool(objects, 'valueFormat', 'useModelFormat', true);
    const usePercent = this.bool(objects, 'valueFormat', 'usePercent', false);
    const decimals = this.num(objects, 'valueFormat', 'decimals', 2);
    const thousands = this.bool(objects, 'valueFormat', 'thousands', true);
    const prefix = this.txt(objects, 'valueFormat', 'prefix', '');
    const suffix = this.txt(objects, 'valueFormat', 'suffix', '');
    const customFmt = this.txt(objects, 'valueFormat', 'customFormat', '').trim();

    const formatted = this.format(value, { useModel, customFmt, decimals, thousands, usePercent, prefix, suffix, modelFmt: measureFormat });

    // Coloring rules
    const mode = (this.txt(objects, 'rules', 'mode', 'none') || 'none').toLowerCase();
    const rulesColor = this.pickRuleColor(mode, condition, {
      pos: this.col(objects, 'rules', 'posColor', '#28FF18'),
      zero: this.col(objects, 'rules', 'zeroColor', '#FFEA04'),
      neg: this.col(objects, 'rules', 'negColor', '#FF2C2C'),
      good: this.col(objects, 'rules', 'goodColor', '#28FF18'),
      warn: this.col(objects, 'rules', 'warnColor', '#FFEA04'),
      bad: this.col(objects, 'rules', 'badColor', '#FF2C2C'),
      defaultCol: this.col(objects, 'rules', 'defaultColor', valColorDefault)
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

    // Placements
    this.place(this.iconEl, iconPlacement);
    this.place(this.nameEl, namePlacement);
    this.valueEl.style.gridRow = '2'; this.valueEl.style.gridColumn = '2';

    // Store action config
    this._actionMode = (this.txt(objects,'action','mode','none')||'none').toLowerCase();
    this._actionUrl = this.txt(objects,'action','url','');
  }

  // ==== FormattingModel API (Modern Format Pane) ====
  public getFormattingModel(): powerbi.visuals.FormattingModel {
    const cards: powerbi.visuals.FormattingCard[] = [];
    const makeUid = (s: string) => `${s}_uid`;

    // Helper creators for common controls
    const textInput = (objectName:string, propertyName:string, displayName:string, value:string): powerbi.visuals.FormattingSlice => ({
      uid: makeUid(`${objectName}_${propertyName}`),
      displayName,
      control: {
        type: powerbi.visuals.FormattingComponent.TextInput,
        properties: { descriptor: { objectName, propertyName }, value }
      }
    });
    const numUpDown = (objectName:string, propertyName:string, displayName:string, value:number, min?:number, max?:number): powerbi.visuals.FormattingSlice => ({
      uid: makeUid(`${objectName}_${propertyName}`),
      displayName,
      control: {
        type: powerbi.visuals.FormattingComponent.NumUpDown,
        properties: { descriptor: { objectName, propertyName }, value, options: { min, max } }
      }
    });
    const colorPicker = (objectName:string, propertyName:string, displayName:string, value:string): powerbi.visuals.FormattingSlice => ({
      uid: makeUid(`${objectName}_${propertyName}`),
      displayName,
      control: {
        type: powerbi.visuals.FormattingComponent.ColorPicker,
        properties: { descriptor: { objectName, propertyName }, value: { value } }
      }
    });
    const toggle = (objectName:string, propertyName:string, displayName:string, value:boolean): powerbi.visuals.FormattingSlice => ({
      uid: makeUid(`${objectName}_${propertyName}`),
      displayName,
      control: {
        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
        properties: { descriptor: { objectName, propertyName }, value }
      }
    });
    const dropdown = (objectName:string, propertyName:string, displayName:string, value:string, items: {value:string, displayName:string}[]): powerbi.visuals.FormattingSlice => ({
      uid: makeUid(`${objectName}_${propertyName}`),
      displayName,
      control: {
        type: powerbi.visuals.FormattingComponent.Dropdown,
        properties: { descriptor: { objectName, propertyName }, value, items }
      }
    });

    const obj = this.lastObjects || ({} as powerbi.DataViewObjects);

    // Value card
    cards.push({
      uid: makeUid('valueText_card'),
      displayName: 'Measure value',
      groups: [{
        uid: makeUid('valueText_group'), displayName: 'Text',
        slices: [
          textInput('valueText','fontFamily','Font family', this.txt(obj,'valueText','fontFamily','Segoe UI, Arial')),
          numUpDown('valueText','fontSize','Font size', this.num(obj,'valueText','fontSize',28), 8, 120),
          colorPicker('valueText','color','Color', this.col(obj,'valueText','color','#0F172A'))
        ]
      }]
    });

    // Name card
    cards.push({
      uid: makeUid('nameText_card'), displayName:'Measure name',
      groups: [{ uid: makeUid('nameText_group'), displayName:'Text',
        slices: [
          textInput('nameText','fontFamily','Font family', this.txt(obj,'nameText','fontFamily','Segoe UI, Arial')),
          numUpDown('nameText','fontSize','Font size', this.num(obj,'nameText','fontSize',12), 6, 80),
          colorPicker('nameText','color','Color', this.col(obj,'nameText','color','#6B7280')),
          dropdown('nameText','placement','Placement', this.txt(obj,'nameText','placement','top'), [
            { value:'left', displayName:'Left' },{ value:'right', displayName:'Right' },{ value:'top', displayName:'Above' },{ value:'bottom', displayName:'Below' }
          ])
        ]
      }]
    });

    // Icon card
    cards.push({
      uid: makeUid('icon_card'), displayName:'Icon',
      groups: [{ uid: makeUid('icon_group'), displayName:'Appearance',
        slices: [
          numUpDown('icon','size','Size (px)', this.num(obj,'icon','size',18), 8, 128),
          dropdown('icon','placement','Placement', this.txt(obj,'icon','placement','left'), [
            { value:'left', displayName:'Left' },{ value:'right', displayName:'Right' },{ value:'top', displayName:'Above' },{ value:'bottom', displayName:'Below' }
          ]),
          dropdown('icon','builtIn','Built-in icons', this.txt(obj,'icon','builtIn','status-circles'), [
            { value:'none', displayName:'None' },{ value:'status-circles', displayName:'Status circles' }
          ])
        ]
      }]
    });

    // Value format card
    cards.push({ uid: makeUid('valueFormat_card'), displayName:'Value format',
      groups: [{ uid: makeUid('valueFormat_group'), displayName:'Format',
        slices: [
          toggle('valueFormat','useModelFormat','Use data model format', this.bool(obj,'valueFormat','useModelFormat', true)),
          toggle('valueFormat','usePercent','Percent (×100 + %)', this.bool(obj,'valueFormat','usePercent', false)),
          numUpDown('valueFormat','decimals','Decimals', this.num(obj,'valueFormat','decimals', 2), 0, 6),
          toggle('valueFormat','thousands','Thousands separator', this.bool(obj,'valueFormat','thousands', true)),
          textInput('valueFormat','prefix','Prefix', this.txt(obj,'valueFormat','prefix','')),
          textInput('valueFormat','suffix','Suffix', this.txt(obj,'valueFormat','suffix','')),
          textInput('valueFormat','customFormat','Custom format', this.txt(obj,'valueFormat','customFormat',''))
        ]
      }]
    });

    // Rules
    cards.push({ uid: makeUid('rules_card'), displayName:'Coloring rules',
      groups: [{ uid: makeUid('rules_group'), displayName:'Rules',
        slices: [
          dropdown('rules','mode','Mode', this.txt(obj,'rules','mode','none'), [
            { value:'none', displayName:'None' },{ value:'numeric', displayName:'Numeric' },{ value:'text', displayName:'Text' },{ value:'hex', displayName:'Hex' }
          ]),
          colorPicker('rules','posColor','Positive color', this.col(obj,'rules','posColor','#28FF18')),
          colorPicker('rules','zeroColor','Zero color', this.col(obj,'rules','zeroColor','#FFEA04')),
          colorPicker('rules','negColor','Negative color', this.col(obj,'rules','negColor','#FF2C2C')),
          colorPicker('rules','goodColor','Good color', this.col(obj,'rules','goodColor','#28FF18')),
          colorPicker('rules','warnColor','Warn color', this.col(obj,'rules','warnColor','#FFEA04')),
          colorPicker('rules','badColor','Bad color', this.col(obj,'rules','badColor','#FF2C2C')),
          colorPicker('rules','defaultColor','Default color', this.col(obj,'rules','defaultColor','#0F172A'))
        ]
      }]
    });

    // Background
    cards.push({ uid: makeUid('background_card'), displayName:'Background',
      groups: [{ uid: makeUid('background_group'), displayName:'Background',
        slices: [
          colorPicker('background','color','Background color', this.col(obj,'background','color','#FFFFFF')),
          numUpDown('background','transparency','Transparency (0-100)', this.num(obj,'background','transparency', 0), 0, 100)
        ]
      }]
    });

    // Card border
    cards.push({ uid: makeUid('card_card'), displayName:'Card border',
      groups: [{ uid: makeUid('card_group'), displayName:'Border',
        slices: [
          colorPicker('card','borderColor','Border color', this.col(obj,'card','borderColor','#E5E7EB')),
          numUpDown('card','borderWidth','Border width (px)', this.num(obj,'card','borderWidth', 0), 0, 20),
          numUpDown('card','cornerRadius','Corner radius (px)', this.num(obj,'card','cornerRadius', 6), 0, 50)
        ]
      }]
    });

    // Layout
    cards.push({ uid: makeUid('layout_card'), displayName:'Layout',
      groups: [{ uid: makeUid('layout_group'), displayName:'Layout',
        slices: [ numUpDown('layout','gap','Gap (px)', this.num(obj,'layout','gap', 6), 0, 50), numUpDown('layout','padding','Padding (px)', this.num(obj,'layout','padding', 8), 0, 50) ]
      }]
    });

    // Action
    cards.push({ uid: makeUid('action_card'), displayName:'Click action',
      groups: [{ uid: makeUid('action_group'), displayName:'Action',
        slices: [
          dropdown('action','mode','Mode', this.txt(obj,'action','mode','none'), [ { value:'none', displayName:'None' }, { value:'url', displayName:'Open URL' } ]),
          textInput('action','url','URL', this.txt(obj,'action','url',''))
        ]
      }]
    });

    return { cards };
  }

  // Click action
  private _actionMode: string = 'none';
  private _actionUrl: string = '';
  private onClick() {
    if (this._actionMode === 'url' && this._actionUrl) {
      try {
        const anyHost = this.host as any;
        if (anyHost && typeof anyHost.launchUrl === 'function') anyHost.launchUrl(this._actionUrl);
        else window.open(this._actionUrl, '_blank');
      } catch {}
    }
  }

  private place(el: HTMLElement, p: string) {
    el.classList.remove('center','right');
    switch ((p || 'left').toLowerCase()) {
      case 'left': el.style.gridRow = '2'; el.style.gridColumn = '1'; break;
      case 'right': el.style.gridRow = '2'; el.style.gridColumn = '3'; el.classList.add('right'); break;
      case 'top': case 'above': el.style.gridRow = '1'; el.style.gridColumn = '2'; el.classList.add('center'); break;
      case 'bottom': case 'below': el.style.gridRow = '3'; el.style.gridColumn = '2'; el.classList.add('center'); break;
      default: el.style.gridRow = '2'; el.style.gridColumn = '1';
    }
  }

  private format(v: any, opt: { useModel: boolean; customFmt: string; decimals: number; thousands: boolean; usePercent: boolean; prefix: string; suffix: string; modelFmt?: string }): string {
    if (v == null || v === '') return '';
    const n = (typeof v === 'number') ? v : Number(v);

    let model = opt.useModel && opt.modelFmt ? String(opt.modelFmt) : '';
    let usePct = opt.usePercent;
    let decimals = opt.decimals;
    let useThousands = opt.thousands;

    if (model) {
      if (model.indexOf('%') >= 0) usePct = true;
      const m = model.match(/0\.0+/); if (m) decimals = Math.max(decimals, m[0].length - 2);
      if (model.indexOf(',') >= 0) useThousands = true;
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

  private rgba(hex: string, alpha: number): string {
    try {
      const h = hex.replace('#','');
      let r:number,g:number,b:number;
      if (h.length===3){ r=parseInt(h[0]+h[0],16); g=parseInt(h[1]+h[1],16); b=parseInt(h[2]+h[2],16);} else { r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16);} 
      return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,alpha)).toFixed(3)})`;
    } catch { return hex; }
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
    try { const v: any = (objects as any)[obj]?.[prop]; if (typeof v === 'boolean') return v; if (v==='true') return true; if (v==='false') return false; return def; } catch { return def; }
  }
}
