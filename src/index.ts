import { Elysia, t } from "elysia";
import { openapi } from "@elysiajs/openapi"; // Plugin dokumentasi API otomatis (Swagger/Scalar)
import { DivisionByZeroError, formatErrorResponse } from "./errors";
import { textPlugin } from "./plugins/text";

// Type Union di TypeScript: membatasi nilai variabel hanya boleh "c", "f", atau "k"
type TempUnit = "c" | "f" | "k";

// Fungsi logika konversi suhu
function convertTemperature(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return value; // Jika satuan asal & tujuan sama, langsung kembalikan nilainya

  // Tahap 1: Ubah semua satuan ke Celsius sebagai patokan tengah
  let celsius: number;
  if (from === "c") celsius = value;
  else if (from === "f") celsius = ((value - 32) * 5) / 9;
  else celsius = value - 273.15;

  // Tahap 2: Ubah dari Celsius ke satuan tujuan
  let result: number;
  if (to === "c") result = celsius;
  else if (to === "f") result = (celsius * 9) / 5 + 32;
  else result = celsius + 273.15;

  // `.toFixed(2)` membulatkan jadi 2 angka di belakang koma (hasilnya string), lalu `Number(...)` mengubahnya kembali jadi angka
  return Number(result.toFixed(2));
}

// Fungsi menentukan kategori BMI dengan Union Return Type
function getBmiCategory(bmi: number): "Underweight" | "Normal" | "Overweight" | "Obese" {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

// Skema validasi runtime Elysia untuk satuan suhu (ekuivalen dengan `type TempUnit` di atas)
const tempUnitSchema = t.Union([t.Literal("c"), t.Literal("f"), t.Literal("k")]);

// Inisialisasi aplikasi utama Elysia dengan pola Method Chaining (.use().onRequest()...)
export const app = new Elysia()
  // Mendaftarkan plugin OpenAPI agar dokumentasi bisa diakses di /openapi
  .use(
    openapi({
      path: "/openapi",
      documentation: {
        info: {
          title: "Toolbox API",
          version: "1.0.0",
          description: "Stateless utility API built with Elysia and Bun",
        },
      },
    })
  )
  // 1. Lifecycle `onRequest`: selalu berjalan paling pertama saat ada request masuk
  .onRequest(({ request }) => {
    console.log(`[${request.method}] ${request.url}`);
  })
  // 2. Lifecycle `derive`: menyuntikkan properti baru (requestId & startTime) ke dalam context request
  .derive(() => ({
    requestId: crypto.randomUUID(), // Membuat ID unik acak untuk melacak request
    startTime: performance.now(), // Mencatat waktu mulai eksekusi (dalam milidetik)
  }))
  // 3. Global Error Handler: menangkap semua error yang terjadi di seluruh route
  .onError(({ code, error, set }) => {
    // Jika error adalah DivisionByZeroError
    if (error instanceof DivisionByZeroError) {
      set.status = error.status; // Set HTTP status ke 400
      return formatErrorResponse(error, error.code);
    }

    // Jika request gagal melewati validasi skema `t`
    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
      };
    }

    // Jika URL endpoint tidak ditemukan
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Route not found",
        code: "NOT_FOUND",
      };
    }

    // Fallback untuk error lainnya (default status 500 Internal Server Error)
    const statusCode =
      typeof set.status === "number" && set.status >= 400 ? set.status : 500;
    set.status = statusCode;

    return formatErrorResponse(error, String(code));
  })
  // 4. Lifecycle `onAfterHandle`: berjalan setelah handler selesai memproses data, sebelum response dikirim
  .onAfterHandle(({ requestId, startTime, set }) => {
    const durationMs = Math.max(0, performance.now() - startTime); // Hitung durasi proses
    set.headers["X-Request-Id"] = requestId; // Tambahkan custom header ID request
    set.headers["X-Response-Time"] = `${durationMs.toFixed(2)}ms`; // Tambahkan header lama eksekusi
  })
  // Route dasar: GET /
  .get("/", () => ({ message: "Toolbox API" }))
  // Route dengan Path Parameter (`:name`) dan Query Parameter (`?lang=...`)
  .get(
    "/greet/:name",
    ({ params, query }) => {
      const lang = query.lang ?? "en"; // Default bahasa "en" jika query `lang` tidak dikirim
      const greeting = lang === "id" ? "Halo" : "Hello";
      return `${greeting}, ${params.name}`;
    },
    {
      // Validasi `:name` minimal 1 karakter
      params: t.Object({ name: t.String({ minLength: 1 }) }),
      // Validasi `?lang=` opsional, jika diisi hanya boleh "en" atau "id"
      query: t.Object({
        lang: t.Optional(t.Union([t.Literal("en"), t.Literal("id")])),
      }),
    }
  )
  // Route POST dengan validasi JSON Body
  .post(
    "/bmi",
    ({ body }) => {
      const rawBmi = body.weight / (body.height * body.height);
      const bmi = Number(rawBmi.toFixed(2));
      return {
        bmi,
        category: getBmiCategory(bmi),
      };
    },
    {
      body: t.Object({
        // `exclusiveMinimum: 0`: angka harus lebih besar dari 0 (tidak boleh 0 atau negatif)
        weight: t.Number({ exclusiveMinimum: 0 }),
        height: t.Number({ exclusiveMinimum: 0 }),
      }),
    }
  )
  // Route GET dengan validasi Query String
  .get(
    "/convert/temperature",
    ({ query }) => {
      const converted = convertTemperature(query.value, query.from, query.to);
      return {
        value: query.value,
        from: query.from,
        to: query.to,
        result: converted,
      };
    },
    {
      query: t.Object({
        // `t.Numeric()`: mengonversi string angka dari URL query (misal "30") menjadi tipe `number`
        value: t.Numeric(),
        from: tempUnitSchema,
        to: tempUnitSchema,
      }),
    }
  )
  // Menggabungkan seluruh route dari `textPlugin` (/text/count, /text/reverse, /text/slug)
  .use(textPlugin)
  // Route pembagian yang bisa memicu custom error
  .get(
    "/math/divide",
    ({ query }) => {
      if (query.b === 0) {
        throw new DivisionByZeroError(); // Lempar error; akan ditangkap otomatis oleh `.onError()`
      }
      return {
        a: query.a,
        b: query.b,
        result: query.a / query.b,
      };
    },
    {
      query: t.Object({
        a: t.Numeric(),
        b: t.Numeric(),
      }),
    }
  )
  // `.group()`: mengelompokkan route di bawah awalan URL "/secure"
  .group("/secure", (group) =>
    group
      // `.guard()`: menerapkan aturan (middleware) ke semua route di dalam grup ini
      .guard({
        // `beforeHandle`: dijalankan tepat sebelum handler route dieksekusi
        beforeHandle({ headers, set }) {
          const apiKey = headers["x-api-key"];
          if (apiKey !== "secret123") {
            set.status = 401; // Tolak akses jika API key salah/kosong
            return {
              error: "Unauthorized: invalid or missing x-api-key",
              code: "UNAUTHORIZED",
            };
          }
        },
      })
      // Endpoint ini menjadi GET /secure/time dan otomatis terlindungi oleh guard di atas
      .get("/time", () => ({
        serverTime: new Date().toISOString(),
      }))
  )
  // `.ws()`: mendefinisikan endpoint WebSocket untuk komunikasi dua arah real-time
  .ws("/ws/echo", {
    // Terpanggil setiap kali klien mengirim pesan ke server WebSocket
    message(ws, message) {
      const text = typeof message === "string" ? message : JSON.stringify(message);
      ws.send(text.toUpperCase()); // Balas pesan dalam huruf kapital
    },
  })
  // Menjalankan server pada port 3000
  .listen(3000);

console.log(`Toolbox API running at http://${app.server?.hostname}:${app.server?.port}`);