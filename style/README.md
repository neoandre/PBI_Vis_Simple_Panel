# Simple Panel (Goal + Tooltip)

Power BI custom visual: Simple KPI panel z opcjonalnym **Celem** i konfigurowalnym **Tooltipem**.

## Najważniejsze
- Rola danych **Value** (główna wartość) i **Goal** (opcjonalny cel).
- Rola danych **Tooltip fields** do wyświetlania dowolnej liczby par `Pole: Wartość` w tooltipie.
- Format Pane (API 5.1+): karta **Cel (etykieta)** — krój pisma, rozmiar, pogrubienie, pozycja względem wartości; karta **Tooltip** — włącznik, tytuł, przełączniki pokazywania pól.
- Layout CSS oparty o **siatkę 3×3** (.card-root) — zachowuje dotychczasowe klasy `.name`, `.value`, `.icon` i dodaje `.goal`.

## Uruchomienie
```bash
npm install
npm run start
# w Power BI Desktop: importuj wizual z localhost (pbiviz)
```

## Wymagania
- `apiVersion` 5.1+ (Format Pane — FormattingModel)
- Pakiety: `powerbi-visuals-utils-tooltiputils`, `powerbi-visuals-utils-formattingmodel`, `powerbi-visuals-utils-formattingutils`

## Uwaga
- Jeśli masz własny **title/name** bindowany do `.name`, ustaw go podczas `update()`.
- Pozycja "celu" jest kontrolowana klasą na kontenerze: `.goal-above/.goal-below/.goal-left/.goal-right`.
