// src/visual.ts
// Logika wizuala: wartość + opcjonalny cel + tooltipy
// Wymaga: powerbi-visuals-utils-tooltiputils, powerbi-visuals-utils-formattingmodel, powerbi-visuals-utils-formattingutils

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

  private container: HTMLDivElement;
  private valueEl: HTMLDivElement;
  private goalEl: HTMLDivElement;

  constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
    this.host = options.host;
    this.element = options.element;

    this.formattingSettingsService = new FormattingSettingsService();

    this.tooltipServiceWrapper = createTooltipServiceWrapper(
      this.host.tooltipService,
      this.element
    );

    // Prosty layout
    this.container = document.createElement("div");
    this.container.className = "pbi-panel-container";

    this.valueEl = document.createElement("div");
    this.valueEl.className = "pbi-panel-value";

    this.goalEl = document.createElement("div");
    this.goalEl.className = "pbi-panel-goal";

    this.container.appendChild(this.valueEl);
    this.container.appendChild(this.goalEl);
    this.element.appendChild(this.container);
  }

  public update(options: powerbi.extensibility.visual.VisualUpdateOptions) {
    const dataView = options.dataViews && options.dataViews[0];
    if (!dataView) return;

    // 1) Ustawienia z Format Pane (FormattingModel)
    this.settings = this.formattingSettingsService.populateFormattingSettingsModel(VisualSettings, dataView);

    // 2) Ekstrakcja danych wg ról
    const cat = dataView.categorical;
    const values = cat && cat.values ? cat.values : [];

    const valueCol = values.find(v => v.source.roles && v.source.roles["value"]);
    const goalCol  = values.find(v => v.source.roles && v.source.roles["goal"]);
    const toolCols = values.filter(v => v.source.roles && v.source.roles["tooltips"]);

    const valueRaw = valueCol && valueCol.values ? valueCol.values[0] : undefined;
    const goalRaw  = goalCol && goalCol.values ? goalCol.values[0]   : undefined;

    // 3) Formatowanie tekstów liczbowych
    const valueTxt = (valueRaw !== undefined && valueRaw !== null)
      ? vf.create({ format: valueCol?.source.format, value: valueRaw as number }).format(valueRaw as number)
      : "";

    const goalTxt = (goalRaw !== undefined && goalRaw !== null)
      ? vf.create({ format: goalCol?.source.format, value: goalRaw as number }).format(goalRaw as number)
      : "";

    // 4) Render wartości
    this.valueEl.textContent = valueTxt;

    // 5) Render celu + format i pozycja
    if (goalTxt) {
      this.goalEl.textContent = goalTxt;
      this.goalEl.style.fontFamily = this.settings.goalLabel.fontFamily.value;
      this.goalEl.style.fontWeight = this.settings.goalLabel.bold.value ? "700" : "400";
      this.goalEl.style.fontSize   = `${this.settings.goalLabel.fontSize.value}px`;

      // Pozycjonowanie gridem
      this.container.style.display = "grid";
      const pos = (this.settings.goalLabel.position.value && (this.settings.goalLabel.position.value as any).value) || "right";

      switch (pos) {
        case "above":
          this.container.style.gridTemplateRows = "auto auto";
          this.container.style.gridTemplateColumns = "1fr";
          (this.goalEl.style as any).gridArea  = "1 / 1 / 2 / 2";
          (this.valueEl.style as any).gridArea = "2 / 1 / 3 / 2";
          break;
        case "below":
          this.container.style.gridTemplateRows = "auto auto";
          this.container.style.gridTemplateColumns = "1fr";
          (this.valueEl.style as any).gridArea = "1 / 1 / 2 / 2";
          (this.goalEl.style as any).gridArea  = "2 / 1 / 3 / 2";
          break;
        case "left":
          this.container.style.gridTemplateColumns = "auto 1fr";
          this.container.style.gridTemplateRows = "1fr";
          (this.goalEl.style as any).gridArea  = "1 / 1 / 2 / 2";
          (this.valueEl.style as any).gridArea = "1 / 2 / 2 / 3";
          break;
        case "right":
        default:
          this.container.style.gridTemplateColumns = "1fr auto";
          this.container.style.gridTemplateRows = "1fr";
          (this.valueEl.style as any).gridArea = "1 / 1 / 2 / 2";
          (this.goalEl.style as any).gridArea  = "1 / 2 / 2 / 3";
      }

      this.goalEl.style.display = "";
    } else {
      this.goalEl.style.display = "none";
    }

    // 6) Tooltip — do całego panelu
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

    // Tytuł
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
