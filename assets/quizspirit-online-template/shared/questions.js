export const generateMathProblem = (difficulty = 'medium', type = 'attack') => {
  let question = '';
  let answer = 0;
  let options = [];

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  if (difficulty === 'easy') {
    // 基礎加減法 (1~30)
    const op = Math.random() > 0.4 ? '+' : '-';
    if (op === '+') {
      const a = rand(3, 30);
      const b = rand(3, 30);
      question = `${a} + ${b}`;
      answer = a + b;
    } else {
      const a = rand(15, 60);
      const b = rand(2, a - 1);
      question = `${a} - ${b}`;
      answer = a - b;
    }
  } else if (difficulty === 'medium') {
    // 乘除法與雙位數運算
    const mode = rand(1, 3);
    if (mode === 1) {
      // 九九乘法表或二位數乘法
      const a = rand(3, 12);
      const b = rand(3, 12);
      question = `${a} × ${b}`;
      answer = a * b;
    } else if (mode === 2) {
      // 整除法
      const b = rand(3, 9);
      const ans = rand(3, 12);
      const a = b * ans;
      question = `${a} ÷ ${b}`;
      answer = ans;
    } else {
      // 兩位數混合運算
      const a = rand(20, 80);
      const b = rand(15, 60);
      question = `${a} + ${b}`;
      answer = a + b;
    }
  } else if (difficulty === 'hard') {
    // 混合四則運算 (先乘除後加減 / 括號)
    const mode = rand(1, 3);
    if (mode === 1) {
      const a = rand(3, 9);
      const b = rand(3, 8);
      const c = rand(5, 30);
      question = `${a} × ${b} + ${c}`;
      answer = (a * b) + c;
    } else if (mode === 2) {
      const a = rand(30, 80);
      const b = rand(2, 6);
      const c = rand(2, 6);
      question = `${a} - ${b} × ${c}`;
      answer = a - (b * c);
    } else {
      const a = rand(4, 12);
      const b = rand(3, 8);
      const c = rand(2, 5);
      question = `(${a} + ${b}) × ${c}`;
      answer = (a + b) * c;
    }
  } else {
    // 大師級 (Champion)：代數方程式或快速連續運算
    const x = rand(3, 20);
    const m = rand(2, 7);
    const c = rand(4, 25);
    const total = m * x + c;
    question = `${m}x + ${c} = ${total}，求 x = ?`;
    answer = x;
  }

  // 產生 4 個不重複的干擾選項
  const optSet = new Set([answer]);
  while (optSet.size < 4) {
    const delta = rand(-12, 12);
    const wrong = answer + delta;
    if (wrong !== answer && wrong >= 0) {
      optSet.add(wrong);
    } else {
      optSet.add(answer + rand(1, 15) * (Math.random() > 0.5 ? 1 : -1));
    }
  }
  options = Array.from(optSet).sort(() => Math.random() - 0.5);

  return { question, answer, options };
};
