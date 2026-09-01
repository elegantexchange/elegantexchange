/** Square Point of Sale API deep links (Square Stand / Square POS on iPad). */

export function canOpenSquarePos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Square Stand runs Square POS on iPad; Android POS also supported.
  return /iPad|iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && !/Windows Phone/i.test(ua));
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua);
}

/**
 * Build a Square Point of Sale charge URL from /api/square/charge payload.
 * @param {{ amount_cents: number, currency?: string, notes?: string, client_id: string, callback_url: string, state: string }} payload
 */
export function buildSquarePosChargeUrl(payload) {
  const {
    amount_cents,
    currency = "USD",
    notes = "",
    client_id,
    callback_url,
    state,
  } = payload;
  if (!client_id || !callback_url || !state || !amount_cents) {
    throw new Error("Missing Square charge fields");
  }

  if (isIosDevice()) {
    const data = {
      amount_money: {
        amount: amount_cents,
        currency_code: currency,
      },
      callback_url,
      client_id,
      version: "1.3",
      notes: notes || undefined,
      state,
      options: {
        supported_tender_types: ["CREDIT_CARD", "CASH", "OTHER"],
        auto_return: true,
        skip_receipt: false,
      },
    };
    return `square-commerce-v1://payment/create?data=${encodeURIComponent(
      JSON.stringify(data)
    )}`;
  }

  // Android intent
  const parts = [
    "intent:#Intent",
    "action=com.squareup.pos.action.CHARGE",
    "package=com.squareup",
    `S.browser_fallback_url=${callback_url}`,
    `S.com.squareup.pos.WEB_CALLBACK_URI=${callback_url}`,
    `S.com.squareup.pos.CLIENT_ID=${client_id}`,
    "S.com.squareup.pos.API_VERSION=v2.0",
    `i.com.squareup.pos.TOTAL_AMOUNT=${amount_cents}`,
    `S.com.squareup.pos.CURRENCY_CODE=${currency}`,
    "S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD,com.squareup.pos.TENDER_CASH,com.squareup.pos.TENDER_OTHER",
    `S.com.squareup.pos.NOTE=${encodeURIComponent(notes || "")}`,
    `S.com.squareup.pos.REQUEST_METADATA=${encodeURIComponent(state)}`,
    "end",
  ];
  return parts.join(";");
}

/**
 * Parse Square POS callback query params from the Sales page URL.
 * iOS returns `data` (JSON). Android returns com.squareup.pos.* params.
 */
export function parseSquarePosCallback(searchParams) {
  const dataRaw = searchParams.get("data");
  if (dataRaw) {
    try {
      let parsed;
      try {
        parsed = JSON.parse(dataRaw);
      } catch {
        parsed = JSON.parse(decodeURIComponent(dataRaw));
      }
      const status =
        parsed.status === "ok" || parsed.status === "error"
          ? parsed.status
          : parsed.error_code
            ? "error"
            : parsed.transaction_id || parsed.client_transaction_id
              ? "ok"
              : "error";
      return {
        platform: "ios",
        state: parsed.state || null,
        status,
        transaction_id: parsed.transaction_id || null,
        client_transaction_id: parsed.client_transaction_id || null,
        error_code: parsed.error_code || null,
      };
    } catch {
      return null;
    }
  }

  const androidError = searchParams.get("com.squareup.pos.ERROR_CODE");
  const androidTx = searchParams.get("com.squareup.pos.SERVER_TRANSACTION_ID");
  const androidClientTx = searchParams.get("com.squareup.pos.CLIENT_TRANSACTION_ID");
  const androidState = searchParams.get("com.squareup.pos.REQUEST_METADATA");
  if (androidError || androidTx || androidClientTx || androidState) {
    return {
      platform: "android",
      state: androidState || null,
      status: androidError ? "error" : "ok",
      transaction_id: androidTx || null,
      client_transaction_id: androidClientTx || null,
      error_code: androidError || null,
    };
  }

  return null;
}
