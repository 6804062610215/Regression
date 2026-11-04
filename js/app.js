// ===============================================================
//  ส่วนติดต่อผู้ใช้: อ่านข้อมูลจากฟอร์ม สร้างออบเจ็กต์ Regression
//  แล้วแสดงผลลัพธ์ ตาราง และกราฟ
// ===============================================================

const SAMPLES = {
  linear: "10, 2.2\n15, 4.6\n20, 4.2\n25, 7.0\n30, 6.6\n35, 9.2",
  polynomial: "0, 2.1\n1, 7.7\n2, 13.6\n3, 27.2\n4, 40.9\n5, 61.1",
  multiple: "0, 0, 1\n0, 1, 4\n1, 0, 3\n1, 2, 9\n2, 1, 8\n2, 2, 11",
};

/** แปลงข้อความในช่อง textarea เป็นแถวตัวเลข */
function parseRows(text, minColumns) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, i) => {
      const cells = line.split(/[\s,;\t]+/).filter(Boolean).map(Number);
      if (cells.some((v) => !Number.isFinite(v))) throw new Error(`บรรทัดที่ ${i + 1} มีค่าที่ไม่ใช่ตัวเลข: “${line}”`);
      return cells;
    });
  if (!rows.length) throw new Error("ยังไม่มีข้อมูล — กดปุ่มตัวอย่างหรือพิมพ์ข้อมูลก่อน");
  const width = rows[0].length;
  if (width < minColumns) throw new Error(`แต่ละบรรทัดต้องมีอย่างน้อย ${minColumns} ค่า`);
  if (rows.some((r) => r.length !== width)) throw new Error("ทุกบรรทัดต้องมีจำนวนคอลัมน์เท่ากัน");
  return rows;
}

const n6 = (v) => fmt(v, 6);
const cell = (v) => `<td>${typeof v === "number" ? n6(v) : v}</td>`;

function statBlock(label, value) {
  return `<div class="stat"><div class="k">${label}</div><div class="v">${value}</div></div>`;
}

function matrixBlock(model) {
  const A = model.normalMatrix, b = model.normalVector;
  const names = model.coefficients.map((_, j) => `a${sub(j)}`);
  const rows = (arr) => arr.map((r) => `<tr>${(Array.isArray(r) ? r : [r]).map((v) => `<td>${n6(v)}</td>`).join("")}</tr>`).join("");
  return `
    <h3>ระบบสมการปกติ (Normal Equations)</h3>
    <div class="matrix">
      <table>${rows(A)}</table>
      <table>${names.map((nm) => `<tr><td>${nm}</td></tr>`).join("")}</table>
      <span>=</span>
      <table>${rows(b)}</table>
    </div>`;
}

function residualTable(model, inputNames) {
  const head = ["i", ...inputNames, "y<sub>i</sub>", "g(x<sub>i</sub>)", "d(x<sub>i</sub>) = y<sub>i</sub> − g(x<sub>i</sub>)"];
  const body = model
    .residualRows()
    .map((r, i) => `<tr>${cell(i + 1)}${r.input.map(cell).join("")}${cell(r.y)}${cell(r.g)}${cell(r.d)}</tr>`)
    .join("");
  return `<h3>ค่าที่ประมาณได้และความคลาดเคลื่อน</h3>
    <div class="table-scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function summaryBlock(model) {
  return `
    <div class="equation">${model.toEquationString()}</div>
    <div class="summary">
      ${model.coefficients.map((a, j) => statBlock(`a${sub(j)}`, n6(a))).join("")}
      ${statBlock("E = Σ[yᵢ − g(xᵢ)]²", n6(model.sumOfSquaredErrors()))}
      ${statBlock("R²", fmt(model.rSquared(), 6))}
    </div>`;
}

function predictBlock(id, variableCount) {
  const inputs = Array.from({ length: variableCount }, (_, j) =>
    `<label>${variableCount === 1 ? "x" : "x" + sub(j + 1)} <input type="number" step="any" data-predict-input="${id}" value="1"></label>`
  ).join("");
  return `<h3>ทำนายค่าจากสมการ</h3>
    <div class="predict">${inputs}<button class="btn" data-predict="${id}">หาค่า g</button> <output id="${id}-predict"></output></div>`;
}

// ---------- ตาราง Σ ของ Linear ตามรูปแบบในเอกสาร ----------
function linearSumsTable(model) {
  const rows = model.inputs.map((r, i) => {
    const x = r[0], y = model.outputs[i];
    return `<tr>${cell(i + 1)}${cell(x)}${cell(y)}${cell(x * x)}${cell(x * y)}</tr>`;
  });
  const s = model.sums;
  return `<h3>ตารางผลรวม</h3>
    <div class="table-scroll"><table>
      <thead><tr><th>i</th><th>x<sub>i</sub></th><th>y<sub>i</sub></th><th>x<sub>i</sub>²</th><th>x<sub>i</sub>y<sub>i</sub></th></tr></thead>
      <tbody>${rows.join("")}<tr class="sum"><td>Σ</td>${cell(s.x)}${cell(s.y)}${cell(s.x2)}${cell(s.xy)}</tr></tbody>
    </table></div>`;
}

// ===============================================================
//  Controller ของแต่ละแท็บ — ใช้ร่วมกันผ่านการกำหนด config
// ===============================================================
class RegressionPanel {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.textarea = document.getElementById(`${id}-data`);
    this.resultEl = document.getElementById(`${id}-result`);
    this.chart = new ScatterChart(document.getElementById(`${id}-chart`), config.axes);
    this.model = null;
  }

  loadSample() {
    this.textarea.value = SAMPLES[this.id];
    this.run();
  }

  clear() {
    this.textarea.value = "";
    this.resultEl.innerHTML = "";
    this.model = null;
    this.chart.setData([], null);
  }

  run() {
    try {
      const rows = parseRows(this.textarea.value, 2);
      const inputs = rows.map((r) => r.slice(0, -1));
      const outputs = rows.map((r) => r[r.length - 1]);
      if (this.config.singleVariable && inputs[0].length !== 1) {
        throw new Error("แท็บนี้รับข้อมูล 2 คอลัมน์ (x, y) — ถ้ามีหลายตัวแปรให้ใช้แท็บ Multiple Linear");
      }
      this.model = this.config.createModel().fit(inputs, outputs); // polymorphism: fit() เดียวกันทุกคลาส
      this.render();
    } catch (err) {
      this.model = null;
      this.resultEl.innerHTML = `<div class="error">${err.message}</div>`;
      this.chart.setData([], null);
    }
  }

  render() {
    const m = this.model;
    const k = m.inputs[0].length;
    const inputNames = k === 1 ? ["x<sub>i</sub>"] : Array.from({ length: k }, (_, j) => `x<sub>${j + 1}i</sub>`);
    this.resultEl.innerHTML =
      summaryBlock(m) +
      (this.config.extra ? this.config.extra(m) : "") +
      matrixBlock(m) +
      residualTable(m, inputNames) +
      predictBlock(this.id, k);

    if (k === 1) {
      this.chart.setData(
        m.inputs.map((r, i) => ({ x: r[0], y: m.outputs[i] })),
        (x) => m.predict([x]),
        { curveLabel: "g(x)" }
      );
    } else {
      // หลายตัวแปร: เทียบค่าจริงกับค่าประมาณ เส้น y = x คือการพอดีสมบูรณ์
      this.chart.setData(
        m.outputs.map((y, i) => ({ x: m.predict(m.inputs[i]), y })),
        (x) => x,
        { curveLabel: "y = g" }
      );
    }
  }

  predict() {
    if (!this.model) return;
    const values = [...document.querySelectorAll(`[data-predict-input="${this.id}"]`)].map((el) => Number(el.value));
    document.getElementById(`${this.id}-predict`).textContent = `g = ${n6(this.model.predict(values))}`;
  }
}

const panels = {
  linear: new RegressionPanel("linear", {
    singleVariable: true,
    createModel: () => new LinearRegression(),
    extra: linearSumsTable,
    axes: { xLabel: "x", yLabel: "y" },
  }),
  polynomial: new RegressionPanel("polynomial", {
    singleVariable: true,
    createModel: () => new PolynomialRegression(Number(document.getElementById("polynomial-order").value)),
    axes: { xLabel: "x", yLabel: "y" },
  }),
  multiple: new RegressionPanel("multiple", {
    createModel: () => new MultipleLinearRegression(),
    axes: { xLabel: "ค่าประมาณ g", yLabel: "ค่าจริง y" },
  }),
};

// ---------- ผูกเหตุการณ์ปุ่ม ----------
document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.tab) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === t));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${t.dataset.tab}`));
    panels[t.dataset.tab].chart.draw();
  }
  if (t.dataset.run) panels[t.dataset.run].run();
  if (t.dataset.sample) panels[t.dataset.sample].loadSample();
  if (t.dataset.clear) panels[t.dataset.clear].clear();
  if (t.dataset.predict) panels[t.dataset.predict].predict();
});

document.getElementById("polynomial-order").addEventListener("change", () => {
  if (panels.polynomial.model) panels.polynomial.run();
});

// เริ่มต้นด้วยข้อมูลตัวอย่างทุกแท็บ และเปิดแท็บตาม #hash ใน URL (เช่น #polynomial)
Object.values(panels).forEach((p) => p.loadSample());
const startTab = location.hash.slice(1);
if (panels[startTab]) document.querySelector(`.tab[data-tab="${startTab}"]`).click();
