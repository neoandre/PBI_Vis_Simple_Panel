
# PBI Panel (v5.1.2)

A simple Power BI custom visual that displays a **measure value**, its **name**, and an optional **status icon**.

- CSS **grid** layout (icon | text | spare), so **icon placement** and **name placement** work.
- Formatting pane: font family/size/color for value and name; icon size/placement; background, border, layout, rules, etc.
- Works with API 5.1.x and pbiviz 5.6.0 (tested).

## Build

```bash
npm i -g powerbi-visuals-tools
npm i
pbiviz start       # dev
pbiviz package     # dist .pbiviz
```

## Data roles
- **measure** (required)
- **condition** (optional) – used by rules (numeric/text/hex)
- **iconSvg** (optional) – custom inline SVG (falls back to built-in status circle)

## Notes
- If a chosen font family is not installed on the client, the browser will fall back to the next font in the stack.
- Layout relies on `.card-root { display: grid; ... }` which is declared in `style/visual.less` and also enforced in code as a safety net.
