// ===============================================================
//  Least-Squares Regression — คลาสสำหรับการคำนวณ
//  Regression (คลาสแม่)  ->  LinearRegression
//                         ->  PolynomialRegression
//                         ->  MultipleLinearRegression
// ===============================================================

/** แก้ระบบสมการเชิงเส้น A·a = b ด้วย Gaussian Elimination (partial pivoting) */
class LinearSystemSolver {
  static solve(matrix, vector) {
    const n = vector.length;
    // สร้าง augmented matrix [A | b] แบบคัดลอก เพื่อไม่แก้ข้อมูลต้นฉบับ
    const m = matrix.map((row, i) => [...row, vector[i]]);

    for (let col = 0; col < n; col++) {
      // เลือกแถวที่ค่าสัมบูรณ์มากที่สุดเป็น pivot
      let pivot = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
      }
      if (Math.abs(m[pivot][col]) < 1e-12) {
        throw new Error("ระบบสมการไม่มีคำตอบเดียว (เมทริกซ์เป็น singular) — ลองเพิ่มข้อมูลหรือลดอันดับพหุนาม");
      }
      [m[col], m[pivot]] = [m[pivot], m[col]];

      // กำจัดตัวแปรในแถวด้านล่าง
      for (let r = col + 1; r < n; r++) {
        const factor = m[r][col] / m[col][col];
        for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
      }
    }

    // แทนค่าย้อนกลับ (back substitution)
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let sum = m[r][n];
      for (let c = r + 1; c < n; c++) sum -= m[r][c] * x[c];
      x[r] = sum / m[r][r];
    }
    return x;
  }
}

/** คลาสแม่ของการถดถอยทุกแบบ */
class Regression {
  constructor(name) {
    if (new.target === Regression) {
      throw new Error("Regression เป็นคลาสนามธรรม ให้สร้างจากคลาสลูกแทน");
    }
    this.name = name;
    this.coefficients = [];
    this.inputs = [];   // แต่ละแถวคือ array ของตัวแปรอิสระ
    this.outputs = [];  // ค่า y
  }

  /** คลาสลูกต้อง override: คืน { matrix, vector } ของสมการปกติ (normal equations) */
  buildNormalEquations() {
    throw new Error("คลาสลูกต้องเขียนเมธอด buildNormalEquations()");
  }

  /** คลาสลูกต้อง override: คำนวณ g(x) จากแถวข้อมูลหนึ่งแถว */
  predict(_input) {
    throw new Error("คลาสลูกต้องเขียนเมธอด predict()");
  }

  /** คลาสลูกต้อง override: แสดงสมการที่ได้เป็นข้อความ */
  toEquationString() {
    throw new Error("คลาสลูกต้องเขียนเมธอด toEquationString()");
  }

  /** ขั้นตอนร่วมของทุกคลาส: สร้างสมการปกติแล้วแก้หาค่าสัมประสิทธิ์ */
  fit(inputs, outputs) {
    if (inputs.length !== outputs.length) throw new Error("จำนวนข้อมูล x และ y ไม่เท่ากัน");
    this.inputs = inputs;
    this.outputs = outputs;
    const { matrix, vector } = this.buildNormalEquations();
    if (inputs.length < vector.length) {
      throw new Error(`ต้องมีข้อมูลอย่างน้อย ${vector.length} จุด สำหรับการถดถอยแบบนี้`);
    }
    this.normalMatrix = matrix;
    this.normalVector = vector;
    this.coefficients = this.solveCoefficients(matrix, vector);
    return this;
  }

  /** ค่าเริ่มต้นใช้ Gaussian Elimination — คลาสลูกเปลี่ยนวิธีได้ */
  solveCoefficients(matrix, vector) {
    return LinearSystemSolver.solve(matrix, vector);
  }

  /** E = Σ [y_i − g(x_i)]² */
  sumOfSquaredErrors() {
    return this.outputs.reduce((sum, y, i) => sum + (y - this.predict(this.inputs[i])) ** 2, 0);
  }

  /** สัมประสิทธิ์การตัดสินใจ R² */
  rSquared() {
    const mean = this.outputs.reduce((s, y) => s + y, 0) / this.outputs.length;
    const total = this.outputs.reduce((s, y) => s + (y - mean) ** 2, 0);
    return total === 0 ? 1 : 1 - this.sumOfSquaredErrors() / total;
  }

  /** ตารางค่าแต่ละจุด: ค่าจริง ค่าที่ประมาณได้ และความคลาดเคลื่อน d(x_i) */
  residualRows() {
    return this.outputs.map((y, i) => {
      const g = this.predict(this.inputs[i]);
      return { input: this.inputs[i], y, g, d: y - g };
    });
  }
}

/** การถดถอยเชิงเส้น g(x) = a0 + a1·x — ใช้กฎของคราเมอร์ตามเอกสาร */
class LinearRegression extends Regression {
  constructor() {
    super("Linear Regression");
  }

  get sums() {
    const xs = this.inputs.map((r) => r[0]);
    const ys = this.outputs;
    return {
      n: xs.length,
      x: xs.reduce((s, v) => s + v, 0),
      y: ys.reduce((s, v) => s + v, 0),
      x2: xs.reduce((s, v) => s + v * v, 0),
      xy: xs.reduce((s, v, i) => s + v * ys[i], 0),
    };
  }

  buildNormalEquations() {
    const s = this.sums;
    return {
      matrix: [
        [s.n, s.x],
        [s.x, s.x2],
      ],
      vector: [s.y, s.xy],
    };
  }

  // Override: ใช้สูตรคราเมอร์แทน Gaussian Elimination
  solveCoefficients() {
    const s = this.sums;
    const det = s.n * s.x2 - s.x ** 2;
    if (Math.abs(det) < 1e-12) throw new Error("ค่า x ทุกตัวเท่ากัน ไม่สามารถลากเส้นตรงได้");
    const a0 = (s.y * s.x2 - s.xy * s.x) / det;
    const a1 = (s.n * s.xy - s.x * s.y) / det;
    return [a0, a1];
  }

  predict(input) {
    const x = Array.isArray(input) ? input[0] : input;
    return this.coefficients[0] + this.coefficients[1] * x;
  }

  toEquationString() {
    const [a0, a1] = this.coefficients;
    return `g(x) = ${fmt(a0)} ${sign(a1)} ${fmt(Math.abs(a1))}x`;
  }
}

/** การถดถอยพหุนามอันดับ m: g(x) = a0 + a1x + ... + am·x^m */
class PolynomialRegression extends Regression {
  constructor(order = 2) {
    super("Polynomial Regression");
    this.order = order;
  }

  buildNormalEquations() {
    const m = this.order;
    const xs = this.inputs.map((r) => r[0]);
    const ys = this.outputs;
    // powerSum[k] = Σ x_i^k สำหรับ k = 0..2m
    const powerSum = Array.from({ length: 2 * m + 1 }, (_, k) => xs.reduce((s, x) => s + x ** k, 0));
    const matrix = Array.from({ length: m + 1 }, (_, r) =>
      Array.from({ length: m + 1 }, (_, c) => powerSum[r + c])
    );
    const vector = Array.from({ length: m + 1 }, (_, r) => xs.reduce((s, x, i) => s + x ** r * ys[i], 0));
    return { matrix, vector };
  }

  predict(input) {
    const x = Array.isArray(input) ? input[0] : input;
    return this.coefficients.reduce((s, a, k) => s + a * x ** k, 0);
  }

  toEquationString() {
    return "g(x) = " + termsToString(this.coefficients, (k) => (k === 0 ? "" : k === 1 ? "x" : `x^${k}`));
  }
}

/** การถดถอยเชิงเส้นหลายตัวแปร: g = a0 + a1x1 + ... + ak·xk */
class MultipleLinearRegression extends Regression {
  constructor() {
    super("Multiple Linear Regression");
  }

  get variableCount() {
    return this.inputs[0]?.length ?? 0;
  }

  buildNormalEquations() {
    const k = this.variableCount;
    // เติม 1 หน้าแต่ละแถว: [1, x1, x2, ..., xk]
    const rows = this.inputs.map((r) => [1, ...r]);
    const matrix = Array.from({ length: k + 1 }, (_, a) =>
      Array.from({ length: k + 1 }, (_, b) => rows.reduce((s, r) => s + r[a] * r[b], 0))
    );
    const vector = Array.from({ length: k + 1 }, (_, a) => rows.reduce((s, r, i) => s + r[a] * this.outputs[i], 0));
    return { matrix, vector };
  }

  predict(input) {
    return this.coefficients.reduce((s, a, j) => s + a * (j === 0 ? 1 : input[j - 1]), 0);
  }

  toEquationString() {
    return "g = " + termsToString(this.coefficients, (j) => (j === 0 ? "" : `x${sub(j)}`));
  }
}

// ---------- ฟังก์ชันช่วยจัดรูปแบบตัวเลข ----------
function fmt(v, digits = 6) {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) < 1e-10) v = 0;
  return parseFloat(v.toFixed(digits)).toString();
}

function sign(v) {
  return v < 0 ? "−" : "+";
}

function sub(n) {
  return String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d]);
}

function termsToString(coefs, varName) {
  return coefs
    .map((a, k) => {
      const body = `${fmt(Math.abs(a))}${varName(k)}`;
      if (k === 0) return (a < 0 ? "−" : "") + body;
      return `${sign(a)} ${body}`;
    })
    .join(" ");
}
