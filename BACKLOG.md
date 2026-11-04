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
- Be smart about slow sellers that are almost out. If an item still sells but only has 1–2 left, add at least 1 even when the days math rounds down to 0. For example, 2 bottles on hand, selling 1 a month, with 80 days asked for.
- Show next to each line how many days the suggested quantity covers, so you can check it.
- Show whether the total reaches the deal's case count, and how far short it is.
- Open questions:
  - When the "add at least 1" rule applies, should it add one unit or one case?
  - At what point counts as "almost out": fewer than 2 on hand, or less than a few weeks of stock?
  - Should the days include the usual safety stock, or exactly the days you typed?
