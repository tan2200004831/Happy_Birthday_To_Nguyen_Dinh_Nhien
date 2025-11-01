function createIcon() {
  const icon = document.createElement("div");
  icon.classList.add("floating-icon");

  const emojis = [
    "❤️",
    "🌸",
    "🎉",
    "⭐",
    "💖",
    "🎊",
    "🎁",
    "🥳",
    "🧁",
    "🍰",
    "🍭",
    "🍬",
    "🎀",
    "🎂",
    "🕯️",
  ];

  icon.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];

  icon.style.left = Math.random() * 100 + "vw";
  icon.style.animationDuration = Math.random() * 4 + 3 + "s";

  document.body.appendChild(icon);

  setTimeout(() => {
    icon.remove();
  }, 5000);
}

setInterval(createIcon, 300);

/*
================================================================================= 
Chuyển hướng sang index2.html
*/

document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector(".password-box");
  const buttons = document.querySelectorAll(".keypad button");
  const notifyBox = document.getElementById("notify");
  const CORRECT_PASSWORD = "31102004"; // <-- thay thành mật khẩu bạn muốn

  // Hàm hiển thị thông báo (màu tuỳ chọn)
  function showNotify(msg, color = "white") {
    if (!notifyBox) return; // nếu ko có thẻ notify thì thôi
    notifyBox.innerText = msg;
    notifyBox.style.color = color;
    notifyBox.style.display = "block";

    // ẩn sau 3.2s
    setTimeout(() => {
      notifyBox.style.display = "none";
    }, 3200);
  }

  // hiệu ứng sai: shake + thông báo
  function showWrong() {
    input.classList.add("wrong");
    setTimeout(() => input.classList.remove("wrong"), 600);
    input.value = "";
    showNotify("❌ Sai rầuuu, thử lại ngheee!", "red");
  }

  // kiểm tra mật khẩu
  function checkPassword() {
    const val = input.value.trim();
    if (val === CORRECT_PASSWORD) {
      showNotify("✅ Yeahhh đúng rầu 🥳!", "green");
      // chuyển trang sau 900ms để user thấy thông báo
      setTimeout(() => {
        window.location.href = "index2.html";
      }, 900);
    } else {
      showWrong();
    }
  }

  // Thêm chức năng cho mỗi nút keypad
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.textContent.trim();

      if (text === "Xóa" || text === "Xoa" || text === "XOA") {
        // xóa 1 ký tự cuối
        input.value = input.value.slice(0, -1);
      } else if (text.toLowerCase() === "ok") {
        checkPassword();
      } else {
        // nút số
        // đảm bảo không vượt maxlength nếu có
        const max = input.getAttribute("maxlength");
        if (!max || input.value.length < Number(max)) {
          input.value += text;
        }
      }
    });
  });

  // Nhấn Enter để OK
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      checkPassword();
    }
  });
});

/*
================================================================================= 
Gấu bắn trái tim
*/
// ----------------- CẤU HÌNH (tùy chỉnh) -----------------
const heartSize = 18;
const spacing = 3;
const gridStep = heartSize + spacing;
const borderMargin = Math.max(8, Math.floor(heartSize * 0.6));
const r = 8; // bán kính tham số
let heartPositions = [];

function generateHeartPositions() {
  heartPositions = [];
  const box = document.querySelector(".left-box");
  const ox = box.offsetWidth / 2;
  const oy = box.offsetHeight / 2;

  // 1) Viền
  const borderPoints = [];
  let lastX = null,
    lastY = null;
  for (let angle = 0; angle < Math.PI * 2; angle += 0.14) {
    const x = r * 16 * Math.pow(Math.sin(angle), 3);
    const y =
      -r *
      (13 * Math.cos(angle) -
        5 * Math.cos(2 * angle) -
        2 * Math.cos(3 * angle) -
        Math.cos(4 * angle));
    const px = ox + x;
    const py = oy + y;
    if (lastX === null || Math.hypot(px - lastX, py - lastY) > 8) {
      borderPoints.push([px, py]);
      lastX = px;
      lastY = py;
    }
  }

  // lọc trùng
  const filtered = [];
  let last = null;
  borderPoints.forEach(([x, y]) => {
    if (!last || Math.hypot(x - last[0], y - last[1]) > 20) {
      filtered.push([x, y]);
      last = [x, y];
    }
  });
  if (filtered.length > 1) {
    const [fx, fy] = filtered[0];
    const [lx, ly] = filtered[filtered.length - 1];
    if (Math.hypot(lx - fx, ly - fy) < 20) filtered.pop();
  }

  heartPositions.push(...filtered);

  // 2) Ứng viên bên trong
  const candidates = [];
  for (let gy = -r * 10; gy <= r * 10; gy += gridStep) {
    for (let gx = -r * 15; gx <= r * 15; gx += gridStep) {
      const nx = gx / (r * 16),
        ny = gy / (r * 13);
      if ((nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny <= 0) {
        candidates.push([ox + gx, oy - gy]);
      }
    }
  }

  // 3) Loại gần viền
  const candidNoBorder = candidates.filter(([cx, cy]) => {
    for (let [bx, by] of filtered) {
      if (Math.hypot(cx - bx, cy - by) < heartSize / 2 + borderMargin)
        return false;
    }
    return true;
  });

  // 4) Chọn không chồng
  const minDist = heartSize + 0.7;
  const selected = [];
  for (let [cx, cy] of candidNoBorder) {
    if (!selected.some(([sx, sy]) => Math.hypot(cx - sx, cy - sy) < minDist)) {
      const jitter = Math.min(3, Math.floor(minDist * 0.12));
      selected.push([
        cx + (Math.random() * 2 - 1) * jitter,
        cy + (Math.random() * 2 - 1) * jitter,
      ]);
    }
  }

  // 5) Sắp xếp bắn
  selected.sort((a, b) => {
    const ax = Math.atan2(a[1] - oy, a[0] - ox);
    const bx = Math.atan2(b[1] - oy, b[0] - ox);
    const aAngle = ax < 0 ? ax + Math.PI * 2 : ax;
    const bAngle = bx < 0 ? bx + Math.PI * 2 : bx;
    if (Math.abs(aAngle - bAngle) > 1e-6) return aAngle - bAngle;
    const da = Math.hypot(a[0] - ox, a[1] - oy),
      db = Math.hypot(b[0] - ox, b[1] - oy);
    return db - da;
  });

  heartPositions.push(...selected);
}

// ----------------- Bắn tim -----------------
let index = 0,
  shootIntervalId = null;

function shootHeart() {
  if (!heartPositions.length) generateHeartPositions();
  if (index >= heartPositions.length) {
    if (shootIntervalId) clearInterval(shootIntervalId);
    return;
  }

  const box = document.querySelector(".left-box");
  const bear = document.querySelector(".bear");
  const boxRect = box.getBoundingClientRect();
  const bearRect = bear.getBoundingClientRect();
  const deltaX = 50; // muốn bay sang phải 100px
  const deltaY = 50; // muốn bay lên trên 50px
  // Tọa độ xuất phát của tim **relative với left-box**
  const offsetX = 0; // điều chỉnh để đúng tay gấu
  const offsetY = 0;
  const startX = bearRect.left - boxRect.left + bearRect.width / 2 + offsetX;
  const startY = bearRect.top - boxRect.top + bearRect.height / 2 + offsetY;

  const h = document.createElement("div");
  h.classList.add("small-heart");
  box.appendChild(h); // append vào left-box
  h.style.left = startX + "px";
  h.style.top = startY + "px";
  h.style.opacity = 0;

  const [tx, ty] = heartPositions[index];
  index++;

  requestAnimationFrame(() => {
    h.style.left = tx + "px"; // +offsetX nếu muốn điều chỉnh nữa
    h.style.top = ty + "px"; // +offsetY nếu muốn điều chỉnh nữa
    h.style.opacity = 1;
    h.style.transform = "scale(1)";
  });

  requestAnimationFrame(() => {
    h.style.left = tx + deltaX + "px";
    h.style.top = ty + deltaY + "px";
    h.style.opacity = 1;
    h.style.transform = "scale(1)";
  });
}

// Bắn đều
shootIntervalId = setInterval(shootHeart, 90);
