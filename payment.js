import crypto from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, plan } = req.body || {};
  const KEY_ID     = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (action === "create-order") {
    const PRICES = { monthly: 9900, yearly: 69900 };
    const amount = PRICES[plan];
    if (!amount) return res.status(400).json({ error: "Invalid plan" });

    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    const rzp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ amount, currency: "INR", receipt: `rcpt_${Date.now()}` }),
    });
    if (!rzp.ok) return res.status(502).json({ error: "Razorpay order failed" });
    const order = await rzp.json();
    return res.status(200).json({ orderId: order.id, amount, keyId: KEY_ID });
  }

  if (action === "verify") {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (sign === razorpay_signature)
      return res.status(200).json({ verified: true });
    return res.status(400).json({ verified: false, error: "Signature mismatch" });
  }

  return res.status(400).json({ error: "Invalid action" });
}
