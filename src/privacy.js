import {CLOSE_ICON_SVG} from "./ui-utils.js";

const contact = '<a href="mailto:setsaathi@gmail.com">setsaathi@gmail.com</a>';

const pages = {
  about: {
    kicker: "ABOUT THE APP",
    title: "Built for better training.",
    content: `<p>SetSaathi is a workout planning and tracking app. Members can build training plans, review exercise instructions, record workouts and attendance, track body measurements, and ask the AI Coach training questions. Gym managers have a separate workspace for gym details and member records.</p>
      <h3>Our aim</h3><p>We want training to be easier to follow and progress easier to understand. Plans and guidance are tools to support your decisions; they do not replace a qualified trainer or healthcare professional.</p>
      <h3>Information and feedback</h3><p>For product questions, accessibility feedback, support, privacy requests or information about SetSaathi, email ${contact}. We review reports about inaccurate exercise information or content rights through the same address.</p>`
  },
  privacy: {
    kicker: "YOUR INFORMATION",
    title: "Privacy at SetSaathi",
    content: `<p>This notice describes the personal information SetSaathi processes when you use the app or contact us.</p>
      <h3>Information you provide</h3><p>We collect account details (name, username, email, mobile number and password), gym and membership details, reported gym equipment, workout settings and plans, attendance and exercise progress, and height or weight measurements you enter. Gym managers may enter gym contact details and member records in their workspace. Messages you send us may include your contact details and the content of your request.</p>
      <h3>Why we use it</h3><p>We use these details to create and secure accounts, sign you in, recover access, generate and display plans, track workouts and measurements, show gym information, manage membership records, answer support requests and improve the app. We send a password reset email only when one is requested for an account.</p>
      <h3>AI Coach and gym search</h3><p>When you ask AI Coach a question, the question and relevant saved workout information and exercise instructions may be sent to an AI service to prepare a reply. Questions and answers may also be saved in the app to reuse an answer. Searching for a gym may send your search terms to a mapping service. Avoid including sensitive medical details in questions or searches.</p>
      <h3>Who may receive information</h3><p>Service providers help us host the app, store data, deliver requested emails, find gym listings and generate AI replies. Authorised administrators can access registered account information needed to run the service. Gym managers can access records in their own workspace. We do not sell personal information.</p>
      <h3>Browser storage and retention</h3><p>Your browser keeps sign-in information, a saved plan and recent AI Coach messages between visits. Signing out removes the sign-in information from that browser; Clear chat removes its local conversation copy. These actions do not delete server-side account, workout or saved AI answer records. We keep information while it is needed to operate the service and handle requests, and may retain it longer where required by law or for legitimate security and recordkeeping needs.</p>
      <h3>Security</h3><p>We use access controls and other safeguards appropriate to the service. No online service can promise absolute security. Protect your password and contact us if you think your account has been misused.</p>
      <h3>Your choices and requests</h3><p>You can edit your profile and clear local AI Coach messages in the app. For access, correction, account or data deletion, withdrawal of consent where applicable, a privacy question or a complaint, email ${contact}. We may verify that the account belongs to you before acting. We will handle requests in line with applicable law. You may also use any complaint route available to you under applicable law.</p>
      <h3>Body measurements</h3><p>BMI categories are for adults 20+ and BMI does not account for muscle mass. <a href="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html" target="_blank" rel="noopener noreferrer">See BMI categories</a>.</p>
      <h3>Changes to this notice</h3><p>We may update this notice as the app changes. The date below identifies the version shown here.</p>
      <p class="policy-updated">Last updated: 25 November 2026</p>`
  },
  terms: {
    kicker: "USING SETSAATHI",
    title: "Terms & Guidance",
    content: `<p>These terms explain the ground rules for using SetSaathi. By using the app, you agree to use it lawfully and provide accurate information where the app asks for it. If you do not agree, stop using the app and contact us about your account.</p>
      <h3>Your account and entries</h3><p>Keep your sign-in details private. You are responsible for information entered through your account, including gym, equipment and membership details. Do not impersonate others, enter information you are not authorised to share, interfere with the service or misuse another person's account. Gym managers should enter and access member records only when they have authority to do so.</p>
      <h3>Training and AI guidance</h3><p>Workout plans, exercise instructions, BMI information and AI Coach answers are general fitness information. They are not medical advice, diagnosis or treatment, and may contain errors. Consider your condition, equipment and surroundings before exercising. Stop if a movement causes pain or feels unsafe and seek qualified advice when needed.</p>
      <h3>Content and copyright</h3><p>The SetSaathi name, branding, original app design and original content are protected to the extent allowed by applicable law. Exercise images, demonstrations and other third-party material may have separate owners and licences; source and licence details are shown where available. Using the app does not transfer ownership of any content to you. You may use the service for its intended personal or authorised gym-management purposes; do not copy or redistribute its content in ways that infringe rights.</p>
      <h3>Report a rights concern</h3><p>If you believe material in the app infringes your copyright or other rights, email ${contact} with your name and contact details, the work you own or represent, the exact material and location in SetSaathi, and enough information for us to assess the concern. We may ask for clarification and will review substantiated reports.</p>
      <h3>Service availability and responsibility</h3><p>Features, exercise information and availability may change. We try to keep the service useful, but cannot promise uninterrupted access or error-free information. To the extent allowed by applicable law, SetSaathi is not responsible for harm caused by relying on inaccurate general guidance or by using the service contrary to these terms. Nothing here removes rights or remedies that cannot lawfully be excluded.</p>
      <h3>Questions and complaints</h3><p>For help, a content report, a complaint or more information about these terms, email ${contact}. These terms may be updated as the service changes; the date below identifies the version shown here.</p>
      <p class="policy-updated">Last updated: 25 November 2026</p>`
  }
};

function openInformation(pageKey, trigger) {
  const page = pages[pageKey];
  if (!page) return;
  document.querySelector(".privacy-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "privacy-overlay";
  overlay.innerHTML = `<section class="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="information-title" tabindex="-1">
    <button type="button" class="privacy-close modal-close-button" aria-label="Close ${pageKey} information">${CLOSE_ICON_SVG}</button>
    <p class="eyebrow">${page.kicker}</p><h2 id="information-title">${page.title}</h2>
    <div class="privacy-content">${page.content}</div>
  </section>`;
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKeydown); trigger?.focus(); };
  const onKeydown = event => {
    if (event.key === "Escape") close();
    if (event.key !== "Tab") return;
    const items = [...overlay.querySelectorAll("button, a[href]")];
    if (!items.length) return;
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  };
  overlay.querySelector(".privacy-close").addEventListener("click", close);
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", onKeydown);
  document.body.append(overlay);
  overlay.querySelector(".privacy-close").focus();
}

function createInformationFooter() {
  if (document.querySelector(".site-privacy-footer")) return;
  const footer = document.createElement("footer");
  footer.className = "site-privacy-footer";
  footer.innerHTML = `<span class="footer-copyright">© ${new Date().getFullYear()} SetSaathi</span><nav aria-label="Information"><button type="button" data-information="about">About us</button><span class="footer-separator" aria-hidden="true">|</span><button type="button" data-information="privacy">Privacy</button><span class="footer-separator" aria-hidden="true">|</span><button type="button" data-information="terms">Terms & Guidance</button></nav><a class="footer-contact" href="mailto:setsaathi@gmail.com">Contact</a>`;
  footer.addEventListener("click", event => {
    const button = event.target.closest("[data-information]");
    if (button) openInformation(button.dataset.information, button);
  });
  document.body.append(footer);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createInformationFooter);
else createInformationFooter();
