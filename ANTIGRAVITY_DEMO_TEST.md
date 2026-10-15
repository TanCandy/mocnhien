# Demo Test Run — Instructions for Antigravity Agent (Gemini Flash)

> Bạn là agent QA. Nhiệm vụ: **dựng stack local, chạy toàn bộ kiểm thử, chạy kịch bản demo trên trình duyệt, và viết báo cáo**.
> Bạn **được phép sửa code** để fix lỗi tìm thấy (xem PHASE 10). Mọi thay đổi phải ghi vào báo cáo.
> Làm tuần tự từng PHASE. Mỗi PHASE xong mới sang PHASE sau. Không bỏ bước.

---

## 0. LUẬT CỨNG (đọc trước, tuân thủ tuyệt đối)

1. **KHÔNG dùng database thật.** Không đọc, không copy, không dùng bất kỳ file `.env` nào nằm ngoài repo (ví dụ `D:\Downloads\.env`) và không tạo `backend/.env` trỏ tới MongoDB Atlas. Toàn bộ demo chạy trên **MongoDB in-memory** do `test-evidence/scripts/devstack.cjs` tự dựng.
2. Được sửa code trong `src/`, `backend/`, `e2e/`, `test-evidence/scripts/` **chỉ ở PHASE 10** (sau khi đã có báo cáo lỗi). Không sửa test chỉ để nó pass khi app thật sự sai — sửa app. Không thêm dependency mới trừ khi bắt buộc.
3. **KHÔNG** `git commit`, `git push`, `git reset`, `git checkout --`, `git clean`. Không xoá file.
4. **KHÔNG** gửi email thật, không gọi webhook Google Sheets thật, không nhập thông tin tài chính thật. Tài khoản test duy nhất được dùng là các tài khoản seed ở mục 2.
5. Máy là **Windows 11 + PowerShell 5.1**: không dùng `&&` — dùng `;` hoặc `if ($?) { ... }`. Đường dẫn có dấu cách → luôn bọc trong dấu nháy kép.
6. Lệnh chạy lâu (server) phải chạy ở **terminal nền riêng**, không chặn terminal chính.
7. Nếu một bước fail 2 lần liên tiếp với cùng lỗi → ghi vào báo cáo là FAIL kèm log, **đi tiếp** bước sau. Không lặp vô hạn.

---

## 1. BỐI CẢNH DỰ ÁN

- Tên: **Mộc Nhiên Authentic** — quản lý đơn hàng mua hộ Mỹ → Việt Nam.
- Frontend: React 19 + Vite + Tailwind, port **3000** (proxy `/api` → `:4000`).
- Backend: Express 5 + Mongoose, thư mục `backend/`, port **4000**, health check `GET http://localhost:4000/health`.
- Root repo: `D:\personal stuff\Side Job\mocnhien`
- Node yêu cầu ≥ 20 (máy đang có v24).

Các port dùng trong demo:

| Port  | Thành phần                                                        |
|-------|-------------------------------------------------------------------|
| 3000  | Vite dev server (giao diện)                                        |
| 4000  | Backend API                                                       |
| 4999  | Control server của devstack (`/reseed`, `/restart`, `/reset-token`) |
| 27018 | MongoDB in-memory                                                 |

---

## 2. DỮ LIỆU SEED (devstack tạo sẵn)

Mật khẩu chung: `E2e-Pass-123`

| Vai trò | Email                  | Tên          |
|---------|------------------------|--------------|
| Admin   | `admin-e2e@test.local` | Admin E2E    |
| Khách A | `khach-a@test.local`   | Nguyen Van A |
| Khách B | `khach-b@test.local`   | Tran Thi B   |

9 đơn hàng mẫu, ví dụ: `ORD-20261001-A001` (Khách A, Laptop stand, $59.99, **pending**, chưa trả), `ORD-20260819-A001` (Khách B, Túi Coach, shipping, chưa trả), `ORD-20260806-A001` (Khách A, delivered, đã trả đủ).

Control server:
- `GET http://localhost:4999/reseed` → xoá sạch, seed lại, restart backend (dùng giữa các phase).
- `GET http://localhost:4999/restart` → restart backend (reset rate limiter đăng nhập khi bị 429).

SePay webhook key trong devstack: `e2e-sepay-key`.

---

## PHASE 1 — Chuẩn bị (preflight)

Tạo thư mục kết quả:

```powershell
New-Item -ItemType Directory -Force "test-evidence\demo-run\logs", "test-evidence\demo-run\screenshots" | Out-Null
```

Kiểm tra môi trường, ghi output vào `test-evidence\demo-run\logs\00-preflight.log`:

```powershell
node -v; npm -v
Get-NetTCPConnection -LocalPort 3000,4000,4999,27018 -State Listen -ErrorAction SilentlyContinue
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
Test-Path ".playwright-browsers"
```

- Nếu có port đang bị chiếm → ghi lại PID và **dừng**, hỏi người dùng (không tự kill process lạ).
- Nếu `node_modules` thiếu ở root hoặc `backend/`: chạy `npm ci` ở root, sau đó `npm ci` trong `backend`.
- Nếu `.playwright-browsers` không tồn tại: `$env:PLAYWRIGHT_BROWSERS_PATH="$PWD\.playwright-browsers"; npx playwright install chromium`.

✅ Tiêu chí qua: Node ≥ 20, 4 port trống, dependency đủ.

---

## PHASE 2 — Kiểm tra tĩnh + unit test (không cần server)

Chạy lần lượt, mỗi lệnh ghi log riêng (dùng `*>&1 | Tee-Object`):

```powershell
npm run lint *>&1 | Tee-Object "test-evidence\demo-run\logs\10-lint.log"
npm test *>&1 | Tee-Object "test-evidence\demo-run\logs\11-frontend-test.log"
cd backend; npm test *>&1 | Tee-Object "..\test-evidence\demo-run\logs\12-backend-test.log"; cd ..
npm run build:fe *>&1 | Tee-Object "test-evidence\demo-run\logs\13-build.log"
```

Ghi lại cho mỗi lệnh: exit code, số test pass/fail, thời gian. Backend test dùng mongodb-memory-server, không cần cấu hình gì.

✅ Tiêu chí qua: lint 0 lỗi, tất cả test pass, build thành công.

---

## PHASE 3 — Dựng stack demo

**Terminal nền #1 — backend + DB in-memory + seed:**

```powershell
node test-evidence/scripts/devstack.cjs *>&1 | Tee-Object "test-evidence\demo-run\logs\20-devstack.log"
```

Chờ đến khi log có đủ 3 dòng: `[devstack] seeded 3 users, 9 orders`, `[devstack] backend spawned on :4000`, `[devstack] control on :4999`.

**Terminal nền #2 — frontend:**

```powershell
npm run dev *>&1 | Tee-Object "test-evidence\demo-run\logs\21-vite.log"
```

**Terminal chính — health check:**

```powershell
Invoke-RestMethod http://localhost:4000/health
(Invoke-WebRequest http://localhost:3000 -UseBasicParsing).StatusCode
```

✅ Tiêu chí qua: `/health` trả OK, trang `:3000` trả 200.

---

## PHASE 4 — Bộ flow API tự động

```powershell
node test-evidence/scripts/flows-api.cjs *>&1 | Tee-Object "test-evidence\demo-run\logs\30-flows-api.log"
```

- Script tự gọi `/reseed` giữa các nhóm. Các nhóm: `auth profile orders admin payments public matrix`.
- Kết quả JSON: `test-evidence/logs/flows-api.json` và `test-evidence/logs/permission-matrix.json` (copy cả hai vào `test-evidence/demo-run/logs/`).
- Dòng cuối log có dạng `X pass, Y fail, Z skip / N`. Ghi lại con số này.
- Các mục SKIP (SEC-02 email thật, SEC-03 Google Sheets thật) là **dự kiến**, không tính là lỗi.

Nếu một nhóm fail vì `429 Too Many Requests` → chạy `Invoke-RestMethod http://localhost:4999/restart`, rồi chạy lại riêng nhóm đó, ví dụ: `node test-evidence/scripts/flows-api.cjs auth`.

---

## PHASE 5 — Bộ flow UI tự động (Chrome headless + screenshot)

```powershell
Invoke-RestMethod http://localhost:4999/reseed
node test-evidence/scripts/flows-ui.cjs *>&1 | Tee-Object "test-evidence\demo-run\logs\40-flows-ui.log"
```

- Các nhóm: `auth guard orders track profile admin mobile robust`.
- Ảnh chụp ra `test-evidence/screenshots/ui-*.png`, kết quả ra `test-evidence/logs/flows-ui.json` → copy vào `test-evidence/demo-run/`.
- Ghi lại tổng pass/fail/skip.

---

## PHASE 6 — Playwright E2E

```powershell
Invoke-RestMethod http://localhost:4999/reseed
npx playwright test *>&1 | Tee-Object "test-evidence\demo-run\logs\50-playwright.log"
```

- Config dùng `reuseExistingServer: true` nên sẽ dùng luôn stack ở PHASE 3.
- 2 spec: `e2e/comprehensive.spec.ts`, `e2e/interactive-deep.spec.ts`.
- Báo cáo HTML: `playwright-report/index.html`. Test fail có ảnh/trace trong `test-results/`.
- Nếu test fail vì login bị 429 → `/restart` rồi chạy lại riêng spec đó: `npx playwright test e2e/<file>.spec.ts`.

---

## PHASE 7 — Kịch bản DEMO thủ công trên trình duyệt (Antigravity browser)

Trước khi bắt đầu: `Invoke-RestMethod http://localhost:4999/reseed`.
Mỗi bước có 📸 → chụp màn hình, lưu `test-evidence/demo-run/screenshots/<mã bước>.png`.
Mỗi bước ghi: **Kỳ vọng / Thực tế / PASS-FAIL**. Đồng thời mở DevTools console — có lỗi đỏ thì ghi lại.

### D1 — Trang công khai (chưa đăng nhập)
1. Mở `http://localhost:3000/` → thấy tiêu đề "Mộc Nhiên", nút "Create Order Now". 📸 `D1-home`
2. `/calculator` → nhập cân nặng `3.5`, chọn "Hỏa tốc" → hiện "Tổng cước dự tính" và "Phụ phí hỏa tốc". 📸 `D1-calculator`
3. `/support` → hiển thị kênh liên hệ. 📸 `D1-support`
4. `/trang-khong-ton-tai` → trang 404 tuỳ chỉnh. 📸 `D1-404`

### D2 — Bảo vệ route
1. Chưa đăng nhập vào `/dashboard`, `/profile`, `/admin/orders` → đều bị chuyển về `/login`.
2. Đăng nhập sai mật khẩu → hiện thông báo lỗi, không vào được. 📸 `D2-login-wrong`

### D3 — Khách hàng tạo đơn
1. Đăng nhập `khach-a@test.local` / `E2e-Pass-123` → vào `/dashboard`, thấy danh sách đơn của Khách A (KHÔNG thấy đơn của Khách B). 📸 `D3-dashboard`
2. Mở modal tạo đơn, nhập sản phẩm "Demo MacBook", giá **1299** USD, điền các trường bắt buộc, gửi. 📸 `D3-create-modal`
3. Kiểm tra đơn mới xuất hiện, giá hiển thị đúng **$1,299** (không bị cắt thành $1 hay $12). 📸 `D3-order-created`
4. Mở modal lần nữa và bấm `Esc` → modal đóng.
5. Mở `/order-detail/<id đơn mới>` → thấy chi tiết + timeline trạng thái. 📸 `D3-order-detail`
6. Vào `/admin/orders` bằng tài khoản khách → bị chuyển về `/`.
7. Đăng xuất.

### D4 — Admin xử lý đơn
1. Đăng nhập `admin-e2e@test.local`.
2. `/admin/dashboard` → thấy số liệu tổng quan. 📸 `D4-admin-dashboard`
3. `/admin/orders` → thấy đơn "Demo MacBook" vừa tạo. Lọc theo trạng thái `pending`. 📸 `D4-admin-orders`
4. Duyệt + báo giá đơn đó (tỉ giá ví dụ 25600) → trạng thái thành `approved`, tổng VND = USD × tỉ giá. 📸 `D4-approved`
5. Bấm **Export Excel** → file `.xlsx` được tải về. Ghi tên file + dung lượng. (Chỉ tải file do chính app sinh ra.)
6. Tìm user của chính mình trong trang quản lý người dùng → thử xoá / hạ quyền chính mình → **phải bị chặn**. 📸 `D4-self-protect`

### D5 — Thanh toán VietQR + SePay webhook giả lập
1. Đăng nhập Khách A, mở chi tiết đơn `ORD-20261001-A001` → hiển thị mã VietQR với số tiền còn lại và nội dung chứa mã đơn. 📸 `D5-vietqr`
2. Từ terminal, giả lập ngân hàng báo có tiền (một phần) cho đơn đó:

```powershell
$body = @{
  id = 990001; gateway = "MSB"; transactionDate = "2026-10-15 10:00:00"
  accountNumber = "80002725995"; transferType = "in"; transferAmount = 500000
  content = "ORD-20261001-A001 thanh toan"; referenceCode = "FT990001"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/payments/webhook/sepay `
  -Headers @{ Authorization = "Apikey e2e-sepay-key" } -ContentType "application/json" -Body $body
```

3. Reload trang chi tiết đơn → "đã trả" tăng 500,000 VND, "còn lại" giảm tương ứng. 📸 `D5-partial-paid`
4. Gửi lại **đúng** request trên lần nữa (cùng `id`) → số tiền **không** bị cộng 2 lần (idempotency).
5. Gửi request với header sai key (`Apikey wrong`) → phải bị từ chối với HTTP 401.
6. Gửi request với `content = "khong co ma don"` và `id = 990002` → đăng nhập admin, vào `/admin/payments` → giao dịch nằm trong danh sách chưa khớp, có thể gán thủ công cho một đơn. 📸 `D5-unmatched`

### D6 — Tra cứu & hồ sơ
1. Khách A vào `/tracking`, gõ `ORD-20261001-A001` rồi bấm Track → hiện thông tin đơn. 📸 `D6-tracking`
2. `/profile` → đổi số điện thoại → hiện toast thành công, reload vẫn giữ giá trị mới. 📸 `D6-profile`

### D7 — Responsive
Đặt viewport 375×812, lặp lại nhanh `/`, `/dashboard`, `/order-detail/<id>` → không tràn ngang, menu dùng được. 📸 `D7-mobile-*`

---

## PHASE 8 — Dọn dẹp

1. Dừng terminal nền #2 (Vite) và #1 (devstack) bằng `Ctrl+C`.
2. Kiểm tra port đã trống: `Get-NetTCPConnection -LocalPort 3000,4000,4999,27018 -State Listen -ErrorAction SilentlyContinue` → không còn kết quả.
3. Không xoá bất kỳ file nào đã sinh ra.
4. `git status` → liệt kê mọi file source đã sửa ở PHASE 10 vào báo cáo; không được có file nào bị sửa ngoài danh sách đó.

---

## PHASE 9 — Báo cáo

Tạo `test-evidence/demo-run/DEMO_REPORT.md` theo mẫu:

```markdown
# Demo Test Report — Mộc Nhiên Authentic
Ngày chạy: <YYYY-MM-DD HH:mm> · Agent: Antigravity / Gemini Flash · Node: <version>

## Tóm tắt
| Phase | Kết quả | Pass | Fail | Skip | Ghi chú |
|-------|---------|------|------|------|---------|
| 2 Lint / Unit / Build | | | | | |
| 4 Flows API | | | | | |
| 5 Flows UI | | | | | |
| 6 Playwright E2E | | | | | |
| 7 Demo thủ công | | | | | |

Kết luận: SẴN SÀNG DEMO / CHƯA SẴN SÀNG (lý do)

## Lỗi phát hiện
Mỗi lỗi một mục:
### BUG-01 <tiêu đề ngắn>
- Mức độ: Critical / High / Medium / Low
- Bước tái hiện: …
- Kỳ vọng: …
- Thực tế: …
- Bằng chứng: <đường dẫn log / screenshot>
- File nghi ngờ (nếu đoán được): …

## Chi tiết demo thủ công
| Mã | Bước | Kỳ vọng | Thực tế | Kết quả | Screenshot |
|----|------|---------|---------|---------|------------|

## Console error / request lỗi ghi nhận
…

## Mục SKIP dự kiến
- Gửi email thật (Resend) — không có key trong môi trường test
- Đồng bộ Google Sheets thật — không cấu hình WEBHOOK_URL
```

Quy tắc viết báo cáo:
- Chỉ ghi điều **đã thực sự quan sát**. Không đoán kết quả. Bước nào không chạy được → ghi "KHÔNG CHẠY" + lý do.
- Mọi FAIL phải có đường dẫn bằng chứng.
- Mức độ: Critical = mất dữ liệu / lộ dữ liệu người khác / sai tiền; High = chức năng chính hỏng; Medium = lỗi có cách né; Low = giao diện/chữ.

---

## PHASE 10 — Fix lỗi và chạy lại

Với từng BUG trong báo cáo, theo thứ tự Critical → Low:
1. Tìm nguyên nhân gốc trong code (không vá triệu chứng).
2. Sửa tối thiểu, đúng phong cách code xung quanh. Nếu phù hợp, thêm test tái hiện lỗi (`backend/tests/` hoặc `src/**/*.test.ts`).
3. Chạy lại test liên quan + `npm run lint` + `npm test` + `cd backend; npm test`.
4. Nếu lỗi nằm ở test/script (không phải app) → sửa test/script và ghi rõ lý do.
5. Dựng lại stack (PHASE 3) và chạy lại PHASE 4–6 một lần cuối.

Thêm vào `DEMO_REPORT.md` mục **"## Đã sửa"**: mỗi BUG → file đã sửa, mô tả thay đổi, kết quả chạy lại. BUG nào không sửa được → ghi lý do. Cập nhật bảng tóm tắt với số liệu **sau khi sửa**.

Vẫn tuân thủ luật cứng: không commit/push, không dùng DB thật, không xoá file. Dọn dẹp (PHASE 8) ở cuối cùng.

Cuối cùng in ra màn hình: đường dẫn `DEMO_REPORT.md`, bảng tóm tắt (trước/sau sửa), danh sách BUG theo mức độ và trạng thái đã sửa.
