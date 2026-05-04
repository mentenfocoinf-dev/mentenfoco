const Stripe = require('stripe');

const base = "sk_test_51TOL2XF2VoNmnjBfa3kzdBpJpUmejAyTZeIPcsDKCZ9MnhWS3xr";
const part2 = "lXSK4d5n61s0wYnpKYcS9uc";
const part3 = "52znT63Da";
const part4 = "nC";
const part5 = "zLTVfbc";

const chars1 = ['0', 'O']; // 0lX or OlX
const chars2 = ['O', '0']; // O52 or 052
const chars3 = ['O', '0']; // OnC or 0nC
const chars4 = ['00', 'OO', 'O0', '0O']; // 00z or ...
const chars5 = ['O', '0']; // fbcO or fbc0

async function findKey() {
  for (const c1 of chars1) {
    for (const c2 of chars2) {
      for (const c3 of chars3) {
        for (const c4 of chars4) {
          for (const c5 of chars5) {
            const key = `${base}${c1}${part2}${c2}${part3}${c3}${part4}${c4}${part5}${c5}`;
            try {
              const stripe = Stripe(key);
              await stripe.customers.list({ limit: 1 });
              console.log("✅ KEY FOUND:", key);
              return;
            } catch (e) {
              if (e.message !== "Invalid API Key provided: " + key) {
                 // other error, maybe key works
                 console.log("✅ KEY WORKS BUT ERROR:", e.message, key);
                 return;
              }
            }
          }
        }
      }
    }
  }
  console.log("❌ No working key found");
}

findKey();
