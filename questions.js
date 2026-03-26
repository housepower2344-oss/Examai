export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const CATS = {
    ssc:"SSC CGL/CHSL exam", banking:"Banking IBPS/SBI/RBI exam",
    railway:"Railway RRB NTPC exam", upsc:"UPSC Civil Services exam",
    gk:"General Knowledge and Current Affairs", math:"Quantitative Aptitude arithmetic",
    english:"English Grammar and Vocabulary", reasoning:"Logical and Verbal Reasoning"
  };

  const { category, lang = "en", count = 5 } = req.body || {};
  if (!category || !CATS[category]) return res.status(400).json({ error: "Invalid category" });

  const isHindi = lang === "hi";
  const prompt = `Generate ${Math.min(count, 10)} multiple choice questions for Indian government exam topic: ${CATS[category]}.
${isHindi ? "Write ALL questions and options in Hindi language." : "Write in English."}
Respond ONLY with valid JSON array, no markdown:
[{"q":"question text","opts":["A) option1","B) option2","C) option3","D) option4"],"ans":"A","exp":"short explanation"}]`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "AI unavailable" });
    const data = await r.json();
    const text = data.content?.[0]?.text || "[]";
    const questions = JSON.parse(text.replace(/```json|```/g, "").trim());
    return res.status(200).json({ questions });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
