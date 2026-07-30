/*
 * מנוע ההגייה – מבוסס על Web Speech API המובנה בדפדפן.
 * עובד מקומית, ללא אינטרנט, בקול אנגלי-אמריקאי אם זמין.
 */
const Speech = (() => {
  let voices = [];
  let preferred = null;

  function loadVoices() {
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    // עדיפות: אנגלית אמריקאית → כל אנגלית → קול ברירת מחדל
    preferred =
      voices.find(v => /en[-_]US/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang)) ||
      voices[0] || null;
  }

  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function supported() {
    return typeof window.speechSynthesis !== "undefined" &&
           typeof window.SpeechSynthesisUtterance !== "undefined";
  }

  function speak(text, rate) {
    if (!supported()) {
      alert("הדפדפן הזה אינו תומך בהגייה קולית. נסו בדפדפן Chrome / Edge עדכני.");
      return;
    }
    window.speechSynthesis.cancel();     // עצירת הגייה קודמת
    if (!preferred) loadVoices();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = preferred ? preferred.lang : "en-US";
    if (preferred) u.voice = preferred;
    u.rate = rate || 0.9;                // מעט לאט – ברור יותר ללמידה
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  return { supported, speak, loadVoices, listVoices: () => voices };
})();
