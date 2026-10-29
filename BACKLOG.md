# Backlog

Ideas to build later. Not started unless marked.

## 1. Unsuppress an item automatically when it's restocked

If a suppressed item was at zero stock and a later item list shows new stock, unsuppress it. New stock means it was ordered again, so the planner should start suggesting it again.

Notes for when this is built:
- Each item list only shows today's stock, so the planner has to save each suppressed item's last stock count (in the item's shared adjustments) to notice when it goes from 0 to more than 0.
- Say which items were unsuppressed this way when the new item list loads, with an Undo.
- Open question: should this also happen when stock goes up from a number above zero, or only from zero?
