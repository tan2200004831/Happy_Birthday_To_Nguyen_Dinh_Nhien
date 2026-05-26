// index3.js
const card = document.querySelector(".card"); // nếu bạn dùng card toggle
// hoặc không cần card: chạy trực tiếp document.querySelectorAll(...)

function startTypewriterFor(el, speed = 50) {
  const text = el.dataset.text ?? "";
  if (!text) return;

  // tìm hoặc tạo span.tw-text
  let span = el.querySelector(".tw-text");
  if (!span) {
    span = document.createElement("span");
    span.className = "tw-text";
    el.appendChild(span);
  }

  if (span.dataset.typing === "true") return; // tránh chạy chồng
  span.dataset.typing = "true";

  span.textContent = "";
  span.classList.add("caret");

  const chars = Array.from(text);
  let i = 0;

  const id = setInterval(() => {
    if (i < chars.length) {
      span.textContent += chars[i];
      i++;
    } else {
      clearInterval(id);
      span.classList.remove("caret");
      span.dataset.typing = "false";
    }
  }, speed);

  return () => {
    clearInterval(id);
    span.classList.remove("caret");
    span.dataset.typing = "false";
  };
}

// Ví dụ: chạy khi mở card (giữ logic của bạn)
if (card) {
  card.addEventListener("click", () => {
    card.classList.toggle("open");
    if (card.classList.contains("open")) {
      document
        .querySelectorAll(".typewriter")
        .forEach((el) => startTypewriterFor(el, 50));
    }
  });
} else {
  // Nếu muốn chạy ngay:
  // document.querySelectorAll(".typewriter").forEach(el => startTypewriterFor(el, 90));
}

// Chuyển sang trang Baby_photo.html
document.querySelector(".special-btn").addEventListener("click", function () {
  window.location.href = "Baby_photo.html";
});
