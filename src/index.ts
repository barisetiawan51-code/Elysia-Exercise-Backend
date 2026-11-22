import { Elysia, t } from "elysia"; // Mengimpor framework Elysia dan validator skema `t`
import { openapi } from "@elysiajs/openapi"; // Mengimpor plugin OpenAPI untuk dokumentasi endpoint otomatis
import { DivisionByZeroError, formatErrorResponse } from "./errors"; // Mengimpor custom error & formatter error
import { convertTemperature, getBmiCategory } from "./helpers"; // Mengimpor fungsi bantu perhitungan BMI & suhu
import { textPlugin } from "./plugins/text"; // Mengimpor plugin route /text

// Skema runtime TypeBox untuk memastikan nilai satuan suhu hanya "c", "f", atau "k"
const tempUnitSchema = t.Union([t.Literal("c"), t.Literal("f"), t.Literal("k")]);

// Membuat instance utama Elysia menggunakan method chaining (menyambung method bertahap)
export const app = new Elysia()
  // Mendaftarkan plugin OpenAPI agar dokumentasi bisa diakses di http://localhost:3000/openapi
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
  // 1. Hook `onRequest`: berjalan paling awal saat request masuk ke server
  .onRequest(({ request }) => {
    console.log(`[${request.method}] ${request.url}`); // Mencatat metode HTTP dan URL yang diakses
  })
  // 2. Hook `derive`: menambahkan properti baru ke context khusus untuk request yang sedang berjalan
  // Bersifat stateless karena dibuat baru per request, tidak disimpan ke variabel global
  .derive(() => ({
    requestId: crypto.randomUUID(), // ID unik tiap request
    startTime: performance.now(), // Waktu mulai request (dalam milidetik)
  }))
  // 3. Hook `onAfterHandle`: berjalan setelah route handler selesai, sebelum response dikirim ke klien
  .onAfterHandle(({ requestId, startTime, set }) => {
    const elapsedMs = Math.max(0, performance.now() - startTime); // Menghitung lama proses request
    set.headers["X-Request-Id"] = requestId; // Menyisipkan header ID request
    set.headers["X-Response-Time"] = `${elapsedMs.toFixed(2)}ms`; // Menyisipkan header durasi respons
  })
  // 4. Hook `onError`: menangkap error yang dilempar di route/hook dan menyeragamkan format JSON-nya
  .onError(({ code, error, set }) => {
    // Jika error adalah DivisionByZeroError, kembalikan status 400 dan format seragam
    if (error instanceof DivisionByZeroError) {
      set.status = error.status;
      return formatErrorResponse(error, error.code);
    }

    // Jika gagal validasi skema `t`, Elysia memberi code "VALIDATION" -> set status HTTP 422
    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: "Invalid request data",
        code: "VALIDATION_ERROR",
      };
    }

    // Jika path/URL tidak cocok dengan route mana pun -> set status HTTP 404
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Route not found",
        code: "NOT_FOUND",
      };
    }

    // Fallback untuk error lain -> gunakan status >= 400 jika sudah ada, atau 500
    const statusCode =
      typeof set.status === "number" && set.status >= 400 ? set.status : 500;
    set.status = statusCode;
    return formatErrorResponse(error, String(code));
  })
  // Route dasar GET /: mengembalikan objek JSON sederhana
  .get("/", () => ({ message: "Toolbox API" }))
  // Route GET /greet/:name?lang=en|id: membaca path param `name` dan query param `lang`
  .get(
    "/greet/:name",
    ({ params, query }) => {
      const lang = query.lang ?? "en"; // Jika `lang` tidak dikirim, pakai default "en"
      const greeting = lang === "id" ? "Halo" : "Hello"; // Pilih sapaan sesuai bahasa
      return `${greeting}, ${params.name}`; // Mengembalikan string sapaan
    },
    {
      // Validasi path parameter `:name` minimal 1 karakter
      params: t.Object({ name: t.String({ minLength: 1 }) }),
      // Validasi query parameter `lang` bersifat opsional, hanya boleh "en" atau "id" jika diisi
      query: t.Object({
        lang: t.Optional(t.Union([t.Literal("en"), t.Literal("id")])),
      }),
    }
  )
  // Route POST /bmi: menghitung BMI dari body JSON `{ weight, height }`
  .post(
    "/bmi",
    ({ body }) => {
      // Rumus BMI: berat (kg) / (tinggi (m) * tinggi (m)), dibulatkan 2 desimal
      const bmi = Number((body.weight / (body.height * body.height)).toFixed(2));
      return {
        bmi,
        category: getBmiCategory(bmi),
      };
    },
    {
      body: t.Object({
        // `exclusiveMinimum: 0` berarti nilai harus > 0 (0 dan angka negatif akan ditolak -> 422)
        weight: t.Number({ exclusiveMinimum: 0 }),
        height: t.Number({ exclusiveMinimum: 0 }),
      }),
    }
  )
  // Route GET /convert/temperature: konversi suhu lewat query string
  .get(
    "/convert/temperature",
    ({ query }) => {
      const result = convertTemperature(query.value, query.from, query.to);
      return {
        value: query.value,
        from: query.from,
        to: query.to,
        result,
      };
    },
    {
      query: t.Object({
        value: t.Numeric(), // Mengubah nilai query string (misal "30") menjadi number
        from: tempUnitSchema,
        to: tempUnitSchema,
      }),
    }
  )
  // Memasang plugin route `/text/count`, `/text/reverse`, dan `/text/slug`
  .use(textPlugin)
  // Route GET /math/divide: membagi `a` dengan `b`, melempar DivisionByZeroError jika `b === 0`
  .get(
    "/math/divide",
    ({ query }) => {
      if (query.b === 0) {
        throw new DivisionByZeroError(); // Otomatis diteruskan ke `.onError(...)`
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
  // Mengelompokkan route di bawah prefix "/secure" dan memasang guard
  .group("/secure", (group) =>
    group
      // `.guard(...)`: middleware yang melindungi seluruh route di dalam grup `/secure`
      .guard({
        // `beforeHandle`: berjalan sebelum handler route dijalankan
        beforeHandle({ headers, set }) {
          // Cek header `x-api-key`; jika tidak sama dengan "secret123", kembalikan status 401
          if (headers["x-api-key"] !== "secret123") {
            set.status = 401;
            return {
              error: "Unauthorized: missing or invalid x-api-key",
              code: "UNAUTHORIZED",
            };
          }
        },
      })
      // Route GET /secure/time: hanya bisa diakses jika lolos `beforeHandle` di atas
      .get("/time", () => ({
        serverTime: new Date().toISOString(), // Waktu server saat ini dalam format ISO-8601
      }))
  )
  // Endpoint WebSocket /ws/echo: mengirim balik pesan yang diterima dalam bentuk HURUF KAPITAL
  .ws("/ws/echo", {
    // `message`: terpanggil setiap kali klien mengirim pesan lewat koneksi WebSocket
    message(ws, message) {
      const text = typeof message === "string" ? message : JSON.stringify(message);
      ws.send(text.toUpperCase()); // Mengirim balasan ke klien
    },
  })
  // Menjalankan HTTP & WebSocket server di port 3000
  .listen(3000);

console.log(`Toolbox API running at http://${app.server?.hostname}:${app.server?.port}`); // Log alamat server aktif