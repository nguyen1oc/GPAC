from flask import Flask, render_template, request
import re
import json

app = Flask(__name__)

# GPA parsing and calculation logic (adapted from calculate_gpa.py)
def parse_gpa_text(text):
    letter_to_4 = {
        'A+': 4.0,
        'A': 4.0,
        'B+': 3.5,
        'B': 3.0,
        'C+': 2.5,
        'C': 2.0,
        'D+': 1.5,
        'D': 1.0,
        'F': 0.0
    }
    # Extract student info
    name = re.search(r'Họ và tên:\s*(.+)', text)
    mssv = re.search(r'Mã sinh viên:\s*(\d+)', text)
    major = re.search(r'Ngành:\s*(.+)', text)
    class_ = re.search(r'Mã lớp:\s*(\w+)', text)
    info = {
        'name': name.group(1).strip() if name else '',
        'mssv': mssv.group(1).strip() if mssv else '',
        'major': major.group(1).strip() if major else '',
        'class': class_.group(1).strip() if class_ else ''
    }
    # Extract subjects
    subjects = []
    for line in text.splitlines():
        if not re.search(r'\b[A-Z]{2}\d{4,}\b', line):
            continue
        parts = re.split(r'\t+|\s{2,}', line.strip())
        if len(parts) < 6:
            continue
        try:
            score_10 = float(parts[3]) if parts[3] != '--' else None
        except Exception:
            score_10 = None
        letter = parts[4]
        try:
            credits = int(parts[5])
        except Exception:
            credits = 0
        subjects.append({
            'code': parts[1],
            'name': parts[2],
            'score_10': score_10,
            'letter': letter,
            'credits': credits
        })
    return info, subjects, letter_to_4

def calculate_gpa(subjects, letter_to_4):
    total_4 = 0.0
    total_credits_4 = 0
    total_10 = 0.0
    total_credits_10 = 0
    total_credits = 0
    for subj in subjects:
        code = subj.get('code', '')
        credits = subj['credits']
        score_10 = subj['score_10']
        letter = subj['letter']
        # Điều kiện hợp lệ cho tín chỉ tích lũy
        valid_10 = score_10 is not None and isinstance(score_10, (int, float))
        valid_4 = letter in letter_to_4
        is_english = code.startswith('LA')
        count_credit = False
        if credits > 0:
            if is_english:
                # Chỉ tính tín chỉ nếu: (1) hợp lệ cả thang 4 và 10 và điểm chữ khác F, hoặc (2) điểm 10 là 12 và điểm chữ rỗng/--
                if ((valid_10 and valid_4 and letter != 'F') or (score_10 == 12 and (not letter or letter == '--'))):
                    count_credit = True
            else:
                if valid_10 and valid_4 and letter != 'F':
                    count_credit = True
        if count_credit:
            total_credits += credits
        # GPA thang 4
        if valid_4 and credits > 0:
            total_4 += letter_to_4[letter] * credits
            total_credits_4 += credits
        # GPA thang 10 (trừ môn Anh Văn)
        if valid_10 and credits > 0 and not is_english:
            total_10 += score_10 * credits
            total_credits_10 += credits
    gpa_4 = total_4 / total_credits_4 if total_credits_4 > 0 else 0
    gpa_10 = total_10 / total_credits_10 if total_credits_10 > 0 else 0
    return gpa_4, gpa_10, total_credits

@app.route('/', methods=['GET', 'POST'])
def index():
    gpa_text = ''
    info = None
    subjects = []
    gpa_4 = gpa_10 = total_credits = 0
    if request.method == 'POST':
        gpa_text = request.form.get('gpa_text', '')
        subjects_json = request.form.get('subjects_json')
        if subjects_json:
            # Parse subjects from JSON (user edited)
            try:
                subjects = json.loads(subjects_json)
                # Convert score_10 and credits to float/int
                for s in subjects:
                    try:
                        s['score_10'] = float(s['score_10']) if s['score_10'] != '' else None
                    except Exception:
                        s['score_10'] = None
                    try:
                        s['credits'] = int(s['credits'])
                    except Exception:
                        s['credits'] = 0
                # Use info from text (not editable)
                info, _, letter_to_4 = parse_gpa_text(gpa_text)
            except Exception:
                subjects = []
                info, subjects, letter_to_4 = parse_gpa_text(gpa_text)
        else:
            info, subjects, letter_to_4 = parse_gpa_text(gpa_text)
        gpa_4, gpa_10, total_credits = calculate_gpa(subjects, letter_to_4)
    return render_template('index.html', gpa_text=gpa_text, info=info, subjects=subjects, gpa_4=gpa_4, gpa_10=gpa_10, total_credits=total_credits)

if __name__ == '__main__':
    app.run(debug=True) 