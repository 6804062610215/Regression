// ===============================================================
//  ScatterChart — วาดกราฟจุดข้อมูลและเส้นโค้งบน <canvas>
// ===============================================================
class ScatterChart {
  constructor(canvas, { xLabel = "x", yLabel = "y" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.xLabel = xLabel;
    this.yLabel = yLabel;
    this.points = [];
    this.curve = null; // ฟังก์ชัน x => y
    this.padding = { top: 18, right: 20, bottom: 46, left: 56 };
    window.addEventListener("resize", () => this.draw());
  }

  setData(points, curve, labels = {}) {
    this.points = points;
    this.curve = curve;
    Object.assign(this, labels);
    this.draw();
  }

  /** หาช่วงค่าแกนพร้อมเว้นขอบ และปัดเป็นตัวเลขสวย ๆ */
  static niceRange(min, max) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step = ScatterChart.niceStep(span / 5);
    return { min: Math.floor((min - span * 0.05) / step) * step, max: Math.ceil((max + span * 0.05) / step) * step, step };
  }

  static niceStep(raw) {
    const p = 10 ** Math.floor(Math.log10(raw));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  draw() {
    const { canvas, ctx, padding: pad } = this;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(document.documentElement);
    const color = (name) => css.getPropertyValue(name).trim();
    ctx.font = "13px Sarabun, sans-serif";

    if (!this.points.length) {
      ctx.fillStyle = color("--muted");
      ctx.textAlign = "center";
      ctx.fillText("ใส่ข้อมูลแล้วกด “คำนวณ” เพื่อแสดงกราฟ", w / 2, h / 2);
      return;
    }

    const xs = this.points.map((p) => p.x);
    let ys = this.points.map((p) => p.y);
    const xr0 = ScatterChart.niceRange(Math.min(...xs), Math.max(...xs));
    if (this.curve) {
      for (let i = 0; i <= 60; i++) {
        const v = this.curve(xr0.min + ((xr0.max - xr0.min) * i) / 60);
        if (Number.isFinite(v)) ys.push(v);
      }
      // ไม่ให้ปลายพหุนามดึงแกน y ไกลเกินข้อมูลจริง
      const dy = Math.max(...this.points.map((p) => p.y)) - Math.min(...this.points.map((p) => p.y)) || 1;
      const lo = Math.min(...this.points.map((p) => p.y)) - dy, hi = Math.max(...this.points.map((p) => p.y)) + dy;
      ys = ys.map((v) => Math.min(hi, Math.max(lo, v)));
    }
    const xr = xr0, yr = ScatterChart.niceRange(Math.min(...ys), Math.max(...ys));
    const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
    const sx = (x) => pad.left + ((x - xr.min) / (xr.max - xr.min)) * plotW;
    const sy = (y) => pad.top + plotH - ((y - yr.min) / (yr.max - yr.min)) * plotH;

    // เส้นตาราง + ตัวเลขแกน
    ctx.strokeStyle = color("--line");
    ctx.fillStyle = color("--muted");
    ctx.lineWidth = 1;
    ctx.textAlign = "center";
    for (let x = xr.min; x <= xr.max + 1e-9; x += xr.step) {
      ctx.beginPath(); ctx.moveTo(sx(x), pad.top); ctx.lineTo(sx(x), pad.top + plotH); ctx.stroke();
      ctx.fillText(+x.toFixed(6), sx(x), pad.top + plotH + 18);
    }
    ctx.textAlign = "right";
    for (let y = yr.min; y <= yr.max + 1e-9; y += yr.step) {
      ctx.beginPath(); ctx.moveTo(pad.left, sy(y)); ctx.lineTo(pad.left + plotW, sy(y)); ctx.stroke();
      ctx.fillText(+y.toFixed(6), pad.left - 8, sy(y) + 4);
    }

    // ชื่อแกน
    ctx.fillStyle = color("--ink");
    ctx.textAlign = "center";
    ctx.fillText(this.xLabel, pad.left + plotW / 2, h - 8);
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(this.yLabel, 0, 0);
    ctx.restore();

    // เส้นโค้งที่ได้จากการถดถอย
    if (this.curve) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.left, pad.top, plotW, plotH);
      ctx.clip();
      ctx.strokeStyle = color("--fit");
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const steps = 240;
      for (let i = 0; i <= steps; i++) {
        const x = xr.min + ((xr.max - xr.min) * i) / steps;
        const y = this.curve(x);
        i === 0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y));
      }
      ctx.stroke();
      ctx.restore();
    }

    // จุดข้อมูล
    ctx.fillStyle = color("--data");
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    for (const p of this.points) {
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // คำอธิบายสัญลักษณ์
    ctx.textAlign = "left";
    const lx = pad.left + 12, ly = pad.top + 14;
    ctx.fillStyle = color("--data");
    ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color("--ink");
    ctx.fillText("ข้อมูล", lx + 10, ly + 4);
    if (this.curve) {
      ctx.strokeStyle = color("--fit"); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(lx + 56, ly); ctx.lineTo(lx + 78, ly); ctx.stroke();
      ctx.fillText(this.curveLabel || "g(x)", lx + 84, ly + 4);
    }
  }
}
