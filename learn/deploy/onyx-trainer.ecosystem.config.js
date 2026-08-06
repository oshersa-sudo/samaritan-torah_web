// pm2 ecosystem for the multi-subject trainer on the shared onyx-study VPS.
// Isolated: its own folder, its own pm2 name, its own port, its own SQLite DB.
// Start:  pm2 start learn/deploy/onyx-trainer.ecosystem.config.js && pm2 save
// Stop :  pm2 delete onyx-trainer     (only ever touches THIS app)
module.exports = {
  apps: [{
    name: "onyx-trainer",
    cwd: "/root/onyx-trainer/learn",
    script: "/root/onyx-trainer/venv/bin/gunicorn",
    interpreter: "none",                     // run the binary directly
    args: "onyx_app:app -b 127.0.0.1:3001 -w 2 --timeout 60",
    env: {
      LEARN_DB: "/root/onyx-trainer/data/learn.db",  // DB stays inside this app
      LEARN_DEV: "1",                                // codes returned until SMTP set
      APP_VERSION: "1.0",
      // Pixabay free API key → real, kid-safe photos for concrete words
      // (falls back to emoji on any miss). The key is a read-only free-tier
      // key and is embedded in the page for the browser to query Pixabay
      // directly, so it is not a secret.
      PIXABAY_KEY: "56860993-5e9530afd69d12c263f7a242f"
    },
    max_restarts: 10,
    autorestart: true
  }]
};
