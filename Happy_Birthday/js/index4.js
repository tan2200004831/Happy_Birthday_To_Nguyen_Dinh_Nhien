// index4.js - tạo grid ảnh + hiệu ứng bay + click mở trang
document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("photoGrid");

  // === DANH SÁCH ẢNH ===
  const images = [
    "Happy_Birthday/images/Qua_cute.jpg",
    "Happy_Birthday/images/Qua_dep.jpg",
    "Happy_Birthday/images/Qua_deppp.jpg",
    "Happy_Birthday/images/1.jpg",
    "Happy_Birthday/images/2.jpg",
    "Happy_Birthday/images/3.jpg",
    "Happy_Birthday/images/4.jpg",
    "Happy_Birthday/images/5.jpg",
    "Happy_Birthday/images/6.jpg",
    "Happy_Birthday/images/7.jpg",
    "Happy_Birthday/images/8.jpg",
    "Happy_Birthday/images/9.jpg",
    "Happy_Birthday/images/10.jpg",
    "Happy_Birthday/images/11.jpg",
    "Happy_Birthday/images/12.jpg",
    "Happy_Birthday/images/13.jpg",
    "Happy_Birthday/images/14.jpg",
    "Happy_Birthday/images/15.jpg",
    "Happy_Birthday/images/16.jpg",
    "Happy_Birthday/images/17.jpg",
    "Happy_Birthday/images/18.jpg",
    "Happy_Birthday/images/19.jpg",
    "Happy_Birthday/images/20.jpg",
    "Happy_Birthday/images/21.jpg",
    "Happy_Birthday/images/22.jpg",
    "Happy_Birthday/images/23.jpg",
    "Happy_Birthday/images/24.jpg",
    "Happy_Birthday/images/25.jpg",
    "Happy_Birthday/images/26.jpg",
    "Happy_Birthday/images/27.jpg",
    "Happy_Birthday/images/28.jpg",
    "Happy_Birthday/images/29.jpg",
    "Happy_Birthday/images/30.jpg",
    "Happy_Birthday/images/31.jpg",
    "Happy_Birthday/images/32.jpg",
    "Happy_Birthday/images/33.jpg",
    "Happy_Birthday/images/34.jpg",
    "Happy_Birthday/images/35.jpg",
    "Happy_Birthday/images/36.jpg",
    "Happy_Birthday/images/37.jpg",
    "Happy_Birthday/images/38.jpg",
    "Happy_Birthday/images/39.jpg",
    "Happy_Birthday/images/40.jpg",
    "Happy_Birthday/images/41.jpg",
    "Happy_Birthday/images/42.jpg",
    "Happy_Birthday/images/43.jpg"
  ];

  // === MAP ẢNH -> TRANG CHUYỂN ===
  const clickMap = {
    "Happy_Birthday/images/Qua_cute.jpg": "index5.html",
  };

  // === TẠO DANH SÁCH TILE ===
  const desiredTiles = Math.max(images.length, 12);
  const pool = [];
  for (let i = 0; i < desiredTiles; i++) {
    pool.push(images[i % images.length]);
  }

  grid.innerHTML = "";

  pool.forEach((src, i) => {
    const tile = document.createElement("div");
    tile.className = "tile";

    const img = document.createElement("img");
    img.src = src;
    img.alt = `image ${i + 1}`;

    // Nếu ảnh không load được
    img.onerror = () => {
      console.error("Image failed to load:", src);
      img.style.display = "none";
      tile.style.background = "#f8eaf0";
    };

    // Nếu ảnh này nằm trong clickMap → cho phép click
    for (const key in clickMap) {
      if (src === key) {
        tile.classList.add("clickable"); // CSS sẽ hiển thị cursor pointer
        tile.addEventListener("click", () => {
          tile.style.transition = "transform 0.2s ease";
          tile.style.transform = "scale(0.95)";
          setTimeout(() => (window.location.href = clickMap[key]), 150);
        });
      }
    }

    tile.appendChild(img);
    grid.appendChild(tile);

    // Hiệu ứng xuất hiện bay từ trái sang
    const baseDelay = 5500; // nhanh và mượt hơn 6000
    const stagger = i * baseDelay * 0.06 + Math.random() * 180;
    setTimeout(() => tile.classList.add("show"), 200 + stagger);
  });
});
