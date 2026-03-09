// src/visual.ts
// Uses:
//  - Formatting Model (API 5.1+) for format pane cards
//  - Tooltip Service Wrapper for hover tooltips
//  - 3x3 grid CSS layout with .card-root, preserving existing functionality

import powerbi from "powerbi-visuals-api";
import { VisualSettings } from "./settings";
import { valueFormatter as vf } from "powerbi-visuals-utils-formattingutils";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { ITooltipServiceWrapper, createTooltipServiceWrapper, TooltipEventArgs } from "powerbi-visuals-utils-tooltiputils";
import * as d3 from "d3-selection";

export class Visual implements powerbi.extensibility.visual.IVisual {
  private host: powerbi.extensibility.visual.IVisualHost;
  private element: HTMLElement;
  private tooltipServiceWrapper: ITooltipServiceWrapper;
  private formattingSettingsService: FormattingSettingsService;
  private settings: VisualSettings;

  private container: HTMLDivElement;  // .card-root
  private nameEl: HTMLDivElement;     // optional, if you bind name elsewhere
  private valueEl: HTMLDivElement;    // .value
  private iconEl: HTMLDivElement;     // .icon (placeholder)
  private goalEl: HTMLDivElement;     // .goal

  constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
    this.host = options.host;
    this.element = options.element;

    this.formattingSettingsService = new FormattingSettingsService();
    this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, this.element);

    // Root container follows your 3x3 grid layout
    this.container = document.createElement("div");
    this.container.className = "card-root";

    // Optional "name" node (kept for compatibility with original CSS)
    this.nameEl = document.createElement("div");
    this.nameEl.className = "name full-width";

    // Value node
    this.valueEl = document.createElement("div");
    this.valueEl.className = "value center";

    // Icon node (placeholder). In your project you can inject actual SVG/icon here
    this.iconEl = document.createElement("div");
    this.iconEl.className = "icon";

    // Goal node
    this.goalEl = document.createElement("div");
    this.goalEl.className = "goal";

    // Assemble DOM
    this.container.appendChild(this.nameEl);
    this.container.appendChild(this.iconEl);
    this.container.appendChild(this.valueEl);
    this.container.appendChild(this.goalEl);
    this.element.appendChild(this.container);
  }

  public update(options: powerbi.extensibility.visual.VisualUpdateOptions) {
    const dataView = options.dataViews && options.dataViews[0];
    if (!dataView) return;

    // 1) Formatting settings
    this.settings = this.formattingSettingsService.populateFormattingSettingsModel(VisualSettings, dataView);

    // 2) Data extraction by roles
    const cat = dataView.categorical;
    const values = cat && cat.values ? cat.values : [];

    const valueCol = values.find(v => v.source.roles && v.source.roles["value"]);
    const goalCol  = values.find(v => v.source.roles && v.source.roles["goal"]);
    const toolCols = values.filter(v => v.source.roles && v.source.roles["tooltips"]);

    const valueRaw = valueCol?.values?.[0];
    const goalRaw  = goalCol?.values?.[0];

    // 3) Format numbers
    const valueTxt = (valueRaw !== undefined && valueRaw !== null)
      ? vf.create({ format: valueCol?.source.format, value: valueRaw as number }).format(valueRaw as number)
      : "";

    const goalTxt = (goalRaw !== undefined && goalRaw !== null)
      ? vf.create({ format: goalCol?.source.format, value: goalRaw as number }).format(goalRaw as number)
      : "";

    // 4) Render nodes (name can be fed from some other source if needed)
    // If you have a bound field for name/title, set it here; otherwise leave empty
    this.nameEl.textContent = this.nameEl.textContent || "";

    this.valueEl.textContent = valueTxt;

    if (goalTxt) {
      this.goalEl.textContent = goalTxt;
      this.goalEl.style.fontFamily = this.settings.goalLabel.fontFamily.value;
      this.goalEl.style.fontWeight = this.settings.goalLabel.bold.value ? "700" : "400";
      this.goalEl.style.fontSize   = `${this.settings.goalLabel.fontSize.value}px`;

      // Position goal relative to value using container modifier class
      const pos = (this.settings.goalLabel.position.value && (this.settings.goalLabel.position.value as any).value) || "right";
      this.container.classList.remove("goal-above","goal-below","goal-left","goal-right");
      switch (pos) {
        case "above": this.container.classList.add("goal-above"); break;
        case "below": this.container.classList.add("goal-below"); break;
        case "left":  this.container.classList.add("goal-left");  break;
        case "right":
        default:       this.container.classList.add("goal-right"); break;
      }
      this.goalEl.style.display = "";
    } else {
      this.goalEl.style.display = "none";
      this.container.classList.remove("goal-above","goal-below","goal-left","goal-right");
    }

    // 5) Tooltip for entire card
    this.tooltipServiceWrapper.addTooltip(
      d3.select(this.container as unknown as Element),
      (args: TooltipEventArgs<void>) => this.buildTooltipItems(valueTxt, goalTxt, toolCols),
      () => null,
      true
    );
  }

  private buildTooltipItems(valueTxt: string, goalTxt: string, toolCols: powerbi.DataViewValueColumn[]): powerbi.extensibility.VisualTooltipDataItem[] {
    const t = this.settings.tooltip;
    if (!t || !t.enabled.value) return [];

    const items: powerbi.extensibility.VisualTooltipDataItem[] = [];

    if (t.title.value && t.title.value.trim()) {
      items.push({ displayName: t.title.value, value: "" });
    }

    if (t.showValue.value && valueTxt) {
      items.push({ displayName: "Wartość", value: valueTxt });
    }

    if (t.showGoal.value && goalTxt) {
      items.push({ displayName: "Cel", value: goalTxt });
    }

    if (t.showFields.value && toolCols?.length) {
      toolCols.forEach(col => {
        const raw = col.values?.[0];
        const display = col.source.displayName || col.source.queryName || "Pole";
        const valTxt = (raw === null || raw === undefined)
          ? ""
          : (typeof raw === "number"
              ? vf.create({ format: col.source.format, value: raw as number }).format(raw as number)
              : String(raw));
        items.push({ displayName: display, value: valTxt });
      });
    }

    return items;
  }

  public getFormattingModel(): powerbi.extensibility.visual.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }
}

export default Visual;
