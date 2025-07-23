// chat.js
// Chatbox UI và logic gửi nhận với Gemini API

// --- UI setup ---
const chatBoxHtml = `
<div id="gpa-chatbox" style="position:fixed;bottom:32px;right:32px;z-index:9999;width:340px;max-width:95vw;display:none;">
  <div style="background:#2a5298;color:#fff;border-radius:12px 12px 0 0;font-weight:600;display:flex;align-items:center;height:44px;">
    <span style="margin-left:16px;flex:1 1 auto;white-space:nowrap;">GPAC Bot</span>
    <button id="gpa-chat-reset-btn" title="Reset chat" style="margin-right:16px;background:none;border:none;cursor:pointer;padding:0 4px;margin:0;line-height:1;display:flex;align-items:center;justify-content:center;width:28px;min-width:28px;max-width:28px;height:44px;"><i data-lucide="rotate-ccw" style="width:22px;height:22px;min-width:22px;max-width:22px;"></i></button>
    <button id="gpa-chat-min-btn" title="Thu nhỏ" style="background:none;border:none;cursor:pointer;padding:0 2px;margin:0 16px 0 0;line-height:1;display:flex;align-items:center;justify-content:center;width:28px;min-width:28px;max-width:28px;height:44px;"><i data-lucide="chevron-down" style="width:22px;height:22px;min-width:22px;max-width:22px;"></i></button>
  </div>
  <div id="gpa-chat-messages" style="background:#fff;height:260px;overflow-y:auto;padding:12px 10px 12px 10px;border:1px solid #b6c6e0;border-top:none;font-size:1em;"></div>
  <form id="gpa-chat-form" style="display:flex;flex-direction:row;align-items:center;border-radius:0 0 12px 12px;overflow:hidden;border:1px solid #b6c6e0;border-top:none;background:#f7fafd;gap:8px;">
    <input id="gpa-chat-input" type="text" placeholder="Ask your question here" style="flex:1;padding:8px 10px;border:none;font-size:1em;background:#f7fafd;outline:none;text-align:left;" autocomplete="off" />
    <button type="submit" style="background:#2a5298;color:#fff;border:none;padding:8px 22px;font-weight:600;cursor:pointer;font-size:1em;min-width:unset;height:40px;border-radius:0;">Send</button>
  </form>
</div>
<div id="gpa-chat-fab" style="position:fixed;bottom:42px;right:32px;z-index:9999;width:44px;height:44px;background:#fff;border-radius:50%;box-shadow:0 2px 8px rgba(42,82,152,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:box-shadow 0.2s;">
  <svg width="36" height="36" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="20" stroke="#2a5298" stroke-width="8" fill="none"/>
    <circle cx="24" cy="24" r="10" fill="#fff"/>
  </svg>
</div>
`;
document.body.insertAdjacentHTML('beforeend', chatBoxHtml);

// Load lucide icons
(function(){
  const lucideScript = document.createElement('script');
  lucideScript.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
  lucideScript.onload = () => { if(window.lucide) window.lucide.createIcons(); };
  document.body.appendChild(lucideScript);
})();

// Thêm CSS responsive để ẩn chatbox và nút fab trên màn hình nhỏ
const chatResponsiveStyle = document.createElement('style');
chatResponsiveStyle.innerHTML = `
@media (max-width: 500px) {
  #gpa-chatbox, #gpa-chat-fab { display: none !important; }
}`;
document.head.appendChild(chatResponsiveStyle);

const chatBox = document.getElementById('gpa-chatbox');
const chatFab = document.getElementById('gpa-chat-fab');
const chatMessages = document.getElementById('gpa-chat-messages');
chatMessages.style.textAlign = 'left';
const chatForm = document.getElementById('gpa-chat-form');
const chatInput = document.getElementById('gpa-chat-input');
const chatMinBtn = document.getElementById('gpa-chat-min-btn');
const chatResetBtn = document.getElementById('gpa-chat-reset-btn');

// --- Ẩn hiện chatbox ---
chatFab.onclick = () => {
  chatBox.style.display = 'block';
  chatFab.style.display = 'none';
  chatInput.focus();
};
chatMinBtn.onclick = () => {
  chatBox.style.display = 'none';
  chatFab.style.display = 'flex';
};

// --- Reset chat ---
chatResetBtn.onclick = () => {
  chatMessages.innerHTML = '';
};

function appendMessage(text, from) {
  const msg = document.createElement('div');
  msg.style.margin = '8px 0';
  msg.style.whiteSpace = 'pre-line';
  msg.innerHTML = `<span style="font-weight:${from==='user'?'500':'400'};color:${from==='user'?'#2a5298':'#222'};">${from==='user'?'Bạn':'Gemini'}:</span> ${text}`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Lấy bảng điểm hiện tại từ JS chính ---
function getCurrentGpaData() {
  if (window.currentSubjects && window.currentInfo) {
    return { info: window.currentInfo, subjects: window.currentSubjects };
  }
  return {};
}

// --- Xử lý lệnh chỉnh sửa điểm từ Gemini ---
function tryApplyEditCommand(text) {
  // Chỉ parse toàn bộ trả lời là JSON
  let obj = null;
  try {
    obj = JSON.parse(text);
    //console.log('Đã parse JSON:', obj);
  } catch (e) {
    //console.log('Lỗi parse JSON:', e);
    return false;
  }
  if (obj && obj.action === 'edit_score' && obj.subject_code && !isNaN(Number(obj.score_10)) && obj.letter) {
    //console.log('obj:', obj);
    //console.log('action:', obj && obj.action);
    //console.log('subject_code:', obj && obj.subject_code);
    //console.log('score_10:', obj && obj.score_10, 'isNaN:', isNaN(Number(obj && obj.score_10)));
    //console.log('letter:', obj && obj.letter);
    let found = false;
    if (window.currentSubjects) {
      //console.log('Danh sách mã môn:', window.currentSubjects.map(s => s.code));
      window.currentSubjects.forEach((s, i) => {
        if (s.code.trim().toLowerCase() === obj.subject_code.trim().toLowerCase()) {
          //console.log('Đã tìm thấy môn:', s.code, '-> Sửa thành:', obj.score_10, obj.letter);
          s.score_10 = obj.score_10;
          s.letter = obj.letter;
          found = true;
        }
      });
      if (found && typeof window.renderResult === 'function') {
        window.renderResult();
      }
      if (!found) {
        //console.log('Không tìm thấy môn cần sửa:', obj.subject_code);
      }
    }
    return found;
  }
  return false;
}

// --- Gửi và nhận với Gemini API ---
chatForm.onsubmit = async function(e) {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  appendMessage(msg, 'user');
  chatInput.value = '';
  chatInput.disabled = true;
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        gpa_data: getCurrentGpaData()
      })
    });
    const data = await res.json();
    let ok = false;
    if (data.reply) {
      let replyText = data.reply.trim();
      // Xử lý nếu Gemini trả về JSON bị gói trong markdown/code block
      if (replyText.startsWith('```json')) {
        replyText = replyText.replace(/^```json/, '').replace(/```$/, '').trim();
      }
      //console.log('Gemini trả về (sau khi loại markdown nếu có):', replyText);
      try {
        const obj = JSON.parse(replyText);
        //console.log('Đã parse JSON:', obj);
        if (Array.isArray(obj)) {
          // Nếu là mảng, lặp qua từng object
          let allOk = true;
          for (const o of obj) {
            if (!tryApplyEditCommand(JSON.stringify(o))) {
              allOk = false;
            }
          }
          if (allOk) {
            appendMessage('Đã cập nhật điểm theo yêu cầu!', 'gemini');
            ok = true;
          }
        } else if (obj && tryApplyEditCommand(JSON.stringify(obj))) {
          appendMessage('Đã cập nhật điểm theo yêu cầu!', 'gemini');
          ok = true;
        }
      } catch (e) {
        //console.log('Không parse được JSON từ Gemini:', replyText);
      }
    }
    if (!ok) {
      appendMessage('Có vấn đề trong quá trình xử lý.', 'gemini');
    }
  } catch (err) {
    appendMessage('Lỗi khi kết nối Gemini API.', 'gemini');
  }
  chatInput.disabled = false;
  chatInput.focus();
}; 