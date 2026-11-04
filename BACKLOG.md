# Backlog

Ideas to build later. Not started unless marked.

## 1. Unsuppress an item automatically when it's restocked

If a suppressed item was at zero stock and a later item list shows new stock, unsuppress it. New stock means it was ordered again, so the planner should start suggesting it again.

Notes for when this is built:
- Each item list only shows today's stock, so the planner has to save each suppressed item's last stock count (in the item's shared adjustments) to notice when it goes from 0 to more than 0.
- Say which items were unsuppressed this way when the new item list loads, with an Undo.
- Open question: should this also happen when stock goes up from a number above zero, or only from zero?

## 2. Quantity deals: order by "days to cover" instead of cases (done)

Built. On the Quantity deals page, a **days to order for** box sits next to the QD quantity. Only one of the two is ever filled in: typing in one empties the other.

With days filled in, each item is ordered up to that many days of sales, minus what's on hand and on order. Quantities are in whole cases, rounded up the same way as the Reorder list. The summary, the total line and the QD heading on the Reorder list all say how many days the order is for. "Change" brings the days back.

- **Nearly-out items get at least one case.** This applies to items with 2 or fewer on hand that will sell at least one more in those days, even when the days only call for part of a case. Your example still gets one: 2 on hand, selling 1 a month, 80 days asked for. Something that sells once a year doesn't get one.
- **No extra safety stock.** The days are exactly what you typed. If you want a cushion, type more days.
- **Changing the size starts the suggestion over.** If you change the QD quantity or the days after "Suggest order", the suggestion is redone. Before, the quantities stayed pinned until you pressed "Reset to suggestion".

## 3. Offer to set the same distributor for the rest of an item's family

When you set a distributor for one item, for example 1800 Blanco 750ml, offer to set it for the rest of the family too: the other sizes (50ml, 375ml, 1.75L) and the related items (1800 Reposado, Añejo, and so on).

Notes for when this is built:
- Show the offer right after the distributor is saved, listing the items it would change with a tick box for each. All are ticked by default except items that already have a different distributor you set yourself; those are shown but unticked.
- Offer everything in the family: every size and every related product (Reposado, Añejo…), in one list with **Select all** and **Deselect all**.
- Find the family the same way the Quantity deals check does for "sizes mix" and "flavours mix".
- Open question: should a new size that shows up later automatically use the family's distributor?
- One Undo for the whole change.
- It should also work from the bulk "set distributor" action, if that gets added.
