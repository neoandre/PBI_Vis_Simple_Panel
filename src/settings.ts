// src/settings.ts
// Ustawienia Format Pane z wykorzystaniem FormattingModel (API 5.1+)
// Wymaga pakietu: powerbi-visuals-utils-formattingmodel
// oraz zdefiniowanych obiektów w capabilities.json

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

export class GoalLabelCard extends formattingSettings.SimpleCard {
  public name: string = "goalLabel";
  public displayName: string = "Cel (etykieta)";

  public fontFamily: formattingSettings.FontPicker = new formattingSettings.FontPicker({
    name: "fontFamily",
    displayName: "Krój pisma",
    value: "Segoe UI, sans-serif"
  });

  public fontSize: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
    name: "fontSize",
    displayName: "Rozmiar",
    value: 12,
    options: { minValue: { value: 8 }, maxValue: { value: 48 } }
  });

  public bold: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
    name: "bold",
    displayName: "Pogrubienie",
    value: false
  });

  public position: formattingSettings.Dropdown = new formattingSettings.Dropdown({
    name: "position",
    displayName: "Pozycja względem wartości",
    value: { value: "right", displayName: "Z prawej" },
    items: [
      { value: "above", displayName: "Nad" },
      { value: "below", displayName: "Pod" },
      { value: "left",  displayName: "Z lewej" },
      { value: "right", displayName: "Z prawej" }
    ]
  });

  public slices: formattingSettings.Slice[] = [
    this.fontFamily,
    this.fontSize,
    this.bold,
    this.position
  ];
}

export class TooltipCard extends formattingSettings.SimpleCard {
  public name: string = "tooltip";
  public displayName: string = "Tooltip";

  public enabled   = new formattingSettings.ToggleSwitch({ name: "enabled",   displayName: "Włącz tooltip", value: true });
  public title     = new formattingSettings.TextInput({   name: "title",     displayName: "Tytuł",         value: "" });
  public showValue = new formattingSettings.ToggleSwitch({ name: "showValue", displayName: "Pokaż wartość", value: true });
  public showGoal  = new formattingSettings.ToggleSwitch({ name: "showGoal",  displayName: "Pokaż cel",     value: true });
  public showFields= new formattingSettings.ToggleSwitch({ name: "showFields",displayName: "Pola dodatkowe",value: true });

  public slices: formattingSettings.Slice[] = [
    this.enabled,
    this.title,
    this.showValue,
    this.showGoal,
    this.showFields
  ];
}

export class VisualSettings extends formattingSettings.Model {
  public goalLabel: GoalLabelCard = new GoalLabelCard();
  public tooltip:   TooltipCard   = new TooltipCard();

  public cards: formattingSettings.SimpleCard[] = [ this.goalLabel, this.tooltip ];
}
