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

## 3. Offer to set the same distributor for the rest of an item's family (done)

Built. When you change an item's distributor in its details, a box appears below it: "Use RNDC for the rest of the 1800 family too?"

- **What's listed:** every other item of the brand in the same department, all sizes and related products. For 1800 Blanco 750ml that's 28 items: Blanco in every size, Reposado, Coconut, Cucumber, the Margaritas and so on. Each shows its current distributor.
- **What's ticked:** everything is ticked, except items where you already picked a different distributor yourself.
- **Same brand in other departments** (1800 Margaritas under RTD Cocktails) is listed in its own group, unticked. Matching on the brand name alone can pull in unrelated items.
- **Controls:** Select all, Deselect all, "Set for N items" and No thanks. One Undo puts every item back as it was.
- **No offer** appears when the distributor didn't actually change, or when the whole family already uses it.
- **Not built yet:** a bulk "set distributor" action. If it's added, it should use the same offer.
- **Open question:** should a new size that shows up later automatically use the family's distributor?

## 4. Suppress button on the Quantity deals page

Each item line in the Quick QD check gets a **Suppress** button, the same as on the Reorder list.

Notes for when this is built:
- Suppressing an item drops it from the deal straight away, and the rest of the QD is split again without it. Suppressed items are already left out of QDs today, but only if you suppress them somewhere else first.
- A toast with Undo brings it back into the deal.
- Under the list, show a small "N suppressed items left out" line with a way to see them and bring one back. Otherwise a flavour can quietly go missing from the deal.
- It's the same suppress as everywhere else (shared, saved with the item), so the item also stops being suggested on the Reorder list.
