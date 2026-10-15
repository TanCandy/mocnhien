/**
 * VietQR (NAPAS 247) payload builder — EMVCo merchant-presented QR format.
 *
 * Every Vietnamese banking app can scan these. A *dynamic* QR (with amount
 * and transfer content) pre-fills the transfer so the customer cannot mistype
 * the order code, which is what lets the bank webhook reconcile it.
 *
 * Reference vector: the static QR printed by MSB for account 80002725995
 * (public/QR/vietqr-msb.jpg) is reproduced byte-for-byte by
 * buildVietQRPayload({ bankBin: "970426", accountNumber: "80002725995" }).
 */

function tlv(id, value) {
  const v = String(value);
  return id + String(v.length).padStart(2, "0") + v;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMVCo. */
function crc16(str) {
  let crc = 0xffff;
  const bytes = Buffer.from(str, "utf8");
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Transfer content must survive every bank's sanitiser: ASCII letters,
 * digits and spaces only, max 25 chars (the common lowest limit).
 */
function sanitizeDescription(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

/**
 * @param {object} opts
 * @param {string} opts.bankBin        NAPAS bank BIN, e.g. "970426" (MSB)
 * @param {string} opts.accountNumber  receiving account number
 * @param {number} [opts.amount]       VND, integer; omitted/0 ⇒ static QR
 * @param {string} [opts.description]  transfer content (sanitised)
 */
function buildVietQRPayload({ bankBin, accountNumber, amount, description }) {
  if (!/^\d{6}$/.test(String(bankBin))) throw new Error("bankBin must be a 6-digit NAPAS BIN");
  if (!/^[0-9A-Za-z]{1,19}$/.test(String(accountNumber))) throw new Error("invalid accountNumber");

  const amt = Math.round(Number(amount) || 0);
  const desc = sanitizeDescription(description);
  const dynamic = amt > 0 || desc.length > 0;

  const beneficiary = tlv("00", bankBin) + tlv("01", accountNumber);
  const merchantInfo =
    tlv("00", "A000000727") + // NAPAS AID
    tlv("01", beneficiary) +
    tlv("02", "QRIBFTTA"); // service: transfer to account

  let payload =
    tlv("00", "01") +
    tlv("01", dynamic ? "12" : "11") +
    tlv("38", merchantInfo) +
    tlv("53", "704"); // VND
  if (amt > 0) payload += tlv("54", String(amt));
  payload += tlv("58", "VN");
  if (desc) payload += tlv("62", tlv("08", desc));
  payload += "6304";
  return payload + crc16(payload);
}

module.exports = { buildVietQRPayload, crc16, sanitizeDescription };
