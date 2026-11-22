import { describe, expect, it } from "bun:test"; // Fungsi bawaan Bun untuk menulis unit/integration test
import { treaty } from "@elysiajs/eden"; // Klien HTTP type-safe dari Eden Treaty untuk memanggil API
import { app } from "../src/index"; // Mengimpor instance `app` agar bisa diuji langsung

// Membuat klien Eden Treaty berdasarkan tipe `typeof app`
const client = treaty<typeof app>("http://localhost:3000");

// `describe`: membungkus beberapa test case yang saling berkaitan
describe("Toolbox API", () => {
  // `it`: satu skenario pengujian spesifik
  it("1. GET / returns Toolbox API and lifecycle headers", async () => {
    // `app.handle(...)`: mengirim Request simulasi ke aplikasi tanpa perlu membuka port baru
    const res = await app.handle(new Request("http://localhost:3000/"));
    expect(res.status).toBe(200); // Memastikan status HTTP 200
    expect(res.headers.get("X-Request-Id")).toBeTruthy(); // Memastikan header dari `onAfterHandle` terpasang
    expect(res.headers.get("X-Response-Time")).toMatch(/ms$/); // Memastikan format waktu respons berakhiran "ms"
    expect(await res.json()).toEqual({ message: "Toolbox API" }); // Memastikan body JSON sesuai
  });

  it("2. GET /greet/:name supports en and id via Eden Treaty", async () => {
    // Memanggil endpoint `/greet/:name` dengan autocomplete & type-checking dari Eden Treaty
    const enRes = await client.greet({ name: "Manu" }).get({ query: { lang: "en" } });
    expect(enRes.status).toBe(200);
    expect(enRes.data).toBe("Hello, Manu");

    const idRes = await client.greet({ name: "Manu" }).get({ query: { lang: "id" } });
    expect(idRes.status).toBe(200);
    expect(idRes.data).toBe("Halo, Manu");
  });

  it("3. POST /bmi calculates BMI and returns 422 on invalid input", async () => {
    // Uji input valid (weight & height > 0)
    const valid = await app.handle(
      new Request("http://localhost:3000/bmi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: 70, height: 1.75 }),
      })
    );
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({ bmi: 22.86, category: "Normal" });

    // Uji input tidak valid (0 dan -1 melanggar `exclusiveMinimum: 0`) -> harus menghasilkan 422
    const invalid = await app.handle(
      new Request("http://localhost:3000/bmi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: 0, height: -1 }),
      })
    );
    expect(invalid.status).toBe(422);
  });

  it("4. GET /convert/temperature converts units and validates enum", async () => {
    // Uji konversi 30°C ke Fahrenheit (harus 86°F)
    const res = await app.handle(
      new Request("http://localhost:3000/convert/temperature?value=30&from=c&to=f")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      value: 30,
      from: "c",
      to: "f",
      result: 86,
    });

    // Uji satuan tidak valid ("x") -> harus ditolak dengan status 422
    const badUnit = await app.handle(
      new Request("http://localhost:3000/convert/temperature?value=30&from=x&to=f")
    );
    expect(badUnit.status).toBe(422);
  });

  it("5. POST /text/count, /text/reverse, and /text/slug work via plugin", async () => {
    // Uji endpoint `/text/count` dari plugin
    const countRes = await app.handle(
      new Request("http://localhost:3000/text/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello World" }),
      })
    );
    expect(countRes.status).toBe(200);
    expect(await countRes.json()).toEqual({
      characters: 11,
      words: 2,
      vowels: 3,
    });

    // Uji endpoint `/text/reverse` dari plugin
    const revRes = await app.handle(
      new Request("http://localhost:3000/text/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "abc" }),
      })
    );
    expect(await revRes.json()).toEqual({ reversed: "cba" });

    // Uji endpoint `/text/slug` dari plugin
    const slugRes = await app.handle(
      new Request("http://localhost:3000/text/slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello World!" }),
      })
    );
    expect(await slugRes.json()).toEqual({ slug: "hello-world" });
  });

  it("6. GET /secure/time enforces x-api-key header (401 vs 200)", async () => {
    // Tanpa header `x-api-key` -> harus mengembalikan 401
    const unauthorized = await app.handle(
      new Request("http://localhost:3000/secure/time")
    );
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({
      error: "Unauthorized: missing or invalid x-api-key",
      code: "UNAUTHORIZED",
    });

    // Dengan header `x-api-key: secret123` -> harus mengembalikan 200 dan `serverTime`
    const authorized = await app.handle(
      new Request("http://localhost:3000/secure/time", {
        headers: { "x-api-key": "secret123" },
      })
    );
    expect(authorized.status).toBe(200);
    const body = (await authorized.json()) as { serverTime: string };
    expect(typeof body.serverTime).toBe("string");
  });

  it("7. GET /math/divide throws DivisionByZeroError in unified error format", async () => {
    // Membagi dengan 0 (`b=0`) -> harus mengembalikan status 400 dan format `{ error, code }`
    const res = await app.handle(
      new Request("http://localhost:3000/math/divide?a=10&b=0")
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Cannot divide by zero",
      code: "DIVISION_BY_ZERO",
    });
  });
});