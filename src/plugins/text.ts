import { Elysia, t } from "elysia"; // Mengimpor framework Elysia dan 't' (TypeBox untuk validasi skema)

// Mendefinisikan aturan bentuk request body: wajib objek dengan properti 'text' bertipe string
const textBodySchema = t.Object({
  text: t.String(),
});

// Helper 1: Menghitung jumlah huruf vokal
function countVowels(input: string): number {
  // `.match(/[aeiou]/gi)`: mencari semua huruf vokal; 'g' = global (semua), 'i' = case-insensitive
  const matches = input.match(/[aeiou]/gi);
  // Jika ditemukan kembalikan panjang array-nya, jika tidak (null) kembalikan 0
  return matches ? matches.length : 0;
}

// Helper 2: Menghitung jumlah kata
function countWords(input: string): number {
  const trimmed = input.trim(); // Hapus spasi berlebih di awal dan akhir teks
  if (!trimmed) return 0; // Jika string kosong, jumlah kata = 0
  // `.split(/\s+/)`: memecah teks menjadi array berdasarkan satu atau lebih spasi/enter/tab
  return trimmed.split(/\s+/).length;
}

// Helper 3: Mengubah kalimat menjadi format URL-friendly (slug)
function toSlug(input: string): string {
  return input
    .toLowerCase()                  // Ubah semua ke huruf kecil
    .trim()                         // Hapus spasi di awal & akhir
    .replace(/[^a-z0-9\s-]/g, "")   // Hapus karakter selain huruf, angka, spasi, dan tanda '-'
    .replace(/\s+/g, "-")           // Ubah satu/lebih spasi menjadi satu tanda '-'
    .replace(/-+/g, "-")            // Gabungkan tanda '-' yang berurutan (misal "---" -> "-")
    .replace(/^-|-$/g, "");         // Hapus tanda '-' jika muncul di paling awal atau paling akhir
}

// Membuat instance Elysia terpisah sebagai Plugin
// `prefix: "/text"`: otomatis menambahkan awalan "/text" ke semua route di dalamnya
// `name: "text-plugin"`: memberi identitas nama unik pada plugin
export const textPlugin = new Elysia({ prefix: "/text", name: "text-plugin" })
  // Endpoint: POST /text/count
  .post(
    "/count",
    // Destructuring `{ body }`: mengambil isi request body yang sudah tervalidasi
    ({ body }) => ({
      characters: body.text.length,
      words: countWords(body.text),
      vowels: countVowels(body.text),
    }),
    { body: textBodySchema } // Menerapkan validasi skema pada body
  )
  // Endpoint: POST /text/reverse
  .post(
    "/reverse",
    ({ body }) => ({
      // `[...body.text]`: memecah string jadi array karakter (aman untuk emoji/unicode) lalu dibalik
      reversed: [...body.text].reverse().join(""),
    }),
    { body: textBodySchema }
  )
  // Endpoint: POST /text/slug
  .post(
    "/slug",
    ({ body }) => ({
      slug: toSlug(body.text),
    }),
    { body: textBodySchema }
  );