// /api/gemini.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { message, gpa_data } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing Gemini API key' });
    return;
  }
  try {
    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [
            { text: `Bảng điểm:\n${JSON.stringify(gpa_data)}

Yêu cầu của người dùng: "${message}"

Nếu người dùng yêu cầu sửa điểm, trả về JSON thuần dạng sau:
{"action":"edit_score","subject_code":"<Mã môn>","score_10":<điểm số>,"letter":"<điểm chữ>"}
Nếu người dùng yêu cầu sửa nhiều môn, trả về một mảng object JSON hợp lệ, ví dụ: [{"action":"edit_score","subject_code":"CO1007","score_10":8,"letter":"B+"}, ...].
Nếu KHÔNG phải yêu cầu sửa điểm, hãy trả lời tự nhiên bằng tiếng Việt, KHÔNG trả về JSON, KHÔNG trả về mảng rỗng, KHÔNG markdown.
` }
          ] }
        ]
      })
    });
    const data = await geminiRes.json();
    //console.log('Gemini raw response:', JSON.stringify(data, null, 2));
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      res.status(200).json({ reply: 'Không nhận được phản hồi hợp lệ từ Gemini.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Gemini API error', detail: err.message });
  }
} 
