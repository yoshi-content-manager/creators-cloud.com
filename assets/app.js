/* ================================
   Creators Cloud – waitlist capture
   Uses Supabase anon key for INSERT only.
   Table: public.waitlist_leads
   ================================ */

const SUPABASE_URL = "https://api-dev.creators-cloud.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MTIyNDAwLCJleHAiOjE5MTI4ODg4MDB9.6KDkb4AjPbqZclRiTTxahyQhtlNk3mfcTrOwOs_9fJE";

let supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  // Year in footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // UTM + referrer capture
  const params = new URLSearchParams(window.location.search);
  const setIf = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.value = params.get(key) || "";
  };
  setIf("utm_source", "utm_source");
  setIf("utm_medium", "utm_medium");
  setIf("utm_campaign", "utm_campaign");
  const ref = document.getElementById("referrer");
  if (ref) ref.value = document.referrer || "";

  // Init Supabase
  if (!window.supabase) {
    console.error("Supabase script not loaded");
    return;
  }
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
      global: { headers: { "x-cc-site": "creators-cloud-landing" } },
    }
  );

  const form = document.getElementById("waitlist-form");
  const statusEl = document.getElementById("form-status");
  const submitBtn = document.getElementById("submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";
    statusEl.className = "";
    submitBtn.classList.add("loading");
    submitBtn.setAttribute("disabled", "true");

    // Normalize inputs & make regex more lax
    const normalize = (s) => (s || "").trim().replace(/^@+/, ""); // strip leading @
    const creator_handle = normalize(form.creator_handle.value);
    const contact_value = normalize(form.contact_value.value);
    const notes = (form.notes.value || "").trim();

    const utm_source = form.utm_source.value || null;
    const utm_medium = form.utm_medium.value || null;
    const utm_campaign = form.utm_campaign.value || null;
    const referrer = form.referrer.value || null;

    // Minimal validation: just make sure we have content and not absurd length
    if (creator_handle.length < 2 || contact_value.length < 2) {
      showError("Please add your handle and a way to contact you.");
      return resetBtn();
    }
    if (creator_handle.length > 80 || contact_value.length > 200) {
      showError("That looks a bit long—please shorten your handle or contact.");
      return resetBtn();
    }

    // Debounce duplicate submits locally (5s)
    const last = Number(localStorage.getItem("wl_last")) || 0;
    const now = Date.now();
    if (now - last < 5000) {
      showError("Please wait a moment before submitting again.");
      return resetBtn();
    }

    const payload = {
      creator_handle,
      contact_value,
      notes: notes || null,
      utm_source,
      utm_medium,
      utm_campaign,
      referrer,
      user_agent: navigator.userAgent.slice(0, 500),
    };

    try {
      const { data, error } = await supabaseClient
        .from("waitlist_leads")
        .insert(payload)
        .select("id, created_at")
        .single();

      if (error) throw error;

      localStorage.setItem("wl_last", String(now));
      form.reset();
      showSuccess(
        "Thanks! You’re on the list. We’ll reach out for onboarding."
      );
      window.dispatchEvent(
        new CustomEvent("waitlist:joined", { detail: data })
      );
    } catch (err) {
      if (
        String(err?.message || "")
          .toLowerCase()
          .includes("duplicate")
      ) {
        showSuccess("You’re already on the list—thanks! We’ll be in touch.");
      } else {
        console.error(err);
        showError("Something went wrong. Please try again in a minute.");
      }
    } finally {
      resetBtn();
    }

    function resetBtn() {
      submitBtn.classList.remove("loading");
      submitBtn.removeAttribute("disabled");
    }
    function showError(msg) {
      statusEl.textContent = msg;
      statusEl.className = "error";
    }
    function showSuccess(msg) {
      statusEl.textContent = msg;
      statusEl.className = "success";
    }
  });
});
