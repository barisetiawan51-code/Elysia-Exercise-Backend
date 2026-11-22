// Mendefinisikan class error kustom yang mewarisi (extends) class bawaan JavaScript 'Error'
export class DivisionByZeroError extends Error {
  // 'public readonly': properti bisa dibaca dari luar class, tapi tidak bisa diubah nilainya
  public readonly status = 400; // Kode status HTTP untuk Bad Request
  public readonly code = "DIVISION_BY_ZERO"; // Kode identitas error

  // 'constructor': fungsi yang otomatis jalan saat kita memanggil `new DivisionByZeroError()`
  // `message = "..."`: nilai default jika saat pemanggilan tidak diisi pesan khusus
  constructor(message = "Cannot divide by zero") {
    super(message); // Wajib dipanggil untuk mengirim pesan ke class induk (Error)
    this.name = "DivisionByZeroError"; // Menimpa nama default "Error" dengan nama class ini
  }
}

// Fungsi pembantu (helper) untuk menyeragamkan bentuk JSON response saat terjadi error
// `error: unknown`: tipe aman di TypeScript (wajib dicek tipenya dulu sebelum dipakai)
// `codeOverride?: string`: tanda '?' berarti parameter ini opsional (boleh tidak diisi)
export function formatErrorResponse(error: unknown, codeOverride?: string) {
  // 1. Cek apakah error berasal dari class DivisionByZeroError buatan kita
  if (error instanceof DivisionByZeroError) {
    return {
      error: error.message,
      code: error.code,
    };
  }

  // 2. Cek apakah error merupakan Error standar JavaScript/TypeScript
  if (error instanceof Error) {
    return {
      error: error.message,
      // Operator '??' (Nullish Coalescing): pakai nilai kanan jika codeOverride bernilai null/undefined
      code: codeOverride ?? "INTERNAL_SERVER_ERROR",
    };
  }

  // 3. Fallback jika yang dilempar (throw) bukan objek Error (misal string atau angka biasa)
  return {
    error: "An unexpected error occurred",
    code: codeOverride ?? "UNKNOWN_ERROR",
  };
}