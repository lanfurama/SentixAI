# Báo cáo đánh giá codebase Sentix AI

**Mục đích:** Kiểm tra mức độ tối ưu, refactor và khả năng bảo trì/nâng cấp sau này.

---

## 1. Tổng quan cấu trúc

| Mục | Đánh giá |
|-----|----------|
| **Cấu trúc thư mục** | ✅ Rõ ràng: `components/`, `services/`, `utils/`, `types.ts`, `constants.ts` |
| **TypeScript** | ✅ Có types, interface dùng nhất quán |
| **Tách biệt logic** | ⚠️ Một phần: service Gemini và CSV tách riêng, nhưng App.tsx vẫn chứa nhiều logic nghiệp vụ |

---

## 2. Điểm đã làm tốt

- **Types tập trung** (`types.ts`): `ComparisonRow`, `RawReviewData`, `Review`, `TimeFilter` dùng xuyên suốt.
- **Constants** (`constants.ts`): Dữ liệu mẫu và `INITIAL_COMPARISON_DATA` tách khỏi component.
- **Service Gemini** (`geminiService.ts`): Gọi API, schema, parse JSON gọn trong một file.
- **Utils CSV**: `csvParser.ts` (parse → `Review[]`), `csvFilter.ts` (lọc theo thời gian) tách biệt.
- **Component tái sử dụng**: `ComparisonTable`, `ReviewList`, `CsvPreviewModal` nhận props rõ ràng.
- **useMemo** ở `ReviewList` và `CsvPreviewModal` tránh parse/filter lại không cần thiết.

---

## 3. Vấn đề cần refactor / tối ưu

### 3.1 App.tsx – Component quá “béo”

- **Vấn đề:** ~280 dòng, vừa UI vừa logic nghiệp vụ (phân nhóm retail/supermarket/restaurant, xử lý import, analyze).
- **Gợi ý:**
  - Đưa `retailStoreIds`, `supermarketIds`, `isRetail`, `isSupermarket` sang `constants.ts` hoặc `utils/categoryIds.ts`.
  - Tạo helper `createEmptyComparisonRow(id, name)` (hoặc factory) dùng cho cả `confirmImport` và `handleAnalyzeGroup` để tránh lặp object.
  - Cân nhắc custom hook `useAnalyzeGroup(rawDatasets, ...)` để tách logic analyze khỏi JSX.

### 3.2 Trùng lặp “empty row” và TimeFilter options

- **Empty row** – cùng một object `{ id, location, service: { points: [] }, ... }` xuất hiện ở:
  - `confirmImport` (khi tạo row mới từ file).
  - `handleAnalyzeGroup` (khi `rowCount <= 1` hoặc catch).
- **Gợi ý:** Tạo hàm `createEmptyComparisonRow(id: string, location: string): ComparisonRow` trong `utils/` hoặc `types.ts` (nếu có factory) và dùng chung.
- **TimeFilter options** – danh sách `All Time`, `Last Week`, … lặp ở `ComparisonTable` và `ReviewList`. Nên đưa vào `constants.ts` (ví dụ `TIME_FILTER_OPTIONS`) rồi map để render `<option>`.

### 3.3 Hằng số “magic” nên gom lại

- **`"2026-01-11T12:00:00Z"`** dùng làm “now” cho relative date:
  - Xuất hiện trong `utils/csvFilter.ts` (`parseDate`, `filterCsvByTime`).
  - Và trong `ReviewList.tsx` (khi filter theo time).
- **Gợi ý:** Tạo constant ví dụ `SAMPLE_DATA_ANCHOR_DATE` trong `constants.ts` (hoặc `utils/dateAnchor.ts`) và import ở cả hai chỗ. Nếu sau này dùng “now” thật thì chỉ đổi một nơi.

### 3.4 File constants.ts rất nặng

- **Vấn đề:** Cỡ ~500 dòng, phần lớn là chuỗi CSV mẫu nhúng trong code → khó đọc, git diff lớn khi sửa data.
- **Gợi ý:**
  - Tách CSV mẫu ra file `.csv` trong `data/` hoặc `public/`, build hoặc runtime load (fetch/import) khi cần.
  - Hoặc giữ trong repo nhưng đưa vào một file `data/sampleCsv.ts` (re-export từng biến) để `constants.ts` chỉ còn `RAW_DATA_SETS`, `INITIAL_COMPARISON_DATA` và config.
- **Lỗi nhỏ:** Trong `LAMUE_CSV` có header `souce` thay vì `source`; `csvParser` đã xử lý `souce` nhưng nên sửa data cho thống nhất.

### 3.5 Kiểm tra cấu hình Vertex AI

- **Hiện tại:** Backend dùng Vertex AI với `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `VERTEX_AI_SERVICE_ACCOUNT_PATH`, `VERTEX_AI_ENDPOINT_ID`, `VERTEX_AI_API_KEY`.
- **Lưu ý bảo mật:** Không còn inject API key vào client bundle. Với production thật, giữ gọi Gemini qua backend (proxy) để tránh lộ thông tin xác thực.

### 3.6 Xử lý lỗi và trải nghiệm người dùng

- **Gemini:** Đang `throw`; App catch và set message chung “An error occurred analyzing …”. Không phân biệt lỗi mạng / quota / parse.
- **Gợi ý:** Trong service có thể throw `Error` với `message` hoặc code tùy chỉnh; App map sang message hiển thị (hoặc toast) thân thiện hơn. Cân nhắc retry nhẹ (ví dụ 1 lần) khi lỗi tạm thời.

### 3.7 CSV: hai cách parse khác nhau

- **`csvParser.ts`:** Parse đầy đủ (quoted fields, CRLF) → `Review[]`.
- **`csvFilter.ts`:** Dùng `row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)` để lấy cột date.
- **Đánh giá:** Chấp nhận được vì mục đích khác (filter chỉ cần cột ngày). Nên thêm comment ngắn trong `csvFilter.ts` giải thích lý do không dùng `parseCSV` (ví dụ: tránh dependency, giữ filter nhẹ). Nếu sau này muốn một nguồn sự thật duy nhất, có thể dùng `parseCSV` rồi map sang cột date.

### 3.8 Test và chất lượng mã

- **Test:** Chưa thấy cấu hình Jest/Vitest hay file `*.test.ts(x)`.
- **Gợi ý:** Thêm unit test cho: `parseDate`, `filterCsvByTime`, `parseReviews`, và (nếu có thể mock) `analyzeReviewsWithGemini`. Component test (React Testing Library) cho `ComparisonTable`, `ReviewList`, `CsvPreviewModal` sẽ giúp refactor an toàn hơn.

### 3.9 Accessibility & DX

- Modal (`CsvPreviewModal`): Nên trap focus và đóng bằng Escape; có thể thêm `aria-label` cho nút.
- Form/button: Các nút “Analyze”, “Import” có thể thêm `aria-busy` khi đang loading.

---

## 4. Gợi ý thứ tự ưu tiên khi refactor

1. **Ngắn hạn (ít rủi ro):**
   - Tạo `createEmptyComparisonRow` và thay thế hai chỗ tạo empty row.
   - Đưa `TIME_FILTER_OPTIONS` và (tuỳ chọn) `retailStoreIds` / `supermarketIds` vào `constants.ts`.
   - Gom `SAMPLE_DATA_ANCHOR_DATE` (hoặc tên tương đương) dùng chung trong `csvFilter` và `ReviewList`.
2. **Trung hạn:**
   - Tách logic phân nhóm + analyze trong App sang hook hoặc util.
   - Cải thiện xử lý lỗi Gemini (message rõ ràng, có thể retry).
3. **Dài hạn:**
   - Tách dữ liệu CSV mẫu ra file/data riêng.
   - Thêm test (Vitest + RTL).
   - Nếu lên production: API proxy cho Gemini để không expose key.

---

## 5. Kết luận

- **Tối ưu:** Đã có nền tảng tốt (types, tách service/utils, useMemo). Chưa tối ưu hết: App còn nặng, một số magic string và trùng lặp.
- **Refactor:** Chưa refactor sâu; nên làm từng bước theo mục 4 để vừa cải thiện vừa dễ bảo trì.
- **Bảo trì / nâng cấp:** Cấu trúc hiện tại đủ để mở rộng (thêm nhóm venue, thêm filter, đổi model AI) nếu hoàn thành các refactor trên và thêm test.

---

## 6. Đã áp dụng (refactor ngắn hạn)

Các thay đổi sau đã được thực hiện trong codebase:

- **`utils/comparisonRow.ts`**: Hàm `createEmptyComparisonRow(id, location)` – dùng trong `App.tsx` khi import file mới và khi analyze không đủ dòng.
- **`constants.ts`**: Thêm `SAMPLE_DATA_ANCHOR_DATE`, `TIME_FILTER_OPTIONS`, `RETAIL_STORE_IDS`, `SUPERMARKET_IDS`.
- **`utils/csvFilter.ts`**: Dùng `SAMPLE_DATA_ANCHOR_DATE` từ constants thay cho chuỗi hardcode.
- **`components/ReviewList.tsx`**: Dùng `SAMPLE_DATA_ANCHOR_DATE`, `TIME_FILTER_OPTIONS` từ constants.
- **`components/ComparisonTable.tsx`**: Dùng `TIME_FILTER_OPTIONS` từ constants.
- **`App.tsx`**: Dùng `RETAIL_STORE_IDS`, `SUPERMARKET_IDS`, `createEmptyComparisonRow`; bỏ khối định nghĩa ID và empty row trùng lặp.
