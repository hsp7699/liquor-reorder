# Backlog

Ideas to build later. Not started unless marked.

## 1. Unsuppress an item automatically when it's restocked

If a suppressed item was at zero stock and a later item list shows new stock, unsuppress it. New stock means it was ordered again, so the planner should start suggesting it again.

Notes for when this is built:
- Each item list only shows today's stock, so the planner has to save each suppressed item's last stock count (in the item's shared adjustments) to notice when it goes from 0 to more than 0.
- Say which items were unsuppressed this way when the new item list loads, with an Undo.
- Open question: should this also happen when stock goes up from a number above zero, or only from zero?

## 2. Quantity deals: order by "days to cover" instead of cases

On the Quantity deals page, add a **Days to order for** box next to the cases box. You fill in one or the other, never both: typing in one clears and disables the other.

When days are filled in, "Suggest order" picks quantities so each item has enough stock to last that many days. For example, at 60 days the target is about 60 days of sales minus what's on hand and on order, rounded to whole cases. The total cases then come from the suggestion, not from a number you typed.

Notes for when this is built:
- Slow sellers that are almost out still get 1 case. If an item still sells and has 2 or fewer on hand, add at least 1 case even when the days math rounds down to 0. For example, 2 bottles on hand, selling 1 a month, with 80 days asked for.
- Show next to each line how many days the suggested quantity covers, so you can check it.
- Show whether the total reaches the deal's case count, and how far short it is.
- Decided:
  - The minimum is one case, not one unit.
  - "Almost out" is judged by on hand: 2 or fewer.
  - The days are exactly what you typed, with no extra safety stock. A deal already makes you buy ahead, and you pick the days yourself, so adding safety stock on top would over-buy. If you want a cushion, type more days.
