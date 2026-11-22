// Mengimpor fungsi pengujian bawaan Bun runtime
import { describe, expect, it } from "bun:test";
// Mengimpor Eden Treaty: klien HTTP yang membaca tipe TypeScript langsung dari aplikasi Elysia
import { treaty } from "@elysiajs/eden";
import { app } from "../src/index";

// Membuat klien API yang type-safe berdasarkan definisi `typeof app`
const client = treaty<typeof app>("http://localhost:3000");

// `describe`: mengelompokkan sekumpulan skenario pengujian dalam satu suite
describe("Toolbox API", () => {
  // `it`: mendefinisikan satu kasus pengujian (test case)
  it("1. GET / returns Toolbox API and lifecycle headers", async () => {
    // `app.handle(...)`: mensimulasikan HTTP request langsung ke Elysia di memori (tanpa perlu server eksternal)
    const res = await app.handle(new Request("http://localhost:3000/"));
    expect(res.status).toBe(200); // Memastikan status HTTP 200 OK
    expect(res.headers.get("X-Request-Id")).toBeTruthy(); // Memastikan header dari onAfterHandle ada
    expect(res.headers.get("X-Response-Time")).toMatch(/ms$/); // Memastikan format diakhiri "ms"
    expect(await res.json()).toEqual({ message: "Toolbox API" }); // Memastikan isi JSON sesuai
  });

  it("2. GET /greet/:name supports en and id via Eden Treaty", async () => {
    // Menggunakan Eden Treaty: path `/greet/:name` dipanggil layaknya fungsi TypeScript biasa
    const enRes = await client.greet({ name: "Manu" }).get({ query: { lang: "en" } });
    expect(enRes.status).toBe(200);
    expect(enRes.data).toBe("Hello, Manu");

    const idRes = await client.greet({ name: "Manu" }).get({ query: { lang: "id" } });
    expect(idRes.status).toBe(200);
    expect(idRes.data).toBe("Halo, Manu");
  });

  it("3. POST /bmi calculates BMI and returns 422 on invalid input", async () => {
    // Skenario input valid
    const valid = await app.handle(
      new Request("http://localhost:3000/bmi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: 70, height: 1.75 }),
      })
    );
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({ bmi: 22.86, category: "Normal" });

    // Skenario input tidak valid (melanggar exclusiveMinimum: 0 -> harus 422)
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

    // Menguji satuan invalid ("x") yang tidak ada di `tempUnitSchema`
    const badUnit = await app.handle(
      new Request("http://localhost:3000/convert/temperature?value=30&from=x&to=f")
    );
    expect(badUnit.status).toBe(422);
  });

  it("5. POST /text/count, /text/reverse, and /text/slug work via plugin", async () => {
    // Menguji endpoint dari `textPlugin`
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

    const revRes = await app.handle(
      new Request("http://localhost:3000/text/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "abc" }),
      })
    );
    expect(await revRes.json()).toEqual({ reversed: "cba" });

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
    // Tanpa header `x-api-key` -> ditolak guard dengan status 401
    const unauthorized = await app.handle(
      new Request("http://localhost:3000/secure/time")
    );
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({
      error: "Unauthorized: invalid or missing x-api-key",
      code: "UNAUTHORIZED",
    });

    // Dengan header `x-api-key: secret123` -> lolos guard dengan status 200
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
    // Pembagian dengan 0 memicu DivisionByZeroError -> ditangkap onError -> status 400
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