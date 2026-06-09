import { STORE } from "@/lib/brand";

export function buildAgreementText({ consignorName = "", consignorId = "", today = new Date() }) {
  const dateStr = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `CONSIGNMENT AGREEMENT

This Consignment Agreement ("Agreement") is entered into on ${dateStr} between ${STORE.name} ("the Store"), located at ${STORE.address}, and ${consignorName || "the Consignor"} ${consignorId ? `(${consignorId})` : ""} ("the Consignor").

1. CONSIGNMENT PERIOD. The Consignor's items will remain available for sale at the Store for a period of sixty (60) days from the date of intake. After 60 days, unsold items must be retrieved by the Consignor within seven (7) days, or the Store may, at its discretion, donate or otherwise dispose of the items.

2. COMMISSION SPLIT. The Store and the Consignor agree to a fifty / fifty (50% / 50%) split on the final sale price of each item, calculated automatically and itemized in the Store's records.

3. PRICING. The Store reserves the right to recommend or adjust pricing in consultation with the Consignor in order to maximize sell-through. Final pricing is mutually agreed at intake and recorded against each item ID.

4. PAYOUTS. Consignor earnings will be paid via the method on file (Cash / Check / Zelle / Venmo / Store Credit) on a rolling basis. The Consignor may request a payout at any time and balances will be reconciled within seven (7) business days.

5. CONDITION OF ITEMS. All items must be clean, in sellable condition, and free from significant damage. The Store may decline items that do not meet these standards at its sole discretion.

6. LOSS, THEFT, OR DAMAGE. While reasonable care will be taken, the Store is not responsible for loss or damage due to theft, fire, water, or other circumstances beyond its control.

7. TERMINATION. Either party may terminate this Agreement with written notice. Upon termination, the Consignor agrees to retrieve any remaining items within seven (7) days; otherwise items will be donated.

By signing below, the Consignor acknowledges that they have read, understood, and agreed to the terms of this Consignment Agreement.`;
}
