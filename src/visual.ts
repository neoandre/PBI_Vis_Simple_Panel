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
  private host: powerbi.extensibility.IVisualHost;
  private selectionManager!: powerbi.extensibility.ISelectionManager;

  private container: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private valueEl: HTMLDivElement;
  private iconEl: HTMLDivElement;

  private lastObjects: powerbi.DataViewObjects | undefined;

  // Click action state
  private _actionMode: string = "none";
  private _actionUrl: string = "";

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = this.host.createSelectionManager();

    this.container = document.createElement("div");
    this.container.className = "card-root";
    options.element.appendChild(this.container);

    this.nameEl = document.createElement("div");
    this.nameEl.className = "name";
    this.container.appendChild(this.nameEl);

    this.valueEl = document.createElement("div");
    this.valueEl.className = "value";
    this.container.appendChild(this.valueEl);

    this.iconEl = document.createElement("div");
    this.iconEl.className = "icon";
    this.container.appendChild(this.iconEl);

    this.container.onclick = () => this.onClick();
  }

  public update(options: VisualUpdateOptions): void {
    const dv: DataView | undefined = options.dataViews && options.dataViews[0];
    this.lastObjects =
      (dv && dv.metadata && dv.metadata.objects) || ({} as powerbi.DataViewObjects);
    const table: DataViewTable | undefined = dv && dv.table;

    // Size
    const width = Math.max(24, options.viewport.width);
    const height = Math.max(24, options.viewport.height);
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;

    const objects = this.lastObjects;

    // Layout, background, border
    const gap = this.num(objects, "layout", "gap", 6);
    const padding = this.num(objects, "layout", "padding", 8);
    (this.container.style as any).gap = `${gap}px`;
    this.container.style.padding = `${padding}px`;

    const bgColor = this.col(objects, "background", "color", "#FFFFFF");
    const bgAlpha = this.num(objects, "background", "transparency", 0);
    this.container.style.backgroundColor = this.rgba(
      bgColor,
      1 - Math.max(0, Math.min(100, bgAlpha)) / 100
    );

    const borderColor = this.col(objects, "card", "borderColor", "#E5E7EB");
    const borderWidth = this.num(objects, "card", "borderWidth", 0);
    const cornerRadius = this.num(objects, "card", "cornerRadius", 6);
    this.container.style.border =
      borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : "none";
    (this.container.style as any).borderRadius = `${cornerRadius}px`;

    // Fonts & placements
    const nameFont = this.txt(objects, "nameText", "fontFamily", "Segoe UI, Arial");
    const nameSize = this.num(objects, "nameText", "fontSize", 12);
    const nameColor = this.col(objects, "nameText", "color", "#6B7280");
    const namePlacement = this.txt(objects, "nameText", "placement", "top");

    const valFont = this.txt(objects, "valueText", "fontFamily", "Segoe UI, Arial");
    const valSize = this.num(objects, "valueText", "fontSize", 28);
    const valColorDefault = this.col(objects, "valueText", "color", "#0F172A");

    const iconSize = this.num(objects, "icon", "size", 18);
    const iconPlacement = this.txt(objects, "icon", "placement", "left");
    const builtIn =
      (this.txt(objects, "icon", "builtIn", "status-circles") || "status-circles").toLowerCase();

    // Data roles → first row
    let value: any = "";
    let condition: any = undefined;
    let iconSvg: string | undefined = undefined;
    let measureName = "Measure";
    let measureFormat: string | undefined = undefined;

    if (table && table.rows && table.rows.length > 0) {
      const row = table.rows[0];
      const cols = (table.columns || []) as DataViewMetadataColumn[];

      const idxMeasure = cols.findIndex((c) => c.roles && (c.roles as any)["measure"]);
      const idxCond = cols.findIndex((c) => c.roles && (c.roles as any)["condition"]);
      const idxIcon = cols.findIndex((c) => c.roles && (c.roles as any)["iconSvg"]);

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
    const useModel = this.bool(objects, "valueFormat", "useModelFormat", true);
    const usePercent = this.bool(objects, "valueFormat", "usePercent", false);
    const decimals = this.num(objects, "valueFormat", "decimals", 2);
    const thousands = this.bool(objects, "valueFormat", "thousands", true);
    const prefix = this.txt(objects, "valueFormat", "prefix", "");
    const suffix = this.txt(objects, "valueFormat", "suffix", "");
    const customFmt = this.txt(objects, "valueFormat", "customFormat", "").trim();

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
    const mode = (this.txt(objects, "rules", "mode", "none") || "none").toLowerCase();
    const rulesColor = this.pickRuleColor(mode, condition, {
      pos: this.col(objects, "rules", "posColor", "#28FF18"),
      zero: this.col(objects, "rules", "zeroColor", "#FFEA04"),
      neg: this.col(objects, "rules", "negColor", "#FF2C2C"),
      good: this.col(objects, "rules", "goodColor", "#28FF18"),
      warn: this.col(objects, "rules", "warnColor", "#FFEA04"),
      bad: this.col(objects, "rules", "badColor", "#FF2C2C"),
      defaultCol: this.col(objects, "rules", "defaultColor", valColorDefault),
    });

    // Apply Name
    this.nameEl.textContent = measureName || "";
    this.nameEl.style.fontFamily = nameFont;
    this.nameEl.style.fontSize = `${nameSize}px`;
    this.nameEl.style.color = nameColor;

    // Apply Value
    this.valueEl.textContent = formatted || "";
    this.valueEl.style.fontFamily = valFont;
    this.valueEl.style.fontSize = `${valSize}px`;
    this.valueEl.style.color = rulesColor || valColorDefault;

    // Icon (built-in fallback)
    this.iconEl.innerHTML = "";
    let svgToRender: string | undefined = iconSvg;
    if ((!svgToRender || !svgToRender.trim()) && builtIn === "status-circles") {
      const fill = rulesColor || "#28FF18";
      svgToRender = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${fill}"/></svg>`;
    }
    if (svgToRender && svgToRender.trim().length > 0) {
      const svg = this.ensureSvg(svgToRender);
      if (svg) {
        svg.setAttribute("width", String(iconSize));
        svg.setAttribute("height", String(iconSize));
        this.iconEl.appendChild(svg);
      }
    }

    // Placements
    this.place(this.iconEl, iconPlacement);
    this.place(this.nameEl, namePlacement);
    this.valueEl.style.gridRow = "2";
    this.valueEl.style.gridColumn = "2";

    // Store action config
    this._actionMode = (this.txt(objects, "action", "mode", "none") || "none").toLowerCase();
    this._actionUrl = this.txt(objects, "action", "url", "");
  }

  // ==== Modern Format Pane ====
