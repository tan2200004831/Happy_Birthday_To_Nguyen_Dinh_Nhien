const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

// Phục vụ toàn bộ file tĩnh từ thư mục gốc
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Server chạy ở http://localhost:${PORT}`);
});
